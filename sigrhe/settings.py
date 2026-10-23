"""
SIGRHE · paramètres Django.
Toute la configuration sensible passe par des variables d'environnement (fichier .env sur le serveur, non versionné).
"""
import os
from pathlib import Path
from urllib.parse import urlparse, unquote

BASE_DIR = Path(__file__).resolve().parent.parent


def env(name, default=None):
    return os.environ.get(name, default)


def env_bool(name, default=False):
    v = os.environ.get(name)
    return default if v is None else v.strip().lower() in ('1', 'true', 'yes', 'oui', 'on')


def env_list(name, default=''):
    return [x.strip() for x in os.environ.get(name, default).split(',') if x.strip()]


# Chargement facultatif d'un fichier .env à la racine (sans dépendance externe)
_env_file = BASE_DIR / '.env'
if _env_file.exists():
    for line in _env_file.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

DEBUG = env_bool('DJANGO_DEBUG', False)
SECRET_KEY = env('DJANGO_SECRET_KEY') or ('dev-insecure-key-change-me' if DEBUG else None)
if not SECRET_KEY:
    raise RuntimeError('DJANGO_SECRET_KEY doit être défini en production (fichier .env).')

ALLOWED_HOSTS = env_list('DJANGO_ALLOWED_HOSTS', 'localhost,127.0.0.1')
CSRF_TRUSTED_ORIGINS = env_list('DJANGO_CSRF_TRUSTED_ORIGINS', '')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'sigrhe.urls'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [BASE_DIR / 'frontend' / 'templates'],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

WSGI_APPLICATION = 'sigrhe.wsgi.application'


# Base de données : PostgreSQL via DATABASE_URL (postgres://utilisateur:mot_de_passe@hôte:5432/base)
def _db_from_url(url):
    u = urlparse(url)
    if u.scheme in ('postgres', 'postgresql', 'pgsql'):
        return {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': unquote(u.path.lstrip('/')),
            'USER': unquote(u.username or ''),
            'PASSWORD': unquote(u.password or ''),
            'HOST': u.hostname or 'localhost',
            'PORT': str(u.port or 5432),
            'CONN_MAX_AGE': int(env('DB_CONN_MAX_AGE', '60')),
            'OPTIONS': {'sslmode': env('DB_SSLMODE', 'prefer')},
        }
    if u.scheme == 'sqlite':
        return {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / (u.path.lstrip('/') or 'db.sqlite3')}
    raise RuntimeError('DATABASE_URL non reconnu : ' + url)


DATABASES = {'default': _db_from_url(env('DATABASE_URL', 'postgres://sigrhe:sigrhe@localhost:5432/sigrhe'))}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 10}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = env('TIME_ZONE', 'Africa/Bangui')
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [BASE_DIR / 'frontend' / 'static']
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage' if not DEBUG else 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}
# Fichiers téléversés (pièces des agents, GED) : hors de la racine web, servis uniquement par l'API après contrôle des droits
MEDIA_ROOT = Path(env('MEDIA_ROOT', str(BASE_DIR / 'media')))
DATA_UPLOAD_MAX_MEMORY_SIZE = 25 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
SIGRHE_MAX_FILE_BYTES = 20 * 1024 * 1024

# Sessions et sécurité
SESSION_COOKIE_AGE = int(env('SESSION_SECONDS', str(8 * 3600)))
SESSION_EXPIRE_AT_BROWSER_CLOSE = True
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False  # le front-end lit le jeton CSRF pour l'envoyer dans l'en-tête X-CSRFToken
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
X_FRAME_OPTIONS = 'DENY'
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
if env_bool('DJANGO_HTTPS', not DEBUG):
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = env_bool('DJANGO_SSL_REDIRECT', False)  # la redirection est faite par Nginx
    SECURE_HSTS_SECONDS = int(env('DJANGO_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# La redirection HTTP → HTTPS est faite par Nginx ; la liste de préchargement HSTS est facultative
SILENCED_SYSTEM_CHECKS = ['security.W008', 'security.W021']

# Courriels (notifications) : SMTP de l'État ; par défaut, affichage dans la console
EMAIL_BACKEND = env('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = env('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(env('EMAIL_PORT', '587'))
EMAIL_HOST_USER = env('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = env_bool('EMAIL_USE_TLS', True)
EMAIL_TIMEOUT = 15
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', 'SIGRHE <notifications@sigrhe.gouv.cf>')

# Assistant RH (IA) : appel de l'API Anthropic depuis le serveur, la clé ne quitte jamais le serveur
ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY', '')
ANTHROPIC_MODEL = env('ANTHROPIC_MODEL', 'claude-haiku-5-5')
ASSISTANT_MAX_PER_HOUR = int(env('ASSISTANT_MAX_PER_HOUR', '60'))

# Mode démonstration : comptes de démonstration visibles sur la page de connexion, réinitialisation possible
SIGRHE_DEMO_MODE = env_bool('SIGRHE_DEMO_MODE', False)
SIGRHE_DEMO_PASSWORD = env('SIGRHE_DEMO_PASSWORD', 'demo-sigrhe-2026')

# Verrouillage après échecs de connexion
LOGIN_MAX_FAILURES = int(env('LOGIN_MAX_FAILURES', '5'))
LOGIN_LOCK_MINUTES = int(env('LOGIN_LOCK_MINUTES', '15'))

LOGGING = {
    'version': 1, 'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': env('LOG_LEVEL', 'INFO')},
}
