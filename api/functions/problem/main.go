package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/guregu/dynamo"
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

type Problem struct {
	ID          string            `json:"-" dynamo:"id"`
	Version     string            `json:"version" dynamo:"version"`
	Title       string            `json:"title" dynamo:"title"`
	ContentType string            `json:"content_type" dynamo:"-"`
	Content     string            `json:"content" dynamo:"-"`
	Template    map[string]string `json:"template" dynamo:"-"`
	UpdatedAt   int64             `json:"updated_at" dynamo:"updated_at"`
	Writer      string            `json:"writer" dynamo:"writer"`
	Files       []string          `json:"files" dynamo:"files"`
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

type Attachment struct {
	Code     string `json:"code"`
	Filename string `json:"filename"`
	Language string `json:"language"`
}

type CreateProblemInput struct {
	Title       string            `json:"title"`
	ContentType string            `json:"content_type"`
	Content     string            `json:"content"`
	Template    map[string]string `json:"template"`
	Attachments []Attachment      `json:"attachments"`
}

func (repo ProblemRepo) doCreate(userID string, input CreateProblemInput) error {
	problemID := uuid.NewV4().String()

	files := []string{}
	for _, attachment := range input.Attachments {
		if err := repo.saveAttachment(problemID, attachment.Language, attachment.Filename, attachment.Code, true); err != nil {
			return err
		}

		files = append(files, attachment.Language+attachment.Filename)
	}

	problem := Problem{
		ID:          problemID,
		Version:     "1.0",
		Title:       input.Title,
		ContentType: input.ContentType,
		Content:     input.Content,
		Template:    input.Template,
		UpdatedAt:   time.Now().Unix(),
		Writer:      userID,
		Files:       files,
	}

	if err := repo.doPut(problemID, problem, true); err != nil {
		return err
	}

	return nil
}

type UpdateProblemInput struct {
	Title       string            `json:"title"`
	ContentType string            `json:"content_type"`
	Content     string            `json:"content"`
	Template    map[string]string `json:"template"`
}

func (repo ProblemRepo) doUpdate(problemID string, userID string, input UpdateProblemInput) error {
	prev, err := repo.doGet(problemID, true)
	if err != nil {
		return err
	}

	if prev.Writer != userID {
		return errors.New("unauthorized")
	}

	problem := Problem{
		ID:          problemID,
		Version:     "1.0",
		Title:       input.Title,
		ContentType: input.ContentType,
		Content:     input.Content,
		Template:    input.Template,
		UpdatedAt:   time.Now().Unix(),
		Writer:      prev.Writer,
		Files:       prev.Files,
	}

	return repo.doPut(problemID, problem, true)
}

func (repo ProblemRepo) doListWriterProblems(userID string, draft bool) ([]Problem, error) {
	var problems []Problem
	if err := repo.problemTable.Get("writer", userID).Index("writer").All(&problems); err != nil {
		return nil, err
	}

	return problems, nil
}

func (repo ProblemRepo) doPublic(userID string, problemID string) error {
	problem, err := repo.doGet(problemID, true)
	if err != nil {
		return err
	}

	return repo.doPut(problemID, problem, false)
}

func handler(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	sess := session.Must(session.NewSession())
	ddb := dynamo.New(sess)

	problemRepo := ProblemRepo{
		s3c:          *s3.New(sess),
		problemTable: ddb.Table(problemTableName),
		draftTable:   ddb.Table(problemDraftTableName),
	}

	if event.HTTPMethod == "PUT" {
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
