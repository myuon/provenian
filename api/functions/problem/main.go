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
	"github.com/satori/go.uuid"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

var storageBucketName = os.Getenv("storageBucketName")
var problemTableName = os.Getenv("problemTableName")

type ProblemRepo struct {
	s3c s3.S3
}

type Problem struct {
	Version     string            `json:"version"`
	Title       string            `json:"title"`
	ContentType string            `json:"content_type"`
	Content     string            `json:"content"`
	Template    map[string]string `json:"template"`
	UpdatedAt   int64             `json:"updated_at"`
	Writer      string            `json:"writer"`
	Files       []string          `json:"files"`
	IsPublic    bool              `json:"is_public"`
}

func (repo ProblemRepo) doGet(problemID string) (Problem, error) {
	out, err := repo.s3c.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(storageBucketName),
		Key:    aws.String(problemID + ".json"),
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

func (repo ProblemRepo) doPut(problemID string, problem Problem) error {
	json, err := json.Marshal(problem)
	if err != nil {
		return err
	}

	if _, err := repo.s3c.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(storageBucketName),
		Key:    aws.String(problemID + ".json"),
		Body:   aws.ReadSeekCloser(strings.NewReader(string(json))),
	}); err != nil {
		return err
	}

	return nil
}

func (repo ProblemRepo) saveAttachment(problemID string, language string, filename string, code string) error {
	if _, err := repo.s3c.PutObject(&s3.PutObjectInput{
		Bucket: aws.String(storageBucketName),
		Key:    aws.String(problemID + "/" + language + "/" + filename),
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
		if err := repo.saveAttachment(problemID, attachment.Language, attachment.Filename, attachment.Code); err != nil {
			return err
		}

		files = append(files, attachment.Language+attachment.Filename)
	}

	problem := Problem{
		Version:     "1.0",
		Title:       input.Title,
		ContentType: input.ContentType,
		Content:     input.Content,
		Template:    input.Template,
		UpdatedAt:   time.Now().Unix(),
		Writer:      userID,
		Files:       files,
		IsPublic:    false,
	}

	if err := repo.doPut(problemID, problem); err != nil {
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
	prev, err := repo.doGet(problemID)
	if err != nil {
		return err
	}

	if prev.Writer != userID {
		return errors.New("unauthorized")
	}

	problem := Problem{
		Version:     "1.0",
		Title:       input.Title,
		ContentType: input.ContentType,
		Content:     input.Content,
		Template:    input.Template,
		UpdatedAt:   time.Now().Unix(),
		Writer:      prev.Writer,
		Files:       prev.Files,
		IsPublic:    prev.IsPublic,
	}

	return repo.doPut(problemID, problem)
}

func handler(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	sess := session.Must(session.NewSession())

	problemRepo := ProblemRepo{
		s3c: *s3.New(sess),
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
	}

	panic("unreachable")
}

func main() {
	lambda.Start(handler)
}
