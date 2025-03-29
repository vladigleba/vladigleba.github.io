#!/bin/bash

# Exit immediately if any command fails
set -e

PROD_BRANCH="master"
SOURCE_BRANCH="source"
CURRENT_TIME_UTC=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

echo "Building Eleventy site..."
npx eleventy

echo "Switching to $PROD_BRANCH branch..."
git checkout $PROD_BRANCH

echo "Cleaning up old files..."
rm -rf *

echo "Copying new build..."
cp -r $SOURCE_BRANCH/_site/* .  # Copy built files to root

echo "Deploying to GitHub Pages..."
git add .
git commit -m "Site deployed at $CURRENT_TIME_UTC"
git push -f origin $PROD_BRANCH

echo "Switching back to $SOURCE_BRANCH..."
git checkout $SOURCE_BRANCH

echo "Deployment complete!"