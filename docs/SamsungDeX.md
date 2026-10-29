# Samsung DeX in ADBKit — install and compatibility

This fork extends the upstream [ADBKit](https://github.com/Drenzzz/ADBKit)
with **genuine Samsung DeX dual mode**, preserving its normal ADB, APK,
file management, Logcat, Fastboot, scrcpy, and device management tools.

It uses the [ScrcpyDeX](https://github.com/Aureliano021/ScrcpyDex)
phone-local RTSP activator. Its Apache 2.0 license and attribution are in
`dex/third_party/scrcpydex/`. The main ADBKit program remains under MIT.

## Fast Linux installation (x86_64)

```bash
git clone https://github.com/lotfinity/ADBKit-DeX.git
cd ADBKit-DeX
bash scripts/install-linux.sh
```

The installer downloads the prebuilt release and checks its SHA-256. It
installs user-local files (without changing system partitions):
- executable `~/.local/opt/adbkit-dex/ADBKit-DeX`;
- DeX launcher `~/.local/bin/note20-dex-linux`;
- activation server `~/.local/share/note20-dex/scrcpydex-server.jar`;
- desktop shortcut `~/.local/share/applications/adbkit-samsung-dex.desktop`.

The installer offers to install required host ADB, scrcpy, and GTK/WebKit
runtime packages through apt when missing. On non-apt Linux distributions,
install equivalent packages manually and use `--skip-deps`.

To launch, select **ADBKit + Samsung DeX** in the app menu, or run:
```bash
~/.local/opt/adbkit-dex/ADBKit-DeX
```

## Build from source

With Go 1.26 or later (Go toolchains auto-download in supported versions),
Bun, GTK4/WebKitGTK 6 development headers, ADB, and scrcpy:

```bash
bash scripts/install-linux.sh --source
```

This installs into the same user-local destinations. It does not require
the Wails CLI because generated bindings are committed. Source install also
works on compatible CPU architectures if the host has dependencies.

## Device behavior

- **Galaxy Note20 Ultra, One UI 6.1.1 custom port / Android 14:** verified
  local-loopback true dual-display DeX activation on display ID 2 while
  Android display 0 remains usable. The display ID is detected dynamically.
- **Galaxy Note10 SM-N976N, One UI 4.1 / Android 12:** Android rejects
  loopback activation for shell UID with
  `android.permission.CONFIGURE_WIFI_DISPLAY`. Start DeX on an authorized
  Windows client or compatible receiver, then use **Attach existing DeX**.
  Enter display ID 8 only if that ID is currently present on the device.
  External attach in the updated ADBKit UI still needs further validation.
  This Exynos device uses `OMX.Exynos.AVC.Encoder` or automatic encoder
  selection, not the Qualcomm encoder name.
- **Other Galaxy phones:** compatibility depends on firmware; the GUI checks
  for a real separate DeX display and refuses Android display ID 0.

There are four controls in the Samsung DeX screen: Launch (activate or
attach), Attach (keep existing external activation), Activate only, and
Stop (only for independently activated local-loopback sessions).
The UI shows loading animations, errors, bitrate and FPS presets, and
an optional external DeX display-ID field.

## Technical design

- React UI: `frontend/src/routes/SamsungDeXPage.tsx`
- Go integration: `internal/app/app_dex.go`
- Linux shell activator: `dex/linux/note20-dex-linux`
- Android activation server: `dex/third_party/scrcpydex/scrcpydex-server.jar`

Runtime Go uses the installed launcher at
`~/.local/bin/note20-dex-linux` (or `DEX_BRIDGE_SCRIPT` override).
The launcher requires `NOTE20_SERIAL` when multiple ADB connections are
active; the GUI passes the selected serial automatically. It never mirrors
display 0 and does not grant root privileges.

## Tested

Acer Debian 13, GTK4 4.18, WebKitGTK 6, scrcpy 4.0:
- Wails native Linux executable built and started;
- React frontend built with Bun and TypeScript;
- DeX-specific Go unit tests passed;
- Note20 genuine DeX display 2 activated and streamed.

## Other operating systems

The bundled launcher is a **Linux Bash** implementation. The ADBKit core
is cross-platform, but independent DeX on Windows/macOS is **not yet
packaged or validated** in this fork. Please do not assume the Linux release
binary will run on Windows or on Android phones themselves.
