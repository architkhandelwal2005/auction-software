# Threaded workers: every audience/control/stage/team screen polls the API
# every 1-2s, so a single sync worker would serialise them and stall under a
# real crowd. gthread lets each worker handle many concurrent polls; 2 workers
# give headroom. --timeout 120 tolerates slow Google Sheet / Drive fetches.
web: gunicorn app:app --workers 2 --threads 8 --worker-class gthread --timeout 120
