package app

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type SamsungDeXState struct {
	Serial      string `json:"serial"`
	Model       string `json:"model"`
	Android     string `json:"android"`
	Active      bool   `json:"active"`
	DisplayID   int    `json:"displayId"`
	Loopback    bool   `json:"loopback"`
	Connection  string `json:"connection"`
	CanActivate bool   `json:"canActivate"`
	Warning     string `json:"warning"`
}

var dexIDPattern = regexp.MustCompile(`(?m)^\s*mDesktopDisplayId=(-?\d+)`)

func dexAdb(serial string, timeout time.Duration, args ...string) (string, error) {
	if strings.TrimSpace(serial) == "" {
		return "", errors.New("select a connected device")
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	all := append([]string{"-s", serial}, args...)
	cmd := exec.CommandContext(ctx, "adb", all...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("ADB %s failed: %s: %w", strings.Join(args, " "), strings.TrimSpace(string(output)), err)
	}
	return string(output), nil
}

func (a *App) GetSamsungDeXStatus(serial string) (*SamsungDeXState, error) {
	if serial == "" {
		var err error
		serial, err = a.resolveActiveSerial(a.ctx)
		if err != nil {
			return nil, err
		}
	}
	s := &SamsungDeXState{Serial: serial, DisplayID: -1, CanActivate: true}
	model, _ := dexAdb(serial, 5*time.Second, "shell", "getprop", "ro.product.vendor.model")
	s.Model = strings.TrimSpace(model)
	android, _ := dexAdb(serial, 5*time.Second, "shell", "getprop", "ro.build.version.release")
	s.Android = strings.TrimSpace(android)
	text, err := dexAdb(serial, 10*time.Second, "shell", "dumpsys", "desktopmode")
	if err != nil {
		return nil, err
	}
	if match := dexIDPattern.FindStringSubmatch(text); len(match) > 1 {
		s.DisplayID, _ = strconv.Atoi(match[1])
	}
	s.Active = s.DisplayID > 0 && strings.Contains(text, "mDualModeEnabled=true")
	if strings.Contains(text, "WIRELESS_DEX") {
		s.Connection = "Wireless DeX"
	} else if strings.Contains(text, "DEX_ON_PC") {
		s.Connection = "DeX on PC"
	} else if s.Active {
		s.Connection = "External DeX"
	} else {
		s.Connection = "Inactive"
	}
	if s.Active {
		displays, err := dexAdb(serial, 8*time.Second, "shell", "dumpsys", "display")
		s.Loopback = err == nil && strings.Contains(displays, "mRemoteDisplayInterface=127.0.0.1:7236") && s.Connection == "Wireless DeX"
	}
	if s.Model == "SM-N976N" && s.Android == "12" {
		s.CanActivate = false
		s.Warning = "Note10 / One UI 4.1 denies CONFIGURE_WIFI_DISPLAY to ADB shell. Attach to DeX after activating it via Windows or a trusted external display."
	}
	return s, nil
}

func dexScriptPath() (string, error) {
	path := os.Getenv("DEX_BRIDGE_SCRIPT")
	if path == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		path = filepath.Join(home, ".local", "bin", "note20-dex-linux")
	}
	st, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("DeX activator not installed at %s: %w", path, err)
	}
	if st.Mode().Perm()&0111 == 0 {
		return "", fmt.Errorf("DeX activator is not executable: %s", path)
	}
	return path, nil
}

