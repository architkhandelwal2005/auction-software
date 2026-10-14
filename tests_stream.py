"""Live push. Where the server streams (gevent), a screen holds /api/live_stream
open and each change is sent to it at once; elsewhere the stream answers 204
and screens poll. After a change every screen asks at once, and one database
read serves them all.
"""
import os, sys, json, time, threading
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
aid = admin.post('/api/auctions', json={'name': 'Stream'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
tid = admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 100}).get_json()['id']
pid = admin.post('/api/players', json={'name': 'Asha', 'category': 'A', 'base_price': 1}).get_json()['id']
admin.post('/api/auction/go_live')
admin.post('/api/auction/state', json={'current_player': 'Asha', 'current_player_id': str(pid), 'current_bid': 1})

anon = A.app.test_client()
check('a server that does not stream says so (204: the browser polls)',
      anon.get('/api/live_stream').status_code == 204)

A.STREAMING = True

def events(resp):
    """The messages of an open stream, as they come."""
    buf = ''
    for chunk in resp.response:
        buf += chunk.decode() if isinstance(chunk, bytes) else chunk
        while '\n\n' in buf:
            block, buf = buf.split('\n\n', 1)
            if block.startswith('data: '):
                yield json.loads(block[6:])

stream = anon.get('/api/live_stream', buffered=False)
check('the stream opens without a login', stream.status_code == 200
      and stream.headers['Content-Type'].startswith('text/event-stream'), stream.headers.get('Content-Type'))
messages = events(stream)
first = next(messages)
check('it starts with the current state', first['live']['auction_state']['current_bid'] == '1'
      and first['live'] == anon.get('/api/live_state').get_json())
check("with the server's clock", abs(first['now'] - time.time() * 1000) < 2000)

def bid_soon():
    time.sleep(0.3)
    admin.post('/api/auction/state', json={'for_player_id': str(pid), 'current_bid': 4, 'bidder_team_id': str(tid)})
threading.Thread(target=bid_soon).start()
started = time.time()
second = next(messages)
waited = time.time() - started
check('a bid is sent at once', second['live']['auction_state']['current_bid'] == '4' and waited < 1.5,
      '%.2fs' % waited)
check('a bid keeps the revision, so screens fetch nothing more', second['live']['rev'] == first['live']['rev'])

# Many screens, one database read.
builds = {'n': 0}
_build = A.build_live_report
def counting_build(conn):
    builds['n'] += 1
    time.sleep(0.2)   # a database far away
    return _build(conn)
A.build_live_report = counting_build
admin.post('/api/auction/state', json={'for_player_id': str(pid), 'current_bid': 5, 'bidder_team_id': str(tid)})
builds['n'] = 0
got = []
def poll():
    got.append(A.app.test_client().get('/api/live_state').get_json()['auction_state']['current_bid'])
threads = [threading.Thread(target=poll) for _ in range(20)]
for t in threads: t.start()
for t in threads: t.join()
check('twenty screens asking at once after a change: one build', builds['n'] == 1 and got == ['5'] * 20,
      '%d builds' % builds['n'])
A.build_live_report = _build

# A stream ends after a while and the browser opens a new one.
A.STREAM_MAX_SECONDS = 0.5
short = events(anon.get('/api/live_stream', buffered=False))
next(short)
started = time.time()
try:
    next(short)
    ended = False
except StopIteration:
    ended = True
check('a stream closes after STREAM_MAX_SECONDS', ended and time.time() - started < 7, '%.1fs' % (time.time() - started))

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
