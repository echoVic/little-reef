package main

import (
	"testing"

	"github.com/egoist/mygo/ui"
)

func TestParseThemeDarkBase(t *testing.T) {
	// reef-realistic has supportsDarkAppearance: true.
	th, err := parseThemeJSON("reef-realistic")
	if err != nil {
		t.Fatal(err)
	}
	if th.Background != ui.Hex("#0c1820") {
		t.Fatalf("bgBase not mapped: %+v", th.Background)
	}
	// Should inherit DarkTheme's Selection/Danger defaults.
	if th.Selection == (ui.Color{}) {
		t.Fatal("dark base must retain Selection")
	}
	if th.Danger == (ui.Color{}) {
		t.Fatal("dark base must retain Danger")
	}
}

func TestParseThemeLightBase(t *testing.T) {
	// cm-cel / ct-cream are light themes.
	th, err := parseThemeJSON("ct-cream")
	if err != nil {
		t.Skipf("ct-cream not readable: %v", err)
	}
	if th.Selection == (ui.Color{}) {
		t.Fatal("light base must retain Selection")
	}
	if th.Danger == (ui.Color{}) {
		t.Fatal("light base must retain Danger")
	}
}
