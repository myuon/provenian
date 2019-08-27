package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/guregu/dynamo"
	"github.com/pkg/errors"
	"github.com/satori/go.uuid"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

var storageBucketName = os.Getenv("storageBucketName")
var problemTableName = os.Getenv("problemTableName")
var problemDraftTableName = os.Getenv("problemDraftTableName")

type ProblemRepo struct {
	s3c          s3.S3
	problemTable dynamo.Table
	draftTable   dynamo.Table
}

type LanguageFiles struct {
	Isabelle []string `json:"isabelle" dynamo:"isabelle"`
}

func (files LanguageFiles) ListLanguages() []string {
	var langs []string

	if len(files.Isabelle) > 0 {
		langs = append(langs, "isabelle")
	}

	return langs
}

type Problem struct {
	ID          string        `json:"id" dynamo:"id"`
	Version     string        `json:"version" dynamo:"version"`
	Title       string        `json:"title" dynamo:"title"`
	ContentType string        `json:"content_type" dynamo:"-"`
	Content     string        `json:"content" dynamo:"-"`
	CreatedAt   int64         `json:"created_at" dynamo:"created_at"`
	UpdatedAt   int64         `json:"updated_at" dynamo:"updated_at"`
	Writer      string        `json:"writer" dynamo:"writer"`
	Files       LanguageFiles `json:"files" dynamo:"files"`
	Languages   []string      `json:"languages" dynamo:"-"`
}

func NewProblem(id string, title string, contentType string, content string, userID string, files LanguageFiles) Problem {
	return Problem{
		ID:          id,
		Version:     "1.0",
		Title:       title,
		ContentType: contentType,
		Content:     content,
		UpdatedAt:   time.Now().Unix(),
		CreatedAt:   time.Now().Unix(),
		Writer:      userID,
		Files:       files,
		Languages:   files.ListLanguages(),
	}
}

func filepath(problemID string, draft bool) string {
	if draft {
		return problemID + ".draft.json"
	}

	return problemID + ".json"
}

func filepathAttachment(problemID string, language string, filename string, draft bool) string {
	if draft {
		return "draft/" + problemID + "/" + language + "/" + filename
	}

	return problemID + "/" + language + "/" + filename
}

func (repo ProblemRepo) doGet(problemID string, draft bool) (Problem, error) {
	out, err := repo.s3c.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(storageBucketName),
		Key:    aws.String(filepath(problemID, draft)),
	})
	if err != nil {
		return Problem{}, err
	}

	buf := new(bytes.Buffer)
	buf.ReadFrom(out.Body)

	var problem Problem
	if err := json.Unmarshal(buf.Bytes(), &problem); err != nil {
		return Problem{}, err
	}

	return problem, nil
}

func (repo ProblemRepo) doPut(problemID string, problem Problem, draft bool) error {
	json, err := json.Marshal(problem)
	if err != nil {
		return err
	}

	if draft {
		if err := repo.draftTable.Put(problem).Run(); err != nil {
			return err
		}
	} else {
		if err := repo.problemTable.Put(problem).Run(); err != nil {
			return err
		}
	}

	if _, err := repo.s3c.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(storageBucketName),
		Key:    aws.String(filepath(problemID, draft)),
		Body:   aws.ReadSeekCloser(strings.NewReader(string(json))),
	}); err != nil {
		return err
	}

	return nil
}

func (repo ProblemRepo) saveAttachment(problemID string, language string, filename string, code string, draft bool) error {
	if _, err := repo.s3c.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(storageBucketName),
		Key:    aws.String(filepathAttachment(problemID, language, filename, draft)),
		Body:   aws.ReadSeekCloser(strings.NewReader(code)),
	}); err != nil {
		return err
	}

	return nil
}

// read draft attachment file and copy to public attachment
func (repo ProblemRepo) publishAttachment(problemID string, language string, filename string) error {
	out, err := repo.s3c.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(storageBucketName),
		Key:    aws.String(filepathAttachment(problemID, language, filename, true)),
	})
	if err != nil {
		return err
	}

	buf := new(bytes.Buffer)
	buf.ReadFrom(out.Body)

	if err := repo.saveAttachment(problemID, language, filename, buf.String(), false); err != nil {
		return err
	}

	return nil
}

func (repo ProblemRepo) publishIndex() error {
	var problems []Problem
	if err := repo.problemTable.Scan().All(&problems); err != nil {
		return errors.Wrap(err, "failed to scan")
	}

	body, err := json.Marshal(problems)
	if err != nil {
		return errors.Wrap(err, "failed to marshal")
	}

	if _, err := repo.s3c.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(storageBucketName),
		Key:    aws.String("index.json"),
		Body:   aws.ReadSeekCloser(strings.NewReader(string(body))),
	}); err != nil {
		return errors.Wrap(err, "failed to put object")
	}

	return nil
}

type Attachment struct {
	Code     string `json:"code"`
	Filename string `json:"filename"`
	Language string `json:"language"`
}

