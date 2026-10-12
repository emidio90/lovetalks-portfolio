import { invalid, invalidOutput } from './errors.js';
export const INTERESTS = Object.freeze(['music', 'food', 'travel', 'books', 'film', 'nature', 'technology', 'art']);
const SETTINGS = ['first-meeting', 'friends', 'date-night'];
const TONES = ['playful', 'thoughtful', 'curious'];
function object(value, keys, fail = invalidOutput) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw fail();
}
function text(value, max, fail = invalidOutput) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)) throw fail();
  return value.trim();
}
export function validatePreferences(value, elaboration = false) {
  const fail = () => invalid('Choose 1–3 interests, a setting, and a conversation style.');
  object(value, elaboration ? ['interests', 'setting', 'tone', 'topic'] : ['interests', 'setting', 'tone'], fail);
  if (!Array.isArray(value.interests) || value.interests.length < 1 || value.interests.length > 3 || new Set(value.interests).size !== value.interests.length || value.interests.some(item => !INTERESTS.includes(item)) || !SETTINGS.includes(value.setting) || !TONES.includes(value.tone)) throw fail();
  return Object.freeze({interests: Object.freeze([...value.interests]), setting: value.setting, tone: value.tone});
}
export function validateTopic(value, fail = invalidOutput) {
  object(value, ['title', 'opener', 'why'], fail);
  return Object.freeze({title: text(value.title, 100, fail), opener: text(value.opener, 320, fail), why: text(value.why, 240, fail)});
}
export function validateElaborateInput(value) {
  const preferences = validatePreferences(value, true);
  const topic = validateTopic(value.topic, () => invalid('Choose a complete topic from your results.'));
  return {preferences, topic};
}
export function validateTopics(value) {
  object(value, ['topics']);
  if (!Array.isArray(value.topics) || value.topics.length !== 3) throw invalidOutput();
  const topics = value.topics.map(topic => validateTopic(topic));
  if (new Set(topics.map(topic => topic.title.toLowerCase())).size !== topics.length) throw invalidOutput();
  return {topics};
}
export function validateElaboration(value) {
  object(value, ['insight', 'questions', 'tip']);
  if (!Array.isArray(value.questions) || value.questions.length !== 3) throw invalidOutput();
  return {insight: text(value.insight, 800), questions: value.questions.map(question => text(question, 240)), tip: text(value.tip, 300)};
}
const string = {type: 'string'};
export const topicSchema = {type:'object',additionalProperties:false,required:['topics'],properties:{topics:{type:'array',minItems:3,maxItems:3,items:{type:'object',additionalProperties:false,required:['title','opener','why'],properties:{title:string,opener:string,why:string}}}}};
export const elaborationSchema = {type:'object',additionalProperties:false,required:['insight','questions','tip'],properties:{insight:string,questions:{type:'array',minItems:3,maxItems:3,items:string},tip:string}};
