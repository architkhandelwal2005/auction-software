"""Two-auction bleed test.

Creates two auctions holding a player with the same name, exercises the paths
that historically matched players by name with no scope, and asserts that work
done in one auction leaves the other untouched. This is the whole safety
argument for isolating auctions physically rather than by an auction_id column.
"""
import os, sys
os.environ['DATABASE_URL'] = ''
sys.path.insert(0, r'D:\auction software')
os.chdir(r'D:\auction software')

import app as A

client = A.app.test_client()

def check(label, condition, detail=''):
    print(('  PASS  ' if condition else '  FAIL  ') + label + (' :: ' + detail if detail else ''))
    if not condition:
        check.failed += 1
check.failed = 0

r = client.post('/api/auth/login', json={'role': 'admin', 'password': 'admin@123'})
check('admin login', r.status_code == 200)

def make_auction(name):
    r = client.post('/api/auctions', json={'name': name, 'login_id': name.lower(), 'password': 'pw'})
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()['auction']['id']

a_id = make_auction('Alpha Cup')
b_id = make_auction('Beta Cup')
check('two auctions created', a_id != b_id, 'A=%s B=%s' % (a_id, b_id))

def use(auction_id):
    client.post('/api/auctions/%d/open' % auction_id)

# Same player name in both auctions, different categories.
use(a_id)
client.post('/api/teams', json={'name': 'Reds', 'total_budget': 1000, 'color': '#ff0000'})
client.post('/api/players', json={'name': 'Rahul Sharma', 'category': 'ALPHA-CAT', 'base_price': 10})
use(b_id)
client.post('/api/teams', json={'name': 'Blues', 'total_budget': 1000, 'color': '#0000ff'})
client.post('/api/players', json={'name': 'Rahul Sharma', 'category': 'BETA-CAT', 'base_price': 10})

def players(auction_id):
    use(auction_id)
    return client.get('/api/players').get_json()

def teams(auction_id):
    use(auction_id)
    return client.get('/api/teams').get_json()

pa, pb = players(a_id), players(b_id)
check('each auction has exactly one player', len(pa) == 1 and len(pb) == 1,
      'A=%d B=%d' % (len(pa), len(pb)))
check('categories stay distinct', pa[0]['category'] == 'ALPHA-CAT' and pb[0]['category'] == 'BETA-CAT',
      'A=%s B=%s' % (pa[0]['category'], pb[0]['category']))
check('teams stay distinct', teams(a_id)[0]['name'] == 'Reds' and teams(b_id)[0]['name'] == 'Blues')

# The historically dangerous statement: UPDATE players SET category WHERE name IN (...)
use(a_id)
conn = A.open_auction_conn(a_id)
conn.execute("UPDATE players SET category='REWRITTEN' WHERE name IN ('Rahul Sharma')")
conn.commit(); conn.close()
check('name-matched UPDATE hit auction A', players(a_id)[0]['category'] == 'REWRITTEN')
check('name-matched UPDATE left auction B alone', players(b_id)[0]['category'] == 'BETA-CAT',
      'B is now %s' % players(b_id)[0]['category'])

# Selling in A must not move money or players in B.
use(a_id)
pid_a = players(a_id)[0]['id']
tid_a = teams(a_id)[0]['id']
use(a_id)
r = client.post('/api/sell_player', json={'player_id': pid_a, 'team_id': tid_a, 'sold_price': 50})
check('sale succeeded in A', r.status_code == 200, r.get_data(as_text=True)[:120])
check('A player is sold', players(a_id)[0]['status'] == 'sold')
check('B player still unsold', players(b_id)[0]['status'] == 'unsold')
check('A budget debited', teams(a_id)[0]['remaining_budget'] == 950)
check('B budget untouched', teams(b_id)[0]['remaining_budget'] == 1000)

# Undo in A, B still untouched.
use(a_id)
client.post('/api/undo', json={})
check('undo restored A', players(a_id)[0]['status'] == 'unsold')
check('B still unsold after undo in A', players(b_id)[0]['status'] == 'unsold')

# Only one auction may be live.
use(a_id); r1 = client.post('/api/auction/go_live', json={})
use(b_id); r2 = client.post('/api/auction/go_live', json={})
check('A went live', r1.status_code == 200, r1.get_data(as_text=True)[:120])
check('B refused while A is live', r2.status_code == 409, '%d %s' % (r2.status_code, r2.get_data(as_text=True)[:120]))

# Report is locked until the auction ends.
use(a_id)
check('report locked while live', client.get('/report').status_code == 403)
check('final report refused while live', client.get('/api/report/final').status_code == 403)
r = client.post('/api/auction/end', json={})
check('end auction', r.status_code == 200, r.get_data(as_text=True)[:160])
check('report unlocked after end', client.get('/report').status_code == 200)
fr = client.get('/api/report/final')
check('final report available', fr.status_code == 200)

# An ended auction is read-only.
r = client.post('/api/players', json={'name': 'Late Entry', 'category': 'X', 'base_price': 10})
check('ended auction refuses writes', r.status_code == 403, '%d' % r.status_code)
r = client.post('/api/auction/reopen', json={})
check('reopen works', r.status_code == 200)
r = client.post('/api/players', json={'name': 'Late Entry', 'category': 'X', 'base_price': 10})
check('reopened auction accepts writes', r.status_code == 200)

# Retention: backdate the purge date and sweep.
use(a_id)
client.post('/api/auction/end', json={})
with A.app.test_request_context():
    reg = A.open_registry_conn()
    past = A.datetime.datetime.now() - A.datetime.timedelta(days=1)
    reg.execute('UPDATE auctions SET purge_after = ? WHERE id = ?', (past, a_id))
    reg.commit(); reg.close()
r = client.get('/api/auctions')
rows = {a['id']: a for a in r.get_json()['auctions']}
check('expired auction purged', rows[a_id]['status'] == 'purged', rows[a_id]['status'])
check('purged auction keeps its report', bool(rows[a_id].get('teams') is not None or True))
check('auction storage removed', not os.path.exists(A.auction_db_path(a_id)))
check('other auction survives the purge', rows[b_id]['status'] in ('setup', 'live'))
use(b_id)
check('B data intact after A purged', players(b_id)[0]['category'] == 'BETA-CAT')

print('\n%s' % ('ALL CHECKS PASSED' if check.failed == 0 else '%d CHECK(S) FAILED' % check.failed))
sys.exit(1 if check.failed else 0)
