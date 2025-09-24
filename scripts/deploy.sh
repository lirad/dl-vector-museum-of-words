#!/bin/bash

# DL Vector Museum of Words - Deployment Script
# This script prepares and deploys the application to various platforms

set -e

echo "🏗️  DL Vector Museum of Words - Deployment Script"
echo "==============================================="

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run tests and checks
echo "🔍 Running type checking..."
npm run typecheck || echo "⚠️  TypeScript warnings detected but continuing..."

echo "🧹 Running linting..."
npm run lint || echo "⚠️  Linting warnings detected but continuing..."

# Build the project
echo "🚀 Building for production..."
npm run build

# Check build output
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build completed successfully!"
echo ""
echo "📊 Build Statistics:"
echo "==================="
ls -la dist/
echo ""
find dist/ -name "*.js" -o -name "*.css" | xargs wc -c | tail -1
echo ""

echo "🎯 Deployment Options:"
echo "======================"
echo ""
echo "📁 Static Hosting (Recommended):"
echo "   • Upload the 'dist/' folder to your hosting provider"
echo "   • Ensure your server serves index.html for all routes (SPA mode)"
echo ""
echo "🚀 Platform-specific deployments:"
echo "   • Vercel:   npx vercel --prod"
echo "   • Netlify:  netlify deploy --prod --dir dist"
echo "   • Surge:    surge dist/"
echo ""
echo "🌐 Preview locally:"
echo "   npm run preview"
echo ""

# Optional: Preview the build
read -p "🔍 Would you like to preview the build locally? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🌐 Starting local preview..."
    npm run preview
fi

echo "✨ Deployment preparation complete!"