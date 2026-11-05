#!/usr/bin/env bash
# Isolated bus, settings, extension directory and compositor; never replaces Shell.
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
python3 "$repo_dir/tools/pack.py"
test_dir=$(mktemp -d /tmp/nextile-runtime.XXXXXX)
echo "Runtime evidence: $test_dir"
mkdir -p "$test_dir/data/gnome-shell/extensions/nextile@erikleblansch.github.io" "$test_dir/config" "$test_dir/runtime"
chmod 700 "$test_dir/runtime"
# Exercise installation of the actual upload package, including GNOME's schema
# compilation. Do not mask a broken ZIP by compiling schemas in the harness.
XDG_DATA_HOME="$test_dir/data" XDG_CONFIG_HOME="$test_dir/config" XDG_CACHE_HOME="$test_dir/cache" \
    gnome-extensions install --force "$repo_dir/dist/nextile@erikleblansch.github.io.shell-extension.zip"
test -s "$test_dir/data/gnome-shell/extensions/nextile@erikleblansch.github.io/schemas/gschemas.compiled"
cp -r "${NEXTILE_DRIVER:-$repo_dir/tests/driver}" "$test_dir/data/gnome-shell/extensions/nextile-test@local"
export XDG_DATA_HOME="$test_dir/data" XDG_CONFIG_HOME="$test_dir/config" XDG_RUNTIME_DIR="$test_dir/runtime"
export NEXTILE_TEST_RESULT="$test_dir/result.txt" NEXTILE_TEST_FIXTURE="$repo_dir/tests/fixture.py"
mkdir -p "$XDG_DATA_HOME/applications"
for name in Alpha Beta; do
    cat > "$XDG_DATA_HOME/applications/nextile-search-$name.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=NexTile Search Test $name
Exec=python3 "$NEXTILE_TEST_FIXTURE" "NexTile Search $name"
Icon=utilities-terminal
Terminal=false
EOF
done
for kind in Multi Single; do
    single=false
    [ "$kind" != Single ] || single=true
    cat > "$XDG_DATA_HOME/applications/org.gnome.NexTileLaunch$kind.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=NexTile Window Launch $kind
Exec=python3 "$repo_dir/tests/launch-fixture.py" $kind
Icon=utilities-terminal
StartupWMClass=org.gnome.NexTileLaunch$kind
X-GNOME-SingleWindow=$single
Actions=new-window;

[Desktop Action new-window]
Name=New Window
Exec=python3 "$repo_dir/tests/launch-fixture.py" $kind --new-window
EOF
done
export GSETTINGS_BACKEND=keyfile
mkdir -p "$XDG_CONFIG_HOME/gtk-3.0"
if [ -n "${NEXTILE_DEMO_ROOT:-}" ]; then
    python3 "$repo_dir/tools/configure-terminal.py" > /dev/null
else
    cp "$repo_dir/extras/terminal-transparency.css" "$XDG_CONFIG_HOME/gtk-3.0/gtk.css"
fi
export NEXTILE_TERMINAL_FIXTURE="$repo_dir/tests/terminal-fixture.py"
export NEXTILE_TEST_BACKEND="${1:-wayland}"
timeout 120s dbus-run-session -- bash -c '
    set -eu
    gsettings set org.gnome.shell enabled-extensions "['\''nextile@erikleblansch.github.io'\'', '\''nextile-test@local'\'']"
    gsettings set org.gnome.shell welcome-dialog-last-shown-version "99.0"
    gsettings set org.gnome.desktop.interface enable-animations false
    # Virtual devices start at (0, 0); do not let their creation trigger the
    # overview hot corner before the first scripted absolute motion arrives.
    gsettings set org.gnome.desktop.interface enable-hot-corners false
    gsettings set org.gnome.desktop.search-providers disable-external true
    xephyr_pid=""
    if [ "$NEXTILE_TEST_BACKEND" = x11 ]; then
        if [ -n "${NEXTILE_XVFB:-}" ]; then
            "$NEXTILE_XVFB" -displayfd 3 -screen 0 1440x900x24 -nolisten tcp -noreset 3> "$XDG_RUNTIME_DIR/display" > "$XDG_RUNTIME_DIR/xephyr.log" 2>&1 &
        else
            Xephyr -displayfd 3 -screen 1280x800 -nolisten tcp -noreset 3> "$XDG_RUNTIME_DIR/display" > "$XDG_RUNTIME_DIR/xephyr.log" 2>&1 &
        fi
        xephyr_pid=$!
        for attempt in $(seq 1 40); do
            [ -s "$XDG_RUNTIME_DIR/display" ] && break
            sleep 0.1
        done
        export DISPLAY=":$(cat "$XDG_RUNTIME_DIR/display")" GDK_BACKEND=x11
        unset WAYLAND_DISPLAY
        shell_args="--x11"
    else
        export WAYLAND_DISPLAY=nextile-test GDK_BACKEND=wayland
        shell_args="--headless --wayland --no-x11 --virtual-monitor 1280x800 --virtual-monitor 1024x768 --wayland-display nextile-test"
    fi
    dbus-update-activation-environment DISPLAY XDG_DATA_HOME XDG_CONFIG_HOME XDG_RUNTIME_DIR GSETTINGS_BACKEND GDK_BACKEND
    if [ "$NEXTILE_TEST_BACKEND" != x11 ]; then
        dbus-update-activation-environment WAYLAND_DISPLAY
    fi
    gnome-shell --force-animations $shell_args > "$XDG_RUNTIME_DIR/shell.log" 2>&1 &
    shell_pid=$!
    cleanup() {
        kill "$shell_pid" 2>/dev/null || true
        wait "$shell_pid" 2>/dev/null || true
        if [ -n "$xephyr_pid" ]; then
            kill "$xephyr_pid" 2>/dev/null || true
            wait "$xephyr_pid" 2>/dev/null || true
        fi
    }
    trap cleanup EXIT
    for attempt in $(seq 1 230); do
        if [ -f "$NEXTILE_TEST_RESULT" ]; then cat "$NEXTILE_TEST_RESULT"; exit 0; fi
        kill -0 "$shell_pid" || exit 1
        sleep 0.5
    done
    exit 1
' || { tail -80 "$test_dir/runtime/shell.log"; exit 1; }
if grep -q '^FAIL:' "$NEXTILE_TEST_RESULT"; then
    tail -80 "$test_dir/runtime/shell.log"
    exit 1
fi
if grep -E 'JS ERROR|Gjs-CRITICAL|Theme parsing error|NexTile (search|contrast):' "$test_dir/runtime/shell.log"; then
    exit 1
fi
