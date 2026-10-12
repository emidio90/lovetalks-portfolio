import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEmptyState, renderTopics, renderElaboration, renderLoading } from '../public/assets/js/results.js';
import { createApp, validSelection, validTopic, validElaboration } from '../public/assets/js/app.js';

// Deliberately tiny DOM: attempting an HTML-insertion API fails these tests.
class FakeElement {
  constructor(document, tag) {
    this.ownerDocument = document;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.className = '';
    this.disabled = false;
    this.hidden = false;
    this.checked = false;
    this.defaultChecked = false;
    this.value = '';
    this.defaultValue = '';
    this._text = '';
    this.classList = { toggle: (name, force) => {
      const classes = new Set(this.className.split(' ').filter(Boolean));
      if (force ?? !classes.has(name)) classes.add(name); else classes.delete(name);
      this.className = [...classes].join(' ');
    } };
  }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw new Error('Unsafe HTML insertion is forbidden'); }
  insertAdjacentHTML() { throw new Error('Unsafe HTML insertion is forbidden'); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.children = [...nodes]; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(callback);
  }
  async dispatch(name, properties = {}) {
    const event = { target: this, preventDefault() {}, ...properties };
    await Promise.all((this.listeners.get(name) ?? []).map(callback => callback(event)));
  }
  focus() { this.ownerDocument.activeElement = this; }
  matches(selector) {
    if (selector.startsWith('.')) return this.className.split(' ').includes(selector.slice(1));
    const named = selector.match(/^(input)?\[name="([^"]+)"\](:checked)?$/);
    if (named) return (!named[1] || this.tagName === 'INPUT') && this.name === named[2] && (!named[3] || this.checked);
    return this.tagName.toLowerCase() === selector;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  reset() {
    for (const input of this.querySelectorAll('input')) input.checked = input.defaultChecked;
    for (const select of this.querySelectorAll('select')) select.value = select.defaultValue;
  }
}

class FakeDocument {
  constructor() { this.nodes = new Map(); this.activeElement = null; }
  createElement(tag) { return new FakeElement(this, tag); }
  getElementById(id) { return this.nodes.get(id); }
  register(id, tag = 'div') { const node = this.createElement(tag); this.nodes.set(id, node); return node; }
}

const topics = [
  { title: 'The soundtrack of a moment', opener: 'Which song always brings back a story?', why: 'Music offers an easy path to memories.' },
  { title: 'A journey worth retelling', opener: 'What small discovery made a trip memorable?', why: 'Unexpected details invite curiosity.' },
  { title: 'A surprising second favorite', opener: 'What did you learn to enjoy over time?', why: 'Changing tastes leave room for a story.' },
];
const elaboration = {
  insight: 'Leave room for an unexpected answer.',
  questions: ['What made it stand out?', 'Did someone introduce you to it?', 'Has it changed how you see things?'],
  tip: 'Share a little of your own answer and let them set the pace.',
};
const response = (data, ok = true) => ({ ok, json: async () => data });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function makeUI() {
  const document = new FakeDocument();
  const form = document.register('conversation-form', 'form');
  for (const id of ['results-content', 'results-heading', 'results-description', 'generate-label', 'request-error', 'interests-error', 'app-status', 'mode-chip', 'consent-panel', 'privacy-note']) document.register(id);
  for (const id of ['generate-button', 'cancel-request', 'retry-config', 'start-over']) document.register(id, 'button');
  const consent = document.register('live-consent', 'input');
  form.append(consent);
  for (const value of ['music', 'food', 'travel', 'books', 'film', 'nature', 'technology', 'art']) {
    const input = document.createElement('input');
    input.name = 'interests';
    input.value = value;
    input.checked = input.defaultChecked = ['music', 'travel'].includes(value);
    form.append(input);
  }
  for (const [name, value] of [['setting', 'friends'], ['tone', 'curious']]) {
    const select = document.createElement('select');
    select.name = name;
    select.value = select.defaultValue = value;
    form.append(select);
  }
  return { document, form, get: id => document.getElementById(id) };
}

