# Windows PowerShell Start Script
param (
    [switch]$Build
)

# Define default image name (GHCR)
$ImageName = "ghcr.io/ltaoo/douyin_selfhost:latest"

# Build
if ($Build) {
    # If building locally, use a local image name
    $ImageName = "douyin-server"
    if (Test-Path "Dockerfile") {
        Write-Host "Building Docker image $ImageName..."
        docker build -t $ImageName .
    } else {
        Write-Warning "Dockerfile not found. Cannot build image."
        exit 1
    }
} else {
    Write-Host "Skipping build. Using image: $ImageName"
    Write-Host "Use -Build to build and run local image 'douyin-server'."
}

# Determine Downloads path
$MountPath = "$env:USERPROFILE\Downloads"

if (-not (Test-Path $MountPath)) {
    Write-Warning "Downloads folder not found at $MountPath"
    $MountPath = Join-Path (Get-Location) "media"
    New-Item -ItemType Directory -Force -Path $MountPath | Out-Null
    Write-Host "Using local media directory: $MountPath"
}

Write-Host "Starting server..."
Write-Host "Mapping host: $MountPath -> container: /app/media"

# Run
docker run --rm -it -p 8080:8080 `
  -v "${MountPath}:/app/media" `
  $ImageName
