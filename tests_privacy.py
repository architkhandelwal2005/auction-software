"""Players' private details stay with the auctioneer. A sheet's phone, email,
address and payment columns, and any phone number or email in other columns,
never reach a screen anyone else can open: the live feed, the stage, team
phones, the roster or the report. Nor does the Google Sheets webhook.
"""
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

SECRETS = ['9876543210', '91234 56789', 'asha@example.com', '12 Park Street', 'Ramesh Rao', 'UTR778899',
           'hooks.example.com']
def leaks(body):
    text = body if isinstance(body, str) else body.decode('utf-8', 'replace')
    return [s for s in SECRETS if s in text]

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': os.environ.get('ADMIN_PASSWORD', 'admin@123')})
aid = admin.post('/api/auctions', json={'name': 'Private'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
tid = admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 100}).get_json()['id']
details = {'Role': 'Batter', 'Age': 24, 'Jersey Number': '1234567890', 'City': 'Pune',
           'Mobile No.': '9876543210', 'Email ID': 'asha@example.com', 'Address': '12 Park Street',
           "Father's Name": 'Ramesh Rao', 'Fee Paid (UTR)': 'UTR778899',
           'Anything else?': 'call me on 91234 56789'}
pids = [admin.post('/api/players', json={'name': n, 'category': 'A', 'base_price': 1}).get_json()['id']
        for n in ('Asha', 'Bina', 'Chitra')]
with A.app.test_request_context():   # what a sheet import stores
    A.g.auction_id = aid
    conn = A.get_db()
    conn.execute('UPDATE players SET attributes = ?', (json.dumps(details),))
    conn.commit()
admin.post('/api/config', json={'config': {'sheets_webhook': 'https://hooks.example.com/abc'}})
admin.post('/api/sell_player', json={'player_id': pids[0], 'team_id': tid, 'sold_price': 5})
admin.post('/api/auction/state', json={'current_player': 'Bina', 'current_player_id': str(pids[1]), 'current_bid': 1})
admin.post('/api/auction/go_live')

full = [p for p in admin.get('/api/players').get_json() if p['id'] == pids[2]][0]['attributes']
check('the console still sees every detail', full.get('Mobile No.') == '9876543210' and full.get('Email ID') == 'asha@example.com',
      json.dumps(full))
check("and the webhook it set", admin.get('/api/config').get_json()['config'].get('sheets_webhook') == 'https://hooks.example.com/abc')

anon = A.app.test_client()
team = A.app.test_client()
team.post('/api/auth/login', json={'role': 'team', 'team_id': tid, 'password': 'reds'})
for who, client, paths in (
        ('the audience', anon, ['/api/live_data', '/api/live_state', '/api/teams', '/api/config']),
        ('a team owner', team, ['/api/live_data', '/api/live_state', '/api/teams', '/api/config', '/api/players',
                                '/api/team/%d' % tid, '/api/auction/state', '/api/stats'])):
    for path in paths:
        r = client.get(path)
        check('%s: %s carries nothing private' % (who, path), r.status_code == 200 and not leaks(r.data),
              '%s %s' % (r.status_code, leaks(r.data)))

live = anon.get('/api/live_data').get_json()
shown = live['unsold_players'][0]['attributes']
check('the details screens show are still there', shown == {'Role': 'Batter', 'Age': 24, 'Jersey Number': '1234567890', 'City': 'Pune'},
      json.dumps(shown))
check('on the stage too', live['auction_state'].get('attributes', {}).get('Role') == 'Batter')
check('and for sold players', live['sold_players'][0]['attributes'].get('City') == 'Pune')
check('team owners still get the player list', len(team.get('/api/players').get_json()) == 3)
check('the console still gets everything after them (answers kept per audience)',
      [p for p in admin.get('/api/players').get_json() if p['id'] == pids[2]][0]['attributes'].get('Mobile No.') == '9876543210')

admin.post('/api/auction/end')
for who, client in (('the audience', anon), ('a team owner', team)):
    for path in ('/api/report/final', '/report'):
        r = client.get(path)
        if r.status_code == 200:
            check('%s: %s carries nothing private' % (who, path), not leaks(r.data), str(leaks(r.data)))
with A.app.test_request_context():
    kept = A.auction_row(aid)['report_json']
check('the report kept after the purge carries nothing private', not leaks(kept), str(leaks(kept)))

# A report kept before details were filtered still has them stored; they are
# cleaned as it is served.
old_report = {'teams': [{'name': 'Reds', 'players': [{'name': 'Asha', 'attributes': details}]}],
              'unsold_players': [{'name': 'Bina', 'attributes': json.dumps(details)}],
              'config': {'event_name': 'Private', 'sheets_webhook': 'https://hooks.example.com/abc'}}
with A.app.test_request_context():
    reg = A.get_registry_db()
    reg.execute("UPDATE auctions SET status = 'purged', report_json = ? WHERE id = ?", (json.dumps(old_report), aid))
    reg.commit()
r = team.get('/api/report/final')
served = r.get_json()['report']
check('an older stored report is served without private details', r.status_code == 200 and not leaks(r.data),
      '%s %s' % (r.status_code, leaks(r.data)))
check('and with the rest intact', served['teams'][0]['players'][0]['attributes'].get('Role') == 'Batter'
      and served['config']['event_name'] == 'Private')

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
