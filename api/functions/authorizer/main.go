package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"

	jwt "github.com/dgrijalva/jwt-go"
	"github.com/myuon/provenian/api/lib/jwk"
)

var audience = os.Getenv("audience")
var issuer = os.Getenv("issuer")
var clientSecret = os.Getenv("clientSecret")
var jwkURL = os.Getenv("jwkURL")
var pemCache string

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

func getPemCert(token *jwt.Token) (string, error) {
	if len(pemCache) > 0 {
		return pemCache, nil
	}

	resp, err := http.Get(jwkURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var jwks = jwk.Jwks{}
	if err = json.NewDecoder(resp.Body).Decode(&jwks); err != nil {
		return "", err
	}

	pem := ""
	for k := range jwks.Keys {
		if token.Header["kid"] == jwks.Keys[k].Kid {
			pem = "-----BEGIN CERTIFICATE-----\n" + jwks.Keys[k].X5c[0] + "\n-----END CERTIFICATE-----"
		}
	}

	if pem == "" {
		return "", errors.New("Unable to find appropriate key")
	}

	pemCache = pem
	return pem, nil
}

func keyFunction(token *jwt.Token) (interface{}, error) {
	if ok := token.Claims.(jwt.MapClaims).VerifyAudience(audience, false); !ok {
		return nil, errors.New("Invalid audience")
	}

	if ok := token.Claims.(jwt.MapClaims).VerifyIssuer(issuer, false); !ok {
		return nil, errors.New("Invalid issuer")
	}

	cert, err := getPemCert(token)
	if err != nil {
		return nil, err
	}

	return jwt.ParseRSAPublicKeyFromPEM([]byte(cert))
}

func handler(ctx context.Context, request events.APIGatewayCustomAuthorizerRequest) (events.APIGatewayCustomAuthorizerResponse, error) {
	token := strings.TrimPrefix(request.AuthorizationToken, "Bearer ")

	verified, err := jwt.Parse(token, keyFunction)
	if err != nil {
		fmt.Println(err.Error())
		return events.APIGatewayCustomAuthorizerResponse{}, errors.New("Unauthorized")
	}

	payload := verified.Claims.(jwt.MapClaims)

	// Payload hack
	// `aud` could be a list but it is not allowed as authorizer response
	payload["aud"] = audience
	return generatePolicy(payload["sub"].(string), "Allow", request.MethodArn, payload), err
}

func main() {
	lambda.Start(handler)
}
