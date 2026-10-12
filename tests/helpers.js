import {createApp} from '../server/app.js';
import {loadConfig} from '../server/config.js';
import {createDemoProvider} from '../server/demo-provider.js';
export const preferences = {interests:['music','food'], setting:'first-meeting', tone:'curious'};
export const topic = {title:'A music story', opener:'Which song comes to mind?', why:'An easy way to share a story.'};
export async function startApp(t, {provider = createDemoProvider(), config = {}} = {}) {
  const server = createApp({provider, config:{...loadConfig({}), rateLimit:60, ...config}});
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => {server.close(resolve); server.closeAllConnections();}));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {base, server, post: (path, value, headers={}) => fetch(base + path, {method:'POST', headers:{'Content-Type':'application/json', ...headers}, body:JSON.stringify(value)})};
}
