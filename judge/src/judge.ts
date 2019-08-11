import AWS from "aws-sdk";
import * as fs from "fs";
import * as child_process from "child_process";
import * as path from "path";
import axios from "axios";

const SUBMISSION_TABLE_NAME = process.env.SUBMISSION_TABLE_NAME;
const JUDGE_QUEUE_NAME = process.env.JUDGE_QUEUE_NAME;
const SUBMISSION_FILE_PATH = process.env.SUBMISSION_FILE_PATH;
const ISABELLE_PATH = process.env.ISABELLE_PATH;
const FILE_DOMAIN = process.env.FILE_DOMAIN;
const BUCKET_NAME = process.env.BUCKET_NAME;

AWS.config.update({
  region: process.env.REGION || "ap-northeast-1"
});

const sqs = new AWS.SQS();
const dynamo = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

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

  // download assets
  const objects = await s3
    .listObjectsV2({
      Bucket: BUCKET_NAME,
      Prefix: `${submission.problem_id}/isabelle2019/`
    })
    .promise();
  Promise.all(
    objects.Contents.map(async object => {
      if (object.Size == 0) return;

      fs.writeFileSync(
        path.resolve(
          path.dirname(SUBMISSION_FILE_PATH),
          path.basename(object.Key)
        ),
        (await s3
          .getObject({
            Bucket: BUCKET_NAME,
            Key: object.Key
          })
          .promise()).Body.toString()
      );
    })
  );

  // save submission file
  fs.writeFileSync(
    SUBMISSION_FILE_PATH,
    (await axios.get(`${FILE_DOMAIN}/${submission.code}`)).data
  );

  // verification check
  const result = await new Promise((resolve, reject) => {
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

      const result = {
        status_code: code === 0 ? "V" : "CE",
        status_text: code === 0 ? "Verified" : "Compilation Error",
        message: fs.readFileSync(stdoutLogFile, "utf8")
      };

      fs.unlinkSync(stdoutLogFile);
      resolve(result);
    });
  });

  const item = (await dynamo
    .get({
      TableName: SUBMISSION_TABLE_NAME,
      Key: {
        id: submissionId
      }
    })
    .promise()).Item;
  await dynamo
    .put({
      TableName: SUBMISSION_TABLE_NAME,
      Item: Object.assign(item, {
        result
      })
    })
    .promise();
};

const sleep = time => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, time);
  });
};

const main = async () => {
  const queueUrl = (await sqs
    .getQueueUrl({
      QueueName: JUDGE_QUEUE_NAME
    })
    .promise()).QueueUrl;

  while (true) {
    const messages = await readJobFromQueue(queueUrl);

    if (messages) {
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
    }

    await sleep(15000);
  }
};

main();
