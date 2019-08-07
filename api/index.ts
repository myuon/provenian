import * as pulumi from "@pulumi/pulumi";
import * as pulumi_extra from "@myuon/pulumi-extra";
import * as aws from "@pulumi/aws";

const config = {
  service: new pulumi.Config().name,
  stage: pulumi.getStack()
};

const lambdaRole = (() => {
  const role = new aws.iam.Role("lambda-role", {
    assumeRolePolicy: aws.iam
      .getPolicyDocument({
        statements: [
          {
            actions: ["sts:AssumeRole"],
            principals: [
              {
                identifiers: ["lambda.amazonaws.com"],
                type: "Service"
              }
            ]
          }
        ]
      })
      .then(result => result.json)
  });
  new aws.iam.RolePolicy("lambda-role-policy", {
    role,
    policy: aws.iam
      .getPolicyDocument({
        statements: [
          {
            actions: ["s3:*", "dynamodb:*", "logs:*"],
            effect: "Allow",
            resources: ["*"]
          }
        ]
      })
      .then(result => result.json)
  });

  return role;
})();

const submitTable = new aws.dynamodb.Table("submit", {
  billingMode: "PAY_PER_REQUEST",
  name: `${config.service}-${config.stage}-submit`,
  attributes: [
    {
      name: "id",
      type: "S"
    }
  ],
  hashKey: "id"
});

const judgeQueue = new aws.sqs.Queue("judge-queue", {
  name: `${config.service}-${config.stage}-judge-queue`
});

pulumi_extra.lambda.createLambdaFunction("submit", {
  filepath: "submit",
  handlerName: `${config.service}-${config.stage}-submit`,
  role: lambdaRole,
  lambdaOptions: {
    environment: {
      variables: {
        submitTableName: submitTable.name,
        judgeQueueName: judgeQueue.name
      }
    }
  }
});
