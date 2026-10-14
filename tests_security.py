"""Team PINs and the reset password. A team signs in with six random digits
the console shows, not its name; guessing is cut off; the PIN never reaches
a screen. Undoing sales needs the wipe password once there are any.
"""
import os, sys
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
aid = admin.post('/api/auctions', json={'name': 'Secure Cup', 'login_id': 'securecup', 'password': 'cup-pass-1'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
reds = admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 100}).get_json()['id']
blues = admin.post('/api/teams', json={'name': 'Blues', 'total_budget': 100}).get_json()['id']
p1 = admin.post('/api/players', json={'name': 'Asha', 'category': 'A', 'base_price': 1}).get_json()['id']
admin.post('/api/auction/go_live')

print('Team PINs')
pins = {t['id']: t['pin'] for t in admin.get('/api/teams/pins').get_json()}
check('every team has a six-digit PIN', all(len(p) == 6 and p.isdigit() for p in pins.values()) and len(pins) == 2, str(pins))
check('and they differ', pins[reds] != pins[blues])
login = lambda c, tid, pw: c.post('/api/auth/login', json={'role': 'team', 'team_id': tid, 'password': pw})
check("the team's name no longer signs in", login(A.app.test_client(), reds, 'reds').status_code == 401)
phone = A.app.test_client()
check('its PIN does', login(phone, reds, pins[reds]).status_code == 200)
check("one team's PIN does not open another", login(A.app.test_client(), blues, pins[reds]).status_code == 401)
check('spaces in a typed PIN are fine', login(A.app.test_client(), blues, ' '.join(pins[blues])).status_code == 200)

anon = A.app.test_client()
for path in ('/api/teams', '/api/live_data', '/api/config'):
    body = anon.get(path).get_data(as_text=True)
    check('no PIN in %s' % path, pins[reds] not in body and pins[blues] not in body)
check("no PIN in the team's own dashboard", pins[reds] not in phone.get('/api/team/%d' % reds).get_data(as_text=True))
check('a team owner cannot list PINs', phone.get('/api/teams/pins').status_code == 403)
check('nor can the audience', anon.get('/api/teams/pins').status_code == 401)

A._pin_failures.clear()   # the wrong team's PIN tried above counted as one
guesser = A.app.test_client()
wrong = '000000' if pins[blues] != '000000' else '111111'
codes = [login(guesser, blues, wrong).status_code for _ in range(A.PIN_TRIES)]
check('wrong PINs are refused', codes == [401] * A.PIN_TRIES, str(codes))
check('then even the right one waits', login(guesser, blues, pins[blues]).status_code == 429)
r = admin.post('/api/teams/%d/pin' % blues)
new = r.get_json()['pin']
check('the console can issue a new PIN', r.status_code == 200 and new != pins[blues] and len(new) == 6)
check('which works at once (and lifts the wait)', login(A.app.test_client(), blues, new).status_code == 200)
check('while the old one stops', new == pins[blues] or login(A.app.test_client(), blues, pins[blues]).status_code == 401)
check('a team owner cannot issue one', phone.post('/api/teams/%d/pin' % reds).status_code == 403)

print('Reset password')
check('with no sales, reset needs no password', admin.post('/api/reset').status_code == 200)
admin.post('/api/sell_player', json={'player_id': p1, 'team_id': reds, 'sold_price': 5})
r = admin.post('/api/reset')
check('with sales, reset asks for the password', r.status_code == 403 and r.get_json()['error'] == 'password_required')
check('a wrong one is refused', admin.post('/api/reset', json={'password': 'guess'}).status_code == 403)
sold = [p for p in admin.get('/api/players').get_json() if p['status'] == 'sold']
check('and the sale stands', len(sold) == 1)
r = admin.post('/api/setup/restart', json={})
check('going back to setup asks too, since it undoes sales', r.status_code == 403)
check('the wipe password resets', admin.post('/api/reset', json={'password': A.WIPE_PASSWORD}).status_code == 200
      and all(p['status'] == 'unsold' for p in admin.get('/api/players').get_json()))

auctioneer = A.app.test_client()
auctioneer.post('/api/auth/login', json={'role': 'admin', 'login_id': 'securecup', 'password': 'cup-pass-1'})
auctioneer.post('/api/sell_player', json={'player_id': p1, 'team_id': reds, 'sold_price': 5})
check("an auction's own auctioneer resets with their login password",
      auctioneer.post('/api/reset', json={'password': 'cup-pass-1'}).status_code == 200)

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
