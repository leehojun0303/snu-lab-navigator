# 현재 상태

기준일: 2026-09-11
GitHub: https://github.com/leehojun0303/snu-lab-navigator
공개 앱: https://leehojun0303.github.io/snu-lab-navigator/

## 데이터
- 2,001명 고유 교수명
- 2,170개 교수×소속 단위
- 1,643개 연구 주제 정보 보유
- 797개 공식 사진 연결

2,170개는 서울대학교 공식 연구실 총계가 아니다.

## 교수 명단 자동화
`tools/roster_sync.py`가 현재 데이터에 연결된 공식 서울대학교 학과·단과대 등 roster URL을 합집합으로 검사한다. 학과와 단과대에 모두 존재해야 한다는 교집합 조건은 사용하지 않는다. 어느 하나의 성공적인 공식 출처가 현재 재직을 지지하면 유지한다.

신규 교수는 공식 roster에서 발견될 경우 새 교수×소속 unit으로 자동 추가하고 상세 수집 대상에 포함한다. 한 번의 roster 누락은 삭제 사유가 아니며, 공식 profile이 살아 있거나 다른 관련 공식 roster에 존재하면 유지한다. 명시적인 퇴직/명예/전임 종료가 확인되거나 모든 관련 성공 roster에서 두 번 연속 빠진 경우에만 보수적으로 제거한다.

## 자동화
`.github/workflows/collect.yml`은 매일 03:00 KST에 roster union sync 후 incremental detail collection을 수행한다. 상세 수집은 최대 285분, batch 40, 최대 Gemini 분석 400건이며 `data/automation-state.json` cursor에서 이어간다. 수집 중에는 마지막 성공 snapshot이 공개된다.

## 상세 수집·AI 검증
정적 HTML → relevance-ranked 동일 공식 host crawl → `<img>/<source>` 이미지/PDF 탐색 → publication/member/recruitment/poster 후보 생성 → Gemini URL Context로 실제 URL 검증·구조화 → 빈약한 hard case에서 Search grounding으로 공식 URL 추가 발견 → canonical verified fields 저장.

논문은 해당 교수/연구실에 귀속된 publication만, 모집은 해당 연구실의 현재 모집만, 구성원은 명시된 이름/역할만, 포스터는 실제 연구 포스터이며 연구실 귀속이 확인된 경우만 공개한다. 학과 뉴스·입학포털·학생지원센터·타 교수 수상 뉴스·로고/SNS 아이콘 등은 공개 canonical field에서 제외한다.

포스터 상태는 `verified / unverified_candidate / none_detected / inaccessible`로 분리하며 verified만 이미지로 표시한다.

## 대표 상세
`dist/showcase-data.js`는 자동 snapshot의 `AUTOMATION_META.showcase_unit_id`를 사용한다. 공식 연구실명, 연구분야, 검증 논문, 구성원, 모집, 포스터, 공식 페이지 수를 이용해 현재 가장 완성도 높은 unit을 자동 선택하며 특정 교수명을 하드코딩하지 않는다.

## 저장된 AI 정보 재사용
자동 수집에서 생성한 `research_summary`, `research_topics`, `recommendation_keywords`, `recent_papers`는 snapshot에 저장한다. 검색·추천·연구실 비교는 저장된 데이터를 우선 사용해 같은 내용을 반복해서 Gemini에 보내는 일을 줄인다.

## 사용자 기능
`dist/favorites-compare.js`가 즐겨찾기와 최대 4개 연구실 비교 UI를 제공한다. 로그인하지 않은 상태에서는 브라우저에 저장하고, 로그인 후에는 Supabase favorites 테이블과 동기화한다. 비교 표는 저장된 AI 요약·keyword, 최근 논문 연도 흐름, 구성원 규모, 모집 상태를 간결하게 보여주고 필요할 때 Gemini로 차이점을 짧게 요약한다.

## 계정 기능
`dist/account.js`가 ID/비밀번호 회원가입·로그인·최근 사용 ID 선택 UI를 제공한다. 실제 인증은 Supabase Auth를 사용하고 비밀번호는 앱 코드/DB에 평문으로 저장하지 않는다. 회원가입 시 입력한 Gemini API key는 `user-secret` Edge Function에서 암호화하여 저장하고, 로그인 후 세션에서 필요한 AI 기능에 사용한다. `gemini-proxy` Edge Function을 통해 서버 측 호출도 지원한다.

GitHub Pages에는 service-role key나 Gemini secret을 저장하지 않는다. `dist/supabase-config.js`에는 공개 Supabase URL/anon key만 설정한다. 실제 계정 기능을 활성화하려면 Supabase 프로젝트에서 `supabase/migrations/20260911_user_accounts.sql`을 적용하고 Edge Function secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_KEY_ENCRYPTION_SECRET`)을 설정해야 한다. 자세한 구현 현황은 `docs/handoff/FEATURE_STATUS.md` 참조.

## 현재 한계
전수 상세 완성은 아직 진행 중이다. JS-only 사이트, 이미지 속 정보, 접근 제한 페이지, 비표준 navigation은 추가 보완이 필요하다. 또한 새 교수 자동 추가는 현재 저장소에 등록된 공식 roster URL 집합을 기준으로 동작하므로 새로운 공식 roster source가 생기면 URL registry에 추가해야 한다.
