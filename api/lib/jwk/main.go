package jwk

import (
	"bytes"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"math/big"
)

// ToPem transforms jwk to pem block
func ToPem(jwk map[string]string) ([]byte, error) {
	nb, err := base64.RawURLEncoding.DecodeString(jwk["n"])
	if err != nil {
		return nil, err
	}

	e := 0
	if jwk["e"] == "AQAB" || jwk["e"] == "AAEAAQ" {
		e = 65537
	} else {
		panic("need to decode e:" + jwk["e"])
	}

	pk := &rsa.PublicKey{
		N: new(big.Int).SetBytes(nb),
		E: e,
	}

	der, err := x509.MarshalPKIXPublicKey(pk)
	if err != nil {
		return nil, err
	}

	block := &pem.Block{
		Type:  "RSA PUBLIC KEY",
		Bytes: der,
	}

	var out bytes.Buffer
	pem.Encode(&out, block)

	return out.Bytes(), nil
}
