#!/usr/bin/env bash
# pre-commit-constitution.sh - Validate commits against project constitution
# Part of dev workflow hooks
#
# This hook validates that significant code changes align with project principles.
# It's designed to run as a Claude Code pre-commit hook or git pre-commit hook.
#
# Usage:
#   As Claude Code hook: Add to .claude/settings.json hooks section
#   As git hook: Link to .git/hooks/pre-commit

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
CONSTITUTION="$REPO_ROOT/.specify/memory/constitution.md"

# Colors for output (if terminal supports)
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Track violations
ERRORS=()
WARNINGS=()

log_error() {
    ERRORS+=("$1")
    echo -e "${RED}ERROR${NC}: $1"
}

log_warning() {
    WARNINGS+=("$1")
    echo -e "${YELLOW}WARNING${NC}: $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

echo "Constitution Validation"
echo "======================="
echo ""

# Check if constitution exists
if [[ ! -f "$CONSTITUTION" ]]; then
    log_warning "Constitution not found at $CONSTITUTION"
    echo "Skipping constitution validation."
    exit 0
fi

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM)

if [[ -z "$STAGED_FILES" ]]; then
    echo "No staged files to check."
    exit 0
fi

echo "Checking ${#STAGED_FILES[@]} staged files..."
echo ""

# Check 1: No secrets in staged files
echo "Checking for secrets..."
SECRET_PATTERNS=(
    "ANTHROPIC_API_KEY"
    "OPENAI_API_KEY"
    "AWS_SECRET"
    "password\s*=\s*['\"][^'\"]+['\"]"
    "api_key\s*=\s*['\"][^'\"]+['\"]"
    "secret\s*=\s*['\"][^'\"]+['\"]"
)

for file in $STAGED_FILES; do
    if [[ -f "$file" ]]; then
        for pattern in "${SECRET_PATTERNS[@]}"; do
            if grep -qE "$pattern" "$file" 2>/dev/null; then
                log_error "Potential secret found in $file (pattern: $pattern)"
            fi
        done
    fi
done

if [[ ${#ERRORS[@]} -eq 0 ]]; then
    log_success "No secrets detected (Principle I: Local-First)"
fi

# Check 2: Task IDs in commit messages for feature branches
echo ""
echo "Checking branch context..."
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")

if [[ "$BRANCH" =~ ^[Ee][Pp][0-9]+-.+ ]]; then
    echo "Feature branch detected: $BRANCH"
    # This check would run on commit message, but we're in pre-commit
    log_success "On feature branch (Principle VIII: Compounding Value - traceable)"
else
    log_warning "Not on a feature branch. Consider using ep##-feature-name format."
fi

# Check 3: No hardcoded values that should be configurable
echo ""
echo "Checking for hardcoded configuration..."
HARDCODE_PATTERNS=(
    "localhost:[0-9]+"
    "127\.0\.0\.1:[0-9]+"
    "http://.*\.local"
)

for file in $STAGED_FILES; do
    if [[ -f "$file" ]] && [[ "$file" =~ \.(ts|js|py|go|rs)$ ]]; then
        for pattern in "${HARDCODE_PATTERNS[@]}"; do
            if grep -qE "$pattern" "$file" 2>/dev/null; then
                log_warning "Potential hardcoded config in $file (pattern: $pattern)"
            fi
        done
    fi
done

if [[ ${#WARNINGS[@]} -eq 0 ]]; then
    log_success "No hardcoded configuration detected"
fi

# Summary
echo ""
echo "Summary"
echo "======="
echo ""

if [[ ${#ERRORS[@]} -gt 0 ]]; then
    echo -e "${RED}BLOCKED${NC}: ${#ERRORS[@]} error(s) found"
    echo ""
    echo "Errors must be fixed before commit:"
    for err in "${ERRORS[@]}"; do
        echo "  - $err"
    done
    echo ""
    echo "To bypass (not recommended): git commit --no-verify"
    exit 1
fi

if [[ ${#WARNINGS[@]} -gt 0 ]]; then
    echo -e "${YELLOW}PASSED WITH WARNINGS${NC}: ${#WARNINGS[@]} warning(s)"
    echo ""
    echo "Warnings (consider addressing):"
    for warn in "${WARNINGS[@]}"; do
        echo "  - $warn"
    done
else
    echo -e "${GREEN}PASSED${NC}: All constitution checks pass"
fi

echo ""
exit 0
