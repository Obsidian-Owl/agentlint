#!/usr/bin/env bash
# setup-plan.sh - Initialize plan artifacts for a feature
# Part of dev.plan skill

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

usage() {
    cat <<EOF
Usage: setup-plan.sh [OPTIONS]

Initialize planning artifacts for the current feature branch.
Copies templates and prepares the feature directory for planning.

Options:
  --json        Output result as JSON
  --force       Overwrite existing artifacts
  -h, --help    Show this help message

Prerequisites:
  - Must be on a feature branch (e.g., ep01-feature-name)
  - spec.md must exist in the feature directory

Creates:
  - plan.md          (from plan-template.md)
  - research.md      (from research-template.md)
  - data-model.md    (from data-model-template.md)
  - quickstart.md    (from quickstart-template.md)
  - contracts/       (directory)
  - checklists/      (directory)

Examples:
  setup-plan.sh
  setup-plan.sh --json
  setup-plan.sh --force
EOF
}

# Parse arguments
JSON_OUTPUT=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Error: Unknown option $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

# Load feature context
eval "$(get_feature_paths)"

# Validate prerequisites
if [[ -z "$EPIC_ID" ]]; then
    echo "Error: Not on a feature branch. Expected branch like 'ep01-feature-name'" >&2
    exit 1
fi

if [[ -z "$FEATURE_DIR" ]] || [[ ! -d "$FEATURE_DIR" ]]; then
    echo "Error: Feature directory not found. Run /dev.specify first." >&2
    exit 1
fi

if [[ ! -f "$FEATURE_SPEC" ]]; then
    echo "Error: spec.md not found at $FEATURE_SPEC. Run /dev.specify first." >&2
    exit 1
fi

# Extract feature name from spec if possible
FEATURE_NAME=""
if [[ -f "$FEATURE_SPEC" ]]; then
    # Try to extract from first heading
    FEATURE_NAME=$(head -1 "$FEATURE_SPEC" | sed -E 's/^#+ (Feature Specification: )?//' | tr -d '\r')
fi
FEATURE_NAME="${FEATURE_NAME:-$EPIC_ID Feature}"

# Generate feature slug from branch
FEATURE_SLUG=$(echo "$CURRENT_BRANCH" | sed -E "s/^${EPIC_ID,,}-//" | tr -d '\r')

# Get current date
CURRENT_DATE=$(date -u +"%Y-%m-%d")

# Get author from git config or fallback
AUTHOR=""
if has_git; then
    AUTHOR=$(git config user.name 2>/dev/null || echo "")
fi
AUTHOR="${AUTHOR:-Developer}"

# Template directory
TEMPLATE_DIR="$(dirname "$SCRIPT_DIR")/templates"

# Helper function to copy template with substitutions
copy_template() {
    local template="$1"
    local target="$2"
    local template_path="$TEMPLATE_DIR/$template"

    if [[ -f "$target" ]] && ! $FORCE; then
        echo "Skipping $target (exists, use --force to overwrite)" >&2
        return 1
    fi

    if [[ -f "$template_path" ]]; then
        sed -e "s/{{FEATURE_NAME}}/$FEATURE_NAME/g" \
            -e "s/{{EPIC_ID}}/$EPIC_ID/g" \
            -e "s/{{EPIC_ID_LOWER}}/${EPIC_ID,,}/g" \
            -e "s/{{FEATURE_SLUG}}/$FEATURE_SLUG/g" \
            -e "s|{{SPEC_PATH}}|$FEATURE_SPEC|g" \
            -e "s/{{DATE}}/$CURRENT_DATE/g" \
            -e "s/{{AUTHOR}}/$AUTHOR/g" \
            "$template_path" > "$target"
        return 0
    else
        echo "Warning: Template $template not found" >&2
        return 1
    fi
}

# Track what was created
CREATED_FILES=()
SKIPPED_FILES=()

# Create directories
mkdir -p "$FEATURE_DIR/contracts"
mkdir -p "$FEATURE_DIR/checklists"

# Copy templates
if copy_template "plan-template.md" "$FEATURE_DIR/plan.md"; then
    CREATED_FILES+=("plan.md")
else
    SKIPPED_FILES+=("plan.md")
fi

if copy_template "research-template.md" "$FEATURE_DIR/research.md"; then
    CREATED_FILES+=("research.md")
else
    SKIPPED_FILES+=("research.md")
fi

if copy_template "data-model-template.md" "$FEATURE_DIR/data-model.md"; then
    CREATED_FILES+=("data-model.md")
else
    SKIPPED_FILES+=("data-model.md")
fi

if copy_template "quickstart-template.md" "$FEATURE_DIR/quickstart.md"; then
    CREATED_FILES+=("quickstart.md")
else
    SKIPPED_FILES+=("quickstart.md")
fi

# Output result
if $JSON_OUTPUT; then
    # Convert arrays to JSON
    created_json=$(printf '%s\n' "${CREATED_FILES[@]}" | jq -R . | jq -s .)
    skipped_json=$(printf '%s\n' "${SKIPPED_FILES[@]}" | jq -R . | jq -s . 2>/dev/null || echo "[]")

    cat <<JSON
{
  "EPIC_ID": "$EPIC_ID",
  "FEATURE_NAME": "$FEATURE_NAME",
  "FEATURE_DIR": "$FEATURE_DIR",
  "FEATURE_SPEC": "$FEATURE_SPEC",
  "IMPL_PLAN": "$FEATURE_DIR/plan.md",
  "RESEARCH": "$FEATURE_DIR/research.md",
  "DATA_MODEL": "$FEATURE_DIR/data-model.md",
  "QUICKSTART": "$FEATURE_DIR/quickstart.md",
  "CONTRACTS_DIR": "$FEATURE_DIR/contracts",
  "BRANCH": "$CURRENT_BRANCH",
  "HAS_GIT": $(has_git && echo "true" || echo "false"),
  "CREATED": $created_json,
  "SKIPPED": $skipped_json
}
JSON
else
    echo "Plan artifacts initialized!"
    echo ""
    echo "  Epic ID:      $EPIC_ID"
    echo "  Feature:      $FEATURE_NAME"
    echo "  Directory:    $FEATURE_DIR"
    echo ""

    if [[ ${#CREATED_FILES[@]} -gt 0 ]]; then
        echo "  Created:"
        for f in "${CREATED_FILES[@]}"; do
            echo "    ✓ $f"
        done
    fi

    if [[ ${#SKIPPED_FILES[@]} -gt 0 ]]; then
        echo ""
        echo "  Skipped (already exist):"
        for f in "${SKIPPED_FILES[@]}"; do
            echo "    - $f"
        done
    fi

    echo ""
    echo "Next steps:"
    echo "  1. Fill in Technical Context in plan.md"
    echo "  2. Complete research.md with findings"
    echo "  3. Define entities in data-model.md"
    echo "  4. Add contracts to contracts/"
    echo "  5. Run /dev.tasks when design is complete"
fi
