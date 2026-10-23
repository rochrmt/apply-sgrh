#!/bin/sh
# SIGRHE · démarrage du conteneur : attente de la base, migrations, référentiel, (démo), puis Gunicorn
set -e
echo "Attente de PostgreSQL…"
i=0
until python -c "import os,psycopg; from urllib.parse import urlparse; u=urlparse(os.environ['DATABASE_URL']); psycopg.connect(host=u.hostname, port=u.port or 5432, user=u.username, password=u.password, dbname=u.path[1:], connect_timeout=3).close()" 2>/dev/null; do
  i=$((i+1)); [ $i -gt 60 ] && echo "PostgreSQL injoignable" && exit 1; sleep 2
done
python manage.py migrate --noinput
python manage.py init_reference
if [ "${SEED_DEMO:-0}" = "1" ]; then python manage.py seed_demo; fi
exec "$@"
