# 현재 상태

기준일: 2026-09-11
GitHub: https://github.com/leehojun0303/snu-lab-navigator
기존 공개 프로토타입: https://snu-lab-navigator.snu-chatgpt-5678.chatgpt.site

## 데이터
- 2,001명 고유 교수명
- 2,170개 교수×소속 단위
- 1,643개 연구 주제 정보 보유
- 797개 공식 사진 연결
- 334개 교수 단위 활동 출처 연결

2,170개는 서울대학교 공식 연구실 총계가 아니다.

## 자동화
`.github/workflows/collect.yml`이 03:00 KST부터 incremental collection을 수행한다. 예약 실행은 최대 285분, batch 40, 최대 Gemini 분석 400건이다. `data/automation-state.json`의 cursor로 이어서 실행하므로 야간 window 동안 가능한 만큼 진행하고 한 바퀴를 끝내면 종료한다. 수집 중에는 기존 snapshot을 공개한다.

현재 workflow가 사용하는 수집기는 `tools/automated_enrichment_v2.py`이다.

## v2 변경
정적 HTML → relevance-ranked 동일 출처 crawl → `<img>/<source>` 이미지/PDF 자산 발견 → publication/member/recruitment/poster 분류 → Gemini URL Context 구조화 → 빈약한 hard case에서만 Google Search grounding으로 공식 URL 추가 발견 → JSON 검증 → snapshot 저장.

기존 코드는 텍스트와 `<a>` 중심이었고 이미지/PDF 자체를 읽지 않았으며 poster status도 사실상 항상 미확인이었다. 그래서 실제 포스터가 있는 연구실도 자동 표시할 수 없었다.

## 포스터 상태
`verified`만 실제 포스터 이미지로 공개한다. `unverified_candidate`는 후보만 찾았지만 연구실 귀속 미확인, `none_detected`는 후보 자체 미확인, `inaccessible`은 접근 실패 등으로 판정 불가이다. 어느 상태도 근거 없이 0/없음으로 단정하지 않는다.

## 대표 상세
`dist/showcase-data.js`는 자동 snapshot의 `AUTOMATION_META.showcase_unit_id`를 사용한다. 대표 예시는 공식 연구실명·연구분야·주제·논문·구성원·모집·검증 포스터·공식 페이지 수를 조합해 자동 선정한다. 특정 교수 하나를 대표로 하드코딩하지 않는다.

## 앱
기존 `dist/app.js`는 저장된 AI 분석을 우선하고 상세 open마다 Gemini를 호출하지 않는다. 사용자 추천은 사용자가 입력한 Gemini API key를 sessionStorage에만 보관한다.

## 현재 확인된 한계
전수 상세 완성은 아직 아니다. JS-only 사이트, 이미지 속 정보, PDF, 동적 메뉴 등은 누락 가능성이 있다. 따라서 “수집 실패”와 “사이트에 정보 없음”을 구분해야 한다.
