# PROJECT HANDOFF COMPLETE

기준일: 2026-09-11

## 목표
서울대학교 공식 자료를 기반으로 교수·연구실을 자연어로 탐색하고, Gemini가 연구 적합도와 근거를 설명하는 공개 프로토타입.

## 현재
2,001 고유 교수명 / 2,170 교수×소속 단위 / 1,643 연구 주제 / 797 공식 사진 / 334 활동 출처.

## 데이터 흐름
공식 roster 합집합 → `dist/data.js`/`dist/data/units-*.js` → `tools/automated_enrichment_v2.py` → `data/automation-state.json` + `dist/automation-data.js` → GitHub Pages.

## 자동 수집 v2
정적 HTML → relevance crawl → 이미지/PDF 자산 발견 → publication/member/recruitment/poster 후보 → Gemini URL Context 구조화 → hard case에서 Search grounding으로 공식 URL 발견 → source allowlist 재검증 → snapshot.

기존 v31에는 3,189 pages / 6,838 candidates / 483 issues가 있었고, 규정 페이지·일반 행사 이미지가 섞였다. 따라서 후보와 verified를 분리한다.

## 포스터
`verified`만 공개. `unverified_candidate`는 후보만 확인, `none_detected`는 후보 미발견, `inaccessible`은 판정 불가. 포스터가 없는데 억지로 만들지 않는다.

## 대표 예시
자동 수집된 레코드 중 공식 연구실명, 연구분야, 주제, 논문, 구성원, 모집, 검증 포스터, 교차확인 페이지가 가장 충실한 단위를 자동 선택. 송재준 교수 고정 로직은 대표 정책에서 제거한다.

## 문서
`README_FIRST.md`, `CURRENT_STATE.md`, `DATA_SOURCES.md`, `AUTOMATION_SPEC.md`, `DEBUGGING_HISTORY.md`, `USER_REQUIREMENTS.md`, `URL_REGISTRY.md`를 순서대로 참조한다.

## 제출 기획서
`docs/proposal/SNU_Lab_Navigator_생성형_AI_활용_기획서_v17.docx`는 Word 편집본이다.
