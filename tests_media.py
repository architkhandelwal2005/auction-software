"""Every photo and logo is kept twice: on this server's disk and in Supabase.
One /media URL serves whichever copy exists, a copy lost on either side is
rebuilt from the other, and a file Supabase refused is uploaded again later.

Supabase is replaced by an in-memory bucket, so nothing leaves this machine.
"""
import io, os, shutil, sys
os.environ['DATABASE_URL'] = ''
os.environ['SUPABASE_URL'] = ''
os.environ['SUPABASE_SERVICE_KEY'] = ''
sys.path.insert(0, r'D:\auction software')
os.chdir(r'D:\auction software')
sys.stdout.reconfigure(encoding='utf-8')
import app as A

def fetch(u):
    """GET and close at once: an open file handle blocks deleting it on Windows."""
    r = admin.get(u)
    out = (r.status_code, r.get_data())
    r.close()
    return out

def check(label, cond, detail=''):
    print(('  PASS  ' if cond else '  FAIL  ') + label + (' :: ' + detail if detail else ''))
    if not cond: check.failed += 1
check.failed = 0

# ── A fake Supabase bucket ──
BUCKET, DOWN = {}, {'on': False}
def fake_put(path, data, ext):
    if DOWN['on']:
        raise RuntimeError('HTTP 503 Service Unavailable')
    BUCKET[path] = bytes(data)
    return 'https://fake.supabase.co/storage/v1/object/public/auction-media/' + path
def fake_get(path):
    return None if DOWN['on'] else BUCKET.get(path)
A.storage_put, A.storage_get = fake_put, fake_get
# A scratch folder stands in for the server's disk, so wiping it in this
# test never touches real uploads.
import tempfile
_scratch = tempfile.mkdtemp()
A.MEDIA_DIR = os.path.join(_scratch, 'media')
A._BACKED_DIR = os.path.join(_scratch, 'media-backed')
A.USE_SUPABASE_STORAGE = True

PNG = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
       b'\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82')

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': os.environ.get('ADMIN_PASSWORD', 'admin@123')})
aid = admin.post('/api/auctions', json={'name': 'Media Test'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
tid = admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 100}).get_json()['id']

# Saved: both copies, one /media URL.
url = admin.post('/api/teams/logo/%d' % tid, data={'logo': (io.BytesIO(PNG), 'l.png')},
                 content_type='multipart/form-data').get_json()['logo_url']
path = A.media_path(url)
check('logo stored under one /media URL', url.startswith('/media/%d/logos/' % aid), url)
check('copy on this server', os.path.isfile(A._media_local(path)))
check('copy in Supabase', BUCKET.get(path) == PNG)
code, body = fetch(url)
check('URL serves the file', code == 200 and body == PNG)

# A deploy wipes the server's disk: the URL still works, from Supabase,
# and the server keeps the file again.
shutil.rmtree(A.MEDIA_DIR); shutil.rmtree(A._BACKED_DIR, ignore_errors=True)
code, body = fetch(url)
check('after the disk is wiped, served from Supabase', code == 200 and body == PNG)
check('and kept on this server again', os.path.isfile(A._media_local(path)))

# Supabase is down during the event: the server's copy keeps it running.
DOWN['on'] = True
check('Supabase down: still served from the server', fetch(url)[0] == 200)

# A photo saved while Supabase is down lives on the server only, is reported,
# and is copied to Supabase once it is back.
pid = admin.post('/api/players', json={'name': 'Asha', 'category': 'A', 'base_price': 1}).get_json()['id']
purl = admin.post('/api/players/photo/%d' % pid, data={'photo': (io.BytesIO(PNG), 'a.png')},
                  content_type='multipart/form-data').get_json()['photo_url']
check('photo saved while Supabase is down', fetch(purl)[0] == 200 and A.media_path(purl) not in BUCKET)
A.sync_media(aid)
st = admin.get('/api/storage/status').get_json()
check('dashboard reports the server-only file and why',
      st['server_only_files'] == 1 and '503' in st['problem'], str(st))
DOWN['on'] = False
A._STORAGE_LAST_ERROR.update(message='')
A.sync_media(aid)
st = admin.get('/api/storage/status').get_json()
check('Supabase back: sync uploads the missing copy', BUCKET.get(A.media_path(purl)) == PNG and st['server_only_files'] == 0, str(st))
check('nothing is reported once both copies exist', not st['problem'] and st['missing_files'] == 0, str(st))

# A file in neither copy is counted as lost.
BUCKET.pop(path, None); os.remove(A._media_local(path))
A.sync_media(aid)
check('a file in neither copy is counted', admin.get('/api/storage/status').get_json()['missing_files'] == 1)
check('and its URL answers 404', fetch(url)[0] == 404)

check('paths cannot leave the media folder', fetch('/media/../app.py')[0] == 404)

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
