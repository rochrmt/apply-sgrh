# SIGRHE · Gunicorn
import multiprocessing
import os

bind = '0.0.0.0:8000'
workers = int(os.environ.get('GUNICORN_WORKERS', min(2 * multiprocessing.cpu_count() + 1, 9)))
threads = int(os.environ.get('GUNICORN_THREADS', 2))
timeout = 150            # l'assistant IA peut prendre jusqu'à deux minutes
graceful_timeout = 30
max_requests = 2000
max_requests_jitter = 200
accesslog = '-'
errorlog = '-'
control_socket = '/tmp/gunicorn.ctl'   # /app n'est pas inscriptible pour l'utilisateur applicatif
forwarded_allow_ips = '*'
