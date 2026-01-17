#!/bin/bash
# Install git hooks for local development
# Runs automatically via `bun install` (npm prepare script)
#
# QUALITY BAR: All issues must be caught locally - not in CI
# Type safety is critical - it's why we chose TypeScript

set -e

HOOKS_DIR=".git/hooks"
SCRIPTS_DIR="$(dirname "$0")"

# Only install if we're in a git repository
if [ ! -d ".git" ]; then
  echo "Not a git repository, skipping hook installation"
  exit 0
fi

echo "Installing git hooks..."

# Install pre-commit hook - catches issues early
cp "$SCRIPTS_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"

# Install pre-push hook - runs full CI suite
cp "$SCRIPTS_DIR/pre-push" "$HOOKS_DIR/pre-push"
chmod +x "$HOOKS_DIR/pre-push"

echo ""
echo "Git hooks installed successfully!"
echo "  - pre-commit: TypeScript check + ESLint + Format check"
echo "  - pre-push: Full CI suite (lint, format, types, tests, build)"
echo ""
echo "Quality Bar:"
echo "  • Type safety is CRITICAL - no TypeScript errors allowed"
echo "  • All ESLint errors must be fixed before committing"
echo "  • We do NOT pass issues to CI - we fix them locally"
echo "  • Pre-existing issues are not acceptable - fix all identified issues"
