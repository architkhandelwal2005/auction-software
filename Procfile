# One process, with gevent: every request is a greenlet rather than a thread,
# so each screen can hold a live stream open (/api/live_stream) at almost no
# cost, and hundreds of spectators do not need hundreds of threads. The work
# is network/database bound; app.py makes psycopg2 wait cooperatively
# (psycogreen). A single process keeps memory well inside Render's 512 MB
# (two processes ran out while photos were downloading) and gives every
# request the same view of in-memory state such as the shared live data and
# photo-download progress. --timeout 120 tolerates slow Google Sheet / Drive
# fetches.
#
# To go back to threads: --worker-class gthread --threads 16 (and drop
# --worker-connections). Screens then poll instead of streaming, on their own.
web: gunicorn app:app --workers 1 --worker-class gevent --worker-connections 1000 --timeout 120
