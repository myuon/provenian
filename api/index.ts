import * as pulumi from "@pulumi/pulumi";
import * as pulumi_extra from "@myuon/pulumi-extra";
import * as aws from "@pulumi/aws";
import { createCORSResource } from "@myuon/pulumi-extra/dist/src/apigateway";

const config = {
  service: new pulumi.Config().name,
  stage: pulumi.getStack()
};

const storageBucket = new aws.s3.Bucket("storage", {
  bucketPrefix: `${config.service}-${config.stage}-storage`,
  corsRules: [
    {
      allowedHeaders: ["*"],
      allowedMethods: ["GET"],
      allowedOrigins: ["*"]
    }
  ]
});

new aws.s3.BucketPolicy(
  "storage-policy",
  {
    bucket: storageBucket.bucket,
    policy: storageBucket.bucket.apply(bucketName =>
      JSON.stringify({
        Version: "2012-10-17",
        Id: "S3Policy",
        Statement: [
          {
            Sid: "1",
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucketName}/*`]
          }
        ]
      })
    )
  },
  {
    dependsOn: [storageBucket]
  }
);

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
            actions: ["sqs:*", "s3:*", "dynamodb:*", "logs:*"],
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
    },
    {
      name: "problem_id",
      type: "S"
    },
    {
      name: "created_at",
      type: "N"
    }
  ],
  hashKey: "id",
  globalSecondaryIndexes: [
    {
      name: "problems",
      hashKey: "problem_id",
      rangeKey: "created_at",
      projectionType: "ALL"
    }
  ]
});

const judgeQueue = new aws.sqs.Queue("judge-queue", {
  name: `${config.service}-${config.stage}-judge-queue`
});

const api = new aws.apigateway.RestApi("api", {
  name: `${config.service}-${config.stage}`
});

const authorizer = pulumi_extra.lambda.createLambdaFunction("authorizer", {
  filepath: "authorizer",
  handlerName: `${config.service}-${config.stage}-authorizer`,
  role: lambdaRole
});

const submitHandler = pulumi_extra.lambda.createLambdaFunction("submit", {
  filepath: "submit",
  handlerName: `${config.service}-${config.stage}-submit`,
  role: lambdaRole,
  lambdaOptions: {
    environment: {
      variables: {
        submitTableName: submitTable.name,
        judgeQueueName: judgeQueue.name,
        storageBucketName: storageBucket.bucket
      }
    }
  }
});

const problemResource = new aws.apigateway.Resource("problems", {
  parentId: api.rootResourceId,
  pathPart: "problems",
  restApi: api
});
const problemIdResource = new aws.apigateway.Resource("problemId", {
  parentId: problemResource.id,
  pathPart: "{problemId}",
  restApi: api
});

const submitAPI = pulumi_extra.apigateway.createLambdaMethod("submit", {
  authorization: "CUSTOM",
  method: {
    authorizerId: authorizer.id
  },
  httpMethod: "POST",
  resource: createCORSResource("submit", {
    parentId: problemIdResource.id,
    pathPart: "submit",
    restApi: api
  }),
  restApi: api,
  integration: {
    type: "AWS_PROXY"
  },
  handler: submitHandler
});

const listSubmissionAPI = pulumi_extra.apigateway.createLambdaMethod(
  "list-submissions",
  {
    authorization: "NONE",
    httpMethod: "GET",
    resource: createCORSResource("problems-submissions", {
      parentId: problemIdResource.id,
      pathPart: "submissions",
      restApi: api
    }),
    restApi: api,
    integration: {
      type: "AWS_PROXY"
    },
    handler: submitHandler
  }
);

const getSubmissionAPI = (() => {
  const submissions = new aws.apigateway.Resource("submissions", {
    parentId: api.rootResourceId,
    pathPart: "submissions",
    restApi: api
  });

  return pulumi_extra.apigateway.createLambdaMethod("get-submit", {
    authorization: "NONE",
    httpMethod: "GET",
    resource: createCORSResource("submissions-id", {
      parentId: submissions.id,
      pathPart: "{submissionId}",
      restApi: api
    }),
    restApi: api,
    integration: {
      type: "AWS_PROXY"
    },
    handler: submitHandler
  });
})();

const apiDeployment = new aws.apigateway.Deployment(
  "api-deployment",
  {
    restApi: api,
    stageName: config.stage,
    stageDescription: new Date().toLocaleString()
  },
  {
    dependsOn: [submitAPI, getSubmissionAPI, listSubmissionAPI]
  }
);

export const output = {
  restApi: apiDeployment.invokeUrl,
  submitTableName: submitTable.name,
  judgeQueueName: judgeQueue.name,
  storageBucketDomain: storageBucket.bucketDomainName
};
