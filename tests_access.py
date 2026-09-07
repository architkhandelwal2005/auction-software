"""Who may call what.

Spectator login takes no password, so a spectator session reaching a write
endpoint is a public hole. Before the route policy existed, a spectator could
clear the live auction's entire player pool. These checks keep that shut.
"""
import os, sys
os.environ['DATABASE_URL'] = ''
sys.path.insert(0, r'D:\auction software')
os.chdir(r'D:\auction software')
import app as A

def check(label, cond, detail=''):
    print(('  PASS  ' if cond else '  FAIL  ') + label + (' :: ' + detail if detail else ''))
    if not cond: check.failed += 1
check.failed = 0

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': 'admin@123'})
admin.post('/api/auctions', json={'name': 'Access Test'})
admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 1000})
admin.post('/api/players', json={'name': 'Keeper', 'category': 'A', 'base_price': 10})
admin.post('/api/auction/go_live')
check('admin can set an auction up', len(admin.get('/api/players').get_json()) == 1)

# ── Nobody signed in ─────────────────────────────────────────────────────────
anon = A.app.test_client()
check('anon may watch the live feed', anon.get('/api/live_data').status_code == 200)
check('anon may open the spectator screen', anon.get('/live').status_code == 200)
for path in ['/api/players', '/api/reset', '/api/players/clear_pool', '/api/sell_player']:
    code = anon.post(path, json={}).status_code
    check('anon refused %s' % path, code in (401, 403, 405), str(code))

# ── Spectator: passwordless, so read-only ────────────────────────────────────
spec = A.app.test_client()
check('spectator can sign in', spec.post('/api/auth/login', json={'role': 'spectator'}).status_code == 200)
check('spectator may read players', spec.get('/api/players').status_code == 200)
check('spectator may read stats', spec.get('/api/stats').status_code == 200)
for path, body in [('/api/players', {'name': 'Intruder', 'category': 'A', 'base_price': 1}),
                   ('/api/reset', {}),
                   ('/api/players/clear_pool', {}),
                   ('/api/sell_player', {'player_id': 1, 'team_id': 1, 'sold_price': 10}),
                   ('/api/setup/restart', {'wipe_all': True, 'password': 'Wipe@123'}),
                   ('/api/auction/end', {}),
                   ('/api/auction/source/import', {'sheet_url': 'x'})]:
    check('spectator refused %s' % path, spec.post(path, json=body).status_code == 403,
          str(spec.post(path, json=body).status_code))
check('spectator refused the admin console', spec.get('/admin').status_code in (302, 403))
check('spectator cannot list auctions', spec.get('/api/auctions').status_code in (401, 403))
check('player pool survived the spectator', len(admin.get('/api/players').get_json()) == 1)

# ── Team owner: their own dashboard, no write access ─────────────────────────
team_id = admin.get('/api/teams').get_json()[0]['id']
team = A.app.test_client()
r = team.post('/api/auth/login', json={'role': 'team', 'team_id': team_id, 'password': 'reds'})
check('team owner can sign in', r.status_code == 200, r.get_data(as_text=True)[:80])
check('team owner sees their dashboard', team.get('/api/team/%d' % team_id).status_code == 200)
check('team owner refused selling', team.post('/api/sell_player', json={}).status_code == 403)
check('team owner refused wiping', team.post('/api/players/clear_pool', json={}).status_code == 403)

# A second team must not be able to read the first team's dashboard.
admin.post('/api/teams', json={'name': 'Blues', 'total_budget': 1000})
other_id = [t['id'] for t in admin.get('/api/teams').get_json() if t['id'] != team_id][0]
check('team owner refused another team\'s dashboard',
      team.get('/api/team/%d' % other_id).status_code == 403,
      str(team.get('/api/team/%d' % other_id).status_code))

# ── The boot guard ───────────────────────────────────────────────────────────
known = {r.endpoint for r in A.app.url_map.iter_rules()}
check('every route is classified', not (known - set(A.ROUTE_POLICY)),
      str(sorted(known - set(A.ROUTE_POLICY))))
saved = A.ROUTE_POLICY.pop('sell_player')
try:
    A._assert_every_route_classified()
    check('boot guard catches an unclassified route', False, 'it did not fire')
except RuntimeError:
    check('boot guard catches an unclassified route', True)
A.ROUTE_POLICY['sell_player'] = saved

print('\n%s' % ('ALL CHECKS PASSED' if check.failed == 0 else '%d CHECK(S) FAILED' % check.failed))
sys.exit(1 if check.failed else 0)
