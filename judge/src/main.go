package main

import (
	"bufio"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path"
	"time"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/sqs"
	"github.com/guregu/dynamo"

	"github.com/myuon/provenian/api/functions/submit/model"
)

var submissionTableName = os.Getenv("SUBMISSION_TABLE_NAME")
var judgeQueueName = os.Getenv("JUDGE_QUEUE_NAME")
var submissionFilePath = os.Getenv("SUBMISSION_FILE_PATH")
var isabellePath = os.Getenv("ISABELLE_PATH")
var fileDomain = os.Getenv("FILE_DOMAIN")
var bucketName = os.Getenv("BUCKET_NAME")

type SQSClient struct {
	queueName string
	queueUrl  string
	*sqs.SQS
}

func NewSQSClient(queueName string, instance *sqs.SQS) (SQSClient, error) {
	res, err := instance.GetQueueUrl(&sqs.GetQueueUrlInput{
		QueueName: aws.String(queueName),
	})
	if err != nil {
		return SQSClient{}, err
	}

	return SQSClient{
		queueName: queueName,
		queueUrl:  *res.QueueUrl,
		SQS:       instance,
	}, nil
}

func (sqsc SQSClient) Receive() ([]sqs.Message, error) {
	res, err := sqsc.ReceiveMessage(&sqs.ReceiveMessageInput{
		QueueUrl: aws.String(sqsc.queueUrl),
	})
	if err != nil {
		return nil, err
	}

	var messages []sqs.Message
	for _, m := range res.Messages {
		messages = append(messages, *m)
	}

	return messages, nil
}

func (sqsc SQSClient) Delete(receiptHandle string) error {
	_, err := sqsc.DeleteMessage(&sqs.DeleteMessageInput{
		QueueUrl:      aws.String(sqsc.queueUrl),
		ReceiptHandle: aws.String(receiptHandle),
	})

	return err
}

type S3Client struct {
	bucketName string
	*s3.S3
}

func NewS3Client(bucketName string, instance *s3.S3) S3Client {
	return S3Client{
		bucketName: bucketName,
		S3:         instance,
	}
}

func (s3c S3Client) ListObjects(prefix string) ([]*s3.Object, error) {
	out, err := s3c.ListObjectsV2(&s3.ListObjectsV2Input{
		Bucket: aws.String(s3c.bucketName),
		Prefix: aws.String(prefix),
	})
	if err != nil {
		return nil, err
	}

	return out.Contents, nil
}

func (s3c S3Client) ReadObject(key string) (io.ReadCloser, error) {
	out, err := s3c.GetObject(&s3.GetObjectInput{
		Bucket: aws.String(s3c.bucketName),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, err
	}

	return out.Body, nil
}

func (s3c S3Client) DownloadObject(key string, filepath string) error {
	body, err := s3c.ReadObject(key)
	if err != nil {
		return err
	}

	file, err := os.Create(filepath)
	if err != nil {
		return err
	}

	defer file.Close()
	if _, err := io.Copy(file, body); err != nil {
		return err
	}

	return nil
}

func main() {
	config := &aws.Config{Region: aws.String("ap-northeast-1")}
	if region, ok := os.LookupEnv("AWS_REGION"); ok {
		config.Region = aws.String(region)
	}

	sess := session.Must(session.NewSession(config))
	sqsc, err := NewSQSClient(judgeQueueName, sqs.New(sess))
	if err != nil {
		panic(err)
	}

	s3c := NewS3Client(bucketName, s3.New(sess))
	submissionTable := dynamo.New(sess).Table(submissionTableName)

	start(sqsc, s3c, submissionTable)
}

func start(sqsc SQSClient, s3c S3Client, submissionTable dynamo.Table) {
	for {
		ids, err := sqsc.Receive()
		if err != nil {
			panic(err)
		}

		for _, message := range ids {
			submissionID := *message.Body

			if err := execRunner(submissionTable, s3c, submissionID); err != nil {
				panic(err)
			}

			if err := sqsc.Delete(*message.ReceiptHandle); err != nil {
				panic(err)
			}
		}

		time.Sleep(15 * time.Second)
	}
}

func execRunner(submissionTable dynamo.Table, s3c S3Client, submissionID string) error {
	var submission model.Submission
	if err := submissionTable.Get("id", submissionID).One(&submission); err != nil {
		return err
	}

	// Download asset files
	objects, err := s3c.ListObjects(submission.ProblemID + "/" + submission.Language + "/")
	if err != nil {
		return err
	}

	for _, object := range objects {
		s3c.DownloadObject(*object.Key, path.Join(path.Dir(submissionFilePath), path.Base(*object.Key)))
	}

	// Save submission file
	if err := s3c.DownloadObject(submission.Code, submissionFilePath); err != nil {
		return err
	}

	// Run verification process
	var result model.Result

	if submission.Language == "isabelle" {
		r, err := execIsabelle()
		if err != nil {
			return err
		}

		result = r
	} else {
		result = model.CE("Unsupported language: " + submission.Language)
	}

	if err := submissionTable.Update("id", submission.ID).Set("result", result).Run(); err != nil {
		return err
	}

	return nil
}

func execIsabelle() (model.Result, error) {
	cmd := exec.Command(isabellePath, "build", "-D", path.Dir(submissionFilePath))

	logfilePath := "./out.log"
	logfile, err := os.Create(logfilePath)
	if err != nil {
		return model.Result{}, err
	}
	defer logfile.Close()

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return model.Result{}, err
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return model.Result{}, err
	}

	writer := bufio.NewWriter(logfile)

	if cmd.Start(); err != nil {
		return model.Result{}, err
	}

	go io.Copy(writer, stdoutPipe)
	go io.Copy(writer, stderrPipe)
	cmd.Wait()
	writer.Flush()

	bytes, err := ioutil.ReadFile(logfilePath)
	if err != nil {
		return model.Result{}, err
	}

	var result model.Result
	if cmd.ProcessState.ExitCode() == 0 {
		result = model.V(string(bytes))
	} else {
		result = model.CE(string(bytes))
	}

	if err := os.Remove(logfilePath); err != nil {
		return model.Result{}, err
	}

	return result, err
}
