# SIGRHE Centrafrique · guide de déploiement (Django + PostgreSQL)

Ce dossier contient l’application SIGRHE prête à être installée sur un serveur :

- **back-end** Django 5.1 (Python 3.12) avec une **API JSON** et le contrôle des droits côté serveur ;
- **base PostgreSQL** 16 (testée) ;
- **front-end** : l’application web de la démonstration, servie par Django, avec une vraie connexion et des données partagées entre tous les utilisateurs ;
- **déploiement** : Docker Compose (PostgreSQL + application + Nginx en HTTPS) ou installation classique (systemd + Nginx).

---

## 1. Architecture

```
Navigateur ──HTTPS──> Nginx ──> Gunicorn (Django, API /api/…) ──> PostgreSQL
                                   │                              └─ tables : comptes, profils, droits, entités,
                                   │                                 agents, données des modules, audit, fichiers, courriels
                                   ├─> /app/media : fichiers téléversés (hors racine web)
                                   ├─> serveur SMTP de l’État : notifications par courriel
                                   └─> API Anthropic : assistant RH (clé conservée sur le serveur)
```

| Élément | Où | Rôle |
|---|---|---|
| `sigrhe/settings.py` | Django | configuration par variables d’environnement (`.env`) |
| `api/models.py` | Django | modèle de données PostgreSQL |
| `api/permissions.py` | Django | **contrôle des droits** : périmètre des agents, écriture des modules, fichiers, matrice |
| `api/views.py` | Django | API : connexion (mot de passe + second facteur TOTP), amorçage, modules, agents, audit, fichiers, comptes, assistant IA |
| `frontend/src/` | navigateur | sources de l’application web ; `server.js` relie l’application à l’API |
| `build_front.py` | outil | reconstruit `frontend/static/` et `frontend/templates/index.html` à partir de `frontend/src/` |
| `deploy/` | serveur | Nginx, Gunicorn, systemd, script de démarrage, sauvegardes |

### Ce que fait le serveur

- **Connexion réelle** : identifiant et mot de passe (hachage Django PBKDF2), second facteur TOTP facultatif par compte, verrouillage après 5 échecs pendant 15 minutes, session de 8 heures.
- **Droits appliqués par le serveur**, et non plus seulement par l’affichage :
  - le gestionnaire RH sectoriel et le décideur ne reçoivent que les agents de leur ministère ;
  - l’agent ne reçoit que son propre dossier ;
  - l’administrateur système, le décideur et le président de commission voient les agents sous forme anonyme (aucune donnée nominative) ;
  - chaque module ne peut être modifié qu’avec le niveau de droit requis dans la matrice (ex. : un gestionnaire RH ne peut pas toucher à la paie : réponse 403) ;
  - la matrice des droits et les comptes ne sont modifiables que par l’administrateur.
- **Données partagées** : tous les utilisateurs travaillent sur la même base ; les écrans se mettent à jour toutes les 30 secondes ; deux modifications simultanées du même module sont détectées (version) et la seconde est refusée proprement.
- **Piste d’audit** : l’auteur, l’heure et l’adresse IP sont fixés par le serveur ; la piste n’est pas modifiable, même depuis l’administration technique.
- **Fichiers** (PDF, images, Word, Excel) stockés sur le serveur, hors de la racine web : contrôle de l’extension et du contenu réel, 20 Mo au plus, empreinte SHA-256, accès vérifié à chaque consultation.
- **Courriels de notification** réellement envoyés par le serveur SMTP configuré, aux adresses des comptes ; chaque envoi est tracé (table « Courriels »).
- **Assistant RH (IA)** : le navigateur passe par `/api/assistant` ; la clé API reste sur le serveur ; limite de questions par heure et par utilisateur.

---

## 2. Installation avec Docker (recommandée)

Prérequis : serveur Linux (Ubuntu 22.04/24.04 ou équivalent), 2 vCPU, 4 Go de RAM, 40 Go de disque, Docker et le plugin Compose, un nom de domaine pointant vers le serveur.

