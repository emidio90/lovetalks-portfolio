import { renderEmptyState, renderTopics, renderElaboration, renderLoading } from './results.js';

const INTERESTS = new Set(['music', 'food', 'travel', 'books', 'film', 'nature', 'technology', 'art']);
const SETTINGS = new Set(['first-meeting', 'friends', 'date-night']);
const TONES = new Set(['playful', 'thoughtful', 'curious']);
const REQUEST_TIMEOUT_MS = 30_000;

export function readSelection(form) {
  return {
    interests: [...form.querySelectorAll('input[name="interests"]:checked')].map(input => input.value),
    setting: form.querySelector('[name="setting"]').value,
    tone: form.querySelector('[name="tone"]').value,
  };
}

export function validSelection(selection) {
  return Array.isArray(selection?.interests)
    && selection.interests.length >= 1 && selection.interests.length <= 3
    && new Set(selection.interests).size === selection.interests.length
    && selection.interests.every(value => INTERESTS.has(value))
    && SETTINGS.has(selection.setting) && TONES.has(selection.tone);
}

const validText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 4000;
export const validTopic = topic => topic && ['title', 'opener', 'why'].every(key => validText(topic[key]));
export const validElaboration = value => value && validText(value.insight) && validText(value.tip)
  && Array.isArray(value.questions) && value.questions.length === 3 && value.questions.every(validText);

