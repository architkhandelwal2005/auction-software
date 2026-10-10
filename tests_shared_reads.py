"""The answers every polling screen asks for are built once and shared, so a
dozen screens do not each read every player from the database. A change made
through the app shows on the very next poll; one made outside a request shows
within SHARED_READ_SECONDS; and one auction's answer never reaches another.
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

# Count how often the live report is really built.
builds = {'n': 0}
_build = A.build_live_report
def counting_build(conn):
    builds['n'] += 1
    return _build(conn)
A.build_live_report = counting_build

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': os.environ.get('ADMIN_PASSWORD', 'admin@123')})
aid = admin.post('/api/auctions', json={'name': 'Shared Reads'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
tid = admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 100}).get_json()['id']
pid = admin.post('/api/players', json={'name': 'Asha', 'category': 'A', 'base_price': 1}).get_json()['id']

# Many screens polling: one build between changes.
builds['n'] = 0
first = [admin.get('/api/live_data').get_json() for _ in range(10)]
check('ten polls, one build', builds['n'] == 1, str(builds['n']))
check('every poll gets the same answer', all(f == first[0] for f in first))

# A change through the app shows on the next poll.
admin.post('/api/auction/state', json={'current_player': 'Asha', 'current_player_id': str(pid), 'current_bid': 3})
st = admin.get('/api/live_data').get_json()['auction_state']
check('a bid shows on the next poll', st.get('current_bid') == '3', str(st.get('current_bid')))
admin.post('/api/sell_player', json={'player_id': pid, 'team_id': tid, 'sold_price': 3})
live = admin.get('/api/live_data').get_json()
check('a sale shows on the next poll', [p['name'] for p in live['sold_players']] == ['Asha'])
check('and on the team list', admin.get('/api/teams').get_json()[0]['remaining_budget'] == 97)
check('and on the player list', admin.get('/api/players').get_json()[0]['status'] == 'sold')

# A change made outside a request (a photo downloading in the background)
# shows once SHARED_READ_SECONDS has passed.
A.SHARED_READ_SECONDS = 0.5
admin.get('/api/players')
with A.app.test_request_context():
    A.g.auction_id = aid
    conn = A.get_db()
    conn.execute("UPDATE players SET photo_url = '/media/x.png' WHERE id = ?", (pid,))
    conn.commit()
check('outside change waits for the window', admin.get('/api/players').get_json()[0]['photo_url'] != '/media/x.png')
time.sleep(0.6)
check('and shows after it', admin.get('/api/players').get_json()[0]['photo_url'] == '/media/x.png')
A.SHARED_READ_SECONDS = 5

# A write that finishes while an answer is being built: that answer is not kept.
def build_during_write(conn):
    data = _build(conn)
    with A._shared_reads_lock:
        A._shared_reads_gen[0] += 1   # what a write finishing now does
    return data
A.build_live_report = build_during_write
admin.post('/api/auction/state', json={'current_bid': 4})   # nothing kept from before
admin.get('/api/live_data')
A.build_live_report = counting_build
builds['n'] = 0
admin.get('/api/live_data')
check('an answer that raced a write is rebuilt', builds['n'] == 1, str(builds['n']))

# One auction's answer never reaches another.
other = admin.post('/api/auctions', json={'name': 'Other'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % other)
check('the other auction sees its own players', admin.get('/api/players').get_json() == [])
check('and its own live data', admin.get('/api/live_data').get_json()['sold_players'] == [])

# Viewer-only answers stay viewer-only.
check('players list still needs a sign-in', A.app.test_client().get('/api/players').status_code in (401, 403))

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
