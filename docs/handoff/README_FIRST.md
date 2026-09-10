# 먼저 읽기

기준일: 2026-09-11
저장소: https://github.com/leehojun0303/snu-lab-navigator

새 채팅에서는 이 파일과 `CURRENT_STATE.md`, `DATA_SOURCES.md`, `AUTOMATION_SPEC.md`, `DEBUGGING_HISTORY.md`, `USER_REQUIREMENTS.md`, `URL_REGISTRY.md`, `PROJECT_HANDOFF_COMPLETE.md`를 먼저 읽는다.

핵심 결론:
- 2,170은 공식 연구실 총계가 아니라 교수×소속 단위이다. 고유 교수명은 2,001명이다.
- 기존 활동 수집기는 텍스트/링크 중심이라 실제 홈페이지에 있는 구성원·논문·포스터를 자주 놓쳤다.
- 특히 기존 포스터 pipeline은 이미지/PDF 자산 자체를 분석하지 않아 자동 verified poster가 나올 구조가 없었다.
- 이번 버전은 이미지/PDF 자산 발견, 제한적 relevance crawl, Gemini URL Context, hard-case Search grounding, 포스터 상태 분리, 자동 대표 예시 선택을 추가한다.
- 포스터는 `verified / unverified_candidate / none_detected / inaccessible`로 구분하며 verified만 공개 이미지로 표시한다.
- 대표 상세 예시는 송재준 교수 고정이 아니라 자동 수집 결과 중 완성도 점수 최고 레코드를 선택한다.
- 대형 원본 ZIP/XLSX 전체는 저장소에 복제하지 않고, 새 채팅 재개에 필요한 코드·규칙·상태·생성 경로를 문서화한다.
