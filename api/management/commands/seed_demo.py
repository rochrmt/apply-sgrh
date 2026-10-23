from django.conf import settings
from django.core.management.base import BaseCommand
from api.seed import load_demo


class Command(BaseCommand):
    help = "Charge les données de DÉMONSTRATION (306 agents fictifs, 13 comptes). Ne pas utiliser en production réelle."

    def add_arguments(self, p):
        p.add_argument('--reset', action='store_true', help='Efface les données de travail des modules')
        p.add_argument('--email-domain', default='', help='Domaine des adresses des comptes de démonstration (pour tester les courriels)')

    def handle(self, *a, **o):
        n, u = load_demo(reset_modules=o['reset'], email_domain=o['email_domain'])
        self.stdout.write(self.style.SUCCESS(f'{n} agents et {u} comptes de démonstration chargés (mot de passe : SIGRHE_DEMO_PASSWORD = {settings.SIGRHE_DEMO_PASSWORD}).'))
