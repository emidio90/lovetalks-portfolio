import test from 'node:test';
import assert from 'node:assert/strict';
import OpenAI from 'openai';
import {createOpenAIProvider} from '../server/openai-provider.js';
import {createDemoProvider} from '../server/demo-provider.js';
import {loadConfig} from '../server/config.js';
import {preferences,topic} from './helpers.js';
const clean = {results:[{flagged:false}]};
function responseBody(data) {return {id:'resp_test',object:'response',status:'completed',output:[{id:'msg_test',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(data),annotations:[]}]}]};}
function mockProvider(replies) {
  const requests=[];
  const client=new OpenAI({apiKey:'unit-test-placeholder',maxRetries:0,timeout:1000,fetch:async (url,options)=>{
    requests.push({url:String(url),body:JSON.parse(options.body),signal:options.signal});
    assert.ok(replies.length,'Unexpected extra HTTP request');
    const next = replies.shift();
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body ?? next),{status:typeof next.status === 'number' ? next.status : 200,headers:{'Content-Type':'application/json'}});
  }});
  return {requests,provider:createOpenAIProvider(loadConfig({APP_MODE:'live',OPENAI_API_KEY:'unit-test-placeholder'}),{client})};
}
test('real SDK sends moderation → structured Responses request → output moderation',async()=>{
  const expected = await createDemoProvider().topics(preferences);
  const {requests,provider}=mockProvider([clean,responseBody(expected),clean]);
  const result=await provider.topics(preferences);
  assert.deepEqual(result,expected);
  assert.deepEqual(requests.map(r=>new URL(r.url).pathname),['/v1/moderations','/v1/responses','/v1/moderations']);
  const payload=requests[1].body;
  assert.equal(payload.model,'gpt-4.1-mini'); assert.equal(payload.store,false);
  assert.equal(payload.max_output_tokens,1100);
  assert.equal(payload.text.format.type,'json_schema'); assert.equal(payload.text.format.strict,true);
  assert.deepEqual(JSON.parse(payload.input).preferences,preferences);
  assert.match(payload.instructions,/untrusted data/);
  assert.equal(requests[0].body.model,'omni-moderation-latest');
  assert.deepEqual(JSON.parse(requests[2].body.input),expected);
});
test('elaboration SDK payload includes explicit per-request context and schema',async()=>{
  const expected=await createDemoProvider().elaborate(preferences,topic);
  const {requests,provider}=mockProvider([clean,responseBody(expected),clean]);
  assert.deepEqual(await provider.elaborate(preferences,topic),expected);
  assert.deepEqual(JSON.parse(requests[1].body.input).topic,topic);
  assert.equal(requests[1].body.text.format.name,'topic_elaboration');
});
test('input moderation blocks generation for both actions',async()=>{
  for (const action of ['topics','elaborate']) {
    const {requests,provider}=mockProvider([{results:[{flagged:true}]}]);
    await assert.rejects(()=>action === 'topics' ? provider.topics(preferences) : provider.elaborate(preferences,topic),error=>error.code==='CONTENT_BLOCKED');
    assert.equal(requests.length,1);
  }
});
test('malformed moderation results fail closed',async()=>{
  const {provider}=mockProvider([{results:[]}]);
  await assert.rejects(()=>provider.topics(preferences),error=>error.code==='INVALID_AI_OUTPUT');
});
test('output moderation prevents flagged output from being returned',async()=>{
  const {provider}=mockProvider([clean,responseBody(await createDemoProvider().topics(preferences)),{results:[{flagged:true}]}]);
  await assert.rejects(()=>provider.topics(preferences),error=>error.code==='CONTENT_BLOCKED');
});
test('refusal, truncated, invalid JSON and structurally invalid output fail safely',async()=>{
  const outputs = [
    {...responseBody({}),status:'incomplete'},
    {status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'Cannot help'}]}]},
    {status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{',annotations:[]}]}]},
    responseBody({topics:[]}),
  ];
  for (const output of outputs) {
    const {provider}=mockProvider([clean,output]);
    await assert.rejects(()=>provider.topics(preferences),error=>['INVALID_AI_OUTPUT','CONTENT_BLOCKED'].includes(error.code));
  }
});
test('provider HTTP failure is not retried and cannot fall back to unmoderated generation',async()=>{
  const {requests,provider}=mockProvider([{status:429,body:{error:{message:'mock limit',type:'rate_limit_error'}}}]);
  await assert.rejects(()=>provider.topics(preferences),error=>error.status===429);
  assert.equal(requests.length,1);
});
test('parallel SDK requests preserve their distinct inputs after moderation awaits',async()=>{
  const inputs=[];
  const client={moderations:{async create(){await new Promise(resolve=>setTimeout(resolve,3));return clean;}},responses:{async create(payload){const value=JSON.parse(payload.input);inputs.push(value.preferences.interests[0]);return {status:'completed',output_text:JSON.stringify(await createDemoProvider().topics(value.preferences))};}}};
  const provider=createOpenAIProvider(loadConfig({}),{client});
  await Promise.all([provider.topics({...preferences,interests:['music']}),provider.topics({...preferences,interests:['books']})]);
  assert.deepEqual(inputs.sort(),['books','music']);
});
