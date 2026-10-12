import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../public/assets/css/styles.css', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/assets/js/app.js', import.meta.url), 'utf8');
const token = name => {
  const match = css.match(new RegExp(`--${name}:\\s*(#[a-f0-9]{6})\\s*;`, 'i'));
  assert.ok(match, `The ${name} palette token exists`);
  return match[1];
};
const luminance = hex => {
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
};
const contrast = (foreground, background) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + .05) / (darker + .05);
};

// These are source-level guardrails; they are not a substitute for browser QA.
test('coral, mint, text and error color pairs meet AA normal-text contrast', () => {
  const pairs = [
    ['primary action', '#ffffff', token('coral')],
    ['hovered primary action', '#ffffff', token('coral-hover')],
    ['body copy', token('ink'), token('card')],
    ['secondary copy', token('muted'), token('card')],
    ['secondary copy on page', token('muted'), token('paper')],
    ['green status chip', token('green'), token('mint')],
    ['green chat bubble', '#265d49', token('mint')],
    ['selected interest', '#b72348', token('coral-pale')],
    ['pink chat bubble', '#9c2947', token('coral-pale')],
    ['error message', '#a32342', token('coral-pale')],
  ];
  for (const [name, foreground, background] of pairs) {
    assert.ok(contrast(foreground, background) >= 4.5, `${name} must have a contrast ratio of at least 4.5:1`);
  }
});

test('restyled form controls retain generous minimum target heights and focus styling', () => {
  for (const selector of ['.interest-chip > span', 'select', '.button', '.text-button', '.header-link']) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rule = css.match(new RegExp(`(?:^|\\n)${escaped} \\{([^}]+)\\}`));
    assert.ok(rule, `${selector} has a base rule`);
    const height = rule[1].match(/min-height:\s*(\d+)px/);
    assert.ok(height && Number(height[1]) >= 44, `${selector} has a target height of at least 44px`);
  }
  assert.match(css, /:focus-visible\s*\{\s*outline: 3px solid/);
  assert.match(css, /input:focus-visible \+ span\s*\{\s*outline: 3px solid/);
});

test('mobile and motion-preference styling is retained without external fonts', () => {
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation: none !important; transition: none !important/);
  assert.match(css, /select \{ font-size: 16px; min-height: 48px/);
  assert.doesNotMatch(css, /@import|@font-face|https?:\/\//);
});

test('social restyle retains every application hook and clearly identifies the illustrative chat', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'HTML IDs remain unique');
  for (const [, id] of app.matchAll(/byId\('([^']+)'\)/g)) {
    assert.ok(ids.includes(id), `Application hook #${id} remains in the HTML`);
  }
  assert.match(html, /<html lang="en">/);
  assert.match(html, /class="hero-art" aria-hidden="true"/);
  assert.match(html, /Sample conversation/);
  assert.match(html, /Checking app settings…/);
  assert.match(html, /local sample responses by default and optional model-generated text/);
  assert.equal([...html.matchAll(/type="checkbox"/g)].length, 9);
  assert.equal([...html.matchAll(/<select\b/g)].length, 2);
  assert.doesNotMatch(html, /<textarea|type="(?:text|email|password)"/);
});

test('visual refresh preserves backend transport and accessible live-mode consent', () => {
  assert.match(app, /requestJSON\('\/api\/config'/);
  assert.match(app, /requestJSON\('\/api\/topics'/);
  assert.match(app, /requestJSON\('\/api\/elaborate'/);
  assert.doesNotMatch(app, /demo-transport|demo-provider/);
  assert.match(html, /class="consent-panel" id="consent-panel" hidden/);
  assert.match(html, /type="checkbox" id="live-consent"/);
  assert.match(html, /I agree to send these choices and selected topics to OpenAI for this session/);
  assert.match(css, /\.mode-chip\.is-live/);
  assert.match(css, /\.consent-label \{[^}]*min-height: 44px/);
  assert.match(css, /\.consent-label input \{/);
});
