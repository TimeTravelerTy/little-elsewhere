import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createWorld, finishAction, startAction } from '../src/server/world.ts';
import type { AgentAction, WorldSnapshot } from '../src/shared/types.ts';
const world = createWorld(); world.projects[0].complete = true;
function act(action: AgentAction, index = 0) { const r = world.residents[index]; assert.ok(startAction(world, r, action)); r.position = { ...r.task!.destination }; finishAction(world, r); }
act({kind:'design',target:'hearth',reason:'A place to cook.'});
const built = world.projects.at(-1)!; world.residents[0].inventory.wood=100;world.residents[0].inventory.stone=100;
while(!built.complete) act({kind:'build',target:built.id,reason:'Build.'});
act({kind:'name_place',target:built.id,placeName:'The Copper Crumb',reason:'Name it.'});
world.minute+=1440;
act({kind:'design',target:'shelter',reason:'A place to rest.'},1);
const partial = world.projects.at(-1)!;act({kind:'build',target:partial.id,reason:'Lay the floor.'},1);
const snapshot:WorldSnapshot={state:world,serverTime:new Date().toISOString(),secondsPerSimMinute:15,mode:'routines',recentEvents:[]};
const browser=await chromium.launch({headless:true,channel:'chrome'});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/world',r=>r.fulfill({json:snapshot}));
  await page.routeWebSocket('**/live',()=>{});
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:3012');await page.locator('canvas').waitFor();
  const nav=await page.getByRole('navigation',{name:'Village views'}).getByRole('button').all();
  assert.deepEqual(await Promise.all(nav.map(b=>b.getAttribute('aria-label'))),['Map','Residents','Places','Post','History','Ops']);
  await page.getByRole('button',{name:'Places',exact:true}).click();
  await page.getByLabel('Explore a place').selectOption(`building:${built.id}`);
  await page.getByRole('heading',{name:'The Copper Crumb',exact:true}).waitFor();
  assert.equal(await page.locator('.blueprint-cell').count(),16);
  assert.match(await page.locator('.place-content').innerText(),/Cook meals.*Meet with a club/);
  await page.screenshot({path:'data/reports/construction-complete.png'});
  await page.getByLabel('Explore a place').selectOption(`project:${partial.id}`);
  assert.ok(await page.locator('.blueprint-cell.planned').count()>0);
  await page.screenshot({path:'data/reports/construction-progress.png'});
  await page.getByLabel('Explore a place').selectOption('building:home-1');
  await page.getByRole('button',{name:'Close places'}).click();
  // Selecting a place centers its entrance at the viewport center with zoom >= 1.2.
  await page.mouse.move(5,950);await page.waitForTimeout(250);
  await page.screenshot({path:'data/reports/map-labels-hidden.png'});
  await page.mouse.move(720,400);await page.waitForTimeout(250);
  await page.screenshot({path:'data/reports/map-building-hover.png'});
  await page.mouse.click(720,400);
  await page.getByLabel('Explore a place').waitFor();
  assert.equal(await page.getByLabel('Explore a place').inputValue(),'building:home-1');
  await page.setViewportSize({width:390,height:844});
  await page.getByLabel('Explore a place').selectOption(`building:${built.id}`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'data/reports/construction-mobile.png'});
  assert.deepEqual(errors,[]);
  console.log('Construction browser checks passed: navigation order, named and partial blueprints, map hover/click, mobile layout and no page errors.');
} finally { await browser.close(); }
