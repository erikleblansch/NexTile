#!/usr/bin/env bash
# Capture only the isolated Xephyr display. Requires GNOME 48 X11 and ffmpeg.
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
export NEXTILE_DEMO_ROOT="$repo_dir" NEXTILE_DRIVER="$repo_dir/tools/demo-driver"
export NEXTILE_FFMPEG="${NEXTILE_FFMPEG:-$(command -v ffmpeg)}"
export NEXTILE_DEMO_OUTPUT="${NEXTILE_DEMO_OUTPUT:-$repo_dir/docs/demo.mp4}"
export LC_ALL=en_US.UTF-8 LANGUAGE=en
bash "$repo_dir/tests/runtime.sh" x11
