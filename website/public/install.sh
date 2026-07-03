#!/usr/bin/env bash
# Mux MCP Gateway — Install Script
# Usage: curl -sL https://mux-gateway.vercel.app/install.sh | bash
set -e

PACKAGE="mux-mcp-gateway"

echo ""
echo "  ╭──────────────────────────────────────╮"
echo "  │   Mux — MCP Gateway Router           │"
echo "  │   One MCP to rule them all.           │"
echo "  ╰──────────────────────────────────────╯"
echo ""

# Check node
if ! command -v node &>/dev/null; then
    echo "  ✗ Node.js not found. Install Node.js 20+ first."
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "  ✗ Node.js 20+ required (found v$NODE_VERSION)"
    exit 1
fi

echo "  ✓ Node.js $(node -v)"

# Check npm
if ! command -v npm &>/dev/null; then
    echo "  ✗ npm not found."
    exit 1
fi

echo "  ✓ npm $(npm -v)"
echo ""
echo "  Installing mux-cli..."
echo ""

npm install -g "$PACKAGE" 2>&1 | sed 's/^/  /'

echo ""
echo "  ✓ mux-cli installed!"
echo ""
echo "  Get started:"
echo "    mux-cli          # Setup wizard"
echo "    mux-cli --help   # All commands"
echo ""
