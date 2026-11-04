#!/usr/bin/env bash
set -euo pipefail
mkdir -p /run/dbus
# No host system bus, display, home directory or GPU is shared.
dbus-daemon --system --fork
cp -a /source /tmp/nextile-source
python3 /tmp/nextile-source/tools/translations.py
gnome-shell --version
result=0
setpriv --reuid 1000 --regid 1000 --clear-groups \
    bash /tmp/nextile-source/tests/runtime.sh wayland || result=$?
cp -a /tmp/nextile-runtime.* /evidence/
exit "$result"
