#!/bin/bash

# Path to store the list of running containers
CONTAINER_LIST="/etc/nas-panel/docker-autostart.list"

# Save currently running containers before shutdown
case "$1" in
  "save")
    docker ps --format '{{.Names}}' > "$CONTAINER_LIST"
    echo "Saved running containers to $CONTAINER_LIST"
    ;;
  *)
    # On normal execution (startup), restore containers
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
esac