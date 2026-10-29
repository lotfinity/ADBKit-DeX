#!/usr/bin/env bash
# Install the ADBKit + Samsung DeX fork after cloning the full repository.
set -euo pipefail

REPO="lotfinity/ADBKit-DeX"
TAG="v0.1.0-dex"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE=binary
DEPS=1
LAUNCH=0
usage() {
  cat <<'EOF'
Usage: bash scripts/install-linux.sh [--binary|--source] [--skip-deps] [--launch]

--binary       Download checksum-verified Linux x86_64 release (default)
--source       Build from this checkout (Go 1.26+, Bun, GTK4/WebKitGTK6 headers)
--skip-deps    Do not install any OS packages
--launch       Launch the app when installation finishes

Linux only. Tested on Debian 13; other distributions need GTK4 + WebKitGTK 6.
EOF
}
while [ "$#" -gt 0 ]; do
 case "$1" in
  --binary) MODE=binary;;
  --source) MODE=source;;
  --skip-deps) DEPS=0;;
  --launch) LAUNCH=1;;
  --help|-h) usage; exit 0;;
  *) echo "Unknown flag: $1" >&2; usage >&2; exit 2;;
 esac
 shift
done

[ "$(id -u)" != 0 ] || { echo "Do not run this script as root." >&2; exit 1; }
[ "$(uname -s)" = Linux ] || { echo "Linux only." >&2; exit 1; }
[ -f "$ROOT/dex/linux/note20-dex-linux" ] || { echo "Clone the complete repo first." >&2; exit 1; }
[ -f "$ROOT/dex/third_party/scrcpydex/scrcpydex-server.jar" ] || { echo "Missing bundled activation server." >&2; exit 1; }
command -v curl >/dev/null || { echo "curl is required." >&2; exit 1; }

if [ "$DEPS" -eq 1 ]; then
  MISSING=""
  command -v adb >/dev/null || MISSING="$MISSING adb"
  command -v scrcpy >/dev/null || MISSING="$MISSING scrcpy"
  if ! (ldconfig -p 2>/dev/null | grep -q libwebkitgtk-6.0); then
    MISSING="$MISSING libgtk-4-1 libwebkitgtk-6.0-4 libsoup-3.0-0"
  fi
  if [ "$MODE" = source ]; then
    MISSING="$MISSING build-essential pkg-config libgtk-4-dev libwebkitgtk-6.0-dev libsoup-3.0-dev"
  fi
  if [ -n "$MISSING" ]; then
    if ! command -v apt-get >/dev/null; then
      echo "Install these dependencies manually using your distro package manager:$MISSING" >&2
      exit 1
    fi
    echo "Installing necessary OS packages:$MISSING"
    sudo apt-get update
    # Intentional word splitting of a fixed, hard-coded package list.
    sudo apt-get install -y $MISSING
  fi
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if [ "$MODE" = binary ]; then
  [ "$(uname -m)" = x86_64 ] || { echo "Binary release targets x86_64 only; try --source." >&2; exit 1; }
  URL="https://github.com/$REPO/releases/download/$TAG"
  echo "Downloading $REPO release $TAG…"
  curl --fail --location --retry 2 "$URL/ADBKit-DeX-linux-amd64" -o "$TMP/ADBKit-DeX"
  curl --fail --location --retry 2 "$URL/ADBKit-DeX-linux-amd64.sha256" -o "$TMP/ADBKit-DeX-linux-amd64.sha256"
  ( cd "$TMP"; cp ADBKit-DeX ADBKit-DeX-linux-amd64; sha256sum -c ADBKit-DeX-linux-amd64.sha256 )
else
  command -v go >/dev/null || { echo "Install Go 1.26+ (https://go.dev/dl/)." >&2; exit 1; }
  if command -v bun >/dev/null; then BUN=bun
  elif [ -x "$HOME/.bun/bin/bun" ]; then BUN="$HOME/.bun/bin/bun"
  else echo "Install Bun (https://bun.sh/) before using --source." >&2; exit 1
  fi
  echo "Building frontend with Bun…"
  (cd "$ROOT/frontend"; "$BUN" install --frozen-lockfile; "$BUN" run build)
  echo "Building native Wails application with Go…"
  (cd "$ROOT"; go build -o "$TMP/ADBKit-DeX" .)
fi

chmod +x "$TMP/ADBKit-DeX"
APP_DIR="$HOME/.local/opt/adbkit-dex"
SHARE="$HOME/.local/share/adbkit-dex"
DEX_SHARE="$HOME/.local/share/note20-dex"
mkdir -p "$APP_DIR" "$SHARE" "$DEX_SHARE" "$HOME/.local/bin" "$HOME/.local/share/applications"
install -m 755 "$TMP/ADBKit-DeX" "$APP_DIR/ADBKit-DeX"
install -m 755 "$ROOT/dex/linux/note20-dex-linux" "$HOME/.local/bin/note20-dex-linux"
install -m 644 "$ROOT/dex/third_party/scrcpydex/scrcpydex-server.jar" "$DEX_SHARE/scrcpydex-server.jar"
install -m 644 "$ROOT/build/appicon.png" "$SHARE/appicon.png"
cat > "$HOME/.local/share/applications/adbkit-samsung-dex.desktop" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=ADBKit + Samsung DeX
GenericName=Android Device Manager with Samsung DeX
Comment=ADBKit extended with genuine dual-display Samsung DeX
Exec=$APP_DIR/ADBKit-DeX
Icon=$SHARE/appicon.png
Terminal=false
StartupNotify=true
Categories=Development;
EOF
if command -v desktop-file-validate >/dev/null; then
 desktop-file-validate "$HOME/.local/share/applications/adbkit-samsung-dex.desktop"
fi
if command -v update-desktop-database >/dev/null; then
 update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true
fi
echo "Installed ADBKit + Samsung DeX: $APP_DIR/ADBKit-DeX"
echo "Application menu: ADBKit + Samsung DeX"
echo "DeX backend: $HOME/.local/bin/note20-dex-linux"
echo "Connect a phone through ADB and use the Samsung DeX tab."
echo "Android 12 Note10: attach to an existing DeX connection; loopback activation is restricted."
if [ "$LAUNCH" -eq 1 ]; then "$APP_DIR/ADBKit-DeX" >/dev/null 2>&1 & fi
