import * as pulumi from "@pulumi/pulumi";
import * as pulumi_extra from "@myuon/pulumi-extra";
import * as aws from "@pulumi/aws";
import { createCORSResource } from "@myuon/pulumi-extra/dist/src/apigateway";

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
            actions: ["sqs:*", "dynamodb:*", "logs:*"],
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

const api = new aws.apigateway.RestApi("api", {
  name: `${config.service}-${config.stage}`
});

const submitAPI = pulumi_extra.apigateway.createLambdaMethod("submit", {
  authorization: "NONE",
  httpMethod: "POST",
  resource: createCORSResource("submit", {
    parentId: api.rootResourceId,
    pathPart: "submit",
    restApi: api
  }),
  restApi: api,
  integration: {
    type: "AWS_PROXY"
  },
  handler: pulumi_extra.lambda.createLambdaFunction("submit", {
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
  })
});

const apiDeployment = new aws.apigateway.Deployment(
  "api-deployment",
  {
    restApi: api,
    stageName: config.stage
  },
  {
    dependsOn: [submitAPI]
  }
);

export const output = {
  restApi: apiDeployment.invokeUrl,
  submitTableName: submitTable.name,
  judgeQueueName: judgeQueue.name
};
