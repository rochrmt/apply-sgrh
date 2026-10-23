"""Construit le front-end servi par Django à partir des sources de l'application web (frontend/src/).
Usage : python tools_build_front.py  (sources : frontend/src)
- copie les scripts dans frontend/static/sigrhe/
- génère data-ref.js (référentiel sans données nominatives de démonstration)
- génère frontend/templates/index.html (balises {% static %}, démarrage via le serveur)
"""
import json, re, shutil, subprocess, sys
from pathlib import Path

SRC = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent / 'frontend' / 'src'
ROOT = Path(__file__).resolve().parent
ST = ROOT / 'frontend' / 'static' / 'sigrhe'
TPL = ROOT / 'frontend' / 'templates'
ST.mkdir(parents=True, exist_ok=True); TPL.mkdir(parents=True, exist_ok=True)

html = (SRC / 'index.html').read_text(encoding='utf-8')
scripts = re.findall(r'<script src="([^"]+)"></script>', html)
for s in scripts + ['server.js']:
    if s != 'data.js':
        shutil.copy(SRC / s, ST / s)
# référentiel : tout DATA sauf les agents, comptes et journal de démonstration
ref = subprocess.run(['node', '-e', "const fs=require('fs');eval(fs.readFileSync(process.argv[1],'utf8').replace('const DATA','global.DATA'));"
                      "process.stdout.write(JSON.stringify({E:DATA.E,P:DATA.P,R:DATA.R,BASE:DATA.BASE,main:DATA.main}))", str(SRC / 'data.js')],
                     capture_output=True, text=True, check=True).stdout
d = json.loads(ref); d.update({'A': [], 'users': [], 'log': []})
(ST / 'data-ref.js').write_text('const DATA=' + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + ';\n', encoding='utf-8')

out = html.replace('<script src="data.js"></script>', '<script src="{% static \'sigrhe/data-ref.js\' %}"></script>')
for s in scripts:
    if s != 'data.js':
        out = out.replace(f'<script src="{s}"></script>', f'<script src="{{% static \'sigrhe/{s}\' %}}"></script>')
out = out.replace('<script>App.start();</script>',
                  '<script src="{% static \'sigrhe/server.js\' %}"></script>\n<script>SIGRHE_SRV.start();</script>')
out = ('{% load static %}<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
       '<meta name="robots" content="noindex">\n<script>window.SIGRHE_BOOT = new Promise(function (r) { window.__bootResolve = r; });</script>\n</head>\n<body>\n'
       + out + '\n</body>\n</html>\n')
(TPL / 'index.html').write_text(out, encoding='utf-8')
print('Front-end construit :', len(scripts), 'scripts ->', ST)
