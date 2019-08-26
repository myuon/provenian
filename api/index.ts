import * as pulumi from "@pulumi/pulumi";
import * as pulumi_extra from "@myuon/pulumi-extra";
import * as aws from "@pulumi/aws";
import { createCORSResource } from "@myuon/pulumi-extra/dist/src/apigateway";

const config = {
  service: new pulumi.Config().name,
  stage: pulumi.getStack()
};

const parameters: Promise<{
  clientSecret: string;
  jwkURL: string;
  audience: string;
  issuer: string;
  roleDomain: string;
}> = aws.ssm
  .getParameter({
    name: `${config.service}-${config.stage}-env`
  })
  .then(result => JSON.parse(result.value));

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

const authorizer = (() => {
  const authorizerRole = new aws.iam.Role("authorizer-role", {
    assumeRolePolicy: aws.iam
      .getPolicyDocument({
        version: "2012-10-17",
        statements: [
          {
            effect: "Allow",
            principals: [
              {
                type: "Service",
                identifiers: ["apigateway.amazonaws.com"]
              }
            ],
            actions: ["sts:AssumeRole"]
          }
        ]
      })
      .then(result => result.json)
  });
  new aws.iam.RolePolicy("authorizer-role-policy", {
    role: authorizerRole,
    policy: aws.iam
      .getPolicyDocument({
        version: "2012-10-17",
        statements: [
          {
            effect: "Allow",
            actions: ["lambda:invokeFunction"],
            resources: ["*"]
          }
        ]
      })
      .then(result => result.json)
  });

  const handler = pulumi_extra.lambda.createLambdaFunction("authorizer", {
    filepath: "authorizer",
    handlerName: `${config.service}-${config.stage}-authorizer`,
    role: lambdaRole,
    lambdaOptions: {
      environment: {
        variables: {
          clientSecret: parameters.then(ps => ps.clientSecret),
          jwkURL: parameters.then(ps => ps.jwkURL),
          audience: parameters.then(ps => ps.audience),
          issuer: parameters.then(ps => ps.issuer),
          roleDomain: parameters.then(ps => ps.roleDomain)
        }
      }
    }
  });

  return new aws.apigateway.Authorizer(
    "authorizer",
    {
      restApi: api,
      type: "TOKEN",
      name: `${config.service}-${config.stage}-authorizer`,
      authorizerUri: pulumi.interpolate`arn:aws:apigateway:ap-northeast-1:lambda:path/2015-03-31/functions/${handler.arn}/invocations`,
      authorizerCredentials: authorizerRole.arn
    },
    {
      dependsOn: [handler, authorizerRole]
    }
  );
})();

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

const problemResource = createCORSResource("problems", {
  parentId: api.rootResourceId,
  pathPart: "problems",
  restApi: api
});
const problemIdResource = new aws.apigateway.Resource("problemId", {
  parentId: problemResource.id,
  pathPart: "{problemId}",
  restApi: api
});

const problemTable = new aws.dynamodb.Table("problem", {
  billingMode: "PAY_PER_REQUEST",
  name: `${config.service}-${config.stage}-problem`,
  attributes: [
    {
      name: "id",
      type: "S"
    },
    {
      name: "writer",
      type: "S"
    },
    {
      name: "updated_at",
      type: "N"
    }
  ],
  hashKey: "id",
  globalSecondaryIndexes: [
    {
      name: "writer",
      hashKey: "writer",
      rangeKey: "updated_at",
      projectionType: "ALL"
    }
  ]
});

const problemDraftTable = new aws.dynamodb.Table("problem-draft", {
  billingMode: "PAY_PER_REQUEST",
  name: `${config.service}-${config.stage}-problem-draft`,
  attributes: [
    {
      name: "id",
      type: "S"
    },
    {
      name: "writer",
      type: "S"
    },
    {
      name: "updated_at",
      type: "N"
    }
  ],
  hashKey: "id",
  globalSecondaryIndexes: [
    {
      name: "writer",
      hashKey: "writer",
      rangeKey: "updated_at",
      projectionType: "ALL"
    }
  ]
});

const problemHandler = pulumi_extra.lambda.createLambdaFunction("problem", {
  filepath: "problem",
  handlerName: `${config.service}-${config.stage}-problem`,
  role: lambdaRole,
  lambdaOptions: {
    environment: {
      variables: {
        storageBucketName: storageBucket.bucket,
        problemTableName: problemTable.name,
        problemDraftTableName: problemDraftTable.name
      }
    }
  }
});

const createProblemAPI = pulumi_extra.apigateway.createLambdaMethod(
  "create-problem",
  {
    authorization: "CUSTOM",
    method: {
      authorizerId: authorizer.id
    },
    httpMethod: "POST",
    resource: problemResource,
    restApi: api,
    integration: {
      type: "AWS_PROXY"
    },
    handler: problemHandler
  }
);

const editProblemAPI = pulumi_extra.apigateway.createLambdaMethod(
  "put-problem",
  {
    authorization: "CUSTOM",
    method: {
      authorizerId: authorizer.id
    },
    httpMethod: "PUT",
    resource: createCORSResource("edit", {
      parentId: problemIdResource.id,
      pathPart: "edit",
      restApi: api
    }),
    restApi: api,
    integration: {
      type: "AWS_PROXY"
    },
    handler: problemHandler
  }
);

const publishProblemAPI = pulumi_extra.apigateway.createLambdaMethod(
  "publish-problem",
  {
    authorization: "CUSTOM",
    method: {
      authorizerId: authorizer.id
    },
    httpMethod: "PUT",
    resource: createCORSResource("publish", {
      parentId: problemIdResource.id,
      pathPart: "publish",
      restApi: api
    }),
    restApi: api,
    integration: {
      type: "AWS_PROXY"
    },
    handler: problemHandler
  }
);

const listDraftAPI = pulumi_extra.apigateway.createLambdaMethod(
  "list-draft-problem",
  {
    authorization: "CUSTOM",
    method: {
      authorizerId: authorizer.id
    },
    httpMethod: "GET",
    resource: createCORSResource("drafts", {
      parentId: problemResource.id,
      pathPart: "drafts",
      restApi: api
    }),
    restApi: api,
    integration: {
      type: "AWS_PROXY"
    },
    handler: problemHandler
  }
);

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
    dependsOn: [
      submitAPI,
      getSubmissionAPI,
      listSubmissionAPI,
      editProblemAPI,
      createProblemAPI,
      publishProblemAPI,
      listDraftAPI
    ]
  }
);

export const output = {
  restApi: apiDeployment.invokeUrl,
  submitTableName: submitTable.name,
  judgeQueueName: judgeQueue.name,
  storageBucketDomain: storageBucket.bucketDomainName
};
