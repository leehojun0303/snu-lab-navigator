# SNU Lab Navigator

## 🚀 공개 앱

**https://leehojun0303.github.io/snu-lab-navigator/**

서울대학교 공식 페이지를 기반으로 교수·연구실을 탐색하고, 저장된 AI 연구분야 정보를 이용해 관심 연구실을 추천·비교하는 공개 프로토타입입니다.

## 현재 범위

- 2,001명 고유 교수명
- 2,170개 교수×소속 단위
- 1,643개 연구 주제 보유
- 797개 공식 사진 연결
- 자동 상세 수집·검증 snapshot 제공

2,170개는 서울대학교 공식 연구실 수가 아니라 교수와 소속의 조합입니다.

## 교수 명단 자동 동기화

`tools/roster_sync.py`가 현재 데이터에 연결된 서울대학교 공식 학과·단과대 등 roster URL을 **합집합(UNION)** 으로 검사합니다.

- 학과에 있거나 단과대·대학원·기타 공식 서울대 roster에 있으면 포함할 수 있습니다.
- 여러 roster에 모두 있어야 하는 교집합 조건을 사용하지 않습니다.
- 한 공식 페이지에서 사라졌다는 이유만으로 교수를 삭제하지 않습니다.
- 공식 교수 profile이 여전히 유효하면 다른 roster 누락에도 유지합니다.
- 공식 퇴직·명예·전임 종료가 확인되거나 관련 성공 공식 roster에서 두 번 연속 확인되지 않을 때만 보수적으로 제거합니다.
- 신규 교수는 공식 roster에서 발견되면 새 교수×소속 unit으로 자동 추가합니다.

## 자동 수집

`.github/workflows/collect.yml`은 코드 push 때마다 실행하지 않고 매일 03:00 KST schedule 또는 수동 실행에서만 작동합니다. 먼저 roster union sync를 수행한 뒤 최대 285분 동안 batch size 40으로 상세 수집을 이어갑니다. `data/automation-state.json`의 cursor에서 계속 진행하며 수집 중에는 마지막 성공 snapshot을 제공합니다.

현재 상세 collector는 `tools/collector_entry.py` → `tools/automated_enrichment_v2.py` 구조입니다.

수집 순서:

1. `homepage`, `profile`, `departmentUrl`에서 시작
2. 동일 공식/연구실 host의 관련 하위 링크를 relevance-ranked crawl
3. publication/member/recruitment 링크와 이미지/PDF 자산을 함께 탐색
4. poster 단서는 이미지/PDF 자산까지 별도로 탐색
5. 실제 공식 URL을 Gemini URL Context로 전달해 연구분야·논문·구성원·모집·포스터를 구조화
6. hard case는 Search grounding으로 공식 세부 URL을 추가 발견한 뒤 source allowlist 검증
7. source URL과 fingerprint를 저장
8. `poster_status`를 `verified / unverified_candidate / none_detected / inaccessible`로 구분
9. 정상 검증된 snapshot에서 가장 완성도가 높은 unit을 대표 상세 예시로 자동 선정

## 정보 검증 원칙

관련 있어 보인다는 이유만으로 링크를 공개 데이터로 승격하지 않습니다.

### 논문
해당 교수/연구실의 직접 publication 페이지 또는 교수/연구실 귀속이 명시된 논문만 승인합니다. 학과 뉴스, 서울대 전체 연구성과, 다른 교수의 수상 기사, 일반 학술행사는 논문 목록에서 제외합니다.

### 모집
해당 연구실/교수의 현재 연구생·대학원생·인턴 등 모집만 승인합니다. 서울대 전체 입학, 학과 일반 대학원 모집, 학생지원센터, 장학·기숙사·행정 페이지는 제외합니다.

### 구성원
이름과 역할이 명시된 공식 member/people 페이지를 기준으로 현재 구성원과 Alumni를 분리하고, 박사과정·석사과정·박사후연구원·학부연구생·연구원 등 역할을 구분합니다. 역할이 불명확하면 임의로 추정하지 않습니다.