/** Separate DOM wiring from module loading so safe rendering is testable without a browser. */
export function createApp(document, { fetchImpl = globalThis.fetch.bind(globalThis) } = {}) {
  const byId = id => document.getElementById(id);
  const form = byId('conversation-form');
  const content = byId('results-content');
  const heading = byId('results-heading');
  const description = byId('results-description');
  const generate = byId('generate-button');
  const generateLabel = byId('generate-label');
  const cancel = byId('cancel-request');
  const consent = byId('live-consent');
  const error = byId('request-error');
  const interestError = byId('interests-error');
  const retry = byId('retry-config');
  const status = byId('app-status');
  let config = null;
  let configLoading = false;
  let configController = null;
  let configVersion = 0;
  let requestController = null;
  let requestVersion = 0;
  let busy = null;
  let topics = [];
  let submittedSelection = null;
  let selectedIndex = null;

  function announce(message) { status.textContent = message; }
  function clearError() { error.textContent = ''; error.hidden = true; }
  function showError(message) { error.textContent = message; error.hidden = false; }
  function canSend() { return config !== null && !configLoading && (config.mode === 'demo' || consent.checked); }
  function updateControls() {
    generate.disabled = !canSend() || busy !== null;
    generateLabel.textContent = busy === 'topics' ? 'Finding your starters…' : 'Find conversation starters';
    cancel.hidden = busy === null;
    content.setAttribute('aria-busy', String(busy !== null));
    retry.disabled = configLoading;
  }
  function abortRequest() {
    requestVersion += 1;
    requestController?.abort();
    requestController = null;
    busy = null;
    updateControls();
  }
  function showTopics({ focusIndex = null } = {}) {
    heading.textContent = 'Your next good conversation';
    description.textContent = 'Choose a starter to find three follow-up questions and a small tip.';
    renderTopics(content, topics, { onSelect: elaborate });
    if (focusIndex !== null) content.querySelectorAll('.topic-button')[focusIndex]?.focus();
  }
  function clearResults(options) {
    topics = [];
    submittedSelection = null;
    selectedIndex = null;
    heading.textContent = 'Your next good conversation';
    description.textContent = 'Three starting points, with room to make them your own.';
    renderEmptyState(content, options);
  }

  async function requestJSON(path, { controller, body } = {}) {
    const timeout = setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
      });
      let data;
      try { data = await response.json(); }
      catch { throw new Error('The service returned an unreadable response. Please try again.'); }
      if (!response.ok) {
        const message = data?.error?.message;
        throw new Error(typeof message === 'string' && message.length <= 500 ? message : 'We couldn’t complete that request. Please try again.');
      }
      return data;
    } catch (failure) {
      if (controller.signal.reason === 'timeout') throw new Error('That request took too long. Please try again.');
      if (controller.signal.aborted) throw failure;
      if (failure instanceof TypeError) throw new Error('We couldn’t reach the service. Check that the local server is running, then try again.');
      throw failure;
    } finally { clearTimeout(timeout); }
  }

  async function loadConfig() {
    const version = ++configVersion;
    configController?.abort();
    configController = new AbortController();
    const controller = configController;
    configLoading = true;
    config = null;
    clearError();
    updateControls();
    try {
      const data = await requestJSON('/api/config', { controller });
      if (version !== configVersion) return;
      if (!data || !['demo', 'live'].includes(data.mode) || !(data.model === null || typeof data.model === 'string')) {
        throw new Error('The service settings are unavailable. Please try loading them again.');
      }
      config = { mode: data.mode, model: data.model };
      const live = config.mode === 'live';
      const modeChip = byId('mode-chip');
      modeChip.textContent = live ? 'Live mode · OpenAI' : 'Sample responses · no OpenAI API calls';
      modeChip.classList.toggle('is-live', live);
      byId('consent-panel').hidden = !live;
      byId('privacy-note').textContent = live
        ? 'Fixed choices only. Live generation requires your opt-in above.'
        : 'Local sample responses. No choices are sent to OpenAI.';
      if (live && config.model) modeChip.setAttribute('title', `Selected model: ${config.model}`);
      else modeChip.removeAttribute('title');
      retry.hidden = true;
      announce(live ? 'Live mode. Review the OpenAI disclosure and opt in before generating.' : 'Sample mode is ready. No OpenAI API calls are made.');
    } catch (failure) {
      if (version !== configVersion) return;
      byId('mode-chip').textContent = 'Settings unavailable';
      retry.hidden = false;
      showError(failure.message || 'We couldn’t load the service settings. Please try again.');
    } finally {
      if (version === configVersion) { configLoading = false; updateControls(); }
    }
  }

  function validateResponseMode(data) {
    if (data?.mode !== config?.mode) throw new Error('The service mode changed. Reload this page to review the current settings before continuing.');
  }

  async function generateTopics(event) {
    event?.preventDefault();
    if (busy !== null || !canSend()) return;
    clearError();
    const selection = readSelection(form);
    if (!validSelection(selection)) {
      interestError.textContent = 'Choose between 1 and 3 different interests to continue.';
      interestError.hidden = false;
      announce(interestError.textContent);
      form.querySelector('input[name="interests"]')?.focus();
      return;
    }
    interestError.hidden = true;
    abortRequest();
    clearResults();
    const version = requestVersion;
    const controller = new AbortController();
    requestController = controller;
    busy = 'topics';
    updateControls();
    renderLoading(content);
    announce('Finding three conversation starters.');
    try {
      const data = await requestJSON('/api/topics', { controller, body: selection });
      if (version !== requestVersion) return;
      validateResponseMode(data);
      if (!Array.isArray(data.topics) || data.topics.length !== 3 || !data.topics.every(validTopic)) {
        throw new Error('We didn’t receive three complete starters. Please try again.');
      }
      topics = data.topics.map(({ title, opener, why }) => ({ title, opener, why }));
      submittedSelection = selection;
      showTopics();
      heading.focus();
      announce('Three conversation starters are ready. Choose a topic to explore it.');
    } catch (failure) {
      if (version !== requestVersion) return;
      clearResults({ title: 'Let’s give that another try', description: 'Your choices are still here. Try again when you’re ready.' });
      showError(failure.message || 'Something interrupted that request. Please try again.');
    } finally {
      if (version === requestVersion) { busy = null; requestController = null; updateControls(); }
    }
  }

  async function elaborate(topic, index) {
    if (busy !== null || !canSend() || !submittedSelection || topics[index] !== topic) return;
    clearError();
    abortRequest();
    const version = requestVersion;
    const controller = new AbortController();
    requestController = controller;
    selectedIndex = index;
    busy = 'elaboration';
    updateControls();
    renderLoading(content, { elaborating: true });
    heading.focus();
    announce(`Exploring ${topic.title}.`);
    try {
      const data = await requestJSON('/api/elaborate', { controller, body: { ...submittedSelection, topic } });
      if (version !== requestVersion) return;
      validateResponseMode(data);
      if (!validElaboration(data.elaboration)) throw new Error('We didn’t receive a complete follow-up. Please try opening the topic again.');
      heading.textContent = 'A little deeper';
      description.textContent = 'Keep what feels natural. Let the conversation find its own pace.';
      const title = renderElaboration(content, data.elaboration, { title: topic.title, onBack: () => {
        clearError();
        showTopics({ focusIndex: index });
        announce('Back to your three conversation starters.');
      } });
      title.focus();
      announce('Three follow-up questions and a conversation tip are ready.');
    } catch (failure) {
      if (version !== requestVersion) return;
      showTopics({ focusIndex: index });
      showError(failure.message || 'Something interrupted that request. Please try opening the topic again.');
    } finally {
      if (version === requestVersion) { busy = null; requestController = null; updateControls(); }
    }
  }

  form.addEventListener('submit', generateTopics);
  form.addEventListener('change', event => {
    if (event.target === consent) {
      if (!consent.checked) {
        abortRequest();
        clearResults();
        clearError();
        announce('Live generation is paused. Opt in before sending any further choices.');
      }
      updateControls();
      return;
    }
    const selection = readSelection(form);
    if (selection.interests.length > 3 && event.target.name === 'interests') {
      event.target.checked = false;
      interestError.textContent = 'Choose up to 3 interests. Uncheck one to try something else.';
      interestError.hidden = false;
      announce(interestError.textContent);
      return;
    }
    interestError.hidden = true;
    abortRequest();
    clearError();
    clearResults({ title: 'A fresh starting point', description: 'Your choices have changed. Find new starters whenever you’re ready.' });
    announce('Choices updated. Generate new conversation starters when you’re ready.');
  });

  cancel.addEventListener('click', () => {
    const wasElaborating = busy === 'elaboration';
    abortRequest();
    clearError();
    if (wasElaborating && topics.length) showTopics({ focusIndex: selectedIndex });
    else {
      clearResults({ title: 'No rush. Start when you’re ready.', description: 'The request was cancelled. Your choices are still here.' });
      generate.focus();
    }
    announce('Request cancelled.');
  });
  byId('start-over').addEventListener('click', () => {
    abortRequest();
    form.reset();
    consent.checked = false;
    clearError();
    interestError.hidden = true;
    clearResults();
    updateControls();
    form.querySelector('input[name="interests"]')?.focus();
    announce('Started over with the fictional sample choices.');
  });
  retry.addEventListener('click', loadConfig);

  const ready = loadConfig();
  return {
    ready,
    dispose() {
      abortRequest();
      configVersion += 1;
      configController?.abort();
    },
  };
}

if (typeof document !== 'undefined' && document.getElementById('conversation-form')) createApp(document);
