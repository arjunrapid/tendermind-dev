#!/usr/bin/env bash
# Local Postgres + pgvector for development, with no Docker and no Homebrew.
#
# Uses `pgserver` (https://pypi.org/project/pgserver/) - a PyPI package that
# bundles a real, prebuilt Postgres 16 + pgvector, installed into a throwaway
# Python 3.12 virtualenv managed by `uv` (https://astral.sh/uv), itself
# installed to ~/.local/bin with no sudo. Nothing here touches system
# directories or needs a password.
#
# `pgserver`'s Python wrapper only exposes a Unix socket by default. This
# script also enables a real TCP listener on 127.0.0.1:5433, because the
# Python backend's `asyncpg` driver is happy with either, but Node tooling
# generally expects TCP.
#
# NOTE: `@vercel/postgres` (used by lib/db.ts) will NOT work against this
# database - its `sql` tagged-template is hardcoded to Neon's HTTP proxy
# protocol, not the Postgres wire protocol, and refuses plain TCP connections
# entirely (verified: "Error connecting to database: fetch failed"). This
# script is therefore only useful for the Python/FastAPI backend
# (DATABASE_URL) - the TypeScript routes in app/api/* still need a real Neon
# or Vercel Postgres instance to run locally. See DEPLOYMENT.md.
#
# Usage:
#   scripts/local-postgres.sh start    # first run: sets up venv, initdb, starts
#   scripts/local-postgres.sh stop
#   scripts/local-postgres.sh status
#   scripts/local-postgres.sh psql [args...]
#   scripts/local-postgres.sh uri      # prints the DATABASE_URL to export

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGDATA="$ROOT_DIR/.pgdata"
VENV="$ROOT_DIR/.pgserver-venv"
PORT=5433
DB_NAME=bid_analyzer
PG_BIN="$VENV/lib/python3.12/site-packages/pgserver/pginstall/bin"
DATABASE_URL="postgresql://postgres@localhost:${PORT}/${DB_NAME}"

ensure_uv() {
  if ! command -v uv >/dev/null 2>&1; then
    if [ -x "$HOME/.local/bin/uv" ]; then
      export PATH="$HOME/.local/bin:$PATH"
    else
      echo "Installing uv (no sudo needed, installs to ~/.local/bin)..."
      curl -LsSf https://astral.sh/uv/install.sh | sh
      export PATH="$HOME/.local/bin:$PATH"
    fi
  fi
}

ensure_venv() {
  if [ ! -x "$VENV/bin/python" ]; then
    ensure_uv
    echo "Creating Python 3.12 venv for pgserver (pgserver has no wheels past 3.12)..."
    uv venv --python 3.12 "$VENV"
    uv pip install --python "$VENV/bin/python" pgserver
  fi
}

is_running() {
  "$PG_BIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1
}

cmd_start() {
  ensure_venv
  mkdir -p "$PGDATA"

  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "Initializing database cluster (first run only)..."
    # cleanup_mode=None: leave postgres running detached from this Python
    # process once initdb + first start are done, so we can restart it below
    # with our own TCP-enabling flags.
    "$VENV/bin/python" -c "
import pgserver
pgserver.get_server('$PGDATA', cleanup_mode=None)
"
    "$PG_BIN/pg_ctl" -D "$PGDATA" stop -w
  fi

  if is_running; then
    echo "Already running: $DATABASE_URL"
    exit 0
  fi

  "$PG_BIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/server.log" \
    -o "-h localhost -p $PORT -k $PGDATA" start -w

  "$PG_BIN/psql" "postgresql://postgres@localhost:${PORT}/postgres" \
    -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
    "$PG_BIN/psql" "postgresql://postgres@localhost:${PORT}/postgres" \
      -c "CREATE DATABASE ${DB_NAME};"

  "$PG_BIN/psql" "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;"

  echo ""
  echo "Postgres + pgvector running."
  echo "  export DATABASE_URL=\"$DATABASE_URL\""
  echo ""
  echo "This only works for the Python backend (asyncpg). The TypeScript"
  echo "routes need real Neon/Vercel Postgres - see DEPLOYMENT.md."
}

cmd_stop() {
  if [ -x "$PG_BIN/pg_ctl" ] && is_running; then
    "$PG_BIN/pg_ctl" -D "$PGDATA" stop -w
    echo "Stopped."
  else
    echo "Not running."
  fi
}

cmd_status() {
  if [ -x "$PG_BIN/pg_ctl" ]; then
    "$PG_BIN/pg_ctl" -D "$PGDATA" status || true
  else
    echo "Not set up yet - run: scripts/local-postgres.sh start"
  fi
}

cmd_psql() {
  shift || true
  "$PG_BIN/psql" "$DATABASE_URL" "$@"
}

cmd_uri() {
  echo "$DATABASE_URL"
}

case "${1:-}" in
  start)  cmd_start ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  psql)   cmd_psql "$@" ;;
  uri)    cmd_uri ;;
  *)
    echo "Usage: $0 {start|stop|status|psql [args]|uri}" >&2
    exit 1
    ;;
esac
