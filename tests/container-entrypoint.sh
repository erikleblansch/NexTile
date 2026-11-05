#!/usr/bin/env bash
set -euo pipefail
mkdir -p /run/dbus
# Packages create this directory even though systemd is not PID 1 here.
# Let Shell select its non-systemd login manager in the isolated container.
if [ -d /run/systemd/seats ]; then
    rmdir /run/systemd/seats
fi
# No host system bus, display, home directory or GPU is shared.
dbus-daemon --system --fork
cp -a /source /tmp/nextile-source
# GitHub's checkout UID differs from the isolated runtime user's UID. The
# native-install harness now builds its ZIP, so its private copy must be writable.
chown -R 1000:1000 /tmp/nextile-source
python3 /tmp/nextile-source/tools/translations.py
gnome-shell --version
result=0
setpriv --reuid 1000 --regid 1000 --clear-groups \
    bash /tmp/nextile-source/tests/runtime.sh wayland || result=$?
cp -a /tmp/nextile-runtime.* /evidence/
exit "$result"
