#!/bin/bash
#
# agentlint installer
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Obsidian-Owl/agentlint/main/scripts/install.sh | bash
#
# Environment variables:
#   AGENTLINT_INSTALL_DIR - Installation directory (default: /usr/local/bin)
#   AGENTLINT_VERSION     - Specific version to install (default: latest)
#

set -euo pipefail

# Configuration
REPO="Obsidian-Owl/agentlint"
BINARY_NAME="agentlint"
DEFAULT_INSTALL_DIR="/usr/local/bin"

# Colors (only if terminal supports them)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Logging functions
info() {
  echo -e "${BLUE}==>${NC} $*"
}

success() {
  echo -e "${GREEN}==>${NC} $*"
}

warn() {
  echo -e "${YELLOW}Warning:${NC} $*" >&2
}

error() {
  echo -e "${RED}Error:${NC} $*" >&2
  exit 1
}

# Detect platform
detect_platform() {
  local os
  os=$(uname -s | tr '[:upper:]' '[:lower:]')

  case "$os" in
    darwin)
      echo "darwin"
      ;;
    linux)
      echo "linux"
      ;;
    *)
      error "Unsupported operating system: $os"
      ;;
  esac
}

# Detect architecture
detect_arch() {
  local arch
  arch=$(uname -m)

  case "$arch" in
    x86_64 | amd64)
      echo "x64"
      ;;
    arm64 | aarch64)
      echo "arm64"
      ;;
    *)
      error "Unsupported architecture: $arch"
      ;;
  esac
}

# Get latest release version from GitHub
get_latest_version() {
  local url="https://api.github.com/repos/${REPO}/releases/latest"
  local version

  if command -v curl &> /dev/null; then
    version=$(curl -fsSL "$url" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
  elif command -v wget &> /dev/null; then
    version=$(wget -qO- "$url" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')
  else
    error "Neither curl nor wget found. Please install one of them."
  fi

  if [ -z "$version" ]; then
    error "Failed to get latest version from GitHub"
  fi

  echo "$version"
}

# Download file
download() {
  local url="$1"
  local dest="$2"

  info "Downloading from $url"

  if command -v curl &> /dev/null; then
    curl -fsSL "$url" -o "$dest"
  elif command -v wget &> /dev/null; then
    wget -q "$url" -O "$dest"
  else
    error "Neither curl nor wget found. Please install one of them."
  fi
}

# Verify checksum
verify_checksum() {
  local file="$1"
  local expected="$2"
  local actual

  if command -v sha256sum &> /dev/null; then
    actual=$(sha256sum "$file" | cut -d ' ' -f 1)
  elif command -v shasum &> /dev/null; then
    actual=$(shasum -a 256 "$file" | cut -d ' ' -f 1)
  else
    warn "Unable to verify checksum: sha256sum/shasum not found"
    return 0
  fi

  if [ "$actual" != "$expected" ]; then
    error "Checksum verification failed!\nExpected: $expected\nActual: $actual"
  fi

  success "Checksum verified"
}

# Main installation logic
main() {
  info "agentlint installer"
  echo

  # Detect system
  local platform
  local arch
  platform=$(detect_platform)
  arch=$(detect_arch)

  info "Detected platform: ${platform}-${arch}"

  # Determine version
  local version="${AGENTLINT_VERSION:-}"
  if [ -z "$version" ]; then
    info "Fetching latest version..."
    version=$(get_latest_version)
  fi

  info "Installing version: $version"

  # Build download URL
  local filename="${BINARY_NAME}-${platform}-${arch}"
  local base_url="https://github.com/${REPO}/releases/download/${version}"
  local binary_url="${base_url}/${filename}"
  local checksum_url="${base_url}/checksums.txt"

  # Create temp directory
  local tmp_dir
  tmp_dir=$(mktemp -d)
  trap 'rm -rf "$tmp_dir"' EXIT

  # Download binary
  local binary_path="${tmp_dir}/${BINARY_NAME}"
  download "$binary_url" "$binary_path"

  # Download and verify checksum
  local checksum_path="${tmp_dir}/checksums.txt"
  download "$checksum_url" "$checksum_path"

  local expected_checksum
  expected_checksum=$(grep "${filename}" "$checksum_path" | cut -d ' ' -f 1)

  if [ -n "$expected_checksum" ]; then
    verify_checksum "$binary_path" "$expected_checksum"
  else
    warn "No checksum found for ${filename}, skipping verification"
  fi

  # Make executable
  chmod +x "$binary_path"

  # Install
  local install_dir="${AGENTLINT_INSTALL_DIR:-$DEFAULT_INSTALL_DIR}"
  local install_path="${install_dir}/${BINARY_NAME}"

  info "Installing to $install_path"

  # Check if we need sudo
  if [ -w "$install_dir" ]; then
    mv "$binary_path" "$install_path"
  else
    info "Requesting sudo access to install to $install_dir"
    sudo mv "$binary_path" "$install_path"
  fi

  success "Successfully installed agentlint $version"
  echo
  info "Run 'agentlint --version' to verify installation"
}

# Run main
main "$@"
