# SIGRHE · image de l'application (Django + Gunicorn)
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 1000 --home /app sigrhe

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
# Fichiers statiques compressés et versionnés (la clé n'est utilisée que pour cette étape)
RUN DJANGO_SECRET_KEY=build-only DATABASE_URL=sqlite:///tmp/build.sqlite3 python manage.py collectstatic --noinput \
 && mkdir -p /app/media && chown -R sigrhe /app/media /app/staticfiles

USER sigrhe
EXPOSE 8000
# Appel via /bin/sh : le script reste exécutable même si le bit +x a été perdu (clone sous Windows)
ENTRYPOINT ["/bin/sh", "/app/deploy/entrypoint.sh"]
CMD ["gunicorn", "sigrhe.wsgi:application", "-c", "/app/deploy/gunicorn.conf.py"]
