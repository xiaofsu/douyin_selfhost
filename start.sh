#!/bin/bash

# Parse arguments
BUILD=false
for arg in "$@"; do
    if [ "$arg" == "-build" ] || [ "$arg" == "--build" ]; then
        BUILD=true
    fi
done

# Detect OS
OS="$(uname -s)"
echo "Detected OS: ${OS}"

# Define default image name (GHCR)
IMAGE_NAME="ghcr.io/ltaoo/douyin_selfhost:latest"

# Build the image
if [ "$BUILD" = true ]; then
    # If building locally, use a local image name
    IMAGE_NAME="douyin-server"
    if [ -f "Dockerfile" ]; then
        echo "Building Docker image ${IMAGE_NAME}..."
        docker build -t $IMAGE_NAME .
    else
        echo "Error: Dockerfile not found in current directory."
        exit 1
    fi
else
    echo "Skipping build. Using image: ${IMAGE_NAME}"
    echo "Use -build or --build to build and run local image 'douyin-server'."
fi

# Determine mount path
MOUNT_PATH="$HOME/Downloads"

# Check if Downloads exists, else use local media dir
if [ ! -d "$MOUNT_PATH" ]; then
    echo "Directory $MOUNT_PATH does not exist."
    MOUNT_PATH="$(pwd)/media"
    mkdir -p "$MOUNT_PATH"
    echo "Using local directory: $MOUNT_PATH"
fi

echo "Starting server..."
echo "Mapping $MOUNT_PATH to /app/media"

# Run based on OS quirks if any (usually docker run syntax is consistent on bash)
# MSYS/MinGW (Git Bash on Windows) might need path conversion, but usually handled by docker CLI now.
# If running in WSL, $HOME/Downloads might be inside WSL distro, not Windows host. 
# But for simplicity, we assume standard usage.

docker run --rm -it -p 8080:8080 \
  -v "$MOUNT_PATH:/app/media" \
  $IMAGE_NAME
