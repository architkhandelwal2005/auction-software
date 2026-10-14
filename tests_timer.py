"""The bid timer and the stream overlay. The server keeps the moment the timer
ends, so every screen counts down together; each new bid restarts it, and a
new player, a sale or a pass clears it.
"""
import os, sys, time
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

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': os.environ.get('ADMIN_PASSWORD', 'admin@123')})
aid = admin.post('/api/auctions', json={'name': 'Timer'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
tid = admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 100}).get_json()['id']
p1 = admin.post('/api/players', json={'name': 'P1', 'category': 'A', 'base_price': 1}).get_json()['id']
p2 = admin.post('/api/players', json={'name': 'P2', 'category': 'A', 'base_price': 1}).get_json()['id']
admin.post('/api/auction/go_live')

def stage():
    return admin.get('/api/live_state').get_json()['auction_state']
def ends():
    return int(stage().get('timer_ends_at') or 0)
now_ms = lambda: int(time.time() * 1000)

admin.post('/api/auction/state', json={'current_player': 'P1', 'current_player_id': str(p1), 'current_bid': 1})
check('no timer until one is started', 'timer_ends_at' not in stage())
admin.post('/api/auction/state', json={'timer': 15})
left = ends() - now_ms()
check('a 15s timer ends 15s from now by the server clock', 14000 < left <= 15000, str(left))
check('and keeps its length', stage().get('timer_seconds') == '15')

before = ends()
time.sleep(1.1)
admin.post('/api/auction/state', json={'for_player_id': str(p1), 'current_bid': 2, 'bidder_team_id': str(tid)})
check('a new bid restarts it', ends() - before >= 1000, str(ends() - before))

admin.post('/api/auction/state', json={'timer_ends_at': 1, 'timer_seconds': 999})
check('a screen cannot set the end directly', ends() > now_ms() and stage().get('timer_seconds') == '15')
check('a nonsense length is refused', admin.post('/api/auction/state', json={'timer': 'soon'}).status_code == 400)
admin.post('/api/auction/state', json={'timer': 9999})
check('a long one is capped at 5 minutes', stage().get('timer_seconds') == '300')
admin.post('/api/auction/state', json={'timer': 0})
check('stopping clears it', 'timer_ends_at' not in stage() and 'timer_seconds' not in stage())

admin.post('/api/auction/state', json={'timer': 10})
admin.post('/api/sell_player', json={'player_id': p1, 'team_id': tid, 'sold_price': 2})
check('a sale clears it', 'timer_ends_at' not in stage())
admin.post('/api/auction/state', json={'current_player': 'P2', 'current_player_id': str(p2), 'current_bid': 1})
admin.post('/api/auction/state', json={'timer': 10})
admin.post('/api/auction/state', json={'current_player': '', 'current_bid': 0})
check('taking the player off the block clears it', 'timer_ends_at' not in stage())
admin.post('/api/auction/state', json={'current_player': 'P2', 'current_player_id': str(p2), 'current_bid': 1})
admin.post('/api/auction/state', json={'timer': 10})
admin.post('/api/action/pass', json={'player_id': p2})
check('a pass clears it', 'timer_ends_at' not in stage())

r = admin.get('/api/live_state')
check("live state carries the server's clock", abs(int(r.headers.get('X-Now') or 0) - now_ms()) < 2000,
      str(r.headers.get('X-Now')))

anon = A.app.test_client()
r = anon.get('/overlay')
check('the stream overlay opens without a login', r.status_code == 200 and b'overlay.js' in r.data, str(r.status_code))
check('and keeps to its auction', ('data-auction="%d"' % aid).encode() in r.data)

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
