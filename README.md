# SNU Lab Navigator

## 공개 앱

**https://leehojun0303.github.io/snu-lab-navigator/**

서울대학교 공식 페이지를 기반으로 교수·연구실을 통합 탐색하고, 저장된 AI 분석을 이용해 관심 분야 검색·추천·비교를 지원하는 공개 프로토타입입니다.

## 현재 데이터 범위

- 2,001명 고유 교수명
- 2,170개 교수×소속 단위
- 자동 상세 수집·검증 snapshot 제공

`교수×소속 단위`는 서울대학교의 공식 연구실 수가 아니라 교수와 확인된 소속의 조합입니다. 교수·소속 수는 공식 roster 동기화 결과에 따라 갱신될 수 있습니다.

## 교수 명단 자동 동기화

`tools/roster_sync.py`는 연결된 서울대학교 공식 학과·단과대·대학원 등의 roster URL을 합집합(UNION)으로 확인합니다.

- 공식 roster 또는 유효한 공식 교수 profile을 근거로 재직·소속을 보수적으로 확인합니다.
- 한 공식 페이지에서 사라졌다는 이유만으로 즉시 삭제하지 않습니다.
- 신규 교수는 공식 roster에서 확인되면 교수×소속 unit으로 추가합니다.
- 동명이인 검색 결과만으로 복수 소속을 추가하지 않고, 공식 소속 근거를 우선합니다.

## 정규 자동 수집

`.github/workflows/collect.yml`은 **매일 02:00 KST에 한 번 시작**합니다. 정기 실행은 상세 수집에 최대 350분을 사용하고, job 종료 전 결과 저장을 위한 여유를 둡니다. 전체 대상 순회를 먼저 마치면 조기 종료할 수 있으며, 제한 시간 내 끝나지 않으면 `data/automation-state.json`의 cursor/state를 저장하고 다음 실행에서 이어갑니다. 수집 중에도 마지막 저장 snapshot으로 공개 앱은 계속 사용할 수 있습니다.

현재 상세 collector는 `tools/collector_entry.py` → `tools/automated_enrichment_v2.py` 구조입니다.

수집 흐름:

1. 공식 `homepage`, `profile`, `departmentUrl`에서 시작
2. 관련 공식 하위 페이지를 탐색해 연구·논문·구성원·모집·활동 후보 수집
3. 필요한 경우 이미지/PDF 자산과 세부 URL 탐색
4. 공식 URL을 근거로 Gemini가 연구분야·논문 요약·구성원·모집 및 계열별 활동을 구조화
5. source allowlist와 품질 규칙으로 결과 검증
6. source URL, fingerprint, 진행 cursor와 결과 snapshot 저장

Gemini가 일시적으로 사용량 제한에 도달하더라도 저장된 진행상황을 보존하며 이후 정기 실행에서 계속 처리할 수 있도록 구성합니다.

## 분야별 상세정보

모든 분야를 논문 중심의 동일한 화면으로 처리하지 않습니다.

- 일반 연구계열: 최근 논문·요약, 연구실 구성, 모집 등
- 인문대학: 논문, 저서·편저, 연구과제·학술발표
- 미술대학: 개인전·단체전, 전공·교육 활동
- 음악대학: 공연·발표, 작품·창작 활동, 전공·교육 활동

전체 순회 후 공식 페이지와의 표본 대조를 통해 분야별 수집 품질을 검증하고, 반복적으로 확인되는 사이트 구조의 누락만 최소 범위에서 보완합니다.

## 전체 순회 후 단과대별 품질검사 계획

`2170/2170` 완료는 모든 사이트에서 모든 세부 항목이 완벽히 추출되었다는 의미가 아니므로, 전체 순회 후 다음 절차로 품질을 확인합니다.

