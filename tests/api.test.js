import test from 'node:test';
import {request} from 'node:http';
import assert from 'node:assert/strict';
import {startApp, preferences, topic} from './helpers.js';
import {createDemoProvider} from '../server/demo-provider.js';
import {AppError} from '../server/errors.js';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
test('demo questionnaire → topics → elaboration works without a key', async t => {
  const {base, post} = await startApp(t);
  const config = await (await fetch(base + '/api/config')).json();
  assert.deepEqual(config, {mode:'demo', model:null});
  const response = await post('/api/topics', preferences);
  assert.equal(response.status,200);
  const data = await response.json();
  assert.equal(data.topics.length,3);
  assert.equal(data.mode,'demo');
  const elaborated = await post('/api/elaborate', {...preferences,topic:data.topics[0]});
  assert.equal(elaborated.status,200);
  assert.equal((await elaborated.json()).elaboration.questions.length,3);
});
test('parallel requests retain their own preferences across awaits', async t => {
  const demo = createDemoProvider();
  const received = [];
  const provider = {...demo, async topics(value) {await pause(value.interests[0] === 'music' ? 25 : 2); received.push(value.interests[0]); return demo.topics(value);}};
  const {post} = await startApp(t,{provider});
  const [music, books] = await Promise.all([post('/api/topics',{...preferences,interests:['music']}),post('/api/topics',{...preferences,interests:['books']})]);
  assert.match((await music.json()).topics[0].title,/soundtrack/);
  assert.match((await books.json()).topics[0].title,/story/);
  assert.deepEqual(received,['books','music']);
});
test('validation rejects unknown, sensitive, duplicate and oversized input before provider', async t => {
  let calls = 0;
  const {post} = await startApp(t,{provider:{topics(){calls++;}}});
  for (const body of [null, [], {}, {...preferences,politics:'private'}, {...preferences,interests:[]}, {...preferences,interests:['music','music']}, {...preferences,interests:['music','food','art','books']}, {...preferences,interests:['a'.repeat(500)]}, {...preferences,setting:'unknown'}, {...preferences,tone:'<script>'}]) assert.equal((await post('/api/topics',body)).status,400);
  assert.equal(calls,0);
});
test('elaboration validates every nested field and rejects missing context', async t => {
  const {post} = await startApp(t);
  for (const body of [{topic}, {...preferences,topic:{...topic,title:''}}, {...preferences,topic:{...topic,extra:'x'}}, {...preferences,topic:{...topic,opener:'x'.repeat(321)}}]) assert.equal((await post('/api/elaborate',body)).status,400);
});
test('malformed JSON, wrong media type and oversized bodies have useful status codes', async t => {
  const {base, post} = await startApp(t);
  assert.equal((await fetch(base+'/api/topics',{method:'POST',headers:{'Content-Type':'application/json'},body:'{' })).status,400);
  assert.equal((await post('/api/topics',preferences,{'Content-Type':'text/plain'})).status,415);
  assert.equal((await post('/api/topics',{payload:'x'.repeat(5000)})).status,413);
});
test('provider exceptions are safe, and the next request can succeed', async t => {
  let calls = 0;
  const demo = createDemoProvider();
  const {post} = await startApp(t,{provider:{...demo, async topics(value){if (++calls === 1) throw new Error('private upstream diagnostic'); return demo.topics(value);}}});
  const response = await post('/api/topics',preferences);
  assert.equal(response.status,502);
  assert.doesNotMatch(await response.text(),/private upstream/);
  assert.equal((await post('/api/topics',preferences)).status,200);
});
test('invalid, empty or duplicate generated topics fail closed', async t => {
  for (const topics of [[],[topic,topic,topic],[{...topic,title:''},topic,topic]]) {
    const {post} = await startApp(t,{provider:{async topics(){return {topics};}}});
    assert.equal((await post('/api/topics',preferences)).status,502);
  }
});
test('elaboration failure returns JSON error instead of hanging', async t => {
  const {post} = await startApp(t,{provider:{async elaborate(){throw new AppError(422,'CONTENT_BLOCKED','Choose another topic.');}}});
  const result = await post('/api/elaborate',{...preferences,topic});
  assert.equal(result.status,422);
  assert.equal((await result.json()).error.code,'CONTENT_BLOCKED');
});
test('whole request deadline aborts provider work and frees concurrency', async t => {
  let signal;
  const {post} = await startApp(t,{config:{requestTimeoutMs:25,maxConcurrent:1},provider:{topics(_,options){signal=options.signal; return new Promise(()=>{});}}});
  const result = await post('/api/topics',preferences);
  assert.equal(result.status,504);
  assert.equal(signal.aborted,true);
  assert.equal((await post('/api/topics',preferences)).status,504);
});
test('rate limiting is bounded and returns a retry hint', async t => {
  const {post} = await startApp(t,{config:{rateLimit:1}});
  assert.equal((await post('/api/topics',preferences)).status,200);
  const response = await post('/api/topics',preferences);
  assert.equal(response.status,429);
  assert.equal(response.headers.get('retry-after'),'60');
});
test('concurrency overload is rejected without starting another generation', async t => {
  let release;
  let entered;
  const started = new Promise(resolve => {entered=resolve;});
  const provider = {async topics(value){entered(); await new Promise(resolve => {release=resolve;}); return createDemoProvider().topics(value);}};
  const {post} = await startApp(t,{provider,config:{maxConcurrent:1}});
  const pending = post('/api/topics',preferences);
  await started;
  assert.equal((await post('/api/topics',preferences)).status,503);
  release();
  assert.equal((await pending).status,200);
});
test('cross-origin and unexpected Host requests are rejected', async t => {
  const {post,base} = await startApp(t);
  assert.equal((await post('/api/topics',preferences,{Origin:'https://example.invalid'})).status,403);
  const hostStatus = await new Promise((resolve,reject) => {const req=request(base+'/api/config',{headers:{Host:'example.invalid'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});
  assert.equal(hostStatus,403);
  assert.equal((await post('/api/topics',preferences,{Origin:base})).status,200);
});
test('only intended public assets are served with defensive headers', async t => {
  const {base} = await startApp(t);
  for (const path of ['/server/app.js','/.env','/package.json','/../server/config.js','/%2e%2e/server/config.js','/missing']) assert.equal((await fetch(base+path)).status,404);
  const response = await fetch(base+'/api/health');
  assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
  assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.equal((await fetch(base+'/api/topics')).status,405);
});

// The deadline covers body reads as well as moderation and generation.
test('unfinished chunked body times out and releases the active request slot', async t => {
  const {base,post} = await startApp(t,{config:{requestTimeoutMs:30,maxConcurrent:1}});
  const status = await new Promise((resolve,reject) => {
    const req=request(base+'/api/topics',{method:'POST',headers:{'Content-Type':'application/json','Transfer-Encoding':'chunked'}},res=>{res.resume();resolve(res.statusCode);});
    req.on('error',reject);
    req.write('{');
    t.after(()=>req.destroy());
  });
  assert.equal(status,504);
  assert.equal((await post('/api/topics',preferences)).status,200);
});
