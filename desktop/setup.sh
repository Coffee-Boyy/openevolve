#!/bin/bash
# Setup script for OpenEvolve Desktop Development

set -e

echo "🧬 OpenEvolve Desktop Setup"
echo "============================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✓ Node.js version: $(node --version)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm is not installed. Installing via npm..."
    npm install -g pnpm
fi

echo "✓ pnpm version: $(pnpm --version)"

# Install Node.js dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
pnpm install

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  pnpm run electron:dev"
echo ""
echo "To build for production:"
echo "  pnpm run build"
echo ""
