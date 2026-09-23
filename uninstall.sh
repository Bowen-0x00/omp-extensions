#!/usr/bin/env bash
set -euo pipefail

show_help() {
  cat << 'EOF'
OMP Extensions Uninstaller

Usage:
  ./uninstall.sh [options]

Options:
  --global, -g           Uninstall globally from ~/.omp/agent/ (default)
  --project, -p <dir>    Uninstall from a specific project directory (.omp/)
  --help, -h             Show this help message
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
else
  DEST_EXT="$PROJECT_DIR/.omp/extensions"
  DEST_AGENTS="$PROJECT_DIR/.omp/agents"
fi

rm -fv "$DEST_EXT/idea.ts" "$DEST_EXT/export-md.ts" || true
rm -fv "$DEST_AGENTS/idea-reviewer.md" || true

echo "Uninstallation complete."