type CreateProblemInput struct {
	Title       string       `json:"title"`
	ContentType string       `json:"content_type"`
	Content     string       `json:"content"`
	Attachments []Attachment `json:"attachments"`
}

// This is always "draft" mode
func (repo ProblemRepo) doCreate(userID string, input CreateProblemInput) error {
	problemID := uuid.NewV4().String()

	files := LanguageFiles{}
	for _, attachment := range input.Attachments {
		if attachment.Language == "isabelle" {
			files.Isabelle = append(files.Isabelle, attachment.Filename)
		} else {
			return errors.New("Unsupported language: " + attachment.Language)
		}
	}

	// In case LanguageFiles contains unsupported language file,
	// separate the for-loop so that we don't mind to undo the putObject actions
	for _, attachment := range input.Attachments {
		if err := repo.saveAttachment(problemID, attachment.Language, attachment.Filename, attachment.Code, true); err != nil {
			return err
		}
	}

	problem := NewProblem(problemID, input.Title, input.ContentType, input.Content, userID, files)

	if err := repo.doPut(problemID, problem, true); err != nil {
		return err
	}

	return nil
}

type UpdateProblemInput struct {
	Title       string `json:"title"`
	ContentType string `json:"content_type"`
	Content     string `json:"content"`
}

func (repo ProblemRepo) doUpdate(problemID string, userID string, input UpdateProblemInput) error {
	prev, err := repo.doGet(problemID, true)
	if err != nil {
		return err
	}

	if prev.Writer != userID {
		return errors.New("unauthorized")
	}

	prev.Title = input.Title
	prev.Content = input.Content
	prev.UpdatedAt = time.Now().Unix()

	return repo.doPut(problemID, prev, true)
}

func (repo ProblemRepo) doListWriterProblems(userID string, draft bool) ([]Problem, error) {
	var problems []Problem
	if err := repo.draftTable.Get("writer", userID).Index("writer").All(&problems); err != nil {
		return nil, err
	}

	return problems, nil
}

func (repo ProblemRepo) doPublish(problemID string, userID string) error {
	problem, err := repo.doGet(problemID, true)
	if err != nil {
		return errors.Wrap(err, "failed to get")
	}

	if err := repo.doPut(problemID, problem, false); err != nil {
		return errors.Wrap(err, "failed to put")
	}

	files := problem.Files
	for _, filename := range files.Isabelle {
		repo.publishAttachment(problemID, "isabelle", filename)
	}

	return repo.publishIndex()
}

func handler(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	sess := session.Must(session.NewSession())
	ddb := dynamo.New(sess)

	problemRepo := ProblemRepo{
		s3c:          *s3.New(sess),
		problemTable: ddb.Table(problemTableName),
		draftTable:   ddb.Table(problemDraftTableName),
	}

	if event.Resource == "/problems/{problemId}/edit" && event.HTTPMethod == "PUT" {
		var input UpdateProblemInput
		if err := json.Unmarshal([]byte(event.Body), &input); err != nil {
			return events.APIGatewayProxyResponse{
				StatusCode: 400,
			}, nil
		}

		if err := problemRepo.doUpdate(event.PathParameters["problemId"], event.RequestContext.Authorizer["sub"].(string), input); err != nil {
			panic(err)
		}

		return events.APIGatewayProxyResponse{
			StatusCode: 204,
			Headers: map[string]string{
				"Access-Control-Allow-Origin": "*",
			},
		}, nil
	} else if event.Resource == "/problems/{problemId}/publish" && event.HTTPMethod == "PUT" {
		if err := problemRepo.doPublish(event.PathParameters["problemId"], event.RequestContext.Authorizer["sub"].(string)); err != nil {
			fmt.Printf("%+v", err)
			panic(err)
		}

		return events.APIGatewayProxyResponse{
			StatusCode: 204,
			Headers: map[string]string{
				"Access-Control-Allow-Origin": "*",
			},
		}, nil
	} else if event.HTTPMethod == "POST" {
		var input CreateProblemInput
		if err := json.Unmarshal([]byte(event.Body), &input); err != nil {
			return events.APIGatewayProxyResponse{
				StatusCode: 400,
			}, nil
		}

		if err := problemRepo.doCreate(event.RequestContext.Authorizer["sub"].(string), input); err != nil {
			panic(err)
		}

		return events.APIGatewayProxyResponse{
			StatusCode: 201,
			Headers: map[string]string{
				"Access-Control-Allow-Origin": "*",
			},
		}, nil
	} else if event.HTTPMethod == "GET" {
		problems, err := problemRepo.doListWriterProblems(event.RequestContext.Authorizer["sub"].(string), true)
		if err != nil {
			panic(err)
		}

		body, _ := json.Marshal(problems)

		return events.APIGatewayProxyResponse{
			StatusCode: 200,
			Headers: map[string]string{
				"Access-Control-Allow-Origin": "*",
			},
			Body: string(body),
		}, nil
	}

	panic("unreachable")
}

func main() {
	lambda.Start(handler)
}
