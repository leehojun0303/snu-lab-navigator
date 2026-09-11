# PROJECT HANDOFF COMPLETE

기준일: 2026-09-11

## 목표
서울대학교 공식 자료를 기반으로 교수·연구실을 자연어로 탐색하고, 저장된 AI 분석을 활용해 추천·즐겨찾기·비교까지 제공하는 공개 프로토타입.

## 현재
2,001 고유 교수명 / 2,170 교수×소속 단위 / 1,643 연구 주제 / 797 공식 사진 / 334 활동 출처.

## 데이터 흐름
공식 roster 합집합 → `dist/data.js`/`dist/data/units-*.js` → `tools/automated_enrichment_v2.py` → `data/automation-state.json` + `dist/automation-data.js` → GitHub Pages.

## 교수 roster 자동화
`tools/roster_sync.py`가 공식 서울대학교 roster URL을 UNION으로 확인한다. 학과·단과대 등 여러 공식 출처 중 한 곳에서 현재 교수가 확인되면 유지한다. 한 페이지 누락으로 삭제하지 않으며, 명시적 종료 상태 또는 관련 성공 roster 전체에서 두 번 연속 미확인인 경우에만 보수적으로 제거한다. 신규 교수는 공식 roster에서 발견되면 교수×소속 unit으로 추가한다.

## 자동 상세 수집
정적 HTML → relevance crawl → 이미지/PDF 자산 발견 → publication/member/recruitment/poster 후보 → Gemini URL Context 검증·구조화 → hard case Search grounding → source allowlist 재검증 → canonical snapshot.

## 정보 품질
논문은 해당 교수/연구실 귀속 publication만, 모집은 해당 연구실의 현재 모집만 공개한다. 학과 뉴스·타 교수 연구성과·일반 입학포털·학생지원 페이지는 canonical field에서 제외한다. 구성원은 현재/Alumni와 박사·석사·학부연구생·기타 역할로 구분한다. 포스터는 실제 연구 포스터 귀속이 검증된 `verified`만 공개한다.

## 저장 AI 정보 재사용
`research_summary`, `research_topics`, `recommendation_keywords`, `recent_papers`를 snapshot에 저장한다. 검색/추천/비교에서는 이 저장 정보를 먼저 사용해 같은 내용을 반복해서 Gemini에 보내는 일을 줄인다. 추천 결과와 비교 결과도 cache할 수 있게 설계한다.

## 사용자 기능
- 즐겨찾기: 카드에서 저장/해제, 목록 보기. 비로그인 시 브라우저 저장, 로그인 시 Supabase account와 동기화.
- 연구실 비교: 최대 4개 선택. 저장된 AI 요약·키워드·최근 논문 연도 흐름·구성원 규모·모집 상태를 간결하게 비교하고, 필요할 때만 Gemini로 핵심 차이를 추가 요약.
- 계정: `dist/account.js`에 ID/비밀번호 회원가입·로그인과 최근 사용 ID 버튼 UI가 들어 있다.
- Gemini key: 회원가입 때 입력한 key를 Supabase Edge Function이 암호화해 저장하고, 로그인한 사용자만 서버 proxy를 통해 사용한다. 활성 세션에서 기존 프런트엔드 AI 호출과 호환하기 위해 세션 key 복구도 지원한다.

## 계정 백엔드
- `supabase/migrations/20260911_user_accounts.sql`
- `supabase/functions/user-secret/index.ts`
- `supabase/functions/gemini-proxy/index.ts`
- `docs/handoff/SUPABASE_SETUP.md`

GitHub Pages에는 service-role key 또는 암호화 secret을 저장하지 않는다.

## 대표 상세 예시
`dist/showcase-data.js`는 특정 교수명을 하드코딩하지 않고 최신 자동 snapshot의 completeness score가 가장 높은 unit을 연다.

## 검사
`tools/test_static.py`, `tools/test_automation_features.py`, Python compile 및 JavaScript syntax check를 사용한다. 최신 QA workflow는 정적 코드 검사 성공 상태를 확인한 뒤 배포/수집을 진행하도록 구성한다.

## 실제 활성화에 필요한 관리자 설정
Supabase 프로젝트 생성 → SQL migration 적용 → 두 Edge Function 배포 → Edge secrets 설정 → `dist/supabase-config.js`에 public URL/anon key/functions base 설정이 필요하다. 이 설정값은 프로젝트별 비밀값이므로 저장소에 대체값을 넣지 않는다.

## 제출 기획서
`docs/proposal/SNU_Lab_Navigator_생성형_AI_활용_기획서_v17.docx`는 최신 Word 편집본이다.
