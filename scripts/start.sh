#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
./scripts/setup.sh
docker compose up -d --build --remove-orphans --wait --wait-timeout 360
./scripts/smoke.sh
