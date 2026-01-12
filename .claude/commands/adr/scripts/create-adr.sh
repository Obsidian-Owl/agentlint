#!/bin/bash
# ADR Numbering Script
# Usage: ./create-adr.sh "Title of the ADR"
# Output: Path to the new ADR file (e.g., docs/architecture/adr/0001-title-of-the-adr.md)
#
# This script MUST be used when creating new ADRs to ensure correct sequential numbering.
# It handles:
# - Finding the next available ADR number
# - Creating the docs/architecture/adr/ directory if needed
# - Converting the title to kebab-case for the filename
# - Outputting the full path for the skill to use

set -e

TITLE="$1"
ADR_DIR="docs/architecture/adr"

if [ -z "$TITLE" ]; then
    echo "Error: Title is required" >&2
    echo "Usage: $0 \"Title of the ADR\"" >&2
    exit 1
fi

# Create directory if needed
mkdir -p "$ADR_DIR"

# Find next number by scanning existing ADRs
# Look for files matching NNNN-*.md pattern
NEXT_NUM=$(ls -1 "$ADR_DIR" 2>/dev/null | grep -E '^[0-9]{4}-.*\.md$' | sort -n | tail -1 | cut -c1-4)

if [ -z "$NEXT_NUM" ]; then
    # No existing ADRs, start at 0001
    NEXT_NUM="0001"
else
    # Increment the highest number by 1
    # Use 10# to force base-10 interpretation (avoids octal issues with leading zeros)
    NEXT_NUM=$(printf "%04d" $((10#$NEXT_NUM + 1)))
fi

# Create kebab-case filename from title
# 1. Convert to lowercase
# 2. Replace spaces with hyphens
# 3. Remove any character that isn't a-z, 0-9, or hyphen
# 4. Collapse multiple consecutive hyphens into one
# 5. Remove leading/trailing hyphens
KEBAB=$(echo "$TITLE" | \
    tr '[:upper:]' '[:lower:]' | \
    tr ' ' '-' | \
    tr -cd 'a-z0-9-' | \
    sed 's/--*/-/g' | \
    sed 's/^-//;s/-$//')

# Construct the full filepath
FILENAME="${ADR_DIR}/${NEXT_NUM}-${KEBAB}.md"

# Output the path (this is what the skill captures)
echo "$FILENAME"
