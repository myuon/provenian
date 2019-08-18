package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
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
var roleDomain = os.Getenv("roleDomain")
var pemCache string

func generatePolicy(principalID string, effect string, resources []string, context map[string]interface{}) events.APIGatewayCustomAuthorizerResponse {
	authResponse := events.APIGatewayCustomAuthorizerResponse{PrincipalID: principalID}

	if effect != "" && len(resources) != 0 {
		authResponse.PolicyDocument = events.APIGatewayCustomAuthorizerPolicy{
			Version: "2012-10-17",
			Statement: []events.IAMPolicyStatement{
				{
					Action:   []string{"execute-api:Invoke"},
					Effect:   effect,
					Resource: resources,
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

func checkAuthority(methodArn string, payload map[string]interface{}) bool {
	path := ""

	if strings.Contains(methodArn, "/POST/") {
		path = strings.Split(methodArn, "/POST/")[1]
	} else if strings.Contains(methodArn, "/PUT/") {
		path = strings.Split(methodArn, "/PUT/")[1]
	} else if strings.Contains(methodArn, "/DELETE/") {
		path = strings.Split(methodArn, "/DELETE/")[1]
	} else {
		return true
	}

	if matched, err := regexp.MatchString(`/problems/(.*)/edit`, path); matched || err != nil {
		if err != nil {
			panic(err)
		}

		return payload["writer"].(bool)
	}

	return false
}

func getResourceRoot(methodArn string) string {
	return strings.Split(strings.Split(strings.Split(strings.Split(strings.Split(methodArn,
		"/GET/")[0],
		"/POST/")[0],
		"/PUT/")[0],
		"/DELETE/")[0],
		"/PATCH/")[0]
}

func getGuestResource(methodArn string) []string {
	root := getResourceRoot(methodArn)
	appendRoot := func(xs []string) []string {
		for i, x := range xs {
			xs[i] = root + x
		}

		return xs
	}

	return appendRoot([]string{
		"/GET/problems/*/submissions",
		"/POST/problems/*/submit",
		"/GET/submissions/*",
	})
}

func getWriterResource(methodArn string) []string {
	root := getResourceRoot(methodArn)
	appendRoot := func(xs []string) []string {
		for i, x := range xs {
			xs[i] = root + x
		}

		return xs
	}

	return append(getGuestResource(methodArn), appendRoot([]string{
		"/PUT/problems/*/edit",
	})...)
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

	roles := payload[roleDomain].([]interface{})
	for _, role := range roles {
		if role.(string) == "writer" {
			payload["writer"] = true
		}
	}
	payload[roleDomain] = roleDomain

	if payload["writer"] == true {
		return generatePolicy(payload["sub"].(string), "Allow", getWriterResource(request.MethodArn), payload), err
	} else {
		return generatePolicy(payload["sub"].(string), "Allow", getGuestResource(request.MethodArn), payload), err
	}
}

func main() {
	lambda.Start(handler)
}
