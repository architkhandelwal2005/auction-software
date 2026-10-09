# One process with many threads. Every audience/control/stage/team screen
# polls the API every 1-2s; gthread serves those polls concurrently, and the
# work is network/database bound, so threads keep up. A single process keeps
# memory well inside Render's 512 MB (two processes ran out while photos were
# downloading) and gives every request the same view of in-memory state such
# as photo-download progress and storage errors. --timeout 120 tolerates slow
# Google Sheet / Drive fetches.
web: gunicorn app:app --workers 1 --threads 16 --worker-class gthread --timeout 120