test('three topic cards are semantic buttons and call back with the selected topic', async () => {
  const document = new FakeDocument();
  const container = document.createElement('section');
  let selected;
  renderTopics(container, topics, { onSelect: (topic, index) => { selected = { topic, index }; } });
  assert.equal(container.querySelectorAll('ol').length, 1);
  assert.equal(container.querySelectorAll('.topic-card').length, 3);
  const buttons = container.querySelectorAll('button');
  assert.equal(buttons.length, 3);
  assert.equal(buttons[1].type, 'button');
  assert.match(buttons[1].getAttribute('aria-label'), /Explore topic 2/);
  await buttons[1].dispatch('click');
  assert.deepEqual(selected, { topic: topics[1], index: 1 });
});

test('HTML-looking model text stays literal in titles, openers, explanations, and elaboration', () => {
  const document = new FakeDocument();
  const container = document.createElement('section');
  const hostile = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  renderTopics(container, [{ title: hostile, opener: hostile, why: hostile }, ...topics.slice(1)]);
  assert.equal(container.querySelector('.topic-title').textContent, hostile);
  assert.equal(container.querySelector('.topic-opener').textContent, hostile);
  assert.match(container.querySelector('.topic-why').textContent, /<script>/);
  assert.equal(container.querySelectorAll('img').length, 0);
  assert.equal(container.querySelectorAll('script').length, 0);
  renderElaboration(container, { insight: hostile, questions: [hostile, hostile, hostile], tip: hostile }, { title: hostile });
  assert.equal(container.querySelector('h4').textContent, hostile);
  assert.equal(container.querySelectorAll('li').length, 3);
  assert.equal(container.querySelector('.elaboration-insight').textContent, hostile);
  assert.equal(container.querySelectorAll('img').length, 0);
  assert.equal(container.querySelectorAll('script').length, 0);
});

test('empty results replace old cards with an accessible, helpful empty state', () => {
  const container = new FakeDocument().createElement('section');
  renderTopics(container, topics);
  renderTopics(container, []);
  assert.equal(container.querySelectorAll('.topic-card').length, 0);
  assert.equal(container.querySelectorAll('h4').length, 1);
  assert.match(container.textContent, /Choose your interests/);
  renderEmptyState(container, { title: 'Try again', description: 'Your choices are still here.' });
  assert.equal(container.querySelector('h4').textContent, 'Try again');
});

test('elaboration renders its insight, three questions, tip, and working return control', async () => {
  const container = new FakeDocument().createElement('section');
  let returned = false;
  const heading = renderElaboration(container, elaboration, { title: topics[0].title, onBack: () => { returned = true; } });
  assert.equal(heading.textContent, topics[0].title);
  assert.equal(heading.tabIndex, -1);
  assert.equal(container.querySelectorAll('li').length, 3);
  assert.match(container.textContent, /Leave room for an unexpected answer/);
  assert.match(container.textContent, /let them set the pace/);
  await container.querySelector('button').dispatch('click');
  assert.equal(returned, true);
});

test('disabled topic cards cannot send another selection', async () => {
  const container = new FakeDocument().createElement('section');
  let count = 0;
  renderTopics(container, topics, { disabled: true, onSelect: () => { count += 1; } });
  assert.equal(container.querySelector('button').disabled, true);
  await container.querySelector('button').dispatch('click');
  assert.equal(count, 0);
  renderLoading(container, { elaborating: true });
  assert.equal(container.querySelectorAll('.topic-card').length, 0);
  assert.match(container.textContent, /Following that thread/);
});

test('only the fixed, non-sensitive selection vocabulary is accepted', () => {
  const valid = { interests: ['music', 'travel'], setting: 'friends', tone: 'curious' };
  assert.equal(validSelection(valid), true);
  for (const interests of [[], ['music', 'music'], ['politics'], ['music', 'travel', 'books', 'film']]) assert.equal(validSelection({ ...valid, interests }), false);
  assert.equal(validSelection({ ...valid, setting: 'location' }), false);
  assert.equal(validSelection({ ...valid, tone: 'anything goes' }), false);
  assert.ok(validTopic(topics[0]));
  assert.equal(validTopic({ ...topics[0], title: '' }), false);
  assert.ok(validElaboration(elaboration));
  assert.equal(validElaboration({ ...elaboration, questions: ['Only one'] }), false);
});

