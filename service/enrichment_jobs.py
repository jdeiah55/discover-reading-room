"""Small resumable on-demand batches. Job files never contain credentials."""
import copy
import json
import re
import secrets
import threading
import time
from pathlib import Path
from book_apis import Client
from saved_credentials import load


class JobError(Exception):
    pass


class Manager:
    def __init__(self, directory, credentials=load, client_factory=Client, interval=12):
        self.directory = Path(directory)
        self.credentials = credentials
        self.client_factory = client_factory
        self.lock = threading.RLock()
        self.jobs = {}
        self.worker = None
        self.interval = interval
        self.wake = threading.Event()

    def config(self):
        try:
            config = self.credentials()
            return {'googleBooks': bool(config.get('booksKey')), 'gemini': bool(config.get('geminiKey') and config.get('model')), 'batchSize': 5}
        except Exception:
            raise JobError('Saved keys could not be opened. Run API setup again.') from None

    def _save(self, job):
        self.directory.mkdir(parents=True, exist_ok=True)
        target = self.directory / (job['id'] + '.json')
        temp = target.with_suffix('.tmp')
        temp.write_text(json.dumps(job, ensure_ascii=False), encoding='utf-8')
        temp.replace(target)

    def _get(self, identifier):
        if not isinstance(identifier, str) or not re.fullmatch(r'[a-f0-9]{32}', identifier):
            raise JobError('Batch not found.')
        if identifier not in self.jobs:
            try:
                path = self.directory / (identifier + '.json')
                if path.stat().st_size > 4_000_000:
                    raise ValueError()
                job = json.loads(path.read_text(encoding='utf-8'))
                # A restart must never silently trigger new provider calls.
                if job['state'] in ('running', 'pausing'):
                    job['state'] = 'paused'
                    for item in job['items']:
                        if item['state'] == 'running':
                            item['state'] = 'pending'
                self.jobs[identifier] = job
            except (OSError, ValueError, KeyError):
                raise JobError('Batch not found. Start a new batch.') from None
        return self.jobs[identifier]

    def status(self, identifier):
        with self.lock:
            return copy.deepcopy(self._get(identifier))

    def create(self, books, use_ai=False, automatic=False, cached_open_library=False, assignment=None):
        if assignment is not None and (not isinstance(assignment,str) or not re.fullmatch(r'[a-f0-9]{32}',assignment)):raise JobError('Invalid assignment identifier.')
        if not isinstance(books, list) or not 1 <= len(books) <= 5:
            raise JobError('Choose between one and five books.')
        items, seen = [], set()
        for book in books:
            if not isinstance(book, dict):
                raise JobError('Invalid book details.')
            title, author = book.get('title'), book.get('author')
            if not all(isinstance(v, str) and v.strip() and len(v) <= 400 for v in (title, author)):
                raise JobError('Each book needs a title and author under 400 characters.')
            identity = (title.strip().casefold(), author.strip().casefold())
            if identity in seen:
                continue
            seen.add(identity)
            items.append({'title': title.strip(), 'author': author.strip(), 'state': 'pending', 'report': None})
        with self.lock:
            if automatic and assignment:
                requested=[(i['title'],i['author']) for i in items]
                for previous in reversed(list(self.jobs.values())):
                    if previous.get('automatic') and previous.get('assignment')==assignment and [(i['title'],i['author']) for i in previous['items']]==requested:
                        return copy.deepcopy(previous)
            if self.worker and self.worker.is_alive():
                raise JobError('Another batch is still finishing. Try again shortly.')
            job = {'id': secrets.token_hex(16), 'state': 'paused', 'useAI': bool(use_ai), 'automatic':bool(automatic),'cachedOpenLibrary':bool(cached_open_library),'items': items, 'message': '', 'created': int(time.time())}
            job['assignment']=assignment or job['id']
            self.jobs[job['id']] = job
            self._save(job)
            return self.resume(job['id'])

    def pause(self, identifier):
        with self.lock:
            job = self._get(identifier)
            if job['state'] == 'running':
                job['state'] = 'pausing'
                self.wake.set()
                job['message'] = 'Finishing the current book, then pausing.'
                self._save(job)
            return copy.deepcopy(job)

    def resume(self, identifier):
        with self.lock:
            job = self._get(identifier)
            if job['state'] == 'complete':
                return copy.deepcopy(job)
            if self.worker and self.worker.is_alive():
                raise JobError('The current book is still finishing. Try again shortly.')
            try:
                config = self.credentials()
            except Exception:
                raise JobError('Saved keys could not be opened. Run API setup again.') from None
            if not config.get('booksKey'):
                raise JobError('Save your Google Books key in API setup before starting a batch.')
            if job['useAI'] and not (config.get('geminiKey') and config.get('model')):
                raise JobError('Save a Gemini key and model, or turn off AI suggestions.')
            job['state'], job['message'] = 'running', ''
            self._save(job)
            self.wake.clear()
            self.worker = threading.Thread(target=self._run, args=(job, config), daemon=True)
            self.worker.start()
            return copy.deepcopy(job)

    def _run(self, job, config):
        # Configuration is held only by this worker, not in job JSON or responses.
        try:
            client = self.client_factory(config.get('booksKey', ''), config.get('geminiKey', ''))
            for index,item in enumerate(job['items']):
                with self.lock:
                    if job['state'] == 'pausing':
                        break
                    if item['state'] == 'done':
                        continue
                if index and job['useAI']:
                    self.wake.wait(self.interval)
                with self.lock:
                    if job['state'] == 'pausing':break
                    item['state'] = 'running'
                    self._save(job)
                try:
                    report = client.lookup(item['title'], item['author'],cached_open_library=True) if job.get('cachedOpenLibrary') else client.lookup(item['title'], item['author'])
                    provider_messages=' '.join(report.get('providers',{}).values()).lower()
                    provider_blocked=any(term in provider_messages for term in ('quota reached','access denied','key not accepted'))
                    if not provider_blocked and not any(v=='responded' for v in report.get('providers',{}).values()):raise RuntimeError('Providers unavailable')
                    if job['useAI'] and not provider_blocked:
                        try:
                            report['suggestedClaims'] = client.classify(report, config['model'])
                        except Exception as exc:
                            # Known provider errors are sanitized by Client; unexpected
                            # exception strings must not expose request/key details.
                            from book_apis import LookupError
                            report['classificationStatus'] = str(exc) if isinstance(exc, LookupError) else 'Classification could not finish.'
                    messages = ' '.join(report.get('providers', {}).values()) + ' ' + report.get('classificationStatus', '')
                    blocked = any(term in messages.lower() for term in ('quota reached', 'access denied', 'key not accepted'))
                    with self.lock:
                        item['report'] = report
                        item['state'] = 'pending' if blocked else 'done'
                        if blocked:
                            job['state'] = 'paused'
                            job['message'] = 'A provider limit or access problem paused this batch. Available results are kept; no paid fallback was used.'
                        self._save(job)
                    if blocked:
                        return
                except Exception:
                    with self.lock:
                        item['state'] = 'pending'
                        job['state'], job['message'] = 'paused', 'This lookup could not finish. Saved results are kept; resume when ready.'
                        self._save(job)
                    return
            with self.lock:
                job['state'] = 'complete' if all(i['state'] == 'done' for i in job['items']) else 'paused'
                self._save(job)
        except Exception:
            with self.lock:
                job['state'],job['message']='paused','The batch stopped unexpectedly. Resume to continue from the last saved book.'
                for item in job['items']:
                    if item['state']=='running':item['state']='pending'
                try:self._save(job)
                except OSError:pass
        finally:
            config.clear()
