"""Sheet import, re-sync diff and apply, using a local CSV in place of Google.

fetch_public_sheet is stubbed so the flow is tested without depending on a
particular sheet staying public; the real fetch is verified separately.
"""
import os, sys
os.environ['DATABASE_URL'] = ''
os.environ['SUPABASE_URL'] = ''           # keep test uploads on local disk, never the real bucket
os.environ['SUPABASE_SERVICE_KEY'] = ''
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

# Two different people may share a name: both are imported, and each keeps
# their own details through re-sync, analysis and the stage.
aid2 = client.post('/api/auctions', json={'name': 'Same Names'}).get_json()['auction']['id']
client.post('/api/auctions/%d/open' % aid2)
CURRENT['data'] = (b'Name,Mobile,Age,Gender\n'
                   b'Rahul Sharma,9000000001,22,Male\n'
                   b'Rahul Sharma,9000000002,41,Male\n'
                   b'Isha Jain,9000000003,30,Female\n')
r = client.post('/api/auction/source/import', json={'sheet_url': SHEET_URL})
check('same-name players both imported', r.status_code == 200 and r.get_json().get('count') == 3,
      r.get_data(as_text=True)[:120])
rahuls = sorted((p for p in client.get('/api/players').get_json() if p['name'] == 'Rahul Sharma'), key=lambda p: p['id'])
check('each keeps their own details', [p['attributes'].get('Mobile') for p in rahuls] == [9000000001, 9000000002]
      or [str(p['attributes'].get('Mobile')) for p in rahuls] == ['9000000001', '9000000002'],
      str([p['attributes'] for p in rahuls]))

# Unchanged sheet: re-sync sees no difference (rows pair up by name + order).
d = client.post('/api/auction/source/resync', json={}).get_json()
check('re-sync pairs same-name rows', not d['added'] and not d['removed'] and not d['changed'], str(d))
# The second Rahul leaves the sheet: exactly one Rahul is removed.
CURRENT['data'] = (b'Name,Mobile,Age,Gender\n'
                   b'Rahul Sharma,9000000001,22,Male\n'
                   b'Isha Jain,9000000003,30,Female\n')
d = client.post('/api/auction/source/resync', json={}).get_json()
check('one of two same-name players removed', d['removed'] == ['Rahul Sharma'] and not d['added'], str(d))

# Analysis gives each Rahul the category of their own age.
r = client.post('/api/players/analyze', json={'num_teams': 1, 'num_splits': 2, 'split_by': ['Age'], 'bins': {'Age': 2}})
rahuls = sorted((p for p in client.get('/api/players').get_json() if p['name'] == 'Rahul Sharma'), key=lambda p: p['id'])
check('same-name players get their own categories', r.status_code == 200 and rahuls[0]['category'] != rahuls[1]['category'],
      str([(p['attributes'].get('Age'), p['category']) for p in rahuls]))

# The setup wizard analyses the uploaded file itself; its rows are matched
# to stored players by name and order, so the result is the same.
import io
client.post('/api/players/edit', json={'id': rahuls[0]['id'], 'category': 'X'})
client.post('/api/players/edit', json={'id': rahuls[1]['id'], 'category': 'X'})
two_rahuls = (b'Name,Mobile,Age,Gender\nRahul Sharma,9000000001,22,Male\n'
              b'Rahul Sharma,9000000002,41,Male\nIsha Jain,9000000003,30,Female\n')
r = client.post('/api/file/smart_analyze', content_type='multipart/form-data', data={
    'file': (io.BytesIO(two_rahuls), 'players.csv'), 'num_teams': '1', 'num_splits': '2',
    'split_by': '["Age"]', 'bins': '{"Age": 2}'})
rahuls = sorted((p for p in client.get('/api/players').get_json() if p['name'] == 'Rahul Sharma'), key=lambda p: p['id'])
check('file analysis also keeps same-name players apart', r.status_code == 200 and rahuls[0]['category'] != rahuls[1]['category']
      and 'X' not in (rahuls[0]['category'], rahuls[1]['category']),
      str([(p['attributes'].get('Age'), p['category']) for p in rahuls]))

# On the stage, the second Rahul is shown with his own details.
client.post('/api/auction/state', json={'current_player': 'Rahul Sharma', 'current_player_id': str(rahuls[1]['id']),
                                        'current_bid': 10})
st = client.get('/api/live_data').get_json()['auction_state']
check('stage shows the right one of two same-name players', str(st['attributes'].get('Mobile')) == '9000000002',
      str(st.get('attributes')))
client.post('/api/auction/state', json={'current_player': 'Isha Jain', 'current_bid': 10})
st = client.get('/api/live_data').get_json()['auction_state']
check('next player without an id does not inherit the last id', not st.get('current_player_id'), str(st))

print('\n%s' % ('ALL CHECKS PASSED' if check.failed == 0 else '%d CHECK(S) FAILED' % check.failed))
sys.exit(1 if check.failed else 0)
