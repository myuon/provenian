package main

import (
	"context"
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

type Submission struct {
	ID        string `dynamo:"id"`
	CreatedAt int64  `dynamo:"created_at"`
	Code      string `dynamo:"code"`
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

func handler(ctx context.Context, event events.APIGatewayProxyRequest) (events.APIGatewayProxyResponse, error) {
	sess := session.Must(session.NewSession())

	db := dynamo.NewFromIface(dynamodb.New(sess))
	sqsc := sqs.New(sess)

	submitRepo := SubmitRepo{
		table: db.Table(submitTableName),
	}

	submission, err := submitRepo.Create(event.Body)
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

	return events.APIGatewayProxyResponse{
		StatusCode: 200,
	}, nil
}

func main() {
	lambda.Start(handler)
}
