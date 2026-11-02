import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const between = (a, b) => html.slice(html.indexOf(a), html.indexOf(b, html.indexOf(a) + a.length));
const line = a => between(a, '\n');
function setup() {
  const els = new Map();
  const get = id => {
    if (!els.has(id)) els.set(id, { hidden: false, innerHTML: '', textContent: '', setAttribute(k,v) { this[k]=v; }, removeAttribute(k) { delete this[k]; } });
    return els.get(id);
  };
  const courses = Array.from({length: 7}, (_, i) => ({ id: `course-${i}`, market_title: `원문 ${i}`, nights: i, is_sample: true, fixed_course: i === 0, hearts: 0, download_count: i, tags: ['원자료'] }));
  const items = courses.map((c,i) => ({id:c.id,label:c.market_title,country:'프랑스',region:i<6?'eu':'ea',n:i}));
  const ctx = vm.createContext({
    $: get, lang:'ko', S:{tab:'modni',load:'ok',tripsLoad:'ok',region:'all',expanded:false},
    REGIONS:[{id:'eu',name:'유럽',en:'Europe'},{id:'ea',name:'동아시아',en:'East Asia'}],
    CAPTION:{ko:{modni:'',mine:''},en:{modni:'',mine:''}},
    currentUser:null, MY:[], courses, items,
    tabItems:()=>items, marketCourses:()=>courses, drawPins(){}, paintFaces(){},
  });
  vm.runInContext([
    line('const esc ='), line('const ringOf ='), line('const stripPrefix ='), line('const firstCity ='), line('const titleOf ='), line('const artOf ='),
    line('const WEB_APP_URL ='), line('const courseHref ='), line('function globeTab('),
    between('const FIRST_N =','function renderGlobeState(){'),
    between('function cardArtHtml(', '/** 받침 있나'),
  ].join('\n'), ctx);
  return {ctx, get, run: source=>vm.runInContext(source,ctx)};
}

test('five actual courses, expansion and region changes retain the same course destinations',()=>{
  const {ctx,get,run}=setup();
  run('renderDiscovery()');
  assert.equal((get('#country-list').innerHTML.match(/class="course-row"/g)||[]).length,5);
  assert.equal(get('#region-more').hidden,false);
  ctx.S.expanded=true;run('renderDiscovery()');
  const expanded=get('#country-list').innerHTML;
  for(const c of ctx.courses) assert.ok(expanded.includes(`marketId=${c.id}`));
  ctx.S.expanded=false;ctx.S.region='ea';run('renderDiscovery()');
  assert.ok(get('#country-list').innerHTML.includes('marketId=course-6'));
  assert.ok(!get('#country-list').innerHTML.includes('marketId=course-0'));
  assert.equal(get('#region-more').hidden,true);
});

test('row labels preserve zero nights and counts, escape source text and use only approved art and actual tier',()=>{
  const {ctx,run}=setup();const c=ctx.courses[0];
  c.market_title='<원문 & 여행>';ctx.items[0].label=c.market_title;c.art_url='https://example.test/a_800.webp';c.art_approved=false;
  let row=run('discoveryRowHtml(items[0], "ko")');
  assert.ok(row.includes('&lt;원문 &amp; 여행&gt;'));
  assert.ok(row.includes('0박'));assert.ok(row.includes('담기 0 · 하트 0'));
  assert.ok(row.includes('정식'));assert.ok(!row.includes(c.art_url));
  c.art_approved=true;c.fixed_course=false;ctx.lang='en';row=run('discoveryRowHtml(items[0], "en")');
  assert.ok(row.includes('a_512.webp'));assert.ok(row.includes('β Beta'));assert.ok(row.includes('0 nights'));
});

test('private rows keep trip IDs and summaries; signed-out tab does not show public rows as personal trips',()=>{
  const {ctx,get,run}=setup();ctx.MY.push({id:'private/id',title:'내 여행 원문',sub:'출발일 원문',st:'계획 중'});
  const row=run('discoveryRowHtml({trip:"private/id",label:"old"}, "ko")');
  assert.ok(row.includes('data-trip="private/id"'));assert.ok(row.includes('내 여행 원문'));assert.ok(row.includes('출발일 원문'));assert.ok(!row.includes('marketId'));
  ctx.S.tab='mine';run('renderDiscovery()');
  assert.equal(get('#country-list').innerHTML,'');assert.equal(get('#my-empty').hidden,false);
});
