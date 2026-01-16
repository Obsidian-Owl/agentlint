#!/bin/bash
# Install git hooks for local development
# Runs automatically via `bun install` (npm prepare script)

set -e

HOOKS_DIR=".git/hooks"
SCRIPTS_DIR="$(dirname "$0")"

# Only install if we're in a git repository
if [ ! -d ".git" ]; then
  echo "Not a git repository, skipping hook installation"
  exit 0
fi

echo "Installing git hooks..."

# Install pre-push hook
cp "$SCRIPTS_DIR/pre-push" "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/pre-push"

echo "Git hooks installed successfully!"
echo "  - pre-push: Runs CI checks before pushing"
