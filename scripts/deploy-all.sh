#!/bin/bash

# deploy all functions
echo -e "deploying cloud function...\n\n"
./scripts/deploy-func.sh
echo -e "deploying cloud run...\n\n"
./scripts/deploy-run.sh