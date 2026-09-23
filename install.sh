#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

show_help() {
  cat << 'EOF'
OMP Extensions Installer

Usage:
  ./install.sh [options]

Options:
  --global, -g           Install globally to ~/.omp/agent/ (default)
  --project, -p <dir>    Install to a specific project directory (.omp/)
  --help, -h             Show this help message

Examples:
  ./install.sh                     # Install globally for all omp sessions
  ./install.sh -p /path/to/project # Install locally for a specific project
EOF
}

TARGET_MODE="global"
PROJECT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    -g|--global)
      TARGET_MODE="global"
      shift
      ;;
    -p|--project)
      TARGET_MODE="project"
      PROJECT_DIR="${2:-}"
      if [[ -z "$PROJECT_DIR" ]]; then
        echo "Error: --project requires a directory path." >&2
        exit 1
      fi
      shift 2
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      show_help
      exit 1
      ;;
  esac
done

if [[ "$TARGET_MODE" == "global" ]]; then
  DEST_EXT="$HOME/.omp/agent/extensions"
  DEST_AGENTS="$HOME/.omp/agent/agents"
  echo "Installing extensions globally to ~/.omp/agent/..."
else
  DEST_EXT="$PROJECT_DIR/.omp/extensions"
  DEST_AGENTS="$PROJECT_DIR/.omp/agents"
  echo "Installing extensions to project at $PROJECT_DIR..."
fi

mkdir -p "$DEST_EXT" "$DEST_AGENTS"

cp -v "$SCRIPT_DIR/extensions/"*.ts "$DEST_EXT/"
cp -v "$SCRIPT_DIR/agents/"*.md "$DEST_AGENTS/"

echo ""
echo " Installation complete!"
echo "Available commands in omp:"
echo "  /idea     - Dual-model iterative research & review workflow"
echo "  /md       - Clean markdown session exporter (with auto session ID)"
EOF
