from django.core.management.base import BaseCommand
from api.seed import load_reference


class Command(BaseCommand):
    help = "Charge le référentiel : profils, matrice des droits par défaut, ministères et institutions (idempotent)."

    def add_arguments(self, p):
        p.add_argument('--reset-rights', action='store_true', help='Rétablit la matrice des droits par défaut')

    def handle(self, *a, **o):
        n, e = load_reference(reset_rights=o['reset_rights'])
        self.stdout.write(self.style.SUCCESS(f'Référentiel chargé : {n} profils, {e} entités.'))
