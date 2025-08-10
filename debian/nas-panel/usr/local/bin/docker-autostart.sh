#!/bin/bash

CONTAINER_LIST="/etc/nas-panel/docker-autostart.list"
CONTAINER_DIR=$(dirname "$CONTAINER_LIST")

# Utwórz katalog, jeśli nie istnieje
mkdir -p "$CONTAINER_DIR"

case "$1" in
  "save")
    docker ps --format '{{.Names}}' > "$CONTAINER_LIST"
    echo "Saved running containers to $CONTAINER_LIST"
    ;;
  "start")
    if [ -f "$CONTAINER_LIST" ]; then
      while read -r container; do
        if [ -n "$container" ]; then
          echo "Starting container: $container"
          docker start "$container" || echo "Failed to start $container"
        fi
      done < "$CONTAINER_LIST"
    else
      echo "No container list found at $CONTAINER_LIST"
    fi
    ;;
  *)
    echo "Usage: $0 [save|start]"
    exit 1
    ;;
esac