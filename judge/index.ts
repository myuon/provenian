import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import AWS from "aws-sdk";

AWS.config.update({
  region: "ap-northeast-1"
});

const config = {
  service: new pulumi.Config().name,
  stage: pulumi.getStack()
};

const main = async () => {
  const parameters: {
    dockerImage: string;
    instanceImageId: string;
    submission_table_name: string;
    judge_queue_name: string;
    submission_file_path: string;
    subnetId: string;
    vpcId: string;
  } = JSON.parse(
    (await new AWS.SSM()
      .getParameter({
        Name: `${config.service}-${config.stage}-env`
      })
      .promise()).Parameter.Value
  );

  const ecsTaskRole = (() => {
    const role = new aws.iam.Role("judge-task-role", {
      assumeRolePolicy: aws.iam
        .getPolicyDocument({
          statements: [
            {
              effect: "Allow",
              principals: [
                {
                  type: "Service",
                  identifiers: ["ecs-tasks.amazonaws.com"]
                }
              ],
              actions: ["sts:AssumeRole"]
            }
          ]
        })
        .then(result => result.json)
    });

    new aws.iam.RolePolicy("judge-task-role-policy", {
      role,
      policy: aws.iam
        .getPolicyDocument({
          statements: [
            // minimal task execution role
            {
              effect: "Allow",
              actions: [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
              ],
              resources: ["*"]
            },
            {
              effect: "Allow",
              actions: ["sqs:*", "dynamodb:*"],
              resources: ["*"]
            }
          ]
        })
        .then(result => result.json)
    });

    return role;
  })();

  const ec2InstanceProfile = (() => {
    const role = new aws.iam.Role("ec2-role", {
      assumeRolePolicy: aws.iam
        .getPolicyDocument({
          statements: [
            {
              effect: "Allow",
              principals: [
                {
                  type: "Service",
                  identifiers: ["ec2.amazonaws.com"]
                }
              ],
              actions: ["sts:AssumeRole"]
            }
          ]
        })
        .then(result => result.json)
    });

    new aws.iam.RolePolicy("ec2-role-policy", {
      role,
      policy: aws.iam
        .getPolicyDocument({
          statements: [
            {
              effect: "Allow",
              actions: [
                "ecs:CreateCluster",
                "ecs:DeregisterContainerInstance",
                "ecs:DiscoverPollEndpoint",
                "ecs:Poll",
                "ecs:RegisterContainerInstance",
                "ecs:StartTelemetrySession",
                "ecs:Submit*",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
                "ecr:GetAuthorizationToken",
                "ecr:BatchGetImage",
                "ecr:GetDownloadUrlForLayer"
              ],
              resources: ["*"]
            }
          ]
        })
        .then(result => result.json)
    });

    return new aws.iam.InstanceProfile("ec2-instance-profile", {
      role
    });
  })();

  const judgeTask = new aws.ecs.TaskDefinition("judge-task", {
    taskRoleArn: ecsTaskRole.arn,
    containerDefinitions: JSON.stringify([
      {
        Name: "worker",
        Cpu: 1024,
        Essential: true,
        Image: parameters.dockerImage,
        Memory: 1500,
        Environment: [
          {
            Name: "SUBMISSION_TABLE_NAME",
            Value: parameters.submission_table_name
          },
          {
            Name: "JUDGE_QUEUE_NAME",
            Value: parameters.judge_queue_name
          },
          {
            Name: "SUBMISSION_FILE_PATH",
            Value: parameters.submission_file_path
          }
        ],
        LogConfiguration: {
          LogDriver: "awslogs",
          Options: {
            "awslogs-region": "ap-northeast-1",
            "awslogs-group": `${config.service}-${config.stage}`
          }
        }
      }
    ]),
    family: "service"
  });

  const cluster = new aws.ecs.Cluster("judge-cluster", {
    name: `${config.service}-${config.stage}-judge`
  });

  const ecsSG = new aws.ec2.SecurityGroup("judge-security-group", {
    name: `${config.service}-${config.stage}-ecs`,
    vpcId: parameters.vpcId,
    egress: [
      {
        fromPort: 0,
        protocol: "-1",
        toPort: 0,
        cidrBlocks: ["0.0.0.0/0"]
      }
    ]
  });

  const launchTemplate = new aws.ec2.LaunchTemplate(
    "judge-task-ec2-launch-template",
    {
      imageId: parameters.instanceImageId,
      vpcSecurityGroupIds: [ecsSG.id],
      instanceType: "t3.micro",
      name: `${config.service}-${config.stage}-judge-ec2-launch-config`,
      iamInstanceProfile: {
        arn: ec2InstanceProfile.arn
      },
      userData: cluster.name.apply(name =>
        new Buffer(`#!/bin/bash -xe
echo ECS_CLUSTER=${name} >> /etc/ecs/ecs.config`).toString("base64")
      )
    }
  );

  new aws.autoscaling.Group(
    "judge-task-autoscaling",
    {
      vpcZoneIdentifiers: [parameters.subnetId],
      minSize: 0,
      maxSize: 10,
      desiredCapacity: 1,
      mixedInstancesPolicy: {
        instancesDistribution: {
          onDemandAllocationStrategy: "prioritized",
          onDemandBaseCapacity: 0,
          onDemandPercentageAboveBaseCapacity: 0,
          spotAllocationStrategy: "lowest-price"
        },
        launchTemplate: {
          launchTemplateSpecification: {
            launchTemplateName: launchTemplate.name,
            version: "$Latest"
          },
          overrides: [
            {
              instanceType: "m3.medium"
            },
            {
              instanceType: "t3.small"
            }
          ]
        }
      }
    },
    {
      dependsOn: [launchTemplate]
    }
  );

  const service = new aws.ecs.Service("judge-service", {
    cluster: cluster.name,
    taskDefinition: judgeTask.arn,
    launchType: "EC2",
    desiredCount: 1
  });
};

main();
