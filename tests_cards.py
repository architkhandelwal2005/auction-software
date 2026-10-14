"""Player cards. The organiser shares one link; each sold player opens it with
no login, finds their name and downloads their card, during the auction and
after it ends. The link cannot be guessed or bent to another auction, and
carries nothing private.
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

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': os.environ.get('ADMIN_PASSWORD', 'admin@123')})
aid = admin.post('/api/auctions', json={'name': 'Cards Cup'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
reds = admin.post('/api/teams', json={'name': 'Reds', 'total_budget': 1000}).get_json()['id']
blues = admin.post('/api/teams', json={'name': 'Blues', 'total_budget': 1000}).get_json()['id']
names = ['Asha', 'Bina', 'Chitra', 'Dev', 'Esha', 'Farid']
pids = {n: admin.post('/api/players', json={'name': n, 'category': 'A', 'base_price': 2}).get_json()['id'] for n in names}
with A.app.test_request_context():
    A.g.auction_id = aid
    conn = A.get_db()
    conn.execute('UPDATE players SET attributes = ?', (json.dumps({'Role': 'Batter', 'Mobile': '9876543210'}),))
    conn.commit()
prices = {'Asha': 9, 'Bina': 4, 'Chitra': 12, 'Dev': 4, 'Esha': 3}
for n, price in prices.items():
    admin.post('/api/sell_player', json={'player_id': pids[n], 'team_id': reds if price > 4 else blues, 'sold_price': price})
admin.post('/api/auction/go_live')

path = admin.get('/api/auction/status').get_json().get('cards_path', '')
check('the console has the players\' link', path.startswith('/cards/') and len(path) > 12, path)
token = path.split('/cards/')[1]

anon = A.app.test_client()
r = anon.get('/api/cards/' + token)
listed = [p['name'] for p in r.get_json()['players']]
check('anyone with the link sees every sold player, by name', r.status_code == 200
      and listed == ['Asha', 'Bina', 'Chitra', 'Dev', 'Esha'], str(listed))
check('and the event', r.get_json()['event']['event_name'] == 'Cards Cup')
check('not the unsold', 'Farid' not in listed)
check('nothing private in the list', b'9876543210' not in r.data)
check('the page opens', anon.get(path).status_code == 200
      and anon.get('%s/%d' % (path, pids['Asha'])).status_code == 200)

card = anon.get('/api/cards/%s/%d' % (token, pids['Asha'])).get_json()
check('a card names the team and price', card['player']['team_name'] == 'Reds' and card['player']['sold_price'] == 9)
check('and the base price', card['player']['base_price'] == 2)
check('and nothing private', 'Mobile' not in card['player']['attributes'] and card['player']['attributes'].get('Role') == 'Batter')
ranks = {n: anon.get('/api/cards/%s/%d' % (token, pids[n])).get_json()['rank'] for n in prices}
check('the price ranks: top buy first, a shared price shares a rank',
      ranks == {'Chitra': 1, 'Asha': 2, 'Bina': 3, 'Dev': 3, 'Esha': 5}, str(ranks))
ties = {n: anon.get('/api/cards/%s/%d' % (token, pids[n])).get_json()['tied'] for n in ('Bina', 'Chitra')}
check('and says how many share a price (the card shows a rank only when few do)', ties == {'Bina': 2, 'Chitra': 1}, str(ties))
check('an unsold player has no card', anon.get('/api/cards/%s/%d' % (token, pids['Farid'])).status_code == 404)

admin.post('/api/auction/end')
check('after End Auction, the link still works with no login',
      anon.get('/api/cards/' + token).status_code == 200
      and anon.get('/api/cards/%s/%d' % (token, pids['Chitra'])).status_code == 200)
check('the auction\'s live screens do not (nothing is live)', anon.get('/api/live_data').status_code == 409)

check('a made-up link is refused', anon.get('/api/cards/abc.def').status_code == 404)
forged = token.split('.')[0][:-1] + 'Z.' + token.split('.')[1]
check('so is one altered to name another auction', anon.get('/api/cards/' + forged).status_code == 404)
other = admin.post('/api/auctions', json={'name': 'Other'}).get_json()['auction']['id']
with A.app.test_request_context():
    other_path = A.cards_path(other)
check("one auction's link shows only its own players", anon.get('/api/cards/' + other_path.split('/cards/')[1]).get_json()['players'] == [])

with A.app.test_request_context():
    reg = A.get_registry_db()
    reg.execute("UPDATE auctions SET status = 'purged' WHERE id = ?", (aid,))
    reg.commit()
r = anon.get('/api/cards/' + token)
check('once the data is cleared, the link says so', r.status_code == 410 and 'cleared' in r.get_json()['message'],
      str(r.status_code))

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