```bash
# 1. Copier le dossier sur le serveur, par exemple dans /opt/sigrhe
cd /opt/sigrhe

# 2. Configuration : créer le fichier .env à la racine (non versionné)
python3 -c "import secrets; print(secrets.token_urlsafe(50))"   # → DJANGO_SECRET_KEY
nano .env      # renseigner au minimum : DJANGO_SECRET_KEY, DJANGO_ALLOWED_HOSTS,
               # DJANGO_CSRF_TRUSTED_ORIGINS, POSTGRES_PASSWORD,
               # TIME_ZONE, EMAIL_*, LOGIN_*, SESSION_SECONDS
               # (et SIGRHE_PORT / SIGRHE_BIND pour l'exposition HTTP directe)

# 3. Certificat HTTPS dans deploy/certs/ (fullchain.pem et privkey.pem)
#    - certificat de l’autorité de l’État, ou
#    - Let's Encrypt : sudo certbot certonly --standalone -d sigrhe.gouv.cf
#      puis copier /etc/letsencrypt/live/sigrhe.gouv.cf/{fullchain,privkey}.pem dans deploy/certs/

# 4. Démarrage (construction de l’image, migrations et référentiel automatiques)
docker compose up -d --build
docker compose logs -f web          # suivre le démarrage

# 5. Premier compte administrateur du SIGRHE
docker compose exec web python manage.py creer_compte admin.sigrhe ADM --nom NOM --prenom Prénom --email admin@...
#    (le mot de passe initial s’affiche : le transmettre au titulaire)
# Comptes suivants : depuis l’écran « Utilisateurs et droits », ou par la commande :
docker compose exec web python manage.py creer_compte drh.mfp DRH --nom ... --prenom ... --email ...
docker compose exec web python manage.py creer_compte grh.sante GRH --entite 14 --nom ... --email ...
docker compose exec web python manage.py creer_compte 211-0457-B AGT --matricule 211-0457-B --nom ... --email ...
#    Profils : ADM, DRH, GRH, SOL, CF, ORD, CON, AUD, DEC, AGT   ·   codes des entités : table « Entités » (admin technique)

# 6. Second facteur pour un compte (recommandé pour ADM, DRH, SOL, CF, ORD)
docker compose exec web python manage.py activer_mfa admin.sigrhe
#    → afficher le lien otpauth:// sous forme de QR code et le scanner avec Google Authenticator, FreeOTP…

# 7. Administration technique Django (comptes, droits, journal, fichiers) : https://<domaine>/admin-technique/
docker compose exec web python manage.py createsuperuser
```

Vérification : `https://<domaine>/api/sante` doit répondre `{"status": "ok", …}`.

### Serveur de démonstration (soutenance de l’offre)

Dans `.env` : `SIGRHE_DEMO_MODE=1`, `SEED_DEMO=1`, `SIGRHE_DEMO_PASSWORD=<mot de passe commun>`.
Au démarrage, les 306 agents fictifs et les 13 comptes de démonstration (un par profil) sont chargés ; la page de connexion affiche la liste des comptes. La DRH ou l’administrateur peuvent réinitialiser les données depuis le menu latéral.
**Ne jamais activer ce mode sur le serveur de production réelle.**

---

## 3. Installation sans Docker (systemd + Nginx)

```bash
sudo apt install python3.12-venv postgresql nginx certbot
sudo -u postgres psql -c "CREATE USER sigrhe PASSWORD 'MOT_DE_PASSE';" -c "CREATE DATABASE sigrhe OWNER sigrhe;"
sudo useradd --system --home /opt/sigrhe sigrhe
sudo cp -r . /opt/sigrhe && cd /opt/sigrhe
python3 -m venv venv && venv/bin/pip install -r requirements.txt
nano .env      # créer le fichier de configuration : DATABASE_URL=postgres://sigrhe:MOT_DE_PASSE@localhost:5432/sigrhe, MEDIA_ROOT=/opt/sigrhe/media …
set -a; . ./.env; set +a
venv/bin/python manage.py migrate
venv/bin/python manage.py init_reference
venv/bin/python manage.py collectstatic --noinput
sudo chown -R sigrhe /opt/sigrhe
sudo cp deploy/sigrhe.service /etc/systemd/system/ && sudo systemctl enable --now sigrhe
sudo cp deploy/nginx-hote.conf /etc/nginx/sites-available/sigrhe && sudo ln -s ../sites-available/sigrhe /etc/nginx/sites-enabled/
sudo certbot --nginx -d sigrhe.gouv.cf && sudo systemctl reload nginx
```