test('demo performs complete topic and elaboration flows with matching request payloads', async () => {
  const ui = makeUI();
  const calls = [];
  const app = createApp(ui.document, { fetchImpl: async (path, options) => {
    calls.push({ path, options });
    if (path === '/api/config') return response({ mode: 'demo', model: null });
    if (path === '/api/topics') return response({ topics, mode: 'demo' });
    return response({ elaboration, mode: 'demo' });
  } });
  await app.ready;
  assert.equal(ui.get('generate-button').disabled, false);
  assert.match(ui.get('mode-chip').textContent, /no OpenAI API calls/);
  await ui.form.dispatch('submit');
  assert.equal(ui.get('results-content').querySelectorAll('.topic-card').length, 3);
  assert.equal(ui.get('results-content').getAttribute('aria-busy'), 'false');
  await ui.get('results-content').querySelectorAll('button')[0].dispatch('click');
  // Render callbacks intentionally do not return their asynchronous work to the DOM.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.get('results-content').querySelectorAll('.follow-up-list').length, 1);
  assert.equal(ui.get('generate-button').disabled, false);
  assert.deepEqual(JSON.parse(calls[1].options.body), { interests: ['music', 'travel'], setting: 'friends', tone: 'curious' });
  assert.deepEqual(JSON.parse(calls[2].options.body).topic, topics[0]);
  assert.equal(calls.every(({ options }) => options.credentials === 'omit'), true);
  await ui.get('results-content').querySelector('button').dispatch('click');
  assert.equal(ui.get('results-content').querySelectorAll('.topic-card').length, 3);
  app.dispose();
});

test('live mode never generates without consent and reset revokes session consent', async () => {
  const ui = makeUI();
  let topicRequests = 0;
  const app = createApp(ui.document, { fetchImpl: async path => {
    if (path === '/api/config') return response({ mode: 'live', model: 'example-model' });
    topicRequests += 1;
    return response({ topics, mode: 'live' });
  } });
  await app.ready;
  assert.equal(ui.get('consent-panel').hidden, false);
  assert.equal(ui.get('generate-button').disabled, true);
  await ui.form.dispatch('submit');
  assert.equal(topicRequests, 0);
  ui.get('live-consent').checked = true;
  await ui.form.dispatch('change', { target: ui.get('live-consent') });
  assert.equal(ui.get('generate-button').disabled, false);
  await ui.form.dispatch('submit');
  assert.equal(topicRequests, 1);
  await ui.get('start-over').dispatch('click');
  assert.equal(ui.get('live-consent').checked, false);
  assert.equal(ui.get('generate-button').disabled, true);
  assert.equal(ui.get('results-content').querySelectorAll('.topic-card').length, 0);
  app.dispose();
});

test('repeat generation is blocked and cancel restores controls even if a stale response later arrives', async () => {
  const ui = makeUI();
  const pending = deferred();
  let requests = 0;
  let signal;
  const app = createApp(ui.document, { fetchImpl: async (path, options) => {
    if (path === '/api/config') return response({ mode: 'demo', model: null });
    requests += 1;
    signal = options.signal;
    return pending.promise;
  } });
  await app.ready;
  const first = ui.form.dispatch('submit');
  await ui.form.dispatch('submit');
  assert.equal(requests, 1);
  assert.equal(ui.get('generate-button').disabled, true);
  await ui.get('cancel-request').dispatch('click');
  assert.equal(signal.aborted, true);
  assert.equal(ui.get('generate-button').disabled, false);
  assert.equal(ui.get('results-content').getAttribute('aria-busy'), 'false');
  pending.resolve(response({ topics, mode: 'demo' }));
  await first;
  assert.equal(ui.get('results-content').querySelectorAll('.topic-card').length, 0);
  assert.match(ui.get('app-status').textContent, /cancelled/);
  app.dispose();
});

test('a new selection cancels old work, and a newer response wins over an old response', async () => {
  const ui = makeUI();
  const older = deferred();
  const newer = deferred();
  let count = 0;
  const app = createApp(ui.document, { fetchImpl: async path => {
    if (path === '/api/config') return response({ mode: 'demo', model: null });
    return ++count === 1 ? older.promise : newer.promise;
  } });
  await app.ready;
  const first = ui.form.dispatch('submit');
  const tone = ui.form.querySelector('[name="tone"]');
  tone.value = 'thoughtful';
  await ui.form.dispatch('change', { target: tone });
  const second = ui.form.dispatch('submit');
  const newTopics = topics.map(topic => ({ ...topic, title: `New: ${topic.title}` }));
  newer.resolve(response({ topics: newTopics, mode: 'demo' }));
  await second;
  older.resolve(response({ topics, mode: 'demo' }));
  await first;
  assert.match(ui.get('results-content').querySelector('.topic-title').textContent, /^New:/);
  assert.equal(ui.get('generate-button').disabled, false);
  app.dispose();
});

