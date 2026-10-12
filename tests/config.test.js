import test from 'node:test';
import assert from 'node:assert/strict';
import {loadConfig} from '../server/config.js';
import {safeError} from '../server/errors.js';
test('demo default ignores any environment API key',()=>{
  const config=loadConfig({OPENAI_API_KEY:'not-used'});
  assert.equal(config.mode,'demo'); assert.equal(config.apiKey,undefined);
  assert.equal(config.host,'127.0.0.1');
});
test('live mode requires an explicit key and loopback host',()=>{
  assert.throws(()=>loadConfig({APP_MODE:'live'}),/requires/);
  assert.throws(()=>loadConfig({APP_MODE:'live',OPENAI_API_KEY:'replace-with-your-own-key-locally'}),/requires/);
  assert.throws(()=>loadConfig({HOST:'0.0.0.0'}),/loopback/);
  assert.equal(loadConfig({APP_MODE:'live',OPENAI_API_KEY:'unit-test-placeholder'}).mode,'live');
});
test('invalid configuration fails clearly instead of quietly becoming live',()=>{
  for (const env of [{APP_MODE:'test'},{PORT:'0'},{PORT:'3e3'},{API_TIMEOUT_MS:'NaN'},{RATE_LIMIT_PER_MINUTE:'10000'},{MAX_CONCURRENT_REQUESTS:'0'},{OPENAI_MODEL:'x\ny'}]) assert.throws(()=>loadConfig(env));
});
test('timeouts and upstream rate limits map to safe errors',()=>{
  assert.equal(safeError({name:'APIConnectionTimeoutError'}).status,504);
  assert.equal(safeError({status:429}).status,503);
  assert.equal(safeError(new Error('provider detail')).status,502);
});