### 포스터
교수 사진·로고·SNS 공유 아이콘·일반 홈페이지 이미지는 포스터로 취급하지 않습니다. 실제 연구 포스터이고 연구실 귀속이 확인된 경우에만 `verified` 포스터를 공개합니다.

## 저장된 AI 정보 재사용

자동 수집에서 생성된 `research_summary`, `research_topics`, `recommendation_keywords`와 최근 논문 metadata는 snapshot에 저장합니다. 이후 검색·추천·비교에서 이 저장 정보를 우선 사용하므로 같은 내용을 매번 Gemini에 다시 보내는 일을 줄입니다.

## 즐겨찾기와 연구실 비교

관심 연구실은 카드의 별 버튼으로 즐겨찾기에 저장할 수 있습니다. 계정이 있는 경우 Supabase DB에 저장하여 브라우저가 바뀌어도 같은 ID로 불러옵니다.

최대 4개 연구실을 선택해 핵심 분야, 저장된 keyword, 최근 1년 논문 수, 구성원 구성, 모집 상태를 간결한 표로 비교합니다. 표 아래 AI 비교는 저장된 정보와 확인된 대표 연구를 기준으로 연구 방향의 차이만 짧게 정리하며, 로그인된 경우에만 Gemini를 보조적으로 호출합니다. AI 호출이 실패해도 기본 비교표는 유지됩니다.

## 개인정보 없는 ID 계정

사용자는 비밀번호·이메일·전화번호·개인 Gemini API key를 입력하지 않고 **고유 ID 하나**만 정합니다.

- 회원가입: ID가 없으면 생성하고, 이미 있으면 다른 ID를 선택합니다.
- 로그인: 회원가입된 ID가 존재하면 로그인합니다.
- 로그아웃/브라우저 변경 후에도 ID만 다시 입력하여 계정을 사용할 수 있습니다.
- 계정 데이터는 ID와 즐겨찾기 정도로 제한하며 민감한 개인정보용 인증으로 사용하지 않습니다.
- 최근 사용 ID는 브라우저에 기억합니다.

Gemini는 Supabase Edge Function에서 운영자가 관리하는 `GEMINI_API_KEY` secret을 사용합니다. GitHub Pages에는 server key를 저장하지 않습니다.

## 가입자 registry

회원가입 시 `supabase/functions/account-registry`가 `data/account-registry.json`에 ID와 가입시각을 누적 기록하도록 구성할 수 있습니다. GitHub token은 Supabase Edge Function secret으로만 보관합니다. 이 registry는 공개 repository에 저장되는 정보이므로 개인정보가 아닌 공개 ID/시각만 기록합니다.

## 대표 상세 예시

`완성형 상세 예시`는 특정 교수를 하드코딩하지 않습니다. 검증된 최신 snapshot의 completeness score가 가장 높은 연구실을 자동 선택합니다.

## 인수인계/기획서

- `docs/handoff/README_FIRST.md`
- `docs/handoff/CURRENT_STATE.md`
- `docs/handoff/DATA_SOURCES.md`
- `docs/handoff/AUTOMATION_SPEC.md`
- `docs/handoff/DEBUGGING_HISTORY.md`
- `docs/handoff/USER_REQUIREMENTS.md`
- `docs/handoff/URL_REGISTRY.md`
- `docs/handoff/PROJECT_HANDOFF_COMPLETE.md`
- `docs/handoff/FEATURE_STATUS.md`
- `docs/handoff/ARCHIVE_MANIFEST.md`
- `docs/handoff/TEAM_COLLABORATION.md`
- `docs/proposal/SNU_Lab_Navigator_생성형_AI_활용_기획서_v17.docx`

## 검사

```bash
python tools/test_static.py
python tools/test_automation_features.py
node --check dist/app.js
node --check dist/showcase-data.js
node --check dist/favorites-compare-fixed.js
node --check dist/account.js
node --check dist/account-ai-bridge.js
python -m py_compile tools/automated_enrichment_v2.py tools/collector_entry.py tools/roster_sync.py tools/full_refresh_entry.py
```
