#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

log()   { echo -e "${GREEN}[build]${NC} $*"; }
error() { echo -e "${RED}[error]${NC} $*" >&2; }

usage() {
    cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  sync        Sync shared grammar to all plugin directories
  test        Run headless test suite (LSP unit + protocol integration + grammar + snapshot)
  vscode          Build VSCode extension (.vsix)
  vscode-install  Build + install VSCode extension
  jetbrains       Build JetBrains plugin (.zip)
  vs              Build Visual Studio extension (.vsix, Windows/.NET SDK)
  all             Sync + test + build VSCode and JetBrains plugins
  clean           Remove build artifacts

EOF
}

dc() {
    docker compose -f "$ROOT_DIR/docker/docker-compose.yml" "$@"
}

# Build image only if Dockerfile changed
ensure_image() {
    if ! command -v docker &>/dev/null; then
        error "Docker is required for this command. Install Docker and try again."
        exit 1
    fi
    dc build builder
}

cmd_clean() {
    log "Cleaning build artifacts..."
    rm -rf "$ROOT_DIR/dist"
    rm -f "$ROOT_DIR/vscode-extension/"*.vsix
    rm -rf "$ROOT_DIR/vscode-extension/dist"
    rm -rf "$ROOT_DIR/vscode-extension/out"
    rm -rf "$ROOT_DIR/language-server/out"
    rm -rf "$ROOT_DIR/language-server/dist"
    rm -rf "$ROOT_DIR/jetbrains-plugin/build"
    rm -rf "$ROOT_DIR/vs-extension/bin"
    rm -rf "$ROOT_DIR/vs-extension/obj"
    rm -rf "$ROOT_DIR/vs-extension/LanguageServer"
    log "Clean complete."
}

cmd_vs() {
    if ! command -v npm &>/dev/null; then
        error "npm is required to build the Visual Studio extension."
        exit 1
    fi
    if ! command -v dotnet &>/dev/null; then
        error "dotnet SDK is required to build the Visual Studio extension."
        exit 1
    fi

    log "Building QTN Language Server bundle for Visual Studio..."
    npm --prefix "$ROOT_DIR" ci --prefer-offline
    npm --prefix "$ROOT_DIR/language-server" ci --prefer-offline
    npm --prefix "$ROOT_DIR" run bundle:server

    log "Building Visual Studio extension..."
    dotnet build "$ROOT_DIR/vs-extension/QtnLanguageExtension.csproj" -c Release

    mkdir -p "$ROOT_DIR/dist/vs"
    VSIX=$(find "$ROOT_DIR/vs-extension/bin" -name '*.vsix' -type f 2>/dev/null | sort | tail -1)
    if [ -z "$VSIX" ]; then
        error "No .vsix file was produced. Visual Studio VSIX packaging usually requires Windows."
        exit 1
    fi
    cp "$VSIX" "$ROOT_DIR/dist/vs/"
    log "Visual Studio extension built -> dist/vs/"
}

COMMAND="${1:-}"

if [ -z "$COMMAND" ]; then
    usage
    exit 1
fi

case "$COMMAND" in
    sync)
        ensure_image
        log "Syncing grammar..."
        dc run --rm sync
        log "Grammar synced."
        ;;
    test)
        ensure_image
        log "Running tests..."
        dc run --rm test
        log "All tests passed."
        ;;
    vscode)
        ensure_image
        log "Building VSCode extension..."
        dc run --rm vscode
        log "VSCode extension built -> dist/vscode/"
        ;;
    vscode-install)
        ensure_image
        log "Building VSCode extension..."
        dc run --rm vscode
        VSIX=$(ls -t "$ROOT_DIR/dist/vscode/"*.vsix 2>/dev/null | head -1)
        if [ -z "$VSIX" ]; then
            error "No .vsix file found in dist/vscode/"
            exit 1
        fi
        log "Installing: $VSIX"
        code --install-extension "$VSIX"
        log "Done. Reload VSCode or open a .qtn file to verify."
        ;;
    jetbrains)
        ensure_image
        log "Building JetBrains plugin..."
        dc run --rm jetbrains
        log "JetBrains plugin built -> dist/jetbrains/"
        ;;
    vs)
        cmd_vs
        ;;
    all)
        ensure_image
        log "Building all..."
        dc run --rm all
        log "All builds complete -> dist/"
        ;;
    clean)
        cmd_clean
        ;;
    -h|--help)
        usage
        ;;
    *)
        error "Unknown command: $COMMAND"
        usage
        exit 1
        ;;
esac
