#!/bin/bash

# Exit immediately if any command fails
set -e

PROD_BRANCH="master"
SOURCE_BRANCH="source"
CURRENT_TIME_UTC=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

cp -r _site/* ../tmp
git checkout $PROD_BRANCH

rm -rf *
mv ../tmp/* .

git add .
git commit -m "Site deployed at $CURRENT_TIME_UTC"
git push -f origin $PROD_BRANCH
git checkout $SOURCE_BRANCH

echo "Deployment complete!"