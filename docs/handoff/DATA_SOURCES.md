# 데이터 소스와 URL 생성 경로

## 교수 명단
현재 앱의 교수×소속 데이터는 `dist/data.js`/`dist/data/units-*.js`와 `dist/roster-supplements.js`에 저장되어 있다. 과거 roster 수집·정합 단계에서 서울대학교 공식 학과·단과대·연구소 등 명단의 합집합을 구성하고, `tools/export_research_units.py`로 앱용 데이터로 내보냈다.

교수는 학과와 단과대 양쪽에 동시에 존재해야 하는 교집합 기준이 아니다. 서울대 공식 출처 한 곳에서 현재 재직이 확인되면 포함한다. 공식 퇴직/명예/전임 종료가 명시될 때만 현재 목록에서 제외한다.

## unit URL 필드
- `profile`: 서울대학교/공식 기관 교수 소개
- `homepage`: 교수 또는 연구실 공식 홈페이지
- `departmentUrl`: 서울대학교 학과/기관 공식 페이지

자동 상세 수집은 위 URL을 root로 사용하고, 같은 공식/연구실 호스트의 관련 하위 페이지를 추가한다.

## 허용 출처
기본 factual source는 `snu.ac.kr`/하위 도메인, `snu.elsevierpure.com`, 그리고 unit에 이미 공급된 연구실 host이다. 공식 부모 페이지에서 직접 임베드된 CDN 이미지/PDF는 자산 후보로 보존할 수 있으나 공개 사실로 승격할 때는 부모 출처와 귀속을 함께 검증한다.

## 연구성과
SNU Research와 공식 연구실 publication 페이지를 우선한다. 화면의 확인 논문 수는 자동 수집에서 실제 제목이 확인된 항목이며 전체 경력 논문 수와 분리한다.

v31 활동 데이터는 3,189개 monitored pages / 6,838 candidates / 483 fetch-parse issues를 기록했다. 후보에는 논문 규정 페이지와 일반 행사 이미지가 섞였으므로 candidate와 verified를 분리해야 한다.

## 구성원/모집
구성원은 이름과 role이 명시된 member/people/student 페이지를 우선한다. 동문은 alumni로 명시된 경우만, 모집은 현재 진행 근거가 있을 때만 반영한다.

## 포스터
기존 collector에는 이미지/PDF 자체 분석이 없어 실제 포스터를 자동 확인하기 어려웠다. 또한 conference/seminar/gallery 같은 키워드가 일반 행사까지 후보로 만들었다.

현재 정책:
- `verified`: 공식 페이지 또는 포스터 자체에서 연구실 귀속 확인
- `unverified_candidate`: 이미지/PDF 후보는 있으나 귀속 미확인
- `none_detected`: 후보 미발견
- `inaccessible`: 접근 실패 등으로 판정 불가

## Gemini
자동 수집은 GitHub Actions `GEMINI_API_KEY` secret을 사용한다. 변경된 URL/어려운 URL은 Gemini URL Context로 실제 페이지·PDF·이미지 내용을 구조화한다. 정적 결과가 너무 빈약할 때만 Google Search grounding으로 공식 상세 URL을 추가 발견한 뒤 source allowlist를 다시 적용한다.

공식 URL Context 문서: https://ai.google.dev/gemini-api/docs/url-context
