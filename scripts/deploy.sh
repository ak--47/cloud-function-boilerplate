#!/bin/bash

# Load .env file
if [ -f .env ]; then
  export $(cat .env | xargs)
else
  echo ".env file not found"
  exit 1
fi

# Check if SERVICE_NAME is set
if [ -z "$SERVICE_NAME" ]; then
  echo "SERVICE_NAME is not set in the .env file"
  exit 1
fi

# cloud event deploy
gcloud alpha functions deploy "$SERVICE_NAME" \
  --runtime nodejs20 \
  --gen2 \
  --trigger-resource MY_BUCKET \
  --trigger-event google.storage.object.finalize \
  --trigger-location us \
  --entry-point entry \
  --env-vars-file env.yaml \
  --timeout=3600 \
  --memory=2G

# http deploy
gcloud alpha functions deploy "$SERVICE_NAME" \
  --gen2 \
  --no-allow-unauthenticated \
  --env-vars-file .env.yaml \
  --runtime nodejs20 \
  --region us-central1 \
  --trigger-http \
  --memory 4GB \
  --entry-point entry \
  --source ./dist/internal/ \
  --timeout=3600 \
  --max-instances=100