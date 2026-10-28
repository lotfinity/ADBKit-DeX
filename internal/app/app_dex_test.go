package app

import (
	"strings"
	"testing"
)

func TestSamsungDeXDisplayID(t *testing.T) {
	cases := []struct {
		input string
		want  string
	}{
		{"  mDesktopDisplayId=2\n  mDualModeEnabled=true", "2"},
		{"  mDesktopDisplayId=8\n", "8"},
		{"  mDesktopDisplayId=-1\n", "-1"},
	}
	for _, c := range cases {
		m := dexIDPattern.FindStringSubmatch(c.input)
		if len(m) != 2 || m[1] != c.want {
			t.Fatalf("for %q want %q got %v", c.input, c.want, m)
		}
	}
}
func TestSamsungDeXStateTags(t *testing.T) {
	if !strings.Contains("mRemoteDisplayInterface=127.0.0.1:7236", "127.0.0.1:7236") {
		t.Fatal("loopback marker")
	}
}
