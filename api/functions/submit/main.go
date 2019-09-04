package main

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"time"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/sqs"
	"github.com/guregu/dynamo"
	"github.com/satori/go.uuid"

	"github.com/myuon/provenian/api/functions/submit/model"
)

var submitTableName = os.Getenv("submitTableName")
var judgeQueueName = os.Getenv("judgeQueueName")
var storageBucketName = os.Getenv("storageBucketName")

type SubmitRepo struct {
	table     dynamo.Table
	s3service s3.S3
}

func (repo SubmitRepo) Create(submission model.Submission) (model.Submission, error) {
	submission.ID = uuid.NewV4().String()
	submission.CreatedAt = time.Now().Unix()

	codeFilePath := submission.ProblemID + "/submissions/" + submission.ID
	if _, err := repo.s3service.PutObject(&s3.PutObjectInput{
		Bucket:       aws.String(storageBucketName),
		Key:          aws.String(codeFilePath),
		Body:         aws.ReadSeekCloser(strings.NewReader(submission.Code)),
		CacheControl: aws.String("public, max-age=86400"),
	}); err != nil {
		return model.Submission{}, err
	}

	submission.Code = codeFilePath

	if err := repo.table.Put(submission).Run(); err != nil {
		return model.Submission{}, err
	}

	return submission, nil
}

// Get method returns submission by ID
// Result will be wj if the status is "Wait for Judge"
func (repo SubmitRepo) Get(ID string) (model.Submission, error) {
	var submission model.Submission
	if err := repo.table.Get("id", ID).One(&submission); err != nil {
		return model.Submission{}, err
	}

	if submission.Result == (model.Result{}) {
		submission.Result = model.WJ()
	} else {
		submission.Result.IsFinished = true
	}

	submission.Result.IsFinished = !(submission.Result.Code == "WJ")

	return submission, nil
}

func (repo SubmitRepo) ListByProblemID(ID string) ([]model.Submission, error) {
	var submissions []model.Submission
	if err := repo.table.Get("problem_id", ID).Index("problems").All(&submissions); err != nil {
		return nil, err
	}

	for index, submission := range submissions {
		if submission.Result == (model.Result{}) {
			submissions[index].Result = model.WJ()
		} else {
			submissions[index].Result.IsFinished = true
		}
	}

	return submissions, nil
}

type JobQueue struct {
	queue sqs.SQS
}

func (queue JobQueue) Push(message string) error {
	out, err := queue.queue.GetQueueUrl(&sqs.GetQueueUrlInput{
		QueueName: aws.String(judgeQueueName),
	})
	if err != nil {
		return err
	}

	_, err = queue.queue.SendMessage(&sqs.SendMessageInput{
		QueueUrl:    out.QueueUrl,
		MessageBody: aws.String(message),
	})
	if err != nil {
		return err
	}

	return nil
}

// ---

func doPost(submitRepo SubmitRepo, queue JobQueue, submissionInput model.Submission) (events.APIGatewayProxyResponse, error) {
	submission, err := submitRepo.Create(submissionInput)
	if err != nil {
		panic(err)
	}

	err = queue.Push(submission.ID)
	if err != nil {
		panic(err)
	}

	body, err := json.Marshal(submission)
	if err != nil {
		panic(err)
	}

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers: map[string]string{
			"Access-Control-Allow-Origin": "*",
		},
		Body: string(body),
	}, nil
}

func doGet(submitRepo SubmitRepo, submissionID string) (events.APIGatewayProxyResponse, error) {
	submission, err := submitRepo.Get(submissionID)
	if err != nil {
		panic(err)
	}

	body, err := json.Marshal(submission)
	if err != nil {
		panic(err)
	}

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers: map[string]string{
			"Access-Control-Allow-Origin": "*",
		},
		Body: string(body),
	}, nil
}

func doList(submitRepo SubmitRepo, problemID string) (events.APIGatewayProxyResponse, error) {
	submissions, err := submitRepo.ListByProblemID(problemID)
	if err != nil {
		panic(err)
	}

	body, err := json.Marshal(submissions)
	if err != nil {
		panic(err)
	}

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
		Headers: map[string]string{
			"Access-Control-Allow-Origin": "*",
		},
		Body: string(body),
	}, nil
}

type SubmitInput struct {
	Language string `json:"language"`
	Code     string `json:"code"`
}

func handler(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	sess := session.Must(session.NewSession())

	submitRepo := SubmitRepo{
		table:     dynamo.NewFromIface(dynamodb.New(sess)).Table(submitTableName),
		s3service: *s3.New(sess),
	}
	jobQueue := JobQueue{
		queue: *sqs.New(sess),
	}

	if event.HTTPMethod == "POST" {
		var input SubmitInput
		if err := json.Unmarshal([]byte(event.Body), &input); err != nil {
			panic(err)
		}

		submission := model.Submission{
			ProblemID: event.PathParameters["problemId"],
			Code:      input.Code,
			UserID:    event.RequestContext.Authorizer["sub"].(string),
			Language:  input.Language,
		}

		return doPost(submitRepo, jobQueue, submission)
	} else if problemID, ok := event.PathParameters["problemId"]; event.HTTPMethod == "GET" && ok {
		return doList(submitRepo, problemID)
	} else if submissionID, ok := event.PathParameters["submissionId"]; event.HTTPMethod == "GET" && ok {
		return doGet(submitRepo, submissionID)
	}

	panic("unreachable")
}

func main() {
	lambda.Start(handler)
}
