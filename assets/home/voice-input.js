import { BrowserSpeechController, appendSpeechText, browserRecognitionFactory } from './browser-speech.js';

const form = document.getElementById('search-form');
const input = document.getElementById('q');
const submit = document.getElementById('go-btn');
const button = document.getElementById('q-voice');
const status = document.getElementById('q-voice-status');

if (form && input && submit && button && status) {
  const factory = browserRecognitionFactory(window);
  const supported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  let snapshot = { phase: supported ? 'idle' : 'unsupported' };
  let interim = '';
  let sendPending = false;
  let sendTimer = null;
  let disposed = false;
  let sendGeneration = 0;

  const english = () => document.documentElement.lang.toLowerCase().startsWith('en');
  const copy = {
    idle: ['음성으로 입력', 'Voice input'],
    stop: ['음성 입력 멈추기', 'Stop voice input'],
    starting: ['마이크 연결 중…', 'Connecting to microphone…'],
    listening: ['말씀해 주세요', 'Speak now'],
    stopping: ['음성 입력 마무리 중…', 'Finishing voice input…'],
    unsupported: ['이 브라우저는 음성 입력을 지원하지 않아요.', 'Voice input is not supported in this browser.'],
    'not-allowed': ['마이크 권한을 허용해 주세요.', 'Allow microphone access to use voice input.'],
    'service-not-allowed': ['이 브라우저에서 음성 입력을 사용할 수 없어요.', 'Voice input is unavailable in this browser.'],
    'no-speech': ['음성이 들리지 않았어요. 다시 눌러 말해 주세요.', 'No speech detected. Press the microphone and try again.'],
    network: ['음성 인식 연결에 실패했어요. 다시 시도해 주세요.', 'Speech recognition failed. Please try again.'],
    'audio-capture': ['사용할 수 있는 마이크가 없어요.', 'No microphone is available.'],
    error: ['음성 입력에 실패했어요. 다시 시도해 주세요.', 'Voice input failed. Please try again.'],
  };
  const say = key => (copy[key] || copy.error)[english() ? 1 : 0];
  const busy = () => ['starting', 'listening', 'stopping'].includes(snapshot.phase);
  const render = () => {
    const active = snapshot.phase === 'starting' || snapshot.phase === 'listening' || snapshot.phase === 'stopping';
    button.disabled = !supported;
    button.setAttribute('aria-pressed', String(active));
    button.setAttribute('aria-label', say(active ? 'stop' : snapshot.phase === 'unsupported' ? 'unsupported' : 'idle'));
    button.title = button.getAttribute('aria-label');
    submit.disabled = false;
    const matchedError = snapshot.message && Object.entries(copy).find(([, values]) => values[0] === snapshot.message)?.[0];
    const message = snapshot.message ? say(matchedError || snapshot.errorKey || 'error')
      : snapshot.phase === 'unsupported' ? say('unsupported')
      : snapshot.phase === 'idle' || snapshot.phase === 'error' ? '' : say(snapshot.phase);
    status.textContent = [message, interim && `${english() ? 'Recognizing:' : '인식 중:'} ${interim}`].filter(Boolean).join(' ');
  };

  const controller = new BrowserSpeechController(factory, chunk => {
    input.value = appendSpeechText(input.value, chunk);
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, state => {
    snapshot = state;
    interim = state.interim || '';
    render();
  });

  button.addEventListener('click', () => {
    if (snapshot.phase === 'starting' || snapshot.phase === 'listening') controller.stop();
    else if (!busy() && supported) { interim = ''; controller.start(); }
  });
  const requestSendAfterStop = () => {
    if (sendPending || !busy()) return;
    sendPending = true;
    const generation = sendGeneration;
    void controller.stopAndWait().then(ended => {
      if (generation !== sendGeneration) return;
      if (!ended || disposed) { sendPending = false; return; }
      // Leave the native submit-event dispatch before calling requestSubmit again.
      // Some browsers suppress a nested submission while the original click/Enter is still dispatching.
      sendTimer = setTimeout(() => {
        sendTimer = null;
        if (disposed || generation !== sendGeneration) { sendPending = false; return; }
        sendPending = false;
        form.requestSubmit();
      }, 0);
    });
  };
  form.addEventListener('submit', event => {
    if (busy() || sendPending) {
      event.preventDefault(); event.stopImmediatePropagation();
      requestSendAfterStop();
    }
  }, true);
  input.addEventListener('keydown', event => {
    if ((busy() || sendPending) && event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault(); event.stopImmediatePropagation(); requestSendAfterStop();
    }
  }, true);
  const languageObserver = new MutationObserver(render);
  languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  window.addEventListener('pagehide', event => {
    sendGeneration++;
    if (sendTimer !== null) clearTimeout(sendTimer);
    sendTimer = null; sendPending = false;
    // A back/forward-cache restore keeps this module and its listeners alive.
    // Cancel the current session so the same controller can start again.
    if (event.persisted) controller.cancel();
    else { disposed = true; controller.dispose(); languageObserver.disconnect(); }
  });
  render();
}
