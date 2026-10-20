import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { BrowserSpeechController, appendSpeechText, browserRecognitionFactory } from '../assets/home/browser-speech.js';

const moduleSource = fs.readFileSync(new URL('../assets/home/voice-input.js', import.meta.url), 'utf8')
  .replace(/^import .* from '\.\/browser-speech\.js';\r?\n/, '');

class Surface {
  listeners = new Map(); value = ''; textContent = ''; disabled = false; attrs = {};
  addEventListener(type, fn, options) {
    const rows = this.listeners.get(type) ?? [];
    rows.push({ fn, once: options?.once }); this.listeners.set(type, rows);
  }
  dispatchEvent(event) {
    for (const row of [...(this.listeners.get(event.type) ?? [])]) {
      row.fn(event);
      if (row.once) this.listeners.set(event.type, this.listeners.get(event.type).filter(x => x !== row));
    }
    return true;
  }
  emit(type, fields = {}) { return this.dispatchEvent({ type, preventDefault() {}, stopImmediatePropagation() {}, ...fields }); }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key]; }
  setSelectionRange() {}
}

function setup({ supported = true, stopSynchronously = false } = {}) {
  const elements = Object.fromEntries(['search-form', 'q', 'go-btn', 'q-voice', 'q-voice-status'].map(id => [id, new Surface()]));
  const window = new Surface(), sessions = [];
  let submissions = 0, disconnected = 0;
  elements.q.value = '먼저 적은 여행';
  elements['search-form'].requestSubmit = () => { submissions++; };
  class Recognizer {
    constructor() { this.active = false; this.aborts = 0; sessions.push(this); }
    start() { this.active = true; this.onstart?.(); }
    stop() { if (stopSynchronously) { this.final('마지막 문장'); this.active = false; this.onend?.(); } }
    abort() { this.active = false; this.aborts++; }
    final(text) { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] }); }
  }
  if (supported) window.SpeechRecognition = Recognizer;
  vm.runInNewContext(moduleSource, {
    BrowserSpeechController, appendSpeechText, browserRecognitionFactory, window, setTimeout, clearTimeout, Event,
    document: { getElementById: id => elements[id], documentElement: { lang: 'ko' } },
    MutationObserver: class { observe() {} disconnect() { disconnected++; } },
  });
  return { window, elements, sessions, submissions: () => submissions, disconnected: () => disconnected };
}

test('back/forward restoration can restart repeatedly with one listener, one active recognizer and retained text', () => {
  const f = setup(), button = f.elements['q-voice'];
  for (let round = 0; round < 3; round++) {
    button.emit('click');
    assert.equal(f.sessions.length, round + 1);
    const rec = f.sessions.at(-1);
    rec.final(`문장${round}`);
    const before = f.elements.q.value;
    f.window.emit('pagehide', { persisted: true });
    assert.equal(rec.aborts, 1); assert.equal(rec.onresult, null);
    f.window.emit('pageshow', { persisted: true });
    assert.equal(f.elements.q.value, before);
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(f.sessions.filter(s => s.active).length, 0);
  }
  button.emit('click');
  assert.equal(f.sessions.length, 4);
  assert.equal(f.sessions.filter(s => s.active).length, 1);
  assert.equal(button.listeners.get('click').length, 1);
  assert.equal(f.window.listeners.get('pagehide').length, 1);
  assert.equal(f.elements.q.value, '먼저 적은 여행 문장0 문장1 문장2');
  f.window.emit('pagehide', { persisted: false });
});

test('a completed stop promise from before pagehide cannot submit after restoration', async () => {
  const f = setup({ stopSynchronously: true });
  f.elements['q-voice'].emit('click');
  f.elements['search-form'].emit('submit');
  f.window.emit('pagehide', { persisted: true });
  f.window.emit('pageshow', { persisted: true });
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.submissions(), 0);
  assert.equal(f.elements.q.value, '먼저 적은 여행 마지막 문장');
  f.elements['q-voice'].emit('click');
  assert.equal(f.sessions.length, 2);
  f.window.emit('pagehide', { persisted: false });
});

test('pending recognition is cancelled on pagehide and normal page disposal stays terminal', async () => {
  const f = setup();
  f.elements['q-voice'].emit('click');
  f.elements['search-form'].emit('submit');
  f.window.emit('pagehide', { persisted: true });
  f.window.emit('pageshow', { persisted: true });
  await Promise.resolve();
  assert.equal(f.submissions(), 0);
  f.elements['q-voice'].emit('click');
  assert.equal(f.sessions.length, 2);
  f.window.emit('pagehide', { persisted: false });
  f.elements['q-voice'].emit('click');
  assert.equal(f.sessions.length, 2); assert.equal(f.disconnected(), 1);
});

test('unsupported, microphone denial and speech-service denial remain visible', () => {
  const unsupported = setup({ supported: false });
  assert.equal(unsupported.elements['q-voice'].disabled, true);
  assert.match(unsupported.elements['q-voice-status'].textContent, /지원하지 않아요/);
  for (const [error, message] of [['not-allowed', /마이크 권한/], ['service-not-allowed', /사용할 수 없어요/]]) {
    const f = setup();
    f.elements['q-voice'].emit('click');
    f.sessions[0].onerror({ error }); f.sessions[0].onend();
    assert.match(f.elements['q-voice-status'].textContent, message);
    assert.equal(f.elements.q.value, '먼저 적은 여행');
    f.window.emit('pagehide', { persisted: false });
  }
});
