# MODNI 홈피(allabouttrip) 프로젝트 규칙

## ⚠️ 배포·브랜치 (2026-07-23 확정 — 작업별 feat 브랜치)

- **master 직접 커밋·푸시 = 즉시 실배포 → 절대 금지** (GitHub Pages, CNAME 연결)
- **작업마다 master 기반 새 `feat/<작업명>` 브랜치**를 파서 거기서만 작업:
  ```
  git switch master && git pull --ff-only
  git switch -c feat/<작업명>
  # 수정 → git add → git commit
  git diff master feat/<작업명> --name-only   # 변경파일 확인
  ```
- ⚠️ **`minji-web`은 민지 디자인 개편 전용 → 다른 작업(핫픽스·신고번호 등) 절대 얹지 말 것** (구조가 master와 크게 달라 충돌·데이터 유실 — 2026-07-23 실제 발생)
- master 반영은 **영아 확인 후** feat→master 병합으로만

## ⚠️ 수정 금지 대상

- `admin.html` (관리자 페이지)
- **호텔 예약 진입 버튼** (현재: topbar `.tb-hotel` + 드로어 `.dw-item` "호텔 예약 회원 특가" + 호텔 섹션 `.btn-go`) — `onclick="openHotelSite(...)"` 연결과 고지 모달 경유 구조 **무접촉**. 위치·스타일 변경은 가능하되 **버튼 제거 금지**
- **`#hotelNotice` 모달** (`index.html` 하단, 변호사 회신 전 임시 국외이전 고지) — 무접촉

## flights.html 공항 매핑 동기화 원칙 (2026-07-29)

- `flights.html`의 `KO_AIRPORTS` 상수는 **앱 레포 `lib/data/airportCodes.ts`에서 생성한 사본**이다 (한글 도시명→IATA, 330곳).
- **앱 원본에 도시가 추가·변경되면 이 사본도 재생성**해야 한다 (수기 수정 금지 — 클로디에게 "KO_AIRPORTS 재생성해줘"라고 요청).
- 어긋나면: 앱에서는 되는 한글 도시가 웹 항공 검색에서 안 잡히는 불일치 발생.

## 한글 문구 변경 시 짝 수정 원칙

한글 문구 변경 시 아래 두 배열도 **동일 변경분에 짝으로 수정**:

- `EN_TEXTS` 배열 (`index.html` 하단, `[["#selector", "English innerHTML"], ...]` 형태)
- 드로어 메뉴 문구는 `dwKo` / `dwEn` 배열 (`index.html` 언어 토글 핸들러 내부) — 배열 항목 수·순서는 드로어 `.dw-item` 버튼 수와 항상 일치 유지

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