1. 각 단과대에서 홈페이지 구조가 다른 학과를 포함해 대표 교수 2~3명을 표본 선정합니다.
2. 앱 결과와 실제 공식 페이지를 항목별로 대조합니다. 일반 연구계열은 연구분야·논문/요약·구성원·모집, 인문대는 저서·학술활동, 미대는 개인전·단체전, 음대는 공연·창작활동을 중점 확인합니다.
3. 결과를 `정상 / 공식 정보 존재하지만 미수집 / 잘못 수집 / 공식 출처 자체에 없음`으로 구분합니다.
4. 같은 분야·사이트 구조에서 반복되는 누락만 보완 대상으로 삼습니다.
5. 기존에 정상 동작하는 범용 collector는 유지하고, 필요한 분야/사이트에만 최소 adapter를 추가한 뒤 다시 표본 검증합니다.

추가 점검 우선순위는 **인문대·미대·음대의 깊은 페이지 구조와 포스터 탐색 정확도**입니다. 포스터는 교수 사진·로고·일반 이미지의 오탐을 막기 위해 실제 연구 포스터이고 연구실 귀속이 확인된 경우에만 공개합니다.

## 정보 검증 원칙

확인되지 않은 정보를 관련 있어 보인다는 이유만으로 공개 데이터로 승격하지 않습니다.

- **논문:** 해당 교수/연구실 귀속이 공식적으로 확인되는 논문을 우선합니다.
- **모집:** 해당 교수/연구실의 현재 연구생·대학원생·인턴 모집만 승인합니다.
- **구성원:** 공식 member/people 페이지에서 이름과 역할이 확인되는 경우를 기준으로 하며 역할을 임의 추정하지 않습니다.
- **포스터:** 교수 사진·로고·SNS 아이콘·일반 이미지는 제외하고 검증된 연구 포스터만 표시합니다.
- **소속:** 동명이인 검색 결과만으로 소속을 합치지 않고 공식 근거가 가장 확실한 소속을 우선합니다.

## 저장된 AI 정보와 검색·비교

자동 수집에서 생성된 연구 요약·주제·키워드, 최근 논문과 요약, 분야별 활동 정보는 snapshot에 저장하여 반복적인 Gemini 호출을 줄입니다. 일반 검색으로 직접 일치하는 결과를 찾기 어려울 때에는 저장된 서울대학교 교수·연구실 후보군 안에서 AI 유사 검색을 사용할 수 있습니다.

관심 교수·연구실은 즐겨찾기에 저장할 수 있고 여러 대상을 한 화면에서 비교할 수 있습니다. 비교표는 저장된 검증 정보를 우선 사용하므로 AI 추가 비교가 실패하더라도 기본 비교 데이터가 사라지지 않도록 구성합니다. 로그인 계정의 즐겨찾기는 Supabase에 저장합니다.

## 계정과 서버 AI

사용자는 비밀번호·이메일·전화번호·개인 Gemini API key 없이 고유 ID로 가입·로그인합니다. Gemini 호출은 Supabase Edge Function의 서버 측 proxy를 사용하며 운영자가 관리하는 API secret을 GitHub Pages 클라이언트에 노출하지 않습니다.

## 주요 파일

- `.github/workflows/collect.yml` — 정규 roster/상세 자동수집
- `tools/roster_sync.py` — 공식 교수 roster 동기화
- `tools/collector_entry.py`, `tools/automated_enrichment_v2.py` — 상세 수집·검증
- `data/automation-state.json` — 누적 수집 state/cursor
- `data/automation-progress.json` — 공개 진행상황
- `dist/automation-data.js` — 공개 상세 snapshot
- `dist/app.js` 및 UI 보완 스크립트 — 공개 앱 UI
- `docs/handoff/` — 인수인계 및 구현 이력

## 기본 검사

```bash
python tools/test_static.py
python tools/test_automation_features.py
node --check dist/app.js
node --check dist/favorites-compare-fixed.js
node --check dist/account.js
node --check dist/account-ai-bridge.js
python -m py_compile tools/automated_enrichment_v2.py tools/collector_entry.py tools/roster_sync.py
```
