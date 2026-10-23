import base64, secrets
from urllib.parse import quote
from django.core.management.base import BaseCommand, CommandError
from api.models import Compte


class Command(BaseCommand):
    help = "Active le second facteur (application TOTP : Google Authenticator, FreeOTP…) pour un compte et affiche le lien de configuration."

    def add_arguments(self, p):
        p.add_argument('login'); p.add_argument('--desactiver', action='store_true')

    def handle(self, *a, **o):
        c = Compte.objects.filter(user__username=o['login']).first()
        if not c:
            raise CommandError('Compte introuvable.')
        if o['desactiver']:
            c.mfa_secret = ''; c.save(); self.stdout.write('Second facteur désactivé.'); return
        c.mfa_secret = base64.b32encode(secrets.token_bytes(20)).decode().rstrip('=')
        c.save()
        self.stdout.write(self.style.SUCCESS('Second facteur activé.'))
        self.stdout.write(f'Secret : {c.mfa_secret}')
        self.stdout.write(f'Lien (à transformer en QR code) : otpauth://totp/SIGRHE:{quote(c.user.username)}?secret={c.mfa_secret}&issuer=SIGRHE')
