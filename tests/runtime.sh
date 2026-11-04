#!/usr/bin/env bash
# Isolated bus, settings, extension directory and compositor; never replaces Shell.
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
test_dir=$(mktemp -d /tmp/nextile-runtime.XXXXXX)
echo "Runtime evidence: $test_dir"
mkdir -p "$test_dir/data/gnome-shell/extensions/nextile@erikleblansch.github.io" "$test_dir/config" "$test_dir/runtime"
chmod 700 "$test_dir/runtime"
cp "$repo_dir/"{extension.js,layout.js,tiler.js,panel.js,panelGeometry.js,stylesheet.css,metadata.json} "$test_dir/data/gnome-shell/extensions/nextile@erikleblansch.github.io/"
cp -r "$repo_dir/schemas" "$test_dir/data/gnome-shell/extensions/nextile@erikleblansch.github.io/"
glib-compile-schemas --strict "$test_dir/data/gnome-shell/extensions/nextile@erikleblansch.github.io/schemas"
cp -r "$repo_dir/tests/driver" "$test_dir/data/gnome-shell/extensions/nextile-test@local"
export XDG_DATA_HOME="$test_dir/data" XDG_CONFIG_HOME="$test_dir/config" XDG_RUNTIME_DIR="$test_dir/runtime"
export NEXTILE_TEST_RESULT="$test_dir/result.txt" NEXTILE_TEST_FIXTURE="$repo_dir/tests/fixture.py"
export GSETTINGS_BACKEND=keyfile
export NEXTILE_TEST_BACKEND="${1:-wayland}"
timeout 90s dbus-run-session -- bash -c '
    set -eu
    gsettings set org.gnome.shell enabled-extensions "['\''nextile@erikleblansch.github.io'\'', '\''nextile-test@local'\'']"
    gsettings set org.gnome.shell welcome-dialog-last-shown-version "48.0"
    gsettings set org.gnome.desktop.interface enable-animations false
    xephyr_pid=""
    if [ "$NEXTILE_TEST_BACKEND" = x11 ]; then
        Xephyr -displayfd 3 -screen 1280x800 -nolisten tcp -noreset 3> "$XDG_RUNTIME_DIR/display" > "$XDG_RUNTIME_DIR/xephyr.log" 2>&1 &
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
    gnome-shell --force-animations $shell_args > "$XDG_RUNTIME_DIR/shell.log" 2>&1 &
    shell_pid=$!
    trap "kill $shell_pid $xephyr_pid 2>/dev/null || true" EXIT
    for attempt in $(seq 1 170); do
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
