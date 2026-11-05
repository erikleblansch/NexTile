#!/usr/bin/env bash
set -euo pipefail
repo_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
version=${1:-51}
containerfile=Containerfile
base_arg=FEDORA_IMAGE
case "$version" in
    46) base='ubuntu:24.04@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852'; containerfile=Containerfile.ubuntu; base_arg=UBUNTU_IMAGE ;;
    47) base='fedora:41@sha256:f1a3fab47bcb3c3ddf3135d5ee7ba8b7b25f2e809a47440936212a3a50957f3d' ;;
    49) base='fedora:43@sha256:f01112b9a1f1d0504ad962d9adfa401425033f8ab067e0a821904ebdde5b8ca5' ;;
    50) base='fedora:44@sha256:15da97ed9aa94dd3d92c3925eb89520f6c80e07ea7ee24cba848d1f8b6912b3e' ;;
    51) base='fedora:45@sha256:a7d72ba2745b100a3351087472e5ee7b2450af7cf331e7673007e3817612839c' ;;
    *) echo 'Usage: tests/runtime-container.sh 46|47|49|50|51' >&2; exit 2 ;;
esac
image="nextile-runtime-test:$version"
evidence=$(mktemp -d /tmp/nextile-container-evidence.XXXXXX)
echo "Container evidence: $evidence"
docker build --build-arg "$base_arg=$base" -f "$repo_dir/tests/$containerfile" -t "$image" "$repo_dir"
docker run --rm --network none --shm-size=512m \
    -e NEXTILE_TEST_ONLY -v "$repo_dir:/source:ro" -v "$evidence:/evidence" "$image"
