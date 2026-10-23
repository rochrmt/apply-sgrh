#!/bin/sh
# SIGRHE · sauvegarde quotidienne (base + fichiers téléversés). Exemple cron : 0 2 * * * /opt/sigrhe/deploy/sauvegarde.sh
set -e
DEST=${DEST:-/var/backups/sigrhe}; J=$(date +%Y%m%d-%H%M); mkdir -p "$DEST"
cd "$(dirname "$0")/.."
docker compose exec -T db pg_dump -U "${POSTGRES_USER:-sigrhe}" -Fc "${POSTGRES_DB:-sigrhe}" > "$DEST/sigrhe-$J.dump"
docker compose run --rm -T --entrypoint "" -v "$DEST:/backup" web tar czf "/backup/fichiers-$J.tgz" -C /app media
find "$DEST" -type f -mtime +30 -delete
echo "Sauvegarde terminée : $DEST ($J)"
