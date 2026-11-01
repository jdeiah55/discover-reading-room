import io
import json
import unittest
from unittest.mock import patch
import app as gateway

class FakeManager:
    def config(self):return {'googleBooks':True,'gemini':True,'batchSize':5}
    jobs={}
    def create(self,books,*args,**kwargs):return {'id':'a'*32,'items':books,'state':'running'}
    def status(self,identifier):return {'id':identifier,'items':[{'title':'Book A'}]}

class GatewayTests(unittest.TestCase):
    def setUp(self):
        gateway.SESSIONS.clear();gateway.WINDOWS.clear()
        self.patcher=patch.object(gateway,'manager',FakeManager());self.patcher.start()
    def tearDown(self):self.patcher.stop()
    def call(self,path,method='GET',data=None,token='',origin=None):
        raw=json.dumps(data).encode() if data is not None else b''
        env={'PATH_INFO':path,'REQUEST_METHOD':method,'HTTP_ORIGIN':origin or gateway.ORIGIN,'HTTP_X_DISCOVER_TOKEN':token,
             'CONTENT_TYPE':'application/json','CONTENT_LENGTH':str(len(raw)),'wsgi.input':io.BytesIO(raw),'REMOTE_ADDR':'1.2.3.4'}
        result={}
        body=b''.join(gateway.app(env,lambda status,headers:result.update(status=int(status.split()[0]),headers=dict(headers))))
        return result['status'],json.loads(body),result['headers']
    def token(self):return self.call('/api/enrichment/config')[1]['csrf']
    def test_config_exposes_flags_not_keys(self):
        status,data,headers=self.call('/api/enrichment/config')
        self.assertEqual(status,200);self.assertNotIn('geminiKey',data)
        self.assertEqual(headers['Access-Control-Allow-Origin'],gateway.ORIGIN)
    def test_other_origin_rejected(self):
        status,_,headers=self.call('/api/enrichment/config',origin='https://unrelated.example')
        self.assertEqual(status,403);self.assertNotIn('Access-Control-Allow-Origin',headers)
    def test_job_cannot_be_read_from_another_session(self):
        owner=self.token();other=self.token()
        self.call('/api/enrichment/jobs','POST',{'books':[{'title':'Book A','author':'Author'}]},owner)
        self.assertEqual(self.call('/api/enrichment/jobs/'+'a'*32,token=owner)[0],200)
        self.assertEqual(self.call('/api/enrichment/jobs/'+'a'*32,token=other)[0],404)
    def test_oversized_batch_rejected(self):
        status,_,_=self.call('/api/enrichment/jobs','POST',{'books':[{}]*6},self.token())
        self.assertEqual(status,400)
    def test_daily_session_batch_cap(self):
        token=self.token()
        for _ in range(12):self.assertEqual(self.call('/api/enrichment/jobs','POST',{'books':[{}]},token)[0],200)
        self.assertEqual(self.call('/api/enrichment/jobs','POST',{'books':[{}]},token)[0],429)

if __name__=='__main__':unittest.main()
