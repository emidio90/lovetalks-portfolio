import {test,expect} from '@playwright/test';
import {createDemoProvider} from '../../server/demo-provider.js';
const preferences={interests:['music','travel'],setting:'friends',tone:'curious'};
const topics=(await createDemoProvider().topics(preferences)).topics;
async function ready(page){await page.goto('/');await expect(page.locator('#mode-chip')).toHaveText('Sample responses · no OpenAI API calls');}
test('demo flow, elaboration, back and reset work without external requests',async({page})=>{
  const unexpected=[];page.on('request',request=>{if(!new URL(request.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/))unexpected.push(request.url());});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await ready(page);
  await page.locator('#generate-button').click();
  await expect(page.locator('.topic-button')).toHaveCount(3);
  await page.locator('.topic-button').first().click();
  await expect(page.locator('.follow-up-list li')).toHaveCount(3);
  await page.getByRole('button',{name:'Back to your three starters'}).click();
  await expect(page.locator('.topic-button')).toHaveCount(3);
  await page.locator('#start-over').click();
  await expect(page.locator('.empty-state')).toBeVisible();
  await expect(page.locator('.topic-button')).toHaveCount(0);
  expect(unexpected).toEqual([]);expect(errors).toEqual([]);
  expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length,cookies:document.cookie}))).toEqual({local:0,session:0,cookies:''});
});
test('layout fits screen and essential controls have keyboard focus',async({page})=>{
  await ready(page);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Skip to conversation builder'})).toBeFocused();
  await page.locator('#generate-button').focus();await page.keyboard.press('Enter');
  await expect(page.locator('.topic-button')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('invalid number of interests is recoverable without a request',async({page})=>{
  await ready(page);let count=0;page.on('request',r=>{if(r.url().endsWith('/api/topics'))count++;});
  for(const checkbox of await page.locator('input[name=interests]:checked').all())await checkbox.uncheck();
  await page.locator('#generate-button').click();
  await expect(page.locator('#interests-error')).toBeVisible();expect(count).toBe(0);
  await page.locator('input[value=books]').check();await page.locator('#generate-button').click();
  await expect(page.locator('.topic-button')).toHaveCount(3);
});
test('server failure restores controls and retry succeeds',async({page})=>{
  await ready(page);
  await page.route('**/api/topics',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'PROVIDER_BUSY',message:'Please try again later.'}})}));
  await page.locator('#generate-button').click();
  await expect(page.locator('#request-error')).toHaveText('Please try again later.');
  await expect(page.locator('#generate-button')).toBeEnabled();
  await expect(page.locator('#cancel-request')).toBeHidden();
  await page.unroute('**/api/topics');
  await page.locator('#generate-button').click();await expect(page.locator('.topic-button')).toHaveCount(3);
});
test('cancel and changing choices discard late results',async({page})=>{
  await ready(page);
  let release;let seen;
  const called=new Promise(resolve=>{seen=resolve;});
  await page.route('**/api/topics',async route=>{seen();await new Promise(resolve=>{release=resolve;});await route.fulfill({contentType:'application/json',body:JSON.stringify({topics,mode:'demo'})}).catch(()=>{});});
  await page.locator('#generate-button').click();await called;
  await expect(page.locator('#generate-button')).toBeDisabled();
  await page.locator('#cancel-request').click();
  release();
  await expect(page.locator('#generate-button')).toBeEnabled();
  await expect(page.locator('.topic-button')).toHaveCount(0);
  await page.unroute('**/api/topics');
  await page.locator('#generate-button').click();await expect(page.locator('.topic-button')).toHaveCount(3);
  await page.locator('#tone').selectOption('playful');
  await expect(page.locator('.topic-button')).toHaveCount(0);
});
test('elaboration error restores topics and permits retry',async({page})=>{
  await ready(page);await page.locator('#generate-button').click();await expect(page.locator('.topic-button')).toHaveCount(3);
  await page.route('**/api/elaborate',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:{message:'Could not load that topic.'}})}));
  await page.locator('.topic-button').first().click();await expect(page.locator('#request-error')).toHaveText('Could not load that topic.');
  await expect(page.locator('.topic-button')).toHaveCount(3);await expect(page.locator('#generate-button')).toBeEnabled();
  await page.unroute('**/api/elaborate');await page.locator('.topic-button').first().click();await expect(page.locator('.follow-up-list li')).toHaveCount(3);
});
test('HTML-looking model text is displayed literally and never executed',async({page})=>{
  await ready(page);
  const injected='<img src=x onerror="window.injected=true">';
  await page.route('**/api/topics',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({topics:[{...topics[0],title:injected},topics[1],topics[2]],mode:'demo'})}));
  await page.locator('#generate-button').click();await expect(page.locator('.topic-title').first()).toHaveText(injected);
  await expect(page.locator('#results-content img')).toHaveCount(0);
  expect(await page.evaluate(()=>window.injected)).toBeUndefined();
});
test('live-mode disclosure requires opt-in and revoking clears results',async({page})=>{
  await page.route('**/api/config',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({mode:'live',model:'gpt-4.1-mini'})}));
  await page.route('**/api/topics',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({topics,mode:'live'})}));
  await page.goto('/');await expect(page.locator('#consent-panel')).toBeVisible();await expect(page.locator('#generate-button')).toBeDisabled();
  await page.locator('#live-consent').check();await page.locator('#generate-button').click();await expect(page.locator('.topic-button')).toHaveCount(3);
  await page.locator('#live-consent').uncheck();await expect(page.locator('#generate-button')).toBeDisabled();await expect(page.locator('.topic-button')).toHaveCount(0);
});
