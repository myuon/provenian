package main

import (
	"context"
	"encoding/json"
	"github.com/aws/aws-sdk-go/aws"
	"os"
	"time"

	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/dynamodb"
	"github.com/aws/aws-sdk-go/service/sqs"
	"github.com/satori/go.uuid"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/guregu/dynamo"
)

var submitTableName = os.Getenv("submitTableName")
var judgeQueueName = os.Getenv("judgeQueueName")

type SubmitRepo struct {
	table dynamo.Table
}

type Result struct {
	Code       string `dynamo:"status_code" json:"status_code"`
	Text       string `dynamo:"status_text" json:"status_text"`
	Message    string `dynamo:"message" json:"message"`
	IsFinished bool   `json:"is_finished"`
}

func wjResult() Result {
	return Result{
		Code: "WJ",
		Text: "Wait for Judge...",
	}
}

type Submission struct {
	ID        string `dynamo:"id" json:"id"`
	CreatedAt int64  `dynamo:"created_at" json:"created_at"`
	Code      string `dynamo:"code" json:"code"`
	Result    Result `dynamo:"result" json:"result"`
}

func (repo SubmitRepo) Create(code string) (Submission, error) {
	submission := Submission{
		ID:        uuid.Must(uuid.NewV4()).String(),
		CreatedAt: time.Now().Unix(),
		Code:      code,
	}

	if err := repo.table.Put(submission).Run(); err != nil {
		return Submission{}, err
	}

	return submission, nil
}

// Get method returns submission by ID
// Result will be wj if the status is "Wait for Judge"
func (repo SubmitRepo) Get(ID string) (Submission, error) {
	var submission Submission
	if err := repo.table.Get("id", ID).One(&submission); err != nil {
		return Submission{}, err
	}

	if submission.Result == (Result{}) {
		submission.Result = wjResult()
	}

	submission.Result.IsFinished = !(submission.Result.Code == "WJ")

	return submission, nil
}

// ---

func doPost(submitRepo SubmitRepo, sqsc *sqs.SQS, input string) (events.APIGatewayProxyResponse, error) {
	submission, err := submitRepo.Create(input)
	if err != nil {
		panic(err)
	}

	out, err := sqsc.GetQueueUrl(&sqs.GetQueueUrlInput{
		QueueName: aws.String(judgeQueueName),
	})
	if err != nil {
		panic(err)
	}

	_, err = sqsc.SendMessage(&sqs.SendMessageInput{
		QueueUrl:    out.QueueUrl,
		MessageBody: aws.String(submission.ID),
	})
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

func handler(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	sess := session.Must(session.NewSession())

	db := dynamo.NewFromIface(dynamodb.New(sess))
	sqsc := sqs.New(sess)

	submitRepo := SubmitRepo{
		table: db.Table(submitTableName),
	}

	if event.HTTPMethod == "POST" {
		return doPost(submitRepo, sqsc, event.Body)
	} else if event.HTTPMethod == "GET" {
		return doGet(submitRepo, event.Body)
	}

	panic("unreachable")
}

func main() {
	lambda.Start(handler)
}
