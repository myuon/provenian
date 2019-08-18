package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
)

var storageBucketName = os.Getenv("storageBucketName")

type ProblemRepo struct {
	s3c s3.S3
}

type Problem struct {
	Version     string              `json:"version"`
	Title       string              `json:"title"`
	ContentType string              `json:"content_type"`
	Content     string              `json:"content"`
	Template    map[string]string   `json:"template"`
	UpdatedAt   int64               `json:"updated_at"`
	Writer      []string            `json:"writer"`
	Files       map[string][]string `json:"files"`
}

func (problem Problem) HasWriter(userID string) bool {
	for _, value := range problem.Writer {
		if value == userID {
			return true
		}
	}

	return false
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

type UpdateProblemInput struct {
	Title       string              `json:"title"`
	ContentType string              `json:"content_type"`
	Content     string              `json:"content"`
	Template    map[string]string   `json:"template"`
	Files       map[string][]string `json:"files"`
}

func (repo ProblemRepo) doUpdate(problemID string, userID string, input UpdateProblemInput) error {
	prev, err := repo.doGet(problemID)
	if err != nil {
		return err
	}

	if !prev.HasWriter(userID) {
		prev.Writer = append(prev.Writer, userID)
	}

	problem := Problem{
		Version:     "1.0",
		Title:       input.Title,
		ContentType: input.ContentType,
		Content:     input.Content,
		Template:    input.Template,
		UpdatedAt:   time.Now().Unix(),
		Writer:      prev.Writer,
		Files:       input.Files,
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
	}

	panic("unreachable")
}

func main() {
	lambda.Start(handler)
}
