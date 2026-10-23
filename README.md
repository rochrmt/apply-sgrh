# SIGRHE Centrafrique

Système intégré de gestion des ressources humaines de l’État (République centrafricaine) — application Django + PostgreSQL, livrée prête pour Docker (base PostgreSQL + application + proxy Nginx TLS).

## Démonstration locale (tout est dans Docker)

Créez le fichier `.env` à la racine (non versionné) avec au minimum :

```
DJANGO_SECRET_KEY=<chaîne aléatoire>
POSTGRES_PASSWORD=<mot de passe>
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,web
SIGRHE_PORT=8888            # port hôte de l'application (8000 par défaut)
SIGRHE_DEMO_MODE=1          # affiche les comptes de démonstration
SIGRHE_DEMO_PASSWORD=<mot de passe commun des comptes de démo>
SEED_DEMO=1                 # charge les 306 agents fictifs au démarrage
```

```bash
docker compose up -d --build
```

L'application répond alors sur **http://localhost:8888** (PostgreSQL 16 + Gunicorn, données de démonstration : 306 agents, 13 comptes).

Le proxy Nginx TLS (production) démarre seulement avec le profil `https` après dépôt des certificats dans `deploy/certs/` :

```bash
docker compose --profile https up -d
```

## Production

- Guide d’installation et d’exploitation : **[README_DEPLOIEMENT.md](README_DEPLOIEMENT.md)**
- créer le fichier `.env` (variables listées dans le guide) → `docker compose --profile https up -d --build`

## Développement local (sans Docker)

```bash
pip install -r requirements.txt
export DATABASE_URL=postgres://sigrhe:sigrhe@localhost:5432/sigrhe DJANGO_DEBUG=1 DJANGO_HTTPS=0 SIGRHE_DEMO_MODE=1
python manage.py migrate && python manage.py init_reference && python manage.py seed_demo
python manage.py runserver
```

Tests : `python manage.py test api`
