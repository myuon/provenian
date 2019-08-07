import AWS from "aws-sdk";
import * as fs from "fs";
import * as child_process from "child_process";
import * as path from "path";

const SUBMISSION_TABLE_NAME = process.env.SUBMISSION_TABLE_NAME;
const JUDGE_QUEUE_NAME = process.env.JUDGE_QUEUE_NAME;
const SUBMISSION_FILE_PATH = process.env.SUBMISSION_FILE_PATH;
const ISABELLE_PATH = process.env.ISABELLE_PATH;

child_process.exec(`ls -la ${ISABELLE_PATH}`);

AWS.config.update({
  region: process.env.REGION || "ap-northeast-1"
});

const sqs = new AWS.SQS();
const dynamo = new AWS.DynamoDB.DocumentClient();

const readJobFromQueue = async (queueUrl: string) => {
  const messages = (await sqs
    .receiveMessage({
      QueueUrl: queueUrl
    })
    .promise()).Messages;

  return messages;
};

const runJudge = async (submissionId: string) => {
  const submission = (await dynamo
    .get({
      TableName: SUBMISSION_TABLE_NAME,
      Key: {
        id: submissionId
      }
    })
    .promise()).Item;

  // save code file
  fs.writeFileSync(SUBMISSION_FILE_PATH, submission.code);

  // verification check
  const result = new Promise((resolve, reject) => {
    const stdoutLogFile = "./out.log";
    const logStream = fs.createWriteStream(stdoutLogFile, { flags: "a" });

    const proc = child_process.spawn(ISABELLE_PATH, [
      "build",
      "-D",
      path.dirname(SUBMISSION_FILE_PATH)
    ]);
    proc.stdout.pipe(logStream);
    proc.stderr.pipe(logStream);

    proc.on("close", code => {
      logStream.close();

      resolve({
        statusCode: code === 0 ? "V" : "CE",
        statusText: code === 0 ? "Verified" : "Compilation Error",
        message: fs.readFileSync(stdoutLogFile)
      });
    });
  });

  await dynamo
    .update({
      TableName: SUBMISSION_TABLE_NAME,
      Key: {
        id: submissionId
      },
      UpdateExpression: "set result = :result",
      ExpressionAttributeValues: {
        ":result": result
      }
    })
    .promise();
};

const main = async () => {
  const queueUrl = (await sqs
    .getQueueUrl({
      QueueName: JUDGE_QUEUE_NAME
    })
    .promise()).QueueUrl;
  const messages = await readJobFromQueue(queueUrl);

  await Promise.all(
    messages.map(async message => {
      const submissionId = message.Body;

      await runJudge(submissionId);
      await sqs
        .deleteMessage({
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle
        })
        .promise();
    })
  );
};

main();
