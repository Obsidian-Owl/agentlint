#!/usr/bin/env bash
# common.sh - Shared utilities for dev workflow skills
# This file is duplicated in each skill for portability

set -euo pipefail

# Get repository root directory
get_repo_root() {
    if command -v git &>/dev/null && git rev-parse --git-dir &>/dev/null 2>&1; then
        git rev-parse --show-toplevel
    else
        # Fallback: walk up until we find .specify or .claude
        local dir="$PWD"
        while [[ "$dir" != "/" ]]; do
            if [[ -d "$dir/.specify" ]] || [[ -d "$dir/.claude" ]]; then
                echo "$dir"
                return 0
            fi
            dir="$(dirname "$dir")"
        done
        echo "$PWD"
    fi
}

# Get current branch name
get_current_branch() {
    # Allow override via environment variable
    if [[ -n "${SPECIFY_FEATURE:-}" ]]; then
        echo "$SPECIFY_FEATURE"
        return 0
    fi

    if command -v git &>/dev/null && git rev-parse --git-dir &>/dev/null 2>&1; then
        git rev-parse --abbrev-ref HEAD
    else
        echo "main"
    fi
}

# Check if git is available
has_git() {
    command -v git &>/dev/null && git rev-parse --git-dir &>/dev/null 2>&1
}

# Validate feature branch naming convention
# Pattern: {epic-id}-{feature-name} where epic-id is like EP01, EP02, etc.
check_feature_branch() {
    local branch="$1"
    # Match patterns like: EP01-feature-name, ep02-another-feature
    if [[ "$branch" =~ ^[Ee][Pp][0-9]+[a-z]?-.+ ]]; then
        return 0
    else
        return 1
    fi
}

# Extract Epic ID from branch name (e.g., EP01 from EP01-feature-name)
extract_epic_id() {
    local branch="$1"
    echo "$branch" | sed -E 's/^([Ee][Pp][0-9]+[a-z]?)-.*/\1/' | tr '[:lower:]' '[:upper:]'
}

# Find feature directory by Epic ID prefix
find_feature_dir_by_prefix() {
    local repo_root="$1"
    local epic_id="$2"
    local specs_dir="$repo_root/specs"

    if [[ ! -d "$specs_dir" ]]; then
        return 1
    fi

    # Find directory matching the epic ID (case-insensitive)
    local pattern="${epic_id,,}-*"  # lowercase for matching
    local found_dir=""

    for dir in "$specs_dir"/*; do
        if [[ -d "$dir" ]]; then
            local dirname="$(basename "$dir")"
            if [[ "${dirname,,}" == ${pattern} ]]; then
                found_dir="$dir"
                break
            fi
        fi
    done

    if [[ -n "$found_dir" ]]; then
        echo "$found_dir"
        return 0
    else
        return 1
    fi
}

# Get all feature paths as shell variables
# Usage: eval "$(get_feature_paths)"
get_feature_paths() {
    local repo_root
    repo_root="$(get_repo_root)"

    local current_branch
    current_branch="$(get_current_branch)"

    local epic_id=""
    local feature_dir=""
    local feature_spec=""
    local impl_plan=""
    local tasks=""

    if check_feature_branch "$current_branch"; then
        epic_id="$(extract_epic_id "$current_branch")"
        feature_dir="$(find_feature_dir_by_prefix "$repo_root" "$epic_id" 2>/dev/null || echo "")"

        if [[ -n "$feature_dir" ]]; then
            feature_spec="$feature_dir/spec.md"
            impl_plan="$feature_dir/plan.md"
            tasks="$feature_dir/tasks.md"
        fi
    fi

    cat <<EOF
REPO_ROOT="$repo_root"
CURRENT_BRANCH="$current_branch"
HAS_GIT="$(has_git && echo "true" || echo "false")"
EPIC_ID="$epic_id"
FEATURE_DIR="$feature_dir"
FEATURE_SPEC="$feature_spec"
IMPL_PLAN="$impl_plan"
TASKS="$tasks"
SPECS_DIR="$repo_root/specs"
CONSTITUTION="$repo_root/.specify/memory/constitution.md"
EOF
}

# Output paths as JSON
get_feature_paths_json() {
    local repo_root
    repo_root="$(get_repo_root)"

    local current_branch
    current_branch="$(get_current_branch)"

    local epic_id=""
    local feature_dir=""
    local feature_spec=""
    local impl_plan=""
    local tasks=""

    if check_feature_branch "$current_branch"; then
        epic_id="$(extract_epic_id "$current_branch")"
        feature_dir="$(find_feature_dir_by_prefix "$repo_root" "$epic_id" 2>/dev/null || echo "")"

        if [[ -n "$feature_dir" ]]; then
            feature_spec="$feature_dir/spec.md"
            impl_plan="$feature_dir/plan.md"
            tasks="$feature_dir/tasks.md"
        fi
    fi

    cat <<EOF
{
  "REPO_ROOT": "$repo_root",
  "CURRENT_BRANCH": "$current_branch",
  "HAS_GIT": $(has_git && echo "true" || echo "false"),
  "EPIC_ID": "$epic_id",
  "FEATURE_DIR": "$feature_dir",
  "FEATURE_SPEC": "$feature_spec",
  "IMPL_PLAN": "$impl_plan",
  "TASKS": "$tasks",
  "SPECS_DIR": "$repo_root/specs",
  "CONSTITUTION": "$repo_root/.specify/memory/constitution.md"
}
EOF
}

# Check if a file exists and output status
check_file() {
    local file="$1"
    local label="${2:-$file}"

    if [[ -f "$file" ]]; then
        echo "✓ $label"
        return 0
    else
        echo "✗ $label (missing)"
        return 1
    fi
}

# Check if a directory exists and output status
check_dir() {
    local dir="$1"
    local label="${2:-$dir}"

    if [[ -d "$dir" ]]; then
        echo "✓ $label"
        return 0
    else
        echo "✗ $label (missing)"
        return 1
    fi
}

# Generate a slug from a string (lowercase, hyphens, no special chars)
slugify() {
    local input="$1"
    echo "$input" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-|-$//g'
}

# If sourced, export functions; if run directly, show help
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        --json)
            get_feature_paths_json
            ;;
        --paths)
            get_feature_paths
            ;;
        *)
            echo "Usage: common.sh [--json|--paths]"
            echo ""
            echo "Shared utilities for dev workflow skills."
            echo ""
            echo "Options:"
            echo "  --json   Output feature paths as JSON"
            echo "  --paths  Output feature paths as shell variables"
            echo ""
            echo "Functions available when sourced:"
            echo "  get_repo_root, get_current_branch, has_git,"
            echo "  check_feature_branch, extract_epic_id,"
            echo "  find_feature_dir_by_prefix, get_feature_paths,"
            echo "  check_file, check_dir, slugify"
            ;;
    esac
fi
