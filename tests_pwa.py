"""The installable app: its manifest and service worker are served to anyone,
from where a phone needs them, and every app page links them."""
import os, sys, json
os.environ['DATABASE_URL'] = ''
os.environ['SUPABASE_URL'] = ''
os.environ['SUPABASE_SERVICE_KEY'] = ''
sys.path.insert(0, r'D:\auction software')
os.chdir(r'D:\auction software')
import app as A

def check(label, cond, detail=''):
    print(('  PASS  ' if cond else '  FAIL  ') + label + (' :: ' + detail if detail else ''))
    if not cond: check.failed += 1
check.failed = 0

anon = A.app.test_client()
r = anon.get('/static/manifest.webmanifest')
m = json.loads(r.data)
check('the manifest is served as one', r.status_code == 200 and r.headers['Content-Type'].startswith('application/manifest+json'),
      r.headers.get('Content-Type'))
check('it opens the sign-in page, full screen, with icons', m['start_url'] == '/login' and m['display'] == 'standalone'
      and {i['sizes'] for i in m['icons']} == {'192x192', '512x512'})
for icon in m['icons']:
    check('icon %s exists' % icon['sizes'], anon.get(icon['src']).status_code == 200)
r = anon.get('/sw.js')
check('the service worker is served from the root, never stale', r.status_code == 200
      and 'javascript' in r.headers['Content-Type'] and r.headers.get('Cache-Control') == 'no-cache')
check('with no login', r.status_code == 200)
page = anon.get('/login').get_data(as_text=True)
check('the sign-in page links the manifest and installs', 'rel="manifest"' in page and '/static/pwa.js' in page
      and 'data-install-app' in page)

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
