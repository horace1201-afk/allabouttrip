# MODNI 홈피(allabouttrip) 프로젝트 규칙

## ⚠️ 배포·브랜치

- **master 푸시 = 즉시 실배포** (GitHub Pages, CNAME 연결). master로 직접 커밋·푸시 **절대 금지**
- 모든 작업은 `minji-web` 브랜치에서만
- master 반영은 사용자 확인 후 별도 병합 절차로만

## ⚠️ 수정 금지 대상

- `admin.html` (관리자 페이지)
- 히어로의 **호텔 예약 버튼** (`#heroHotel`, `index.html` 히어로 섹션) — 스타일·핸들러·문구 모두 무접촉
- 드로어 메뉴의 **호텔 예약 버튼** (`.dw-item` 중 "호텔 예약 <span class="tag">회원 특가</span>") — 무접촉
- **`#hotelNotice` 모달** (`index.html` 하단, 변호사 회신 전 임시 국외이전 고지) — 무접촉

## 한글 문구 변경 시 짝 수정 원칙

한글 문구 변경 시 아래 두 배열도 **동일 변경분에 짝으로 수정**:

- `EN_TEXTS` 배열 (`index.html` 하단, `[["#selector", "English innerHTML"], ...]` 형태)
- 드로어 메뉴 문구는 `dwKo` / `dwEn` 배열 (`index.html` 언어 토글 핸들러 내부) — 각 7개 항목

짝을 놓치면 ENG 토글 시 한/영 불일치가 즉시 배포에 반영됨.

## 파일 구조

- 정적 단일 파일 웹 — 빌드 도구 없음
- CSS는 `index.html`의 단일 `<style>` 블록 내부에 유지
- 팔레트는 `:root` CSS 변수(`--orange:#F4581C` 등) — 앱 `lib/theme.ts hub`와 정합. 전역 변수는 함부로 변경 금지, 히어로 등 로컬 스타일은 섹션 스코프 규칙으로만
- 자산은 `assets/` 4개(favicon/icon/modni/modni_symbol) 중심 — 앱 심볼과 동일본 유지 (`allabouttrip-app/assets/modni/modni_symbol_orange.png`이 원본)

## 작업 방식

- 파악 → 수정 한 번에 하나. HTML만 바뀌는 정적 사이트라 tsc·빌드는 없음 — 대신 데스크톱+모바일 폭 브라우저 렌더, ENG 토글, 호텔 버튼 → hotelNotice 모달 열림 확인 필수
- 근거 없는 데이터·이미지 표시 금지 (Unsplash 등 외부 스톡은 기본 배제, 필요 시 사용자 승인 후)
- 커밋은 소단위. 푸시는 사용자 확인 후에만
