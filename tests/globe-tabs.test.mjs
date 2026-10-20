import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const coreSource = fs.readFileSync(new URL('../assets/home/globe-core.js', import.meta.url), 'utf8');
function slice(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `source boundaries: ${start}`);
  return html.slice(a, b);
}
function line(start) {
  return slice(start, '\n').trim();
}
const tabMarkup = slice('<div class="tabs"', '</div>');
const tabButtons = [...tabMarkup.matchAll(/<button\b[^>]*data-tab="([^"]+)"[^>]*>([^<]+)<\/button>/g)]
  .map(([, tab, label]) => ({ dataset: { tab }, label, selected: null, setAttribute(key, value) { this[key] = value; } }));
const handler = line('  if (el.dataset.tab || el.dataset.tabGo)');
function setup() {
  const context = vm.createContext({
    S: { tab: 'modni', load: 'ok', tripsLoad: 'ok', region: 'eu', city: null },
    currentUser: { id: 'me' }, MY: [
      { id: 'private', title: '내 아테네', st: '계획 중', a2: 'GR', country: '그리스', city: '아테네', at: [23, 38], g: '유럽' },
      { id: 'unknown-city', title: '위치 미확인', st: '계획 중' },
    ],
    courses: [
      { id: 'sample', market_title: '모드니 아테네', is_sample: true },
      { id: 'traveler', market_title: '여행자 파리', is_sample: false, publisher_id: 'other' },
      { id: 'own-unverified', market_title: '내 공개 계획', is_sample: false, publisher_id: 'me' },
      { id: 'own-verified', market_title: '내 다녀온 코스', publisher_id: 'me', proof: { verified: true } },
      { id: 'unknown-place', market_title: '좌표 미확인', is_sample: true },
    ],
    coursePlace: Object.fromEntries(['sample', 'traveler', 'own-unverified', 'own-verified'].map(id =>
      [id, { a2: 'GR', g: '유럽', city: '아테네', at: [23, 38] }])),
    A2_KO: { GR: '그리스' }, REGION_OF_GROUP: { 유럽: 'eu' },
    cityKeyOf: t => t.city, cityProj: null,
    $$: () => tabButtons,
    renderDiscovery() {}, draw() {},
    window: { innerWidth: 610 }, GW: 610, GH: 610, lang: 'ko',
    sharedWorld: { land: null, countries: { type: 'FeatureCollection', features: [] } },
    currentScene: null, sceneKey: '', sceneMy: null, sceneCourses: null, sceneUser: null, sceneWorld: null,
  });
  vm.runInContext(coreSource, context);
  context.cityKeyOf = context.AatGlobe.cityKeyOf;
  Object.assign(context.S, { rot: [-18, -17, 0], zoom: 1 });
  vm.runInContext([
    line('const ringOf ='), line('const marketCourses ='),
    line('const stripPrefix ='), line('const firstCity ='), line('const titleOf ='),
    line('const WEB_APP_URL ='), line('const courseHref ='),
    line('function globeTab('), line('function renderTabs('),
    slice('function tabItems(){', 'function regionCounts('),
    slice('function homeGlobeState(){', 'function draw(){'),
    `function selectTab(el){\n${handler}\n}`,
  ].join('\n'), context);
  return { context, run: source => vm.runInContext(source, context) };
}
const ids = value => Array.from(value, row => row.id || row.trip);

test('the homepage exposes exactly My trips and Everyone’s trips, including English', () => {
  assert.deepEqual(tabButtons.map(b => [b.dataset.tab, b.label]), [['mine', '내 여행'], ['modni', '모두의 여행']]);
  assert.ok(html.includes('"#tab-modni",\n"Everyone\'s trips"') || html.includes('"#tab-modni",\r\n"Everyone\'s trips"'));
  const { run } = setup();
  run('renderTabs()');
  assert.deepEqual(tabButtons.map(b => b['aria-selected']), ['false', 'true']);
});

test('public tabs include both public types while retaining existing author and location guards', () => {
  const { context, run } = setup();
  for (const value of ['modni', 'market', 'all']) {
    context.S.tab = value;
    assert.deepEqual(ids(run('tabItems()')), ['sample', 'traveler', 'own-verified']);
  }
  context.S.load = 'loading';
  assert.deepEqual(ids(run('tabItems()')), []);
  context.S.load = 'error';
  assert.deepEqual(ids(run('tabItems()')), []);
  context.S.load = 'ok'; context.currentUser = null;
  assert.deepEqual(ids(run('tabItems()')), ['sample', 'traveler', 'own-unverified', 'own-verified']);
});

test('private trips stay separate and require loaded authenticated data', () => {
  const { context, run } = setup();
  context.S.tab = 'mine';
  assert.deepEqual(ids(run('tabItems()')), ['private']);
  context.S.city = { key: '파리' };
  assert.deepEqual(ids(run('tabItems()')), []);
  context.S.city = null; context.S.tripsLoad = 'loading';
  assert.deepEqual(ids(run('tabItems()')), []);
  context.S.tripsLoad = 'ok'; context.currentUser = null;
  assert.deepEqual(ids(run('tabItems()')), []);
});

test('legacy tab and tab-go selections choose the public tab and preserve region and detail URLs', () => {
  const { context, run } = setup();
  for (const key of ['tab', 'tabGo']) {
    for (const value of ['market', 'modni', 'mine']) {
      context.el = { dataset: { [key]: value } };
      context.S.city = { key: '아테네' }; context.cityProj = {}; context.S.expanded = true;
      run('selectTab(el)');
      assert.equal(context.S.tab, value === 'mine' ? 'mine' : 'modni');
      assert.equal(context.S.region, 'eu');
      assert.equal(context.S.city, null); assert.equal(context.cityProj, null);
      assert.equal(context.S.expanded, false); assert.equal(context.S.tabTouched, true);
      assert.deepEqual(tabButtons.map(b => b['aria-selected']), value === 'mine' ? ['true', 'false'] : ['false', 'true']);
    }
  }
  assert.equal(run('courseHref("legacy/id &한글")'), 'https://plan.allabouttrip.app/course-detail?marketId=legacy%2Fid%20%26%ED%95%9C%EA%B8%80');
});

test('homepage bridge actually uses the shared scene and country-to-city/back transitions', () => {
  const { context, run } = setup();
  assert.deepEqual(ids(run('homeScene().items')), ['sample', 'traveler', 'own-verified']);
  context.S.tab = 'mine';
  const country = run('homeScene().pins.find(pin => pin.kind === "country")');
  assert.ok(country);
  context.action = country.action;
  run('applyGlobeEvent(action)');
  assert.equal(run('homeScene().mode'), 'city');
  assert.equal(run('homeScene().pins.filter(pin => pin.kind === "tree").length'), 3);
  assert.deepEqual(ids(run('homeScene().items')), ['private']);
  run('applyGlobeEvent({type:"back"})');
  assert.equal(run('homeScene().mode'), 'world');
  context.currentUser = null;
  assert.equal(run('homeScene().items.length'), 0);
});

test('every inline homepage script parses after the shared-module connection', () => {
  for (const [, attributes, source] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (attributes.includes('src=') || attributes.includes('application/ld+json') || attributes.includes('type="module"')) continue;
    new vm.Script(source);
  }
  assert.ok(html.indexOf('src="assets/home/globe-core.js"') < html.indexOf('const REGIONS = AatGlobe.GLOBE_REGIONS'));
});
