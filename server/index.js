import {loadConfig} from './config.js';
import {createApp} from './app.js';
import {createDemoProvider} from './demo-provider.js';
try {
  const config = loadConfig();
  // Demo does not even construct an SDK client, regardless of environment keys.
  const provider = config.mode === 'demo' ? createDemoProvider() : (await import('./openai-provider.js')).createOpenAIProvider(config);
  const server = createApp({config, provider});
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? 'The port is in use. Choose another PORT in your local environment.' : 'The server could not start. Check the local host and port configuration.');
    process.exitCode = 1;
  });
  server.listen(config.port, config.host, () => {
    const host = config.host.includes(':') ? `[${config.host}]` : config.host;
    console.log(`LoveTalks: http://${host}:${config.port} (${config.mode} mode)`);
    if (config.mode === 'live') console.log('Live mode sends the selected choices to OpenAI and may incur API charges.');
  });
  for (const signal of ['SIGTERM','SIGINT']) process.once(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => {server.closeAllConnections(); process.exit(0);}, 5000).unref();
  });
} catch (error) {
  // Configuration errors never interpolate credential values.
  console.error(error.message);
  process.exitCode = 1;
}
