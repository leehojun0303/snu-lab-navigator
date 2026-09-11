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
`tools/roster_sync.py`가 연결된 공식 서울대학교 학과·단과대 등 roster URL을 합집합으로 검사한다. 한 곳에서 현재 재직이 확인되면 유지하며, 신규 교수는 교수×소속 unit으로 자동 추가한다. 한 번의 출처 누락으로 삭제하지 않고 명시적인 퇴직/전임 종료 또는 보수적 반복 미확인 기준을 적용한다.

## 자동화
`.github/workflows/collect.yml`은 개발 push마다 실행하지 않고 매일 03:00·08:00·13:00·18:00·23:00 KST 또는 수동 실행에서 roster sync와 incremental detail collection을 수행한다. 상세 수집은 실행당 최대 285분, batch 40이며 Gemini 호출에는 임의 400건 상한을 두지 않는다. Gemini가 429/RESOURCE_EXHAUSTED를 반환하면 해당 실행의 AI 호출만 중단하고 URL 수집·상태 저장은 지속하며 다음 5시간 주기에 재개한다.  `data/automation-state.json` cursor에서 이어간다. 전체 재구축용 `full-refresh.yml`은 파생 상세 데이터를 초기화한 후 교수명 가나다순으로 재수집한다.

**자동 수집 표시 개수 원칙:** 정상적인 최신 collector가 완주하고 snapshot 검증/QA가 통과한 경우에만 `enriched_units`를 앱의 자동수집 저장 개수로 표시한다. 과거의 348 같은 임의 숫자를 최신 정상 개수로 사용하지 않는다.

## 상세 수집·AI 검증
정적 HTML → 동일 공식/연구실 host relevance crawl → 이미지/PDF 후보 → publication/member/recruitment/poster 후보 → Gemini URL Context 구조화 → 빈약한 hard case Search grounding → allowlist 재검증 → canonical snapshot.

논문은 교수/연구실 귀속이 확인된 실제 제목만, 모집은 현재 연구실 모집만, 구성원은 공식 이름+role만, 포스터는 실제 연구 포스터 및 귀속 확인 시 verified만 공개한다. 학과 뉴스, 일반 입학/학생지원, 타 교수 연구성과는 canonical field에서 제외한다.

구성원은 current/Alumni와 역할별로 분리하며 박사과정·석사과정·박사후연구원·학부연구생·연구원 등 공식 role을 그대로 반영한다. 모호하면 임의 추정하지 않는다.

## 새 상세 형식 첫 수집

새 상세 형식은 연구 계열의 최근 논문 3건·1줄 요약·모집·구성 요약, 음악의 공연/창작/교육, 미술의 최근 1년 개인전/단체전/교육, 인문의 논문/저서/연구과제를 각각 검증해 저장한다. 검증 포스터 이미지가 있는 경우에는 모든 계열 상세 화면에 원문 링크와 함께 표시한다. 기존 자동 상세 snapshot은 비어 있으므로 이번 형식의 첫 수집부터 새 스키마로 채워진다.

## 대표 상세
`dist/showcase-final.js`가 최신 정상 snapshot의 completeness score로 가장 정보가 충실한 unit을 자동 선택한다. 특정 교수 하드코딩은 사용하지 않는다.

## 검색/추천/비교
자동 수집의 `research_summary`, `research_topics`, `recommendation_keywords`, `recent_papers`는 저장 후 검색·추천·비교에 우선 재사용한다. 비교는 최대 4개이며 표에는 핵심 분야, keyword, 최근 1년 논문 수, 구성원 구성, 모집을 보여준다. 표 아래 AI는 논문 수를 반복하지 않고 연구 방향/대표 연구의 핵심 차이만 짧게 요약한다. AI 호출 실패 시 기본 비교표는 유지한다.

## 계정
현재 사용자 요구사항에 따라 **ID-only account**를 사용한다. 회원가입은 `create_lab_account`, 로그인은 `login_lab_account` RPC를 사용한다. 비밀번호·이메일·전화번호·개인 Gemini key를 받지 않는다. 로그아웃하거나 브라우저를 바꾼 뒤에도 가입된 ID만 입력하면 계정을 다시 사용할 수 있다.

ID를 인증수단으로 사용하는 매우 단순한 서비스 계정이므로 민감한 개인정보/결제/비공개 문서용 인증으로 사용해서는 안 된다.

즐겨찾기는 `lab_favorites`에 username 기준으로 저장해 같은 ID로 다른 브라우저에서도 불러올 수 있다.

## Gemini
`dist/account.js`는 로그인된 ID를 `x-lab-username`으로 서버 proxy에 전달한다. `supabase/functions/gemini-proxy/index.ts`는 이 ID가 `lab_accounts`에 존재하는지 확인한 후 서버의 `GEMINI_API_KEY`로 Gemini를 호출한다. 사용자 개인 key는 저장하지 않는다.

## 가입자 registry
회원가입 성공 후 `account-registry` Edge Function을 호출하고 `data/account-registry.json`에 ID와 가입시각을 기록한다. GitHub token은 Edge Function secret으로만 둔다.

## 공개/협업
repository는 public이므로 코드와 문서는 누구나 읽고 fork할 수 있다. `main`에 직접 push하려면 GitHub collaborator의 Write 권한이 필요하다. 협업 절차는 `docs/handoff/TEAM_COLLABORATION.md`에 있다.

## 알려진 운영 전제
- Supabase에서 `lab_accounts` 관련 최신 SQL이 적용되어 있어야 한다.
- `gemini-proxy` Edge Function은 최신 ID-only 버전으로 배포되어야 한다.
- 가입자 GitHub registry를 쓰려면 `account-registry` Edge Function과 `GITHUB_TOKEN`, `GITHUB_REPO` secrets가 설정되어야 한다.
- 공개 repository에는 service-role/Gemini/GitHub token을 절대 저장하지 않는다.
