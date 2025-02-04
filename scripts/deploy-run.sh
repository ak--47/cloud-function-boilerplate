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

# Set other environment variables
export PROJECT_ID="mixpanel-gtm-training"
export REGION="us-central1"
export REPOSITORY="ak-run-repo"  # Name of the new Artifact Registry repository
export IMAGE_TAG="latest"
export IMAGE_URI="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE_NAME:$IMAGE_TAG"

# Verify Artifact Registry repository exists
echo "Checking Artifact Registry repository..."
gcloud artifacts repositories describe $REPOSITORY --location=$REGION || {
  echo "Repository $REPOSITORY does not exist. Creating it..."
  gcloud artifacts repositories create $REPOSITORY \
    --repository-format=docker \
    --location=$REGION \
    --description="Docker repository for $SERVICE_NAME"
}

# Set the region for Cloud Run
gcloud config set run/region $REGION

# Authenticate Docker to Artifact Registry
echo "Configuring Docker authentication..."
gcloud auth configure-docker $REGION-docker.pkg.dev

# Build the Docker image
echo "Building Docker image..."
docker buildx build --platform linux/amd64 -t $SERVICE_NAME .

# Tag the Docker image for Artifact Registry
echo "Tagging Docker image..."
docker tag $SERVICE_NAME $IMAGE_URI

# Push the Docker image to Artifact Registry
echo "Pushing Docker image to Artifact Registry..."
docker push $IMAGE_URI

# Deploy the service to Cloud Run
echo "Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_URI \
  --platform managed \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --memory=4Gi \
  --max-instances=100 \
  --min-instances=0 \
  --env-vars-file=.env.yaml