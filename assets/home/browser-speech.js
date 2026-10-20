/* Generated from lib/survey/browserSpeech.ts; sourceSHA256: dcf420b243d61d95e91f126f7eaac18ffded64552d3fd2a979e3389f0d12a0e6; keep in sync with app source. */
export function browserRecognitionFactory(host = globalThis) {
    return () => {
        const Ctor = host?.SpeechRecognition ?? host?.webkitSpeechRecognition;
        return Ctor ? new Ctor() : null;
    };
}
export function appendSpeechText(current, text) {
    if (!current || !text)
        return current + text;
    return `${current}${/\s$/.test(current) || /^\s/.test(text) ? '' : ' '}${text}`;
}
const errorCopy = {
    'not-allowed': '마이크 권한을 허용해 주세요.', 'service-not-allowed': '이 브라우저에서 음성 입력을 사용할 수 없어요.',
    'no-speech': '음성이 들리지 않았어요. 다시 눌러 말해 주세요.', network: '음성 인식 연결에 실패했어요. 다시 시도해 주세요.',
    'audio-capture': '사용할 수 있는 마이크가 없어요.',
};
export class BrowserSpeechController {
    constructor(factory, append, changed = () => { }, stopTimeoutMs = 2500) {
        this.recognizer = null;
        this.disposed = false;
        this.phase = 'idle';
        this.stopTimer = null;
        this.factory = factory;
        this.append = append;
        this.changed = changed;
        this.stopTimeoutMs = stopTimeoutMs;
    }
    emit(phase, extra = {}) { this.phase = phase; if (!this.disposed)
        this.changed({ phase, ...extra }); }
    clearStopTimer() { if (this.stopTimer)
        clearTimeout(this.stopTimer); this.stopTimer = null; }
    start() {
        if (this.disposed || this.phase === 'starting' || this.phase === 'listening' || this.phase === 'stopping')
            return;
        if (this.recognizer)
            this.retire(this.recognizer, true);
        this.clearStopTimer();
        let rec;
        try {
            rec = this.factory();
        }
        catch {
            rec = null;
        }
        if (!rec) {
            this.emit('unsupported', { message: '이 브라우저는 음성 입력을 지원하지 않아요.' });
            return;
        }
        this.recognizer = rec;
        this.emit('starting');
        rec.lang = 'ko-KR';
        rec.interimResults = true;
        rec.continuous = true;
        const appended = new Set();
        let hasAppendedFinal = false;
        let lastError = null;
        rec.onstart = () => { if (!this.disposed && this.recognizer === rec)
            this.emit('listening'); };
        rec.onresult = event => {
            if (this.disposed || this.recognizer !== rec)
                return;
            const finals = [];
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const item = event.results[i];
                const text = item?.[0]?.transcript ?? '';
                if (item?.isFinal) {
                    if (!appended.has(i) && text.trim()) {
                        finals.push(text.trim());
                        appended.add(i);
                    }
                }
                else
                    interim += text;
            }
            if (finals.length) {
                this.append(`${hasAppendedFinal ? ' ' : ''}${finals.join(' ')}`);
                hasAppendedFinal = true;
            }
            if (!this.disposed)
                this.changed({ phase: this.phase, ...(interim ? { interim } : {}) });
        };
        rec.onerror = event => { if (this.disposed || this.recognizer !== rec)
            return; lastError = errorCopy[event.error ?? ''] ?? '음성 입력에 실패했어요. 다시 시도해 주세요.'; this.emit('error', { message: lastError }); };
        rec.onend = () => {
            if (this.disposed || this.recognizer !== rec)
                return;
            this.clearStopTimer();
            this.retire(rec, false);
            this.emit(lastError ? 'error' : 'idle', lastError ? { message: lastError } : {});
        };
        try {
            rec.start();
        }
        catch {
            this.retire(rec, true);
            this.emit('error', { message: '음성 입력을 시작하지 못했어요. 다시 시도해 주세요.' });
        }
    }
    stop() {
        const rec = this.recognizer;
        if (!rec || this.phase === 'stopping' || this.disposed)
            return;
        this.emit('stopping');
        try {
            rec.stop();
            if (this.recognizer !== rec)
                return;
            this.stopTimer = setTimeout(() => {
                if (this.disposed || this.recognizer !== rec)
                    return;
                this.retire(rec, true);
                this.stopTimer = null;
                this.emit('error', { message: '음성 입력을 마무리하지 못했어요. 다시 눌러 주세요.' });
            }, this.stopTimeoutMs);
        }
        catch {
            this.clearStopTimer();
            this.retire(rec, true);
            this.emit('error', { message: '음성 입력을 멈추지 못했어요. 다시 눌러 주세요.' });
        }
    }
    /** Abort the current gesture while leaving the controller available for a later start. */
    cancel() { const rec = this.recognizer; if (this.disposed)
        return; this.clearStopTimer(); if (rec)
        this.retire(rec, true); this.emit('idle'); }
    retire(rec, abort) {
        if (this.recognizer === rec)
            this.recognizer = null;
        rec.onstart = rec.onresult = rec.onerror = rec.onend = null;
        if (abort) {
            try {
                rec.abort();
            }
            catch { }
        }
    }
    dispose() { if (this.disposed)
        return; this.disposed = true; this.clearStopTimer(); const rec = this.recognizer; this.recognizer = null; if (rec)
        this.retire(rec, true); }
}
