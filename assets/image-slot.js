// <image-slot> — 실제 이미지가 들어가기 전 자리표시용 커스텀 엘리먼트
// 속성:
//   - src         : 있으면 실제 이미지로 대체 렌더
//   - placeholder : 자리표시 라벨 (한글 캡션 지원)
//   - shape       : "rounded"(기본) | "circle"
//   - radius      : rounded일 때 border-radius px (기본 16)
// 부모 컨테이너 크기를 100%로 채운다. .phone 등 부모가 크기 지정.

customElements.define('image-slot', class extends HTMLElement {
  connectedCallback() {
    if (this._done) return;
    this._done = true;

    const shape       = this.getAttribute('shape') || 'rounded';
    const radiusAttr  = parseInt(this.getAttribute('radius') || '16', 10);
    const placeholder = this.getAttribute('placeholder') || '이미지 자리';
    const src         = this.getAttribute('src') || '';
    const br          = shape === 'circle' ? '9999px' : radiusAttr + 'px';

    Object.assign(this.style, {
      display:      'block',
      width:        '100%',
      height:       '100%',
      minHeight:    '160px',
      background:   '#F7F5F2',
      borderRadius: br,
      overflow:     'hidden',
      position:     'relative',
    });

    if (src) {
      this.innerHTML =
        `<img src="${src}" alt="" style="width:100%;height:100%;object-fit:cover;display:block">`;
    } else {
      const safe = placeholder
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      this.innerHTML =
        `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;` +
        `padding:14px;text-align:center;color:#9C9690;font-size:12px;font-weight:600;` +
        `letter-spacing:.02em;line-height:1.5">${safe}</div>`;
    }
  }
});
