# PROJECT HANDOFF COMPLETE

기준일: 2026-09-11

## 목표
서울대학교 공식 자료를 기반으로 교수·연구실을 자연어로 탐색하고, 저장된 AI 분석을 활용해 추천·즐겨찾기·비교까지 제공하는 공개 프로토타입.

## 현재
2,001 고유 교수명 / 2,170 교수×소속 단위 / 1,643 연구 주제 / 797 공식 사진 / 334 활동 출처.

## 데이터 흐름
공식 roster 합집합 → `tools/roster_sync.py` → `dist/data.js`/`dist/data/units-*.js` → `tools/automated_enrichment_v2.py` → `data/automation-state.json` + `dist/automation-data.js` → GitHub Pages.

## 교수 roster 자동화
`tools/roster_sync.py`가 연결된 공식 서울대학교 학과·단과대 등 roster URL을 UNION으로 확인한다. 학과와 단과대의 교집합을 사용하지 않는다. 어느 하나의 성공적인 공식 출처에서 현재 교수가 확인되면 유지한다. 신규 교수는 공식 roster에서 발견되면 교수×소속 unit으로 추가한다. 한 곳의 누락/접속 실패로 삭제하지 않으며, 명시적 퇴직·명예·전임 종료 또는 모든 성공 공식 roster에서 두 번 연속 미확인일 때만 보수적으로 제거한다.

## 자동 상세 수집
정적 HTML → 관련 하위 페이지 crawl → 이미지/PDF 자산 발견 → publication/member/recruitment/poster 후보 → Gemini URL Context 검증·구조화 → 필요 시 Search grounding → source allowlist 재검증 → canonical snapshot.

## 정보 품질
논문은 해당 교수/연구실에 귀속된 publication만, 모집은 해당 연구실의 현재 모집만 공개한다. 학과 뉴스·타 교수 연구성과·일반 입학/학생지원 페이지는 canonical activity에서 제외한다. 구성원은 현재/Alumni와 박사·석사·학부연구생·기타 역할로 구분한다. 포스터는 실제 연구 포스터이며 연구실 귀속이 확인된 `verified`만 공개한다.

## 저장 AI 정보 재사용
`research_summary`, `research_topics`, `recommendation_keywords`, `recent_papers`를 snapshot에 저장한다. 검색·추천·비교는 저장된 정보를 우선 사용하여 같은 내용을 반복해서 Gemini에 보내는 일을 줄인다.

## 사용자 기능
- 즐겨찾기: 카드에서 저장/해제하고 목록으로 본다. Supabase 연결 시 계정별 동기화, 미연결 시 브라우저 localStorage fallback.
- 연구실 비교: 최대 4개를 선택하여 저장 요약·keyword·최근 논문 연도 흐름·구성원 규모·모집 상태를 간결하게 비교한다. 필요할 때 인증된 서버 Gemini가 핵심 차이를 짧게 요약한다.
- 계정: 개인정보 없이 고유 ID만 선택한다. Supabase Anonymous Auth 세션이 실제 인증이고 username은 계정 식별/표시용이다. 이미 사용 중인 ID는 `claim_username`에서 거부한다.
- 최근 ID: 브라우저가 최근 사용 ID를 기억하므로 다음 방문에 ID를 다시 타이핑하지 않아도 된다. 실제 자격 증명은 익명 인증 세션이며, ID만으로 다른 기기에서 계정을 복구하지 않는다.
- 비밀번호·이메일·전화번호는 받지 않는다.
- Gemini 개인 API key를 받거나 저장하지 않는다. 로그인한 사용자의 AI 기능은 서버의 `GEMINI_API_KEY` secret을 사용한다.

## 계정 백엔드
- `dist/account.js`
- `dist/account-ai-bridge.js`
- `dist/supabase-config.js`
- `supabase/migrations/20260911_user_accounts.sql`
- `supabase/functions/gemini-proxy/index.ts`
- `docs/handoff/SUPABASE_SETUP.md`

GitHub Pages에는 service-role key 또는 Gemini server secret을 저장하지 않는다.

## 대표 상세 예시
`dist/showcase-data.js`는 특정 교수명을 하드코딩하지 않고 최신 snapshot의 completeness가 가장 높은 unit을 자동 선택한다.

## 자동화 운영
`.github/workflows/collect.yml`은 개발 push 때마다 실행하지 않고 매일 03:00 KST schedule 또는 수동 실행에서만 roster sync와 incremental collection을 수행한다. 따라서 코드 수정 때문에 장시간 수집이 반복 실행되는 문제를 막는다.

## 오류 원인/해결
이전에 반복된 collector 실패는 chunked `units-*.js` 파싱 오류였고, QA 실패는 roster 제거 정책 문자열을 검사하는 오래된 테스트가 원인이었다. 두 부분을 수정했다. 현재 collector workflow는 push trigger를 제거했다.

## 검사
`tools/test_static.py`, `tools/test_automation_features.py`, Python compile 및 JavaScript syntax check를 사용한다. 계정은 ID-only Anonymous Auth 구조와 고유 ID claim을 검사한다.

## 실제 계정 기능 활성화
Supabase 프로젝트 생성 → Anonymous Sign-Ins 활성화 → SQL migration 적용 → `gemini-proxy` Edge Function 배포 → Edge secrets `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY` 설정 → `dist/supabase-config.js`에 public URL/anon key/functions base 설정.
