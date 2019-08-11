package main

import (
	"context"
	"encoding/json"
	"errors"
	"io/ioutil"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	"github.com/myuon/provenian/api/lib/jwk"
	"github.com/portals-me/account/lib/jwt"
)

var jwtPrivateKey = os.Getenv("jwtPrivateKey")
var clientSecret = os.Getenv("clientSecret")
var jwkURL = os.Getenv("jwkURL")
var pemCache []byte

func generatePolicy(principalID, effect, resource string, context map[string]interface{}) events.APIGatewayCustomAuthorizerResponse {
	authResponse := events.APIGatewayCustomAuthorizerResponse{PrincipalID: principalID}

	if effect != "" && resource != "" {
		authResponse.PolicyDocument = events.APIGatewayCustomAuthorizerPolicy{
			Version: "2012-10-17",
			Statement: []events.IAMPolicyStatement{
				{
					Action:   []string{"execute-api:Invoke"},
					Effect:   effect,
					Resource: []string{resource},
				},
			},
		}
	}

	authResponse.Context = context
	return authResponse
}

func generateKeyFromSecret(clientSecret string) ([]byte, error) {
	if len(pemCache) != 0 {
		return pemCache, nil
	}

	resp, err := http.Get(jwkURL)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	byteArray, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var jwkJSON struct {
		Keys []map[string]string `json:"keys"`
	}
	if err := json.Unmarshal([]byte(byteArray), &jwkJSON); err != nil {
		return nil, err
	}

	pem, err := jwk.ToPem(jwkJSON.Keys[0])
	if err != nil {
		return nil, nil
	}

	pemCache = pem

	return pem, nil
}

func handler(ctx context.Context, request events.APIGatewayCustomAuthorizerRequest) (events.APIGatewayCustomAuthorizerResponse, error) {
	token := strings.TrimPrefix(request.AuthorizationToken, "Bearer ")

	key, err := generateKeyFromSecret(clientSecret)
	if err != nil {
		panic(err)
	}

	signer := jwt.ES256Signer{
		Key: string(key),
	}
	verified, err := signer.Verify([]byte(token))
	if err != nil {
		return events.APIGatewayCustomAuthorizerResponse{}, errors.New("Unauthorized")
	}

	var user map[string]interface{}
	if err := json.Unmarshal(verified, &user); err != nil {
		return events.APIGatewayCustomAuthorizerResponse{}, errors.New("Unauthorized")
	}

	return generatePolicy(user["sub"].(string), "Allow", request.MethodArn, user), err
}

func main() {
	lambda.Start(handler)
}
