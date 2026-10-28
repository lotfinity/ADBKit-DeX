# Samsung DeX extension for ADBKit

This local ADBKit fork adds a React/Wails **Samsung DeX** screen while retaining
the upstream Android device, app, file, shell, Logcat, Fastboot and scrcpy tools.

## Where to launch

Acer app menu: **ADBKit + Samsung DeX**

Binary: `~/DEV/ADBKit-DeX/bin/ADBKit-DeX`

Source: `~/DEV/ADBKit-DeX`

The original ADBKit AppImage and old PyQt DeX Bridge remain as backups.

## How it works

`internal/app/app_dex.go` exposes `GetSamsungDeXStatus` and
`SamsungDeXControl`. The frontend displays explicit busy spinners,
status updates, and actionable errors. The Go backend invokes the existing
proven phone-local DeX activation script at
`~/.local/bin/note20-dex-linux`, never mirroring phone display 0.

- **Launch:** activate real Samsung dual-mode DeX if permitted, then attach scrcpy.
- **Activate:** start local-loopback DeX only.
- **Attach:** attach to already active DeX without reactivating. Optionally specify
  a nonzero display ID (e.g. Windows-created display 8).
- **Stop:** stop only a verified local-loopback session; never terminate
  external Windows/Miracast connections.

The backend validates that requested displays exist and prevents using display
ID 0.

## Verified device compatibility

- **Rooted Note20 Ultra, Android 14 One UI 6.1.1 port:** genuine dual-mode
  desktop successfully activated and streamed as separate display ID 2.
- **Unrooted SM-N976N Note10, Android 12 One UI 4.1:** ADB-shell activation
  fails at Samsung's `CONFIGURE_WIFI_DISPLAY` security permission. Use
  the external Windows/DeX receiver to activate, then **Attach** to the real
  display (the previously observed display was ID 8). External attach has
  not been end-to-end retested during this build. The Exynos Note10 uses
  its own hardware encoder, not the Note20's Qualcomm encoder.

## Validation / rebuild

Wails bindings generated; React frontend builds; DeX-specific Go tests pass;
native GTK/WebKit build launches and independently activates Note20 DeX.

```bash
cd ~/DEV/ADBKit-DeX
~/DEV/adbkit-dex-tools/wails3 generate bindings -clean -ts
(cd frontend && ~/.bun/bin/bun run build)
go build -o bin/ADBKit-DeX .
```

Root modules and system partitions have not been changed by the extension.
The original standalone script has been backed up in
`~/.local/share/samsung-dex-bridge-v2/backups/`.