test('HTTP errors and malformed results restore loading state and remain literal text', async () => {
  for (const apiResponse of [
    response({ error: { code: 'TEST', message: '<strong>Service unavailable</strong>' } }, false),
    response({ topics: [], mode: 'demo' }),
    response({ topics, mode: 'live' }),
  ]) {
    const ui = makeUI();
    const app = createApp(ui.document, { fetchImpl: async path => path === '/api/config' ? response({ mode: 'demo', model: null }) : apiResponse });
    await app.ready;
    await ui.form.dispatch('submit');
    assert.equal(ui.get('request-error').hidden, false);
    assert.equal(ui.get('request-error').querySelectorAll('strong').length, 0);
    assert.equal(ui.get('generate-button').disabled, false);
    assert.equal(ui.get('cancel-request').hidden, true);
    assert.equal(ui.get('results-content').getAttribute('aria-busy'), 'false');
    assert.equal(ui.get('results-content').querySelectorAll('.topic-card').length, 0);
    app.dispose();
  }
});

test('configuration failure safely blocks generation and a successful retry recovers', async () => {
  const ui = makeUI();
  let count = 0;
  const app = createApp(ui.document, { fetchImpl: async () => ++count === 1
    ? response({ error: { code: 'UNAVAILABLE', message: 'Temporarily unavailable' } }, false)
    : response({ mode: 'demo', model: null }) });
  await app.ready;
  assert.equal(ui.get('generate-button').disabled, true);
  assert.equal(ui.get('retry-config').hidden, false);
  await ui.get('retry-config').dispatch('click');
  assert.equal(ui.get('generate-button').disabled, false);
  assert.equal(ui.get('retry-config').hidden, true);
  app.dispose();
});

test('failed elaboration restores cards and a cancelled elaboration cannot overwrite them', async () => {
  const ui = makeUI();
  const pending = deferred();
  let elaborationCount = 0;
  let elaborationSignal;
  const app = createApp(ui.document, { fetchImpl: async (path, options) => {
    if (path === '/api/config') return response({ mode: 'demo', model: null });
    if (path === '/api/topics') return response({ topics, mode: 'demo' });
    elaborationSignal = options.signal;
    if (++elaborationCount === 1) return response({ error: { code: 'TEST', message: 'Please try again.' } }, false);
    return pending.promise;
  } });
  await app.ready;
  await ui.form.dispatch('submit');
  await ui.get('results-content').querySelector('button').dispatch('click');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.get('request-error').hidden, false);
  assert.equal(ui.get('generate-button').disabled, false);
  assert.equal(ui.get('results-content').querySelectorAll('.topic-card').length, 3);
  await ui.get('results-content').querySelector('button').dispatch('click');
  assert.equal(ui.get('generate-button').disabled, true);
  await ui.get('cancel-request').dispatch('click');
  assert.equal(elaborationSignal.aborted, true);
  assert.equal(ui.get('results-content').querySelectorAll('.topic-card').length, 3);
  pending.resolve(response({ elaboration, mode: 'demo' }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(ui.get('results-content').querySelectorAll('.topic-card').length, 3);
  assert.equal(ui.get('generate-button').disabled, false);
  app.dispose();
});

test('a fourth selected interest is rejected without changing the three valid choices', async () => {
  const ui = makeUI();
  const app = createApp(ui.document, { fetchImpl: async () => response({ mode: 'demo', model: null }) });
  await app.ready;
  const inputs = ui.form.querySelectorAll('input[name="interests"]');
  inputs[1].checked = true;
  await ui.form.dispatch('change', { target: inputs[1] });
  inputs[3].checked = true;
  await ui.form.dispatch('change', { target: inputs[3] });
  assert.equal(inputs[3].checked, false);
  assert.equal(ui.form.querySelectorAll('input[name="interests"]:checked').length, 3);
  assert.equal(ui.get('interests-error').hidden, false);
  assert.match(ui.get('app-status').textContent, /up to 3 interests/);
  app.dispose();
});
