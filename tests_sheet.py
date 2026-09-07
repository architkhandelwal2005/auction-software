"""Sheet import, re-sync diff and apply, using a local CSV in place of Google.

fetch_public_sheet is stubbed so the flow is tested without depending on a
particular sheet staying public; the real fetch is verified separately.
"""
import os, sys
os.environ['DATABASE_URL'] = ''
sys.path.insert(0, r'D:\auction software')
os.chdir(r'D:\auction software')
import app as A

client = A.app.test_client()

def check(label, cond, detail=''):
    print(('  PASS  ' if cond else '  FAIL  ') + label + (' :: ' + detail if detail else ''))
    if not cond: check.failed += 1
check.failed = 0

SHEET_V1 = (b'Name,Category,Photo\n'
            b'Asha Rao,Advanced,https://drive.google.com/open?id=1AAAAAAAAAAAAAAAAAAA\n'
            b'Bina Shah,Beginner,\n'
            b'Chetan Roy,Intermediate,\n')
SHEET_V2 = (b'Name,Category,Photo\n'
            b'Asha Rao,Advanced,https://drive.google.com/open?id=1AAAAAAAAAAAAAAAAAAA\n'
            b'Bina Shah,Advanced,\n'                       # category changed
            b'Deepa Nair,Beginner,\n')                      # added; Chetan removed

CURRENT = {'data': SHEET_V1}
A.fetch_public_sheet = lambda url: CURRENT['data']
# Photo downloads are exercised elsewhere; skip the network here.
A.hydrate_drive_photos_async = lambda auction_id: None

client.post('/api/auth/login', json={'role': 'admin', 'password': 'admin@123'})
aid = client.post('/api/auctions', json={'name': 'Sheet Test'}).get_json()['auction']['id']

SHEET_URL = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0'
r = client.post('/api/auction/source/import', json={'sheet_url': SHEET_URL})
check('import from sheet', r.status_code == 200 and r.get_json().get('count') == 3,
      r.get_data(as_text=True)[:120])

players = client.get('/api/players').get_json()
check('three players stored', len(players) == 3)
check('categories came through',
      sorted(p['category'] for p in players) == ['Advanced', 'Beginner', 'Intermediate'])
check('photo link stored', any('drive.google.com' in (p.get('photo_url') or '') for p in players))

# Re-sync reports differences and writes nothing.
CURRENT['data'] = SHEET_V2
r = client.post('/api/auction/source/resync', json={})
d = r.get_json()
check('resync ok', r.status_code == 200, r.get_data(as_text=True)[:120])
check('one addition detected', d['added'] == ['Deepa Nair'], str(d['added']))
check('one removal detected', d['removed'] == ['Chetan Roy'], str(d['removed']))
check('one change detected', len(d['changed']) == 1 and d['changed'][0]['name'] == 'Bina Shah',
      str(d['changed']))
check('resync wrote nothing', len(client.get('/api/players').get_json()) == 3)

# Apply.
r = client.post('/api/auction/source/apply', json={})
d = r.get_json()
check('apply ok', r.status_code == 200 and d['added'] == 1 and d['removed'] == 1, str(d))
names = sorted(p['name'] for p in client.get('/api/players').get_json())
check('roster matches the sheet', names == ['Asha Rao', 'Bina Shah', 'Deepa Nair'], str(names))
bina = [p for p in client.get('/api/players').get_json() if p['name'] == 'Bina Shah'][0]
check('changed category applied', bina['category'] == 'Advanced', bina['category'])

# A sold player is protected from later sheet edits.
tid = client.post('/api/teams', json={'name': 'Reds', 'total_budget': 1000}).get_json()['id'] \
    if 'id' in (client.post('/api/teams', json={'name': 'Tmp', 'total_budget': 1000}).get_json() or {}) else None
teams = client.get('/api/teams').get_json()
tid = teams[0]['id']
asha = [p for p in client.get('/api/players').get_json() if p['name'] == 'Asha Rao'][0]
client.post('/api/sell_player', json={'player_id': asha['id'], 'team_id': tid, 'sold_price': 40})

SHEET_V3 = (b'Name,Category,Photo\n'
            b'Asha Rao,CHANGED-AFTER-SALE,\n'
            b'Bina Shah,Advanced,\n')
CURRENT['data'] = SHEET_V3
d = client.post('/api/auction/source/resync', json={}).get_json()
check('sold player change is blocked, not applied',
      any(b['name'] == 'Asha Rao' for b in d['blocked']), str(d['blocked']))
client.post('/api/auction/source/apply', json={})
asha2 = [p for p in client.get('/api/players').get_json() if p['name'] == 'Asha Rao'][0]
check('sold player untouched after apply', asha2['category'] == 'Advanced', asha2['category'])
check('sold player not deleted by apply', asha2['status'] == 'sold')

# Duplicate names are refused rather than producing a wrong diff.
CURRENT['data'] = b'Name,Category\nSame Name,A\nSame Name,B\n'
r = client.post('/api/auction/source/resync', json={})
check('duplicate names refused', r.status_code == 400 and 'more than once' in r.get_data(as_text=True),
      r.get_data(as_text=True)[:100])

print('\n%s' % ('ALL CHECKS PASSED' if check.failed == 0 else '%d CHECK(S) FAILED' % check.failed))
sys.exit(1 if check.failed else 0)
