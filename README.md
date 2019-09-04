# provenian

## SSM parameters

- `provenian-api-[env]-env`:

```js
{
  clientSecret: string; // client secret of Auth0
  jwkURL: string; // jwk URL for Auth0
  audience: string; // audience of JWT
  issuer: string; // issuer of JWT
  roleDomain: string; // role domain of JWT
}
```

- `provenian-judge-[env]-env`:

```js
{
  dockerImage: string; // docker image name from dockerhub registry
  instanceImageId: string; // instance image (like Amazon Linux 2) id
  submission_table_name: string; // the name of submission DynamoDB
  judge_queue_name: string; // the name of judge queue
  subnetId: string; // vpc subet id
  vpcId: string; // vpc id
  bucket_name: string; // bucket name for storing problems and submissions
}
```
