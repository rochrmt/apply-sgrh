"""Tests de l'API SIGRHE : connexion, périmètres, droits d'écriture, fichiers, conflits. Lancer : python manage.py test"""
import json

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from .models import Agent, Audit, Compte, Fichier, ModuleState
from .seed import load_demo

PWD = 'demo-test-2026'
PDF = b'%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF'


@override_settings(SIGRHE_DEMO_MODE=True, SIGRHE_DEMO_PASSWORD=PWD, LOGIN_MAX_FAILURES=3)
class ApiTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        with override_settings(SIGRHE_DEMO_PASSWORD=PWD):
            load_demo()

    def login(self, login):
        self.client.logout()
        r = self.client.post('/api/login', json.dumps({'login': login, 'password': PWD}), content_type='application/json')
        self.assertEqual(r.status_code, 200, r.content)

    def boot(self):
        return self.client.get('/api/bootstrap').json()

    def put_module(self, key, data, version=0):
        return self.client.put('/api/modules/' + key, json.dumps({'data': data, 'version': version}), content_type='application/json')

    def test_login_echec_et_verrouillage(self):
        for _ in range(3):
            r = self.client.post('/api/login', json.dumps({'login': 'drh.mfp01', 'password': 'faux'}), content_type='application/json')
            self.assertEqual(r.status_code, 401)
        r = self.client.post('/api/login', json.dumps({'login': 'drh.mfp01', 'password': PWD}), content_type='application/json')
        self.assertEqual(r.status_code, 423)
        self.assertTrue(Audit.objects.filter(action='Échec de connexion').exists())

    def test_anonyme(self):
        b = self.boot()
        self.assertFalse(b['auth'])
        self.assertNotIn('agents', b)
        self.assertEqual(self.put_module('paie', {'step': 1}).status_code, 401)

    def test_perimetres(self):
        self.login('drh.mfp01')
        self.assertEqual(len(self.boot()['agents']), 306)
        self.login('grh.msp02')
        ags = self.boot()['agents']
        self.assertTrue(ags and all(a['code'] == '14' for a in ags))
        self.login('211-0457-B')
        ags = self.boot()['agents']
        self.assertEqual([a['mat'] for a in ags], ['211-0457-B'])
        self.login('admin.sys01')
        self.assertTrue(all(a['nom'] == 'AGENT' for a in self.boot()['agents']))

    def test_droits_modules(self):
        self.login('grh.msp02')
        self.assertEqual(self.put_module('paie', {'step': 4}).status_code, 403)
        self.assertEqual(self.put_module('fiches', {'req': []}).status_code, 200)
        self.login('211-0457-B')
        self.assertEqual(self.put_module('pen2', {}).status_code, 403)
        self.assertEqual(self.put_module('portail', {'reqs': []}).status_code, 200)
        self.login('solde.dgb02')
        self.assertEqual(self.put_module('paie', {'step': 1}).status_code, 200)

    def test_conflit_de_version(self):
        self.login('solde.dgb02')
        self.assertEqual(self.put_module('paie', {'step': 1}, 0).status_code, 200)
        self.assertEqual(self.put_module('paie', {'step': 2}, 1).status_code, 200)
        r = self.put_module('paie', {'step': 9}, 1)
        self.assertEqual(r.status_code, 409)
        self.assertEqual(r.json()['data']['step'], 2)
        self.assertEqual(ModuleState.objects.get(cle='paie').version, 2)

    def test_agents_patch(self):
        self.login('cab.msp01')
        r = self.client.patch('/api/agents/211-0457-B', json.dumps({'data': {'statut': 'Suspendu'}}), content_type='application/json')
        self.assertEqual(r.status_code, 403)
        self.login('grh.msp02')
        a = Agent.objects.get(matricule='211-0457-B').donnees
        a['statut'] = 'Détachement'
        r = self.client.patch('/api/agents/211-0457-B', json.dumps({'data': a}), content_type='application/json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Agent.objects.get(matricule='211-0457-B').statut, 'Détachement')
        hors = Agent.objects.exclude(entite_id='14').first()
        r = self.client.patch('/api/agents/' + hors.matricule, json.dumps({'data': {}}), content_type='application/json')
        self.assertEqual(r.status_code, 404)

    def test_fichiers(self):
        self.login('grh.msp02')
        r = self.client.post('/api/fichiers', {'ctx': 'agent:211-0457-B', 'cat': 'Acte de naissance', 'file': SimpleUploadedFile('acte.pdf', PDF, 'application/pdf')})
        self.assertEqual(r.status_code, 200, r.content)
        fid = r.json()['id']
        r = self.client.post('/api/fichiers', {'ctx': 'agent:211-0457-B', 'file': SimpleUploadedFile('faux.pdf', b'MZ\x90\x00', 'application/pdf')})
        self.assertEqual(r.status_code, 415)
        r = self.client.post('/api/fichiers', {'ctx': 'agent:211-0457-B', 'file': SimpleUploadedFile('x.exe', b'MZ', 'application/octet-stream')})
        self.assertEqual(r.status_code, 415)
        hors = Agent.objects.exclude(entite_id='14').first()
        r = self.client.post('/api/fichiers', {'ctx': 'agent:' + hors.matricule, 'file': SimpleUploadedFile('a.pdf', PDF, 'application/pdf')})
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.client.get('/api/fichiers/' + fid).status_code, 200)
        self.login('211-0457-B')
        self.assertEqual(self.client.get('/api/fichiers/' + fid).status_code, 200)  # son propre dossier
        self.login('grh.men05')
        self.assertEqual(self.client.get('/api/fichiers/' + fid).status_code, 403)  # autre ministère
        self.assertTrue(Fichier.objects.filter(id=fid, sha256__regex=r'^[0-9a-f]{64}$').exists())

    def test_audit_horodate_par_le_serveur(self):
        self.login('drh.mfp01')
        self.client.post('/api/audit', json.dumps({'entries': [{'a': 'Action test', 'o': 'objet', 'u': 'usurpation'}]}), content_type='application/json')
        e = Audit.objects.filter(action='Action test').first()
        self.assertEqual(e.utilisateur, 'drh.mfp01')

    def test_candidature_publique(self):
        r = self.client.post('/api/public/candidature', json.dumps({'cand': {'name': 'TEST Candidat', 'score': 150}}), content_type='application/json')
        self.assertEqual(r.status_code, 200)
        c = ModuleState.objects.get(cle='recrutement').donnees['cands'][-1]
        self.assertEqual(c['score'], 100)

    def test_matrice_reservee_admin(self):
        self.login('drh.mfp01')
        r = self.client.put('/api/matrice', json.dumps({'mx': [[4] * 10]}), content_type='application/json')
        self.assertEqual(r.status_code, 403)
        self.login('admin.sys01')
        r = self.client.put('/api/matrice', json.dumps({'mx': self.boot()['mx']}), content_type='application/json')
        self.assertEqual(r.status_code, 200)

    def test_compte_suspendu(self):
        c = Compte.objects.get(user__username='grh.men05')
        c.statut = 'Suspendu'
        c.save()
        r = self.client.post('/api/login', json.dumps({'login': 'grh.men05', 'password': PWD}), content_type='application/json')
        self.assertEqual(r.status_code, 403)
