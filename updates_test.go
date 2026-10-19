package main

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

// The update signing key stays out of the repository: release builds get it
// from MYGO_UPDATER_PRIVATE_KEY.
func TestUpdateConfiguration(t *testing.T) {
	data, err := os.ReadFile("mygo.json")
	if err != nil {
		t.Fatal(err)
	}
	var config struct {
		Updates struct {
			GitHub     string  `json:"github"`
			PublicKey  string  `json:"publicKey"`
			PrivateKey *string `json:"privateKey"`
		} `json:"updates"`
	}
	if err := json.Unmarshal(data, &config); err != nil {
		t.Fatal(err)
	}
	if config.Updates.GitHub != "echoVic/little-reef" {
		t.Errorf("updates.github = %q, want echoVic/little-reef", config.Updates.GitHub)
	}
	if strings.TrimSpace(config.Updates.PublicKey) == "" {
		t.Error("updates.publicKey must not be empty")
	}
	if config.Updates.PrivateKey != nil {
		t.Error("updates.privateKey must not be configured: release builds get the key from MYGO_UPDATER_PRIVATE_KEY")
	}
}
