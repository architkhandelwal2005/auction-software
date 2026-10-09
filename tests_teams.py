"""Team creation is idempotent by name, and a team's logo travels with it:
uploaded once, it appears on the team and on the leading-bidder / last-buyer
fields every live screen reads.
"""
import io, os, shutil, sys
os.environ['DATABASE_URL'] = ''
os.environ['SUPABASE_URL'] = ''           # keep test uploads on local disk, never the real bucket
os.environ['SUPABASE_SERVICE_KEY'] = ''
sys.path.insert(0, r'D:\auction software')
os.chdir(r'D:\auction software')
import app as A

def check(label, cond, detail=''):
    print(('  PASS  ' if cond else '  FAIL  ') + label + (' :: ' + detail if detail else ''))
    if not cond: check.failed += 1
check.failed = 0

PNG = (b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89'
       b'\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82')

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': os.environ.get('ADMIN_PASSWORD', 'admin@123')})
aid = admin.post('/api/auctions', json={'name': 'Team Test'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)

r = admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 1000})
first = r.get_json()
check('team created', r.status_code == 200 and first.get('id') and not first.get('existing'), r.get_data(as_text=True)[:80])

r = admin.post('/api/teams', json={'name': ' reds ', 'total_budget': 1000})
again = r.get_json()
check('same name (any case/spacing) returns the existing team', again.get('existing') and again['id'] == first['id'], r.get_data(as_text=True)[:80])
admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 1000})
names = [t['name'] for t in admin.get('/api/teams').get_json()]
check('only one team exists after three submissions', names == ['Reds'], str(names))

r = admin.post('/api/teams', json={'name': '   ', 'total_budget': 1000})
check('blank name refused', r.status_code == 400)

tid = first['id']
r = admin.post('/api/teams/logo/%d' % tid, data={'logo': (io.BytesIO(PNG), 'logo.png')}, content_type='multipart/form-data')
check('logo uploaded', r.status_code == 200 and r.get_json().get('logo_url'), r.get_data(as_text=True)[:100])
logo = r.get_json().get('logo_url')
check('team carries its logo', admin.get('/api/teams').get_json()[0].get('logo_url') == logo)

admin.post('/api/players', json={'name': 'Asha', 'category': 'A', 'base_price': 10})
admin.post('/api/auction/state', json={'current_player': 'Asha', 'current_bid': 20,
                                       'bidder_team_id': str(tid), 'bidder_team_name': 'Reds'})
st = admin.get('/api/live_data').get_json()['auction_state']
check('leading bidder logo is in live data', st.get('bidder_team_logo') == logo, str(st.get('bidder_team_logo')))

pid = admin.get('/api/players').get_json()[0]['id']
r = admin.post('/api/sell_player', json={'player_id': pid, 'team_id': tid, 'sold_price': 20})
st = admin.get('/api/live_data').get_json()['auction_state']
check('last buyer logo is in live data', r.status_code == 200 and st.get('last_sold_team_logo') == logo, r.get_data(as_text=True)[:100] + ' / ' + str(st.get('last_sold_team_logo')))

# ── Sponsor is optional: absent by default, stored when given, kept in the
#    frozen report so it survives the purge, and removable. ──
cfg = admin.get('/api/live_data').get_json()['config']
check('no sponsor by default', not cfg.get('sponsor_name') and not cfg.get('sponsor_logo'))
r = admin.post('/api/config/sponsor_logo', data={'logo': (io.BytesIO(PNG), 'sp.png')}, content_type='multipart/form-data')
check('sponsor logo uploaded', r.status_code == 200 and r.get_json().get('logo_url'), r.get_data(as_text=True)[:100])
admin.post('/api/config', json={'config': {'sponsor_name': 'Acme Sports'}})
cfg = admin.get('/api/live_data').get_json()['config']
check('sponsor name and logo are in live config', cfg.get('sponsor_name') == 'Acme Sports' and cfg.get('sponsor_logo'), str(cfg.get('sponsor_logo')))
with A.app.app_context():
    conn = A.open_auction_conn(aid)
    frozen = A.build_final_report(conn, dict(A.auction_row(aid)))
    conn.close()
check('frozen report keeps sponsor (survives purge)', frozen['config']['sponsor_name'] == 'Acme Sports' and frozen['config']['sponsor_logo'] == cfg['sponsor_logo'], str(frozen['config']))
admin.post('/api/config', json={'config': {'sponsor_name': '', 'sponsor_logo': ''}})
cfg = admin.get('/api/live_data').get_json()['config']
check('sponsor can be removed again', not cfg.get('sponsor_name') and not cfg.get('sponsor_logo'))

# ── Pre-allotment: a retained player goes straight to a team at the admin's
#    price (zero allowed), the purse follows, and the player leaves the pool. ──
def team(t_id):
    return next(t for t in admin.get('/api/teams').get_json() if t['id'] == t_id)
