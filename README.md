# SNU Lab Navigator

## 🚀 공개 앱

**https://leehojun0303.github.io/snu-lab-navigator/**

서울대학교 공식 페이지를 기반으로 교수·연구실을 탐색하고 Gemini로 관심 분야 적합도를 설명하는 공개 프로토타입입니다.

## 현재 범위

- 2,001명 고유 교수명
- 2,170개 교수×소속 단위
- 1,643개 연구 주제 보유
- 797개 공식 사진 연결
- 334개 교수 단위 활동 출처 연결

2,170개는 서울대학교 공식 연구실 수가 아니라 교수와 소속의 조합입니다.

## 자동 수집

`.github/workflows/collect.yml`이 매일 03:00 KST에 incremental collection을 시작합니다. schedule 실행은 최대 285분까지 이어받으며 batch size 40, 최대 Gemini 분석 400건입니다. `data/automation-state.json`의 cursor에서 이어가므로 야간 window 동안 가능한 만큼 계속 진행하고, 한 바퀴를 다 돌면 일찍 종료합니다. 수집 중에도 공개 앱은 마지막 성공 snapshot을 계속 제공합니다.

현재 workflow는 `tools/collector_entry.py`를 통해 `tools/automated_enrichment_v2.py`를 실행합니다. entrypoint는 현재 공개 데이터가 `dist/data/units-*.js`로 분할되어 있는 경우에도 전체 교수·소속 데이터를 정상적으로 읽도록 호환 로더를 제공합니다.

수집 순서는 다음과 같습니다.

1. 교수·소속 레코드의 `homepage`, `profile`, `departmentUrl`에서 시작
2. 동일 공식/연구실 출처의 관련 하위 링크를 relevance-ranked crawl
3. publication/member/recruitment 링크와 이미지/PDF 자산을 함께 탐색
4. poster 단서는 명시적 poster 증거와 이미지/PDF 자산을 우선 탐색
5. 변경된 자원을 Gemini URL Context에 실제 URL로 전달해 HTML/PDF/이미지 내용을 구조화
6. 정적 수집 결과가 너무 빈약한 hard case에서만 Google Search grounding으로 공식 세부 URL을 추가 발견
7. source URL, fingerprint, model과 함께 검증된 결과를 저장
8. `poster_status`를 `verified / unverified_candidate / none_detected / inaccessible`로 구분
9. 자동 수집 레코드 중 가장 완성도가 높은 단위를 대표 상세 예시로 자동 선정

### 왜 이전 버전에서 포스터가 거의 안 보였나

기존 collector는 텍스트와 `<a>` 중심이었고 이미지/PDF 자산 자체를 분석하는 경로가 없었습니다. 또한 `poster`라는 단어를 포함하는 링크를 후보로 잡는 방식이라 일반 행사/세미나와 연구 포스터가 섞였습니다. 따라서 “포스터가 실제로 없음”과 “코드가 포스터를 못 읽음”이 함께 존재했습니다.

현재 collector는 이미지/PDF 자산을 별도로 발견하고 실제 URL을 Gemini URL Context에 제공해 내용과 귀속을 검토합니다. 다만 연구실 귀속이 명확히 확인되지 않은 포스터는 공개 화면에 verified 포스터로 표시하지 않습니다.

## Gemini fallback

정적 수집이 잘 되지 않는 연구실은 root URL을 Gemini에 직접 제공할 수 있습니다. URL Context로 실제 페이지를 읽고, Search grounding이 추가로 찾은 URL도 공식 출처 allowlist를 재검증합니다.

## Gemini 서버 키

자동 AI 구조화를 사용하려면 저장소 `Settings → Secrets and variables → Actions → New repository secret`에 `GEMINI_API_KEY`를 등록합니다. 키가 없어도 공식 링크 수집과 변경 감지는 계속 실행됩니다.

## 대표 상세 예시

`완성형 상세 예시`는 특정 교수를 하드코딩하지 않습니다. collector가 연구실명, 연구분야, 논문, 구성원, 모집, 포스터, 공식 페이지 교차 확인 정도를 점수화하여 현재 snapshot에서 가장 완성도가 높은 레코드를 자동 선택합니다.

## 인수인계/기획서

- `docs/handoff/README_FIRST.md`
- `docs/handoff/CURRENT_STATE.md`
- `docs/handoff/DATA_SOURCES.md`
- `docs/handoff/AUTOMATION_SPEC.md`
- `docs/handoff/DEBUGGING_HISTORY.md`
- `docs/handoff/USER_REQUIREMENTS.md`
- `docs/handoff/PROJECT_HANDOFF_COMPLETE.md`
- `docs/handoff/ARCHIVE_MANIFEST.md`
- `docs/proposal/SNU_Lab_Navigator_생성형_AI_활용_기획서_v17.docx`

## 로컬 검사

```bash
python tools/test_static.py
python tools/test_automation_features.py
node --check dist/app.js
node --check dist/showcase-data.js
python -m py_compile tools/automated_enrichment_v2.py tools/collector_entry.py
```

자동 수집기는 Python 표준 라이브러리만 사용합니다.
