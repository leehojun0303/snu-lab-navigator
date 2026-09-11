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

매일 자동화가 시작되면 `tools/roster_sync.py`가 현재 데이터에 연결된 서울대학교 공식 학과·단과대 등 roster URL을 **합집합(UNION)** 으로 검사합니다.

중요한 원칙은 다음과 같습니다.

- 학과에 있거나 단과대/대학원/기타 공식 서울대 roster에 있으면 포함할 수 있습니다.
- 여러 roster에 모두 있어야 하는 교집합 조건을 사용하지 않습니다.
- 한 공식 페이지에서 사라졌다는 이유만으로 교수를 삭제하지 않습니다.
- 공식 교수 profile이 여전히 유효하면 다른 roster에서 누락되어도 유지합니다.
- 공식적으로 퇴직·명예·전임 종료가 확인되거나, 관련된 모든 성공적 공식 roster에서 두 번 연속 확인되지 않을 때만 보수적으로 제거합니다.
- 신규 교수는 공식 roster에서 발견되면 새 교수×소속 unit으로 자동 추가하고 이후 상세 수집 대상으로 넘깁니다.

따라서 특정 단과대 목록에 없다는 이유로 교수를 제거하지 않습니다.

## 자동 수집

`.github/workflows/collect.yml`이 매일 03:00 KST에 incremental collection을 시작합니다. roster union sync를 먼저 수행하고, 이어서 최대 285분 동안 batch size 40으로 상세 수집을 이어갑니다. `data/automation-state.json`의 cursor에서 계속 진행하며 한 바퀴를 끝내면 일찍 종료합니다. 수집 중에도 앱은 마지막 성공 snapshot을 제공합니다.

현재 상세 collector는 `tools/collector_entry.py` → `tools/automated_enrichment_v2.py` 구조입니다.

수집 순서:

1. `homepage`, `profile`, `departmentUrl`에서 시작
2. 동일 공식/연구실 host의 관련 하위 링크를 relevance-ranked crawl
3. publication/member/recruitment 링크와 이미지/PDF 자산을 함께 탐색
4. poster 단서는 이미지/PDF 자산까지 별도로 탐색
5. 실제 공식 URL을 Gemini URL Context로 전달해 연구분야·논문·구성원·모집·포스터를 구조화
6. hard case는 Search grounding으로 공식 세부 URL을 추가 발견한 뒤 다시 source allowlist 검증
7. source URL과 fingerprint를 함께 저장
8. `poster_status`를 `verified / unverified_candidate / none_detected / inaccessible`로 구분
9. 현재 snapshot 중 가장 완성도가 높은 unit을 대표 상세 예시로 자동 선정

## 정보 검증 원칙

관련 있어 보인다는 이유만으로 링크를 공개 데이터로 승격하지 않습니다.

### 논문
해당 교수/연구실의 직접 publication 페이지 또는 교수/연구실 귀속이 명시된 논문만 승인합니다. 학과 뉴스, 서울대 전체 연구성과, 다른 교수의 수상 기사, 일반 학술행사는 논문 목록에서 제외합니다.

### 모집
해당 연구실/교수의 현재 연구생·대학원생·인턴 등 모집만 승인합니다. 서울대 전체 입학, 학과 일반 대학원 모집, 학생지원센터, 장학·기숙사·행정 페이지는 제외합니다.

### 구성원
이름과 역할이 명시된 공식 member/people 페이지를 기준으로 현재 구성원과 Alumni를 분리하고, 박사·석사·학부연구생·기타 역할로 구분합니다.

### 포스터
교수 사진·로고·SNS 공유 아이콘·일반 홈페이지 이미지는 포스터로 취급하지 않습니다. 실제 연구 포스터이고 연구실 귀속이 확인된 경우에만 `verified` 포스터를 공개합니다.

## 저장된 AI 정보 재사용

자동 수집에서 생성된 `research_summary`, `research_topics`, `recommendation_keywords`와 최근 논문 metadata는 공개 데이터에 저장되어 이후 검색·추천·비교에서 재사용할 수 있도록 설계되어 있습니다. 상세 페이지를 열 때마다 동일한 분석을 다시 실행하지 않습니다.

## 즐겨찾기와 연구실 비교

앱에서 관심 연구실을 즐겨찾기로 저장할 수 있고, 최대 4개까지 선택해 핵심 분야·저장된 keyword·최근 논문 연도 흐름·구성원 규모·모집 상태를 간결하게 비교할 수 있습니다. AI 비교도 저장된 정보를 우선 입력으로 사용하며 결과는 짧은 표/문구 중심으로 출력합니다.

현재 즐겨찾기 데이터는 브라우저 로컬 저장소 기반입니다.

## Gemini

자동 수집의 서버 분석은 GitHub Actions의 `GEMINI_API_KEY` secret을 사용합니다. 앱에서 사용자가 직접 Gemini를 연결할 수도 있으며 현재 앱의 직접 연결 키는 브라우저 세션에만 보관됩니다.

현재 공개 GitHub Pages는 정적 호스팅이므로, **아이디·비밀번호 기반의 서버 계정과 계정 간 Gemini 키 동기화**는 별도의 인증/백엔드가 필요합니다. 그 기능은 보안상 GitHub Pages의 평문 저장 방식으로 구현하지 않습니다.

## 대표 상세 예시

`완성형 상세 예시`는 특정 교수를 하드코딩하지 않습니다. collector가 연구실명, 연구분야, 검증된 논문, 구성원, 모집, 포스터, 공식 페이지 교차 확인을 점수화하여 현재 snapshot에서 가장 완성도가 높은 레코드를 자동 선택합니다.

## 인수인계/기획서

- `docs/handoff/README_FIRST.md`
- `docs/handoff/CURRENT_STATE.md`
- `docs/handoff/DATA_SOURCES.md`
- `docs/handoff/AUTOMATION_SPEC.md`
- `docs/handoff/DEBUGGING_HISTORY.md`
- `docs/handoff/USER_REQUIREMENTS.md`
- `docs/handoff/URL_REGISTRY.md`
- `docs/handoff/PROJECT_HANDOFF_COMPLETE.md`
- `docs/handoff/ARCHIVE_MANIFEST.md`
- `docs/proposal/SNU_Lab_Navigator_생성형_AI_활용_기획서_v17.docx`

## 로컬 검사

```bash
python tools/test_static.py
python tools/test_automation_features.py
node --check dist/app.js
node --check dist/showcase-data.js
node --check dist/favorites-compare.js
python -m py_compile tools/automated_enrichment_v2.py tools/collector_entry.py tools/roster_sync.py
```

자동 수집기는 Python 표준 라이브러리만 사용합니다.