def player(name):
    return next(p for p in admin.get('/api/players').get_json() if p['name'] == name)
blues = admin.post('/api/teams', json={'name': 'Blues', 'total_budget': 100}).get_json()['id']
admin.post('/api/players', json={'name': 'Ravi', 'category': 'A', 'base_price': 10})
rid = player('Ravi')['id']
r = admin.post('/api/players/edit_sale', json={'player_id': rid, 'status': 'sold', 'team_id': blues, 'sold_price': 30})
p = player('Ravi')
check('player allotted at chosen price', r.status_code == 200 and p['status'] == 'sold' and p['team_id'] == blues and p['sold_price'] == 30, r.get_data(as_text=True)[:100])
check('purse charged', team(blues)['remaining_budget'] == 70, str(team(blues)['remaining_budget']))
r = admin.post('/api/players/edit_sale', json={'player_id': rid, 'status': 'sold', 'team_id': blues, 'sold_price': 0})
check('price can be zero; same-team change refunds the difference', r.status_code == 200 and player('Ravi')['sold_price'] == 0 and team(blues)['remaining_budget'] == 100)
r = admin.post('/api/players/edit_sale', json={'player_id': rid, 'status': 'sold', 'team_id': blues, 'sold_price': 101})
check('price above the purse refused', r.status_code == 400 and player('Ravi')['sold_price'] == 0, r.get_data(as_text=True)[:100])
r = admin.post('/api/players/edit_sale', json={'player_id': rid, 'status': 'sold', 'team_id': blues, 'sold_price': -5})
check('negative price refused', r.status_code == 400)
r = admin.post('/api/players/edit_sale', json={'player_id': rid, 'status': 'sold', 'team_id': 9999, 'sold_price': 5})
check('unknown team refused', r.status_code == 404)
admin.post('/api/players/edit_sale', json={'player_id': rid, 'status': 'sold', 'team_id': blues, 'sold_price': 40})
r = admin.post('/api/players/edit_sale', json={'player_id': rid, 'status': 'unsold'})
p = player('Ravi')
check('return to pool refunds the purse', r.status_code == 200 and p['status'] == 'unsold' and p['team_id'] is None and team(blues)['remaining_budget'] == 100, str(p))
admin.post('/api/players/edit_sale', json={'player_id': rid, 'status': 'sold', 'team_id': blues, 'sold_price': 25})
admin.post('/api/undo')
check('undo reverses an allotment', player('Ravi')['status'] == 'unsold' and team(blues)['remaining_budget'] == 100)

# ── A team role typed at allotment (Captain, Owner...) shows in the report,
#    and is dropped when the player goes back to the pool. ──
admin.post('/api/players', json={'name': 'Meera', 'category': 'A', 'base_price': 10})
mid = player('Meera')['id']
admin.post('/api/players/edit_sale', json={'player_id': mid, 'status': 'sold', 'team_id': blues, 'sold_price': 5})
r = admin.post('/api/players/edit_sale', json={'player_id': rid, 'status': 'sold', 'team_id': blues, 'sold_price': 0, 'team_role': '  Captain '})
check('allotted with a role', r.status_code == 200 and player('Ravi')['team_role'] == 'Captain', str(player('Ravi').get('team_role')))
squad = next(t for t in admin.get('/api/live_data').get_json()['teams'] if t['id'] == blues)['players']
check('report squad lists role holders first', squad[0]['name'] == 'Ravi' and squad[0]['team_role'] == 'Captain', str([(p['name'], p.get('team_role')) for p in squad]))
with A.app.app_context():
    conn = A.open_auction_conn(aid)
    frozen = A.build_final_report(conn, dict(A.auction_row(aid)))
    conn.close()
fsquad = next(t for t in frozen['teams'] if t['id'] == blues)['players']
check('frozen report keeps the role', any(p['name'] == 'Ravi' and p['team_role'] == 'Captain' for p in fsquad))
check('CSV export has the role', 'Captain' in admin.get('/api/export/csv').get_data(as_text=True))
admin.post('/api/players/edit_sale', json={'player_id': rid, 'status': 'unsold'})
check('return to pool clears the role', not player('Ravi')['team_role'])

# ── Auctions created before the role column existed gain it on first use. ──
import sqlite3, tempfile
old_db = os.path.join(tempfile.mkdtemp(), 'old.db')
oc = sqlite3.connect(old_db); oc.row_factory = sqlite3.Row
oc.execute('CREATE TABLE players (id INTEGER PRIMARY KEY, name TEXT, team_id INTEGER, sold_price REAL, status TEXT)')
A.upgrade_auction_schema(oc, 'old-schema-test')
cols = [r['name'] for r in oc.execute('PRAGMA table_info(players)').fetchall()]
oc.close()
check('old auction gains team_role column', 'team_role' in cols, str(cols))

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
