# 디버깅/교훈 기록

- v28: 검증 연구실 수를 전체 연구실 수로 표현하면 교수 기반 전체 범위와 불일치.
- v29: URL 이동/교수 변경 후보 확장.
- v30: 170개 단위에서 교수×소속을 확장. 장시간 정체 경험으로 checkpoint 필요.
- v31: 3,189 pages / 6,838 candidates / 483 fetch-parse issues. 단순 키워드 분류로 논문 규정/일반 행사 false positive 발생.
- v32: Jupyter `asyncio.run()` running event loop 오류.
- v32.1: Playwright Chromium `libatk-1.0.so.0` 오류. static HTTP 우선 원칙.
- v32.2~v32.5: missing candidate 수 감소 자체는 정확성 증거가 아님.
- v33: 교수 포함은 학과∩단과대가 아니라 공식 명단 합집합.
- v34: 존재하지 않는 입력파일명 가정으로 FileNotFoundError.
- v35~v38: 공식 roster 범위를 넓히자 후보 수가 늘었지만 page/card 인명 오검출 검증 필요.
- 앱 v2~v15: initials, per-open AI 호출, 빈 activity, 내부 분류명 노출 등을 수정.
- 앱 v16: 첫 진입 key, 저장형 AI 상세, 안정적인 사진 표시, Song Jaejoon 고정 showcase.

## 이번 검토의 원인
기존 activity collector는 텍스트와 `<a>` 중심이며 이미지/PDF 자산 자체를 읽지 않았다. poster status도 사실상 항상 미확인으로 저장했다. 그래서 실제 홈페이지에 poster가 있어도 자동 표시 경로가 없었다. 또한 publication/member/recruitment/poster 링크를 소수만 추가로 따라가 실제 하위 페이지가 누락될 수 있었다.

## 재발 방지
자산 자체 수집 → 후보/검증 분리 → URL Context로 실제 자원 분석 → source allowlist 재검증 → verified만 공개 → fingerprint 캐시 → 대표 예시는 자동 score 선택 순서로 유지한다.

- 2026-09-11: 앱에서 Gemini 401이 표시될 경우, 검색어 처리 실패가 아니라 배포된 Edge Function의 JWT gate 또는 Gemini API secret 배포 상태가 최신 소스와 불일치한 문제로 분리한다. UI는 일반 검색과 AI 유사 검색을 분리하고, AI는 Enter/명시 버튼에서만 호출한다.
