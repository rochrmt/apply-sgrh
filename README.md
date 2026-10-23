# SIGRHE Centrafrique

Système intégré de gestion des ressources humaines de l’État (République centrafricaine) — application Django + PostgreSQL, livrée prête pour Docker (base PostgreSQL + application + proxy Nginx TLS).

## Démonstration locale (tout est dans Docker)

```bash
cp deploy/dev-local.env .env   # configuration de démonstration prête à l'emploi
docker compose up -d --build
```

L'application répond alors sur **http://localhost:8888** (PostgreSQL 16 + Gunicorn, données de démonstration : 306 agents, 13 comptes — mot de passe `demo-sigrhe-2026`). Le port se règle par `SIGRHE_PORT` dans `.env` (8000 par défaut).

Le proxy Nginx TLS (production) démarre seulement avec le profil `https` après dépôt des certificats dans `deploy/certs/` :

```bash
docker compose --profile https up -d
```

## Production

- Guide d’installation et d’exploitation : **[README_DEPLOIEMENT.md](README_DEPLOIEMENT.md)**
- `cp .env.example .env` → compléter → `docker compose --profile https up -d --build`

## Développement local (sans Docker)

```bash
pip install -r requirements.txt
export DATABASE_URL=postgres://sigrhe:sigrhe@localhost:5432/sigrhe DJANGO_DEBUG=1 DJANGO_HTTPS=0 SIGRHE_DEMO_MODE=1
python manage.py migrate && python manage.py init_reference && python manage.py seed_demo
python manage.py runserver
```

Tests : `python manage.py test api`
