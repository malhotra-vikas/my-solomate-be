#!/bin/bash

set -e

echo "📦 Installing dependencies..."
npm install


ZIP_NAME="lambda.zip"
ENTRY_FILE="index.mjs"


echo "🧹 Cleaning old zip (if exists)..."
rm -f $ZIP_NAME

echo "📁 Zipping Lambda package..."
zip -r $ZIP_NAME $ENTRY_FILE $HELPER_FILES package.json node_modules

rm -rf node_modules
rm -rf package-lock.json


echo "✅ Done. Created $ZIP_NAME"
