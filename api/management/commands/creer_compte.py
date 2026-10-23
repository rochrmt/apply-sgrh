import secrets
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from api.models import Compte, Entite, Profil


class Command(BaseCommand):
    help = "Crée un compte SIGRHE : creer_compte <identifiant> <PROFIL> --nom NOM --prenom Prénom [--entite 14] [--matricule 211-0457-B] [--email ...]"

    def add_arguments(self, p):
        p.add_argument('login'); p.add_argument('profil')
        p.add_argument('--nom', default=''); p.add_argument('--prenom', default='')
        p.add_argument('--email', default=''); p.add_argument('--entite', default=None)
        p.add_argument('--matricule', default=''); p.add_argument('--perimetre', default='')
        p.add_argument('--password', default=None)

    def handle(self, *a, o=None, **opts):
        prof = Profil.objects.filter(code=opts['profil'].upper()).first()
        if not prof:
            raise CommandError('Profil inconnu : ' + ', '.join(Profil.objects.values_list('code', flat=True)))
        if User.objects.filter(username=opts['login']).exists():
            raise CommandError('Identifiant déjà utilisé.')
        ent = Entite.objects.filter(code=opts['entite']).first() if opts['entite'] else None
        pwd = opts['password'] or secrets.token_urlsafe(12)
        u = User.objects.create_user(opts['login'], email=opts['email'], password=pwd, last_name=opts['nom'], first_name=opts['prenom'])
        Compte.objects.create(user=u, profil=prof, entite=ent, agent_matricule=opts['matricule'],
                              perimetre=opts['perimetre'] or (ent.libelle_court if ent else prof.perimetre))
        self.stdout.write(self.style.SUCCESS(f'Compte {u.username} ({prof.code}) créé. Mot de passe initial : {pwd}'))
