"""Bids from team owners' phones. Off by default; with "Ask me" a bid waits
for the auctioneer; with "Instant" it stands at once. The server decides
what a bid may be, and two teams tapping at once cannot both win.
"""
import os, sys, json, threading
os.environ['DATABASE_URL'] = ''
os.environ['SUPABASE_URL'] = ''
os.environ['SUPABASE_SERVICE_KEY'] = ''
sys.path.insert(0, r'D:\auction software')
os.chdir(r'D:\auction software')
import app as A
sys.stdout.reconfigure(encoding='utf-8', errors='replace')   # messages carry ₹

def check(label, cond, detail=''):
    print(('  PASS  ' if cond else '  FAIL  ') + label + (' :: ' + detail if detail else ''))
    if not cond: check.failed += 1
check.failed = 0

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': os.environ.get('ADMIN_PASSWORD', 'admin@123')})
aid = admin.post('/api/auctions', json={'name': 'Phone Bids'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
admin.post('/api/config', json={'config': {'min_players_per_team': '2', 'pricing': json.dumps(
    {'mode': 'same', 'same': {'base': 2, 'increment': 1, 'steps': [{'from': 10, 'increment': 2}]}})},
    'category_rules': [{'category': 'Gold', 'base_price': 2, 'min_per_team': 0, 'max_per_team': 1}]})
ids = {n: admin.post('/api/teams', json={'name': n, 'total_budget': b}).get_json()['id']
       for n, b in (('Reds', 100), ('Blues', 100), ('Greens', 6))}
p1 = admin.post('/api/players', json={'name': 'Asha', 'category': 'Gold', 'base_price': 2}).get_json()['id']
p2 = admin.post('/api/players', json={'name': 'Bina', 'category': 'Gold', 'base_price': 2}).get_json()['id']
admin.post('/api/auction/go_live')
pins = {t['name']: t['pin'] for t in admin.get('/api/teams/pins').get_json()}
phones = {}
for n in ids:
    phones[n] = A.app.test_client()
    phones[n].post('/api/auth/login', json={'role': 'team', 'team_id': ids[n], 'password': pins[n]})

def stage():
    return admin.get('/api/live_state').get_json()['auction_state']
def up(player, name, amount):
    return phones[name].post('/api/bid', json={'for_player_id': str(player), 'amount': amount})
def on_block(pid, name):
    admin.post('/api/auction/state', json={'current_player': name, 'current_player_id': str(pid), 'category': 'Gold',
                                            'base_price': 2, 'current_bid': 2})

on_block(p1, 'Asha')
r = up(p1, 'Reds', 2)
check('off by default: phones only watch', r.status_code == 403 and r.get_json()['error'] == 'off')

print('Ask me')
admin.post('/api/config', json={'config': {'team_bidding': 'confirm'}})
r = up(p1, 'Reds', 3)
check('the first bid is the base price, not a step above', r.status_code == 409 and r.get_json()['next'] == 2, str(r.get_json()))
r = up(p1, 'Reds', 2)
check('which a phone can bid', r.status_code == 200 and r.get_json()['mode'] == 'confirm')
waiting = json.loads(stage()['bid_request'])
check('it waits for the auctioneer', waiting['team_name'] == 'Reds' and waiting['amount'] == 2 and stage().get('bidder_team_id') is None)
check('the same phone cannot bid over its own waiting bid', up(p1, 'Reds', 3).get_json()['error'] == 'waiting')
r = up(p1, 'Blues', 3)
check('another team bids one step above it', r.status_code == 200 and json.loads(stage()['bid_request'])['team_name'] == 'Blues')
check('and only the highest waits', json.loads(stage()['bid_request'])['amount'] == 3)
check('the auctioneer accepts', admin.post('/api/bid/answer', json={'accept': True, 'for_player_id': str(p1)}).status_code == 200)
st = stage()
check('so Blues lead at 3', st['current_bid'] == '3.0' and st['bidder_team_name'] == 'Blues' and 'bid_request' not in st, str(st.get('current_bid')))
check('the leader cannot outbid themselves', up(p1, 'Blues', 4).get_json()['error'] == 'leading')
up(p1, 'Reds', 4)
check('a rejected bid simply goes', admin.post('/api/bid/answer', json={'accept': False, 'for_player_id': str(p1)}).status_code == 200
      and 'bid_request' not in stage() and stage()['bidder_team_name'] == 'Blues')
up(p1, 'Reds', 4)
admin.post('/api/auction/state', json={'for_player_id': str(p1), 'current_bid': 5, 'bidder_team_id': str(ids['Greens']),
                                        'bidder_team_name': 'Greens'})
check('a room bid as high as a waiting phone bid overtakes it', 'bid_request' not in stage())

print('Instant')
admin.post('/api/config', json={'config': {'team_bidding': 'auto'}})
admin.post('/api/auction/state', json={'timer': 15})
before = int(stage()['timer_ends_at'])
import time; time.sleep(0.05)
r = up(p1, 'Reds', 6)
st = stage()
check('a phone bid stands at once', r.status_code == 200 and st['current_bid'] == '6.0' and st['bidder_team_name'] == 'Reds')
check('and restarts the timer', int(st['timer_ends_at']) > before)
check('the steps follow the pricing (from 10, +2)', up(p1, 'Blues', 7).status_code == 200 and up(p1, 'Reds', 8).status_code == 200
      and up(p1, 'Blues', 9).status_code == 200 and up(p1, 'Reds', 10).status_code == 200
      and up(p1, 'Blues', 11).get_json().get('next') == 12)
check('a bid over the team\'s limit is refused', up(p1, 'Greens', 12).get_json()['error'] == 'over_limit')
check('a bid for a player no longer on the block is refused', up(p2, 'Blues', 12).get_json()['error'] == 'stale_bid')
check('a team owner bids only for their own team', phones['Blues'].post('/api/bid', json={
    'for_player_id': str(p1), 'amount': 12, 'team_id': ids['Reds']}).status_code == 200 and stage()['bidder_team_name'] == 'Blues')

results = [None, None]
def tap(i, name):
    results[i] = up(p1, name, 14).status_code
threads = [threading.Thread(target=tap, args=(0, 'Reds')), threading.Thread(target=tap, args=(1, 'Reds'))]
# Both Reds and nobody else; then Reds and Greens at the same amount.
up(p1, 'Reds', 14)
results = [None, None]
admin.post('/api/auction/state', json={'for_player_id': str(p1), 'current_bid': 14, 'bidder_team_id': str(ids['Greens']),
                                        'bidder_team_name': 'Greens'})
admin.post('/api/config', json={'config': {'team_bidding': 'auto'}})
def tap2(i, name):
    results[i] = up(p1, name, 16).status_code
threads = [threading.Thread(target=tap2, args=(0, 'Reds')), threading.Thread(target=tap2, args=(1, 'Blues'))]
for t in threads: t.start()
for t in threads: t.join()
check('two teams tapping the same amount at once: one wins', sorted(results) == [200, 409], str(results))

admin.post('/api/sell_player', json={'player_id': p1, 'team_id': int(stage()['bidder_team_id']), 'sold_price': 16})
on_block(p2, 'Bina')
winner = [n for n in ids if ids[n] == int(admin.get('/api/players').get_json()[0]['team_id'] or 0)] or ['?']
r = up(p2, winner[0], 2)
check("a team whose Gold slots are full cannot bid on another Gold player", r.status_code == 409 and r.get_json()['error'] == 'category_full',
      '%s %s' % (winner, r.get_json()))
admin.post('/api/config', json={'config': {'team_bidding': 'confirm'}})
other = [n for n in ('Reds', 'Blues') if n != winner[0]][0]
up(p2, other, 2)
admin.post('/api/auction/state', json={'current_player': '', 'current_bid': 0})
check('taking the player off the block drops a waiting bid', 'bid_request' not in stage())

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
