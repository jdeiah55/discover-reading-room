"""Public demo gateway. Single process, anonymous session isolation and bounded usage.

Temporary jobs/cache/limits reset if the free host restarts. Provider free-project
quotas remain the final limit; this service never switches providers or paid plans.
"""
import hashlib
import json
import os
import re
import secrets
import threading
import time
from pathlib import Path
from enrichment_jobs import Manager, JobError
from book_apis import Client

ORIGIN = os.getenv('DISCOVER_ALLOWED_ORIGIN', 'https://jdeiah55.github.io').rstrip('/')
STATE = Path(os.getenv('DISCOVER_STATE_DIR', '/tmp/discover-metadata'))
LOCK = threading.RLock()
SESSIONS = {}
WINDOWS = {}
DAILY_PROVIDER_REQUESTS = 0
DAY = ''

class BudgetClient(Client):
    def __init__(self, *args):
        super().__init__(*args, cache=STATE / 'cache')

    def request(self, provider, url, body=None, headers=None, cache_key=None, cache_only=False):
        # Cache hits and cache-only attempts do not reserve external-call budget.
        cached = self.cache / (hashlib.sha256(cache_key.encode()).hexdigest() + '.json') if cache_key else None
        fresh = cached and cached.exists() and time.time() - cached.stat().st_mtime < 30 * 86400
        if not cache_only and not fresh:
            global DAILY_PROVIDER_REQUESTS, DAY
            with LOCK:
                today = time.strftime('%Y-%m-%d', time.gmtime())
                if today != DAY:
                    DAY, DAILY_PROVIDER_REQUESTS = today, 0
                if DAILY_PROVIDER_REQUESTS >= int(os.getenv('DISCOVER_DAILY_PROVIDER_REQUESTS', '180')):
                    from book_apis import LookupError
                    raise LookupError('Service quota reached. Try again on another day.')
                DAILY_PROVIDER_REQUESTS += 1
        return super().request(provider, url, body, headers, cache_key, cache_only)

manager = Manager(STATE / 'jobs', client_factory=BudgetClient)

def limited(key, limit, seconds):
    now = time.time()
    with LOCK:
        if len(WINDOWS) > 4000:
            for old in list(WINDOWS):
                if WINDOWS[old][0] < now - 86400:
                    del WINDOWS[old]
        start, count = WINDOWS.get(key, (now, 0))
        if now - start >= seconds:
            start, count = now, 0
        if count >= limit:
            return False
        WINDOWS[key] = (start, count + 1)
        return True

def output(start, status, data, origin=''):
    body = json.dumps(data).encode()
    headers = [('Content-Type','application/json'),('Content-Length',str(len(body))),
               ('Cache-Control','no-store'),('X-Content-Type-Options','nosniff'),('Vary','Origin')]
    if origin == ORIGIN:
        headers += [('Access-Control-Allow-Origin', ORIGIN),
                    ('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'),
                    ('Access-Control-Allow-Headers', 'Content-Type,X-Discover-Token'),
                    ('Access-Control-Max-Age','600')]
    start(f'{status} ' + {200:'OK',204:'No Content',400:'Bad Request',403:'Forbidden',404:'Not Found',413:'Payload Too Large',429:'Too Many Requests',503:'Service Unavailable'}[status], headers)
    return [body]

def app(env, start):
    origin, path, method = env.get('HTTP_ORIGIN',''), env.get('PATH_INFO',''), env.get('REQUEST_METHOD','GET')
    respond = lambda status, data: output(start,status,data,origin)
    if path == '/health' and method == 'GET':
        return respond(200, {'ok':True})
    if origin != ORIGIN:
        return respond(403, {'error':'Open enrichment from Discover.'})
    if method == 'OPTIONS':
        return respond(204,{})
    # Render's proxy supplies this address. It is a throttle, not authentication.
    ip = env.get('HTTP_X_FORWARDED_FOR',env.get('REMOTE_ADDR','unknown')).split(',')[0].strip()
    if not limited('http:'+ip, 180, 60):
        return respond(429,{'error':'Too many requests. Wait a minute before resuming.'})
    token = env.get('HTTP_X_DISCOVER_TOKEN','')
    if path == '/api/enrichment/config' and method == 'GET':
        with LOCK:
            if token not in SESSIONS:
                if not limited('session:'+ip, 10, 3600) or len(SESSIONS) >= 2000:
                    return respond(429,{'error':'Session limit reached. Try again later.'})
                token = secrets.token_urlsafe(32)
                SESSIONS[token] = {'jobs':set(), 'created':time.time()}
        return respond(200,{**manager.config(),'csrf':token,'hosted':True,'temporaryJobs':True})
    with LOCK:
        session = SESSIONS.get(token)
    if not session:
        return respond(403,{'error':'Refresh the metadata connection, then resume your saved queue.'})
    try:
        match = re.fullmatch(r'/api/enrichment/jobs/([a-f0-9]{32})(?:/(pause|resume))?',path)
        if match:
            identifier, action = match.groups()
            if identifier not in session['jobs']:
                return respond(404,{'error':'Batch not found. Server restarted or this batch belongs to another session.'})
            if method == 'GET' and not action:
                return respond(200,manager.status(identifier))
            if method == 'POST' and action:
                return respond(200,getattr(manager,action)(identifier))
        if path == '/api/enrichment/jobs' and method == 'POST':
            if env.get('CONTENT_TYPE','') != 'application/json':
                return respond(400,{'error':'Send a JSON batch.'})
            size = int(env.get('CONTENT_LENGTH') or '0')
            if not 0 < size <= 20000:
                return respond(413,{'error':'Batch request is too large.'})
            data = json.loads(env['wsgi.input'].read(size))
            if not isinstance(data,dict) or not isinstance(data.get('books'),list) or not 1 <= len(data['books']) <= 5:
                return respond(400,{'error':'Choose one to five books.'})
            # Reserve per-session and per-IP budget before starting any worker.
            if not limited('batch:'+token,12,86400) or not limited('batch-ip:'+ip,24,86400):
                return respond(429,{'error':'Daily demonstration limit reached. Applied labels are kept.'})
            assignment = data.get('assignment')
            if assignment and any(j.get('assignment')==assignment for key,j in manager.jobs.items() if key not in session['jobs']):
                return respond(403,{'error':'Use a new queue identifier.'})
            job = manager.create(data['books'],data.get('useAI') is True,automatic=data.get('automatic') is True,
                                 cached_open_library=data.get('cachedOpenLibrary') is True,assignment=assignment)
            with LOCK:
                session['jobs'].add(job['id'])
            return respond(200,job)
        return respond(404,{'error':'Not found.'})
    except JobError as exc:
        return respond(400,{'error':str(exc)})
    except (ValueError,TypeError,KeyError):
        return respond(400,{'error':'Invalid request.'})
    except Exception:
        return respond(503,{'error':'The metadata service could not finish. Applied labels are kept.'})
