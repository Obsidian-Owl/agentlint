#!/usr/bin/env bash
# create-new-feature.sh - Initialize a new feature branch and spec directory
# Part of dev.specify skill

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

# Configuration
TEAM_NAME="${TEAM_NAME:-agentlint}"
EPIC_PREFIX="${EPIC_PREFIX:-EP}"

usage() {
    cat <<EOF
Usage: create-new-feature.sh [OPTIONS] <epic-id> [feature-name]

Initialize a new feature branch and specification directory.

Arguments:
  epic-id       Epic identifier (e.g., EP01, EP02, EP10a)
  feature-name  Optional short feature name (2-4 words, will be slugified)

Options:
  --json        Output result as JSON
  --no-branch   Don't create git branch (just create spec directory)
  -h, --help    Show this help message

Examples:
  create-new-feature.sh EP01 "User Authentication"
  create-new-feature.sh EP02 --json
  create-new-feature.sh EP03 "Config Parser" --no-branch

Environment Variables:
  TEAM_NAME     Team name for branch prefix (default: agentlint)
  EPIC_PREFIX   Epic ID prefix (default: EP)
EOF
}

# Parse arguments
JSON_OUTPUT=false
CREATE_BRANCH=true
EPIC_ID=""
FEATURE_NAME=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --no-branch)
            CREATE_BRANCH=false
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        -*)
            echo "Error: Unknown option $1" >&2
            usage >&2
            exit 1
            ;;
        *)
            if [[ -z "$EPIC_ID" ]]; then
                EPIC_ID="$1"
            elif [[ -z "$FEATURE_NAME" ]]; then
                FEATURE_NAME="$1"
            else
                echo "Error: Too many arguments" >&2
                usage >&2
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate Epic ID
if [[ -z "$EPIC_ID" ]]; then
    echo "Error: Epic ID is required" >&2
    usage >&2
    exit 1
fi

# Normalize Epic ID (uppercase EP prefix)
EPIC_ID="$(echo "$EPIC_ID" | tr '[:lower:]' '[:upper:]')"

# Validate Epic ID format (EP followed by digits, optional letter)
if [[ ! "$EPIC_ID" =~ ^${EPIC_PREFIX}[0-9]+[A-Za-z]?$ ]]; then
    echo "Error: Invalid Epic ID format. Expected ${EPIC_PREFIX}XX or ${EPIC_PREFIX}XXa (e.g., EP01, EP10a)" >&2
    exit 1
fi

# Get repo root
REPO_ROOT="$(get_repo_root)"
SPECS_DIR="$REPO_ROOT/specs"

# Check if spec already exists for this Epic
if find_feature_dir_by_prefix "$REPO_ROOT" "$EPIC_ID" &>/dev/null; then
    EXISTING_DIR="$(find_feature_dir_by_prefix "$REPO_ROOT" "$EPIC_ID")"
    echo "Warning: Spec directory already exists for $EPIC_ID: $EXISTING_DIR" >&2
    echo "Use a different Epic ID or work with the existing spec." >&2
    exit 1
fi

# Generate feature name slug if provided, otherwise use Epic ID
if [[ -n "$FEATURE_NAME" ]]; then
    FEATURE_SLUG="$(slugify "$FEATURE_NAME")"
else
    FEATURE_SLUG="feature"
fi

# Create directory name
DIR_NAME="${EPIC_ID,,}-${FEATURE_SLUG}"  # lowercase epic id
FEATURE_DIR="$SPECS_DIR/$DIR_NAME"

# Create branch name
BRANCH_NAME="${EPIC_ID,,}-${FEATURE_SLUG}"

# Create the spec directory
mkdir -p "$FEATURE_DIR"
mkdir -p "$FEATURE_DIR/checklists"

# Copy spec template if it exists
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")/templates"
if [[ -f "$TEMPLATE_DIR/spec-template.md" ]]; then
    cp "$TEMPLATE_DIR/spec-template.md" "$FEATURE_DIR/spec.md"
else
    # Create minimal spec.md
    cat > "$FEATURE_DIR/spec.md" <<SPEC
# Feature Specification: ${FEATURE_NAME:-$EPIC_ID}

> Epic: $EPIC_ID
> Created: $(date -u +"%Y-%m-%d")
> Status: Draft

## Overview

[Brief description of the feature]

## User Scenarios & Testing

### US-001: [Primary User Story]

**As a** [persona],
**I want** [capability],
**So that** [benefit].

**Acceptance Criteria:**
- [ ] [Criterion 1]
- [ ] [Criterion 2]

## Requirements

### Functional Requirements

- **FR-001**: [Requirement description]

### Non-Functional Requirements

- **NFR-001**: [Requirement description]

## Key Entities

| Entity | Description | Attributes |
|--------|-------------|------------|
| | | |

## Success Criteria

- [ ] [Measurable outcome 1]
- [ ] [Measurable outcome 2]

## Edge Cases

- [ ] [Edge case 1]
- [ ] [Edge case 2]

## Open Questions

- [ ] [Question 1]
SPEC
fi

# Create git branch if requested and git is available
if $CREATE_BRANCH && has_git; then
    # Check if branch already exists
    if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
        echo "Warning: Branch $BRANCH_NAME already exists. Checking it out..." >&2
        git checkout "$BRANCH_NAME"
    else
        git checkout -b "$BRANCH_NAME"
    fi
fi

# Set environment variable for other scripts
export SPECIFY_FEATURE="$BRANCH_NAME"

# Output result
if $JSON_OUTPUT; then
    cat <<JSON
{
  "EPIC_ID": "$EPIC_ID",
  "FEATURE_NAME": "${FEATURE_NAME:-}",
  "FEATURE_SLUG": "$FEATURE_SLUG",
  "BRANCH_NAME": "$BRANCH_NAME",
  "FEATURE_DIR": "$FEATURE_DIR",
  "SPEC_FILE": "$FEATURE_DIR/spec.md",
  "BRANCH_CREATED": $(has_git && $CREATE_BRANCH && echo "true" || echo "false")
}
JSON
else
    echo "Feature initialized successfully!"
    echo ""
    echo "  Epic ID:      $EPIC_ID"
    echo "  Feature:      ${FEATURE_NAME:-$FEATURE_SLUG}"
    echo "  Branch:       $BRANCH_NAME"
    echo "  Spec:         $FEATURE_DIR/spec.md"
    echo ""
    if has_git && $CREATE_BRANCH; then
        echo "Branch '$BRANCH_NAME' created and checked out."
    fi
    echo ""
    echo "Next: Edit the spec.md file, then run /dev.clarify"
fi
