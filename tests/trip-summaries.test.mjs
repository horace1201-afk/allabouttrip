import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
function source(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `source boundaries: ${start}`);
  return html.slice(a, b);
}
const fakeTrips = count => Array.from({ length: count }, (_, i) => ({
  id: `trip-${i}`, title: `여행 ${i}`, first_city: i < 40 ? '서울' : '파리',
  route: [], depart_date: null, updated_at: '2026-10-01',
}));
function setup(rows, response) {
  const calls = [], elements = new Map();
  const context = vm.createContext({
    currentUser: { id: 'owner' }, MY: [], RECENT_MY: [],
    S: { tab: 'mine', region: 'all', tabTouched: true, myCount: null },
    sb: { from(table) {
      const call = { table, filters: [], orders: [] }; calls.push(call);
      return {
        select(value) { call.select = value; return this; },
        eq(...args) { call.filters.push(['eq', ...args]); return this; },
        is(...args) { call.filters.push(['is', ...args]); return this; },
        or(value) { call.visibility = value; return this; },
        in(key, values) { call.ids = values; return this; },
        not(path) { call.dayStart = Number(path.split('->').at(-1)); return this; },
        order(...args) { call.orders.push(args); return this; },
        range(from, to) {
          call.range = [from, to];
          const selected = call.ids ? rows.filter(t => call.ids.includes(t.id) && t.days?.[call.dayStart] != null)
            .map(t => Object.fromEntries([['id', t.id], ...Array.from({ length: 16 }, (_, i) => [`city_${i}`, t.days[call.dayStart + i]?.city ?? null])]))
            : rows.map(({ days, ...summary }) => summary);
          return response ? response(call) : Promise.resolve({ data: selected.slice(from, to + 1), error: null });
        },
      };
    } },
    cityCoords: async () => ({ 서울: { country_code: 'KR', lat: 37, lng: 127 }, 파리: { country_code: 'FR', lat: 49, lng: 2 } }),
    groupOf: code => code === 'FR' ? '유럽' : '국내',
    A2_KO: { KR: '대한민국', FR: '프랑스' }, SINGLE: new Set(), REGION_OF_GROUP: { 국내: 'ea', 유럽: 'eu' },
    todayStr: () => '2026-10-21', ddayOf: () => 'D-1', depLabel: value => value, agoOf: () => '오늘 저장',
    renderAll() {}, frontRegion() {}, cityKeyOf: row => row.city,
    $: selector => { if (!elements.has(selector)) elements.set(selector, {}); return elements.get(selector); },
    esc: value => value, paintFaces() {},
    location: {}, WEB_APP_URL: 'https://plan.allabouttrip.app',
  });
  vm.runInContext([
    source('const LISTED_OR =', '/* ── 인증 ── */'),
    source('function myTripCountShown()', 'function userName('),
    source('function renderBand()', '// 기존 market/modni 선택값'),
    source('function tabItems(){', 'function regionCounts('),
    source('function openTrip(id)', 'function openMyTripsApp('),
  ].join('\n'), context);
  return { context, calls, elements, run: value => vm.runInContext(value, context) };
}

test('all 1,205 summary rows populate the globe while the recent display stays at 40', async () => {
  const { context, calls, elements, run } = setup(fakeTrips(1205));
  await run('loadTrips()');
  assert.equal(context.S.tripsLoad, 'ok');
  assert.equal(context.MY.length, 1205);
  assert.equal(context.RECENT_MY.length, 40);
  assert.equal(run('tabItems().length'), 1205);
  assert.equal(run('tabItems().filter(t => t.country === "프랑스").length'), 1165);
  assert.equal(calls.length, 8);
  for (const [index, call] of calls.entries()) {
    assert.equal(call.table, 'trips');
    const from = Math.min(index * 200, 1205);
    assert.deepEqual(call.range, [from, from + 199]);
    assert.deepEqual(call.filters, [['eq', 'user_id', 'owner'], ['is', 'deleted_at', null]]);
    for (const field of ['superseded', 'archived', 'listed', 'stay', 'block']) assert.ok(call.visibility.includes(field));
    assert.deepEqual(call.orders.map(([key, opts]) => [key, opts.ascending]), [['updated_at', false], ['id', false]]);
    assert.ok(call.select.includes('first_city:itinerary->days->0->>city'));
    assert.ok(call.select.includes('route:pref->selectedCourse->route'));
    assert.ok(!call.select.split(',').some(field => ['*', 'itinerary', 'pref'].includes(field.trim())));
  }
  for (const tab of ['mine', 'modni', 'mine']) {
    context.S.tab = tab;
    run('renderContinue()');
    assert.equal(run('myTripCountShown()'), 1205);
    assert.match(elements.get('#continue-slot').innerHTML, /저장한 여행 1205개/);
    assert.equal(elements.get('#world-count').textContent, '저장한 여행 1205개');
  }
  run('openTrip("legacy/id &한글")');
  assert.equal(context.location.href, 'https://plan.allabouttrip.app/mytrips?openTripId=legacy%2Fid%20%26%ED%95%9C%EA%B8%80');
});

