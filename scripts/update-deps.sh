#!/bin/bash

# Make all .sh files in the scripts directory executable
chmod +x scripts/*.sh

# Define an array of dependencies
dependencies=(
  "ak-tools@latest"
  "ak-fetch@latest"
  
)

# Iterate over the array and install each dependency
for dependency in "${dependencies[@]}"; do
  echo "Installing $dependency"
  npm install "$dependency" --save
done