// SamsungDeXControl: action is activate, open, attach or stop.
// The existing proven DeX activator script owns the lifecycle. Its isolated
// optional "attach" mode NEVER creates a display or mirrors phone display 0.
func (a *App) SamsungDeXControl(serial, action string, bitrate, fps int) (string, error) {
	state, err := a.GetSamsungDeXStatus(serial)
	if err != nil {
		return "", err
	}
	script, err := dexScriptPath()
	if err != nil {
		return "", err
	}
	if bitrate != 4 && bitrate != 6 && bitrate != 8 && bitrate != 12 && bitrate != 16 && bitrate != 20 {
		return "", errors.New("unsupported bitrate preset")
	}
	if fps != 30 && fps != 45 && fps != 60 {
		return "", errors.New("unsupported frame rate")
	}
	forcedDisplay := 0
	if strings.HasPrefix(action, "attach:") {
		value := strings.TrimPrefix(action, "attach:")
		id, err := strconv.Atoi(value)
		if err != nil || id <= 0 || id > 255 {
			return "", errors.New("invalid DeX display ID; display 0 is forbidden")
		}
		forcedDisplay = id
		action = "attach"
	}
	targetMode := ""
	switch action {
	case "activate":
		if state.Active && !state.Loopback {
			return "", errors.New("External DeX is already active; use Attach to DeX")
		}
		if !state.Active && !state.CanActivate {
			return "", errors.New(state.Warning)
		}
		targetMode = "activate"
	case "attach":
		if forcedDisplay > 0 {
			displays, err := dexAdb(state.Serial, 12*time.Second, "shell", "dumpsys", "display")
			if err != nil {
				return "", err
			}
			validDisplay := false
			marker := regexp.MustCompile(fmt.Sprintf("displayId[ =]%d([^0-9]|$)", forcedDisplay))
			for _, line := range strings.Split(displays, "\n") {
				if !strings.Contains(line, "mBaseDisplayInfo=DisplayInfo") || !marker.MatchString(line) {
					continue
				}
				if strings.Contains(line, "FLAG_PC_DEX_DISPLAY") || (state.Active && strings.Contains(line, "\"Desktop\"")) {
					validDisplay = true
				}
			}
			if !validDisplay {
				return "", fmt.Errorf("Display %d is not an active recognized Samsung DeX external display (display 0 is never mirrored)", forcedDisplay)
			}
		} else if !state.Active || state.DisplayID <= 0 {
			return "", errors.New("No active genuine dual-mode DeX desktop detected. Enter an external DeX display ID if Windows created a different one.")
		}
		targetMode = "attach"
	case "open":
		if state.Active {
			targetMode = "attach"
		} else {
			if !state.CanActivate {
				return "", errors.New(state.Warning)
			}
			targetMode = "run"
		}
	case "stop":
		if !state.Loopback {
			return "", errors.New("Refusing to stop an external DeX session; only local loopback sessions can be stopped")
		}
		targetMode = "stop"
	default:
		return "", errors.New("unsupported DeX action")
	}
	cmd := exec.Command(script, targetMode)
	cmd.Env = append(os.Environ(),
		"NOTE20_SERIAL="+state.Serial,
		fmt.Sprintf("DEX_DISPLAY_ID=%d", forcedDisplay),
		fmt.Sprintf("DEX_VIDEO_BITRATE=%dM", bitrate),
		fmt.Sprintf("DEX_MAX_FPS=%d", fps),
		"DEX_WINDOW_TITLE=Samsung DeX - "+state.Model,
	)
	if action == "activate" || action == "stop" {
		ctx, cancel := context.WithTimeout(context.Background(), 55*time.Second)
		defer cancel()
		cmd = exec.CommandContext(ctx, script, targetMode)
		cmd.Env = append(os.Environ(), "NOTE20_SERIAL="+state.Serial)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return "", fmt.Errorf("%s: %w", strings.TrimSpace(string(output)), err)
		}
		return strings.TrimSpace(string(output)), nil
	}
	dir, err := os.UserCacheDir()
	if err != nil {
		dir = os.TempDir()
	}
	logfile := filepath.Join(dir, "adbkit-dex-"+strings.NewReplacer(":", "_", ".", "_").Replace(state.Serial)+".log")
	log, err := os.OpenFile(logfile, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return "", err
	}
	cmd.Stdout = log
	cmd.Stderr = log
	cmd.Stdin = nil
	err = cmd.Start()
	log.Close()
	if err != nil {
		return "", err
	}
	go cmd.Wait()
	return fmt.Sprintf("%s launched for %s (process %d). Status and errors: %s", targetMode, state.Model, cmd.Process.Pid, logfile), nil
}
