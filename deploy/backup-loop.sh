#!/bin/sh
set -eu
: "${RESTIC_REPOSITORY:?Set an off-server restic repository}"
: "${RESTIC_PASSWORD:?Set a backup encryption password}"
restic snapshots >/dev/null
while true; do
  # VACUUM INTO creates a consistent snapshot even while the town is running.
  snapshot=$(node --import tsx /app/scripts/backup.ts)
  restic backup "$snapshot" --tag little-elsewhere
  restic forget --tag little-elsewhere --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
  node --import tsx /app/scripts/restore-check.ts "$snapshot"
  # Remove only this uploaded and verified local snapshot, never the live world.
  rm -- "$snapshot"
  sleep 86400
done
