#!/usr/bin/env bash
set -euo pipefail

echo "Bootstrapping AddisGebeya local environment..."

if [ ! -f "apps/web/.env.local" ] && [ -f "apps/web/.env.example" ]; then
  cp apps/web/.env.example apps/web/.env.local
  echo "Created apps/web/.env.local from .env.example"
fi

if [ ! -f "apps/api/.env" ] && [ -f "apps/api/.env.example" ]; then
  cp apps/api/.env.example apps/api/.env
  echo "Created apps/api/.env from .env.example"
fi

echo "Done. Update secrets in apps/api/.env before starting the API."