test('missing first-city coordinates use a route city without mislabelling its coordinates', async () => {
  const { context, run } = setup([{ id: 'route', first_city: '미확인', route: ['파리'], region: '서울' }, { id: 'unmapped', region: '미확인' }]);
  await run('loadTrips()');
  assert.equal(context.MY[0].city, '파리');
  assert.deepEqual(Array.from(context.MY[0].at), [2, 49]);
  assert.equal(run('myTripCountShown()'), 2);
  assert.equal(run('tabItems().length'), 1);
});

test('legacy itinerary cities retain precedence over route/region beyond the first scalar block', async () => {
  const days = Array.from({ length: 22 }, (_, i) => ({ city: i === 20 ? '파리' : '미확인' }));
  const { context, calls, run } = setup([{ id: 'legacy', first_city: '미확인', route: ['서울'], region: '서울', days }]);
  await run('loadTrips()');
  assert.equal(context.MY[0].city, '파리');
  assert.equal(context.S.tripLocationsLoad, 'ok');
  assert.deepEqual([...new Set(calls.filter(c => c.ids).map(c => c.dayStart))], [1, 17]);
  for (const call of calls.filter(c => c.ids)) {
    assert.deepEqual(call.filters, [['eq', 'user_id', 'owner'], ['is', 'deleted_at', null]]);
    assert.equal(call.visibility, calls[0].visibility);
    assert.ok(call.select.includes('->>city'));
    assert.ok(!call.select.split(',').some(field => field.trim() === 'itinerary'));
  }
});

test('a server cap smaller than the requested page still loads every summary', async () => {
  const rows = fakeTrips(205);
  const { context, calls, run } = setup(rows, call => Promise.resolve({ data: rows.slice(call.range[0], call.range[0] + 75), error: null }));
  await run('loadTrips()');
  assert.equal(context.MY.length, 205);
  assert.equal(context.S.myCount, 205);
  assert.deepEqual(calls.map(c => c.range[0]), [0, 75, 150, 205]);
});

test('coordinate failure keeps summaries and counts while explicitly marking globe locations unverified', async () => {
  const { context, elements, run } = setup(fakeTrips(45));
  context.cityCoords = async () => { throw new Error('coordinates unavailable'); };
  await run('loadTrips()');
  assert.equal(context.S.tripsLoad, 'ok');
  assert.equal(context.S.tripLocationsLoad, 'error');
  assert.equal(context.MY.length, 45);
  assert.equal(context.RECENT_MY.length, 40);
  run('renderContinue()');
  assert.match(elements.get('#continue-slot').innerHTML, /저장한 여행 45개/);
  assert.equal(run('tabItems().length'), 0);
});

test('a later-page failure never publishes a partial count or globe', async () => {
  const rows = fakeTrips(205);
  const { context, run } = setup(rows, call => Promise.resolve(call.range[0] === 0
    ? { data: rows.slice(0, 200), error: null } : { data: null, error: new Error('page failed') }));
  await run('loadTrips()');
  assert.equal(context.S.tripsLoad, 'error');
  assert.equal(context.S.myCount, null);
  assert.equal(context.MY.length, 0);
});

test('a late response cannot restore signed-out data or overwrite a newer retry', async () => {
  let release;
  const { context, run } = setup([], call => call.range[0] ? Promise.resolve({ data: [], error: null }) : new Promise(resolve => { release = resolve; }));
  const pending = run('loadTrips()');
  context.currentUser = null;
  await run('loadTrips()');
  release({ data: fakeTrips(1), error: null });
  await pending;
  assert.equal(context.MY.length, 0);
  assert.equal(context.S.myCount, null);
  assert.equal(context.S.tripsLoad, 'ok');

  context.currentUser = { id: 'owner' };
  const old = run('loadTrips()'), releaseOld = release;
  const latest = run('loadTrips()');
  release({ data: fakeTrips(2), error: null });
  await latest;
  releaseOld({ data: fakeTrips(1), error: null });
  await old;
  assert.equal(context.MY.length, 2);
  assert.equal(context.S.myCount, 2);
});
