#!/bin/bash

set -euo pipefail

./node_modules/.bin/prisma migrate deploy
exec "$@"