---

## 4. Exploitation

| Tâche | Commande |
|---|---|
| Mettre à jour l’application | `git pull` (ou copie), puis `docker compose up -d --build` |
| Sauvegarder (base + fichiers) | `deploy/sauvegarde.sh` (à planifier chaque nuit ; conservation de 30 jours) |
| Restaurer la base | `docker compose exec -T db pg_restore -U sigrhe -d sigrhe --clean < sigrhe-AAAAMMJJ.dump` |
| Rétablir la matrice des droits par défaut | `python manage.py init_reference --reset-rights` |
| Lancer les tests de l’API | `python manage.py test api` (11 tests : connexion, périmètres, droits, conflits, fichiers, audit) |
| Journaux | `docker compose logs web` · piste d’audit : admin technique › Audits |
| Modifier le front-end | modifier `frontend/src/`, puis `python build_front.py` et reconstruire l’image |

### Courriels

Dans `.env` : `EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend`, puis `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`. Les notifications partent vers l’adresse de chaque compte (renseigner l’adresse lors de la création). Par défaut, les courriels sont seulement écrits dans les journaux.

### Assistant RH (IA)

Renseigner `ANTHROPIC_API_KEY` (et, si besoin, `ANTHROPIC_MODEL`, `ASSISTANT_MAX_PER_HOUR`). Sans clé, l’assistant fonctionne en mode guidé (réponses construites sans IA). Les questions et les données consultées par l’assistant sont envoyées au fournisseur d’IA : à valider avec la réglementation nationale sur les données personnelles avant activation.

---

## 5. Sécurité : liste de contrôle avant ouverture

- [ ] `DJANGO_DEBUG=0`, `DJANGO_HTTPS=1`, clé secrète unique, `.env` lisible par root uniquement
- [ ] HTTPS valide, port 5432 non exposé (seul Nginx écoute sur 80/443)
- [ ] `SIGRHE_DEMO_MODE=0` et `SEED_DEMO=0` en production
- [ ] second facteur activé pour les profils sensibles (ADM, DRH, SOL, CF, ORD)
- [ ] sauvegardes planifiées et restauration testée
- [ ] pare-feu (ufw) : 22 (administration, restreint), 80, 443
- [ ] mises à jour de sécurité du système automatiques

---

## 6. Limites connues de cette version (à traiter pendant le projet)

Cette version transforme le prototype en application serveur multi-utilisateur. Elle reste issue de la démonstration :

1. **Données de travail des modules** (campagne de paie, actes, dossiers de pension, GED, recrutement…) : elles sont conservées en base sous forme d’un document JSON versionné par module, avec contrôle des droits **par module**. Le découpage en tables détaillées, avec contrôle **ligne par ligne** et règles métier vérifiées par le serveur (ex. calcul de paie refait côté serveur), est l’étape suivante du développement.
2. **Données d’exemple** : quand un module est encore vide, l’application l’initialise avec les exemples de la démonstration (dossiers, courriers, candidatures fictifs). En production réelle, ces modules doivent être alimentés par la **reprise des données** existantes (fichier de la solde, dossiers papier numérisés) avant l’ouverture.
3. **Taux et barèmes** (paie, pensions) : valeurs de démonstration à remplacer par les textes en vigueur dans les écrans « Paramètres ».
4. **Interfaces SIM-BA, SYSTAC, mobile money, CNSS** : simulées. Les connecteurs réels se branchent sur l’API (`api/views.py`) une fois les spécifications des partenaires obtenues.
5. **Polices** : chargées depuis Google Fonts ; pour un réseau isolé, les héberger localement dans `frontend/src/`.
