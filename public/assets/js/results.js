/** All response text is inserted as text, never parsed as HTML. */
function element(document, tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = String(text);
  return node;
}

export function renderEmptyState(container, options = {}) {
  const document = container.ownerDocument;
  const empty = element(document, 'div', 'empty-state');
  const mark = element(document, 'span', 'empty-mark', '♡');
  mark.setAttribute('aria-hidden', 'true');
  empty.append(
    mark,
    element(document, 'h4', '', options.title ?? 'A good story is one question away'),
    element(document, 'p', '', options.description ?? 'Choose your interests, set the mood, and we’ll offer three ways to get the conversation going.'),
    element(document, 'span', 'empty-footnote', 'NO PERFECT ANSWERS REQUIRED'),
  );
  container.replaceChildren(empty);
}

export function renderTopics(container, topics, { onSelect = () => {}, disabled = false } = {}) {
  if (!Array.isArray(topics) || topics.length === 0) {
    renderEmptyState(container);
    return;
  }
  const document = container.ownerDocument;
  const list = element(document, 'ol', 'topic-list');
  topics.forEach((topic, index) => {
    const item = element(document, 'li', 'topic-card');
    const button = element(document, 'button', 'topic-button');
    button.type = 'button';
    button.disabled = disabled;
    button.setAttribute('aria-label', `Explore topic ${index + 1}: ${topic.title}`);
    button.setAttribute('aria-describedby', `topic-opener-${index} topic-why-${index}`);
    const arrow = element(document, 'span', 'topic-arrow', '↗');
    arrow.setAttribute('aria-hidden', 'true');
    const opener = element(document, 'span', 'topic-opener', topic.opener);
    opener.setAttribute('id', `topic-opener-${index}`);
    const why = element(document, 'span', 'topic-why');
    why.setAttribute('id', `topic-why-${index}`);
    why.append(element(document, 'strong', '', 'Why it opens a door: '), element(document, 'span', '', topic.why));
    button.append(
      element(document, 'span', 'topic-kicker', `STARTER ${String(index + 1).padStart(2, '0')}`),
      element(document, 'span', 'topic-title', topic.title),
      opener,
      why,
      arrow,
    );
    button.addEventListener('click', () => { if (!button.disabled) onSelect(topic, index); });
    item.append(button);
    list.append(item);
  });
  container.replaceChildren(list);
}

export function renderElaboration(container, elaboration, { title = 'Follow your curiosity', onBack = () => {} } = {}) {
  const document = container.ownerDocument;
  const panel = element(document, 'div', 'elaboration');
  const back = element(document, 'button', 'text-button elaboration-back', '← Back to your three starters');
  back.type = 'button';
  back.addEventListener('click', onBack);
  const heading = element(document, 'h4', '', title);
  heading.tabIndex = -1;
  const questions = element(document, 'ol', 'follow-up-list');
  for (const question of elaboration.questions) questions.append(element(document, 'li', '', question));
  const tip = element(document, 'p', 'conversation-tip');
  tip.append(element(document, 'strong', '', 'A little conversation wisdom'), element(document, 'span', '', elaboration.tip));
  panel.append(
    back,
    element(document, 'p', 'elaboration-kicker', 'THERE’S MORE TO THE STORY'),
    heading,
    element(document, 'p', 'elaboration-insight', elaboration.insight),
    element(document, 'h5', 'elaboration-subtitle', 'Where you could go next'),
    questions,
    tip,
  );
  container.replaceChildren(panel);
  return heading;
}

export function renderLoading(container, { elaborating = false } = {}) {
  const document = container.ownerDocument;
  const panel = element(document, 'div', 'loading-state');
  const mark = element(document, 'span', 'loading-mark', '•••');
  mark.setAttribute('aria-hidden', 'true');
  panel.append(
    mark,
    element(document, 'p', '', elaborating ? 'Following that thread…' : 'Making room for curiosity…'),
    element(document, 'small', '', elaborating ? 'Finding a few ways to go a little deeper.' : 'Putting together three starting points for you.'),
  );
  container.replaceChildren(panel);
}
