"""Player registration. One signed link per auction; players sign up with a
photo and land in the pool. Closed until the organiser opens it; phone and
email stay private; a photo is re-encoded, dropping where it was taken; the
same phone cannot sign up twice; robots and floods are turned away.
"""
import os, sys, io, json
os.environ['DATABASE_URL'] = ''
os.environ['SUPABASE_URL'] = ''
os.environ['SUPABASE_SERVICE_KEY'] = ''
sys.path.insert(0, r'D:\auction software')
os.chdir(r'D:\auction software')
import app as A
from PIL import Image

def check(label, cond, detail=''):
    print(('  PASS  ' if cond else '  FAIL  ') + label + (' :: ' + detail if detail else ''))
    if not cond: check.failed += 1
check.failed = 0

admin = A.app.test_client()
admin.post('/api/auth/login', json={'role': 'admin', 'password': os.environ.get('ADMIN_PASSWORD', 'admin@123')})
aid = admin.post('/api/auctions', json={'name': 'Signup Cup'}).get_json()['auction']['id']
admin.post('/api/auctions/%d/open' % aid)
admin.post('/api/auction/go_live')
path = admin.get('/api/auction/status').get_json()['registration_path']
token = path.split('/register/')[1]
anon = A.app.test_client()

def photo(fmt='JPEG', gps=False, size=(2400, 3200)):
    img = Image.new('RGB', size, (200, 150, 120))
    out = io.BytesIO()
    if gps:
        exif = Image.Exif()
        exif[0x010F] = 'PhoneMaker'                 # Make
        exif[0x8825] = {1: 'N', 2: (19.0, 4.0, 0.0)}   # GPS
        img.save(out, fmt, exif=exif)
    else:
        img.save(out, fmt)
    out.seek(0)
    return out

def signup(name='Asha Rao', phone='98765 43210', pic=True, **extra):
    data = {'name': name, 'phone': phone, 'email': 'asha@example.com', 'consent': 'yes',
            'q:Playing Role': 'All-rounder', 'q:Age': '24', 'q:City': 'Pune'}
    data.update(extra)
    if pic is True:
        data['photo'] = (photo(gps=True), 'me.jpg')
    elif pic:
        data['photo'] = pic
    return anon.post('/api/register/' + token, data=data, content_type='multipart/form-data')

info = anon.get('/api/register/' + token).get_json()
check('the link opens without a login', info['event']['event_name'] == 'Signup Cup')
check('closed until the organiser opens it', info['open'] is False and signup().status_code == 409)

admin.post('/api/config', json={'config': {'registration_open': '1', 'registration_questions': 'Batting style\nCompany'}})
info = anon.get('/api/register/' + token).get_json()
check('then open, with the organiser\'s questions after the usual ones', info['open'] is True
      and info['questions'] == ['Batting style', 'Company'] and info['fixed'] == ['Playing Role', 'Age', 'City'], str(info))
check('the page opens', anon.get(path).status_code == 200)

check('a photo is required', signup(pic=None).status_code == 400)
r = signup(**{'q:Batting style': 'Left hand'})
check('a sign-up with a photo is taken', r.status_code == 200 and r.get_json()['name'] == 'Asha Rao', r.get_data(as_text=True)[:120])
pid = r.get_json()['id']
p = next(x for x in admin.get('/api/players').get_json() if x['id'] == pid)
check('the player is in the pool, unsold', p['status'] == 'unsold' and p['name'] == 'Asha Rao')
check('with the answers', p['attributes'].get('Playing Role') == 'All-rounder' and p['attributes'].get('Batting style') == 'Left hand'
      and p['attributes'].get('Age') == '24', json.dumps(p['attributes']))
check('and phone and email for the organiser', p['attributes'].get('Phone') == '9876543210' and p['attributes'].get('Email') == 'asha@example.com')
stored = A._media_local(A.media_path(p['photo_url']))
img = Image.open(stored)
check('the photo is stored as JPEG, at most 1600 px', img.format == 'JPEG' and max(img.size) <= 1600, '%s %s' % (img.format, img.size))
check('without where it was taken', not img.getexif().get(0x8825) and not img.getexif().get(0x010F), str(dict(img.getexif())))
public = anon.get('/api/live_data').get_data(as_text=True)
check('phone and email never reach the public screens', '9876543210' not in public and 'asha@example.com' not in public)

check('the same phone cannot sign up twice', signup(name='Asha R', phone='+91 98765-43210').status_code == 409)
check('a name is needed', signup(name='  ', phone='9000000001').status_code == 400)
check('and a real phone number', signup(phone='12345').status_code == 400)
check('and agreement to be shown', signup(phone='9000000002', consent='').status_code == 400)
r = signup(phone='9000000003', pic=(io.BytesIO(b'not a picture'), 'x.jpg'))
check('a file that is not a picture is refused', r.status_code == 400, r.get_data(as_text=True)[:80])
before = len(admin.get('/api/players').get_json())
check('a robot filling the hidden field is quietly ignored', signup(phone='9000000004', website='http://spam').status_code == 200
      and len(admin.get('/api/players').get_json()) == before)

admin.post('/api/config', json={'config': {'registration_photo_optional': '1'}})
check('the organiser can make the photo optional', signup(name='Bina', phone='9000000005', pic=None).status_code == 200)

A._register_times.clear()
A.REGISTER_PER_HOUR = 2
codes = [signup(name='P%d' % i, phone='90000001%02d' % i, pic=None).status_code for i in range(3)]
check('a flood from one connection is cut off', codes == [200, 200, 429], str(codes))

check('a made-up link is refused', anon.get('/api/register/abc.def').status_code == 404)
admin.post('/api/auction/end')
check('after the auction ends, sign-ups close', anon.get('/api/register/' + token).status_code == 410)

print('\nALL CHECKS PASSED' if not check.failed else '\n%d CHECK(S) FAILED' % check.failed)
sys.exit(1 if check.failed else 0)
