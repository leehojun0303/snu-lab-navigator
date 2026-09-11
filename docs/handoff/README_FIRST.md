# 먼저 읽기

기준일: 2026-09-11
저장소: https://github.com/leehojun0303/snu-lab-navigator
공개 앱: https://leehojun0303.github.io/snu-lab-navigator/

새 채팅에서는 이 파일과 `CURRENT_STATE.md`, `DATA_SOURCES.md`, `AUTOMATION_SPEC.md`, `DEBUGGING_HISTORY.md`, `USER_REQUIREMENTS.md`, `URL_REGISTRY.md`, `PROJECT_HANDOFF_COMPLETE.md`를 먼저 읽는다.

핵심 결론:
- 2,170은 공식 연구실 총계가 아니라 교수×소속 단위이다. 고유 교수명은 2,001명이다.
- 교수 current inclusion은 학과·단과대·대학원·연구소 등 추적되는 공식 서울대 roster의 **합집합(UNION)** 이다. 하나의 공식 출처에만 있어도 현재 재직 증거가 있으면 포함한다.
- 어느 한 단과대/학과에 없다는 이유만으로 삭제하지 않는다. 명시적인 퇴직/명예/전임 종료 또는 관련 모든 성공 roster에서 두 번 연속 부재일 때만 보수적으로 제거한다.
- `tools/roster_sync.py`가 신규 교수를 공식 roster에서 발견해 자동 추가하고, 이후 상세 수집 대상으로 넘긴다.
- 기존 활동 수집기는 텍스트/링크 중심이라 실제 홈페이지에 있는 구성원·논문·포스터를 자주 놓쳤다.
- 현재 버전은 이미지/PDF 자산 발견, 제한적 relevance crawl, Gemini URL Context, hard-case Search grounding, 포스터 상태 분리, 자동 대표 예시 선택, publication/recruitment/member quality gate를 사용한다.
- 포스터는 `verified / unverified_candidate / none_detected / inaccessible`로 구분하며 verified만 공개 이미지로 표시한다.
- 논문·모집은 관련 키워드 링크를 그대로 공개하지 않고, 해당 교수/연구실 귀속 여부를 AI 검증한 canonical field만 공개한다.
- 구성원은 current members와 Alumni를 분리하고 박사·석사·학부연구생 등 role을 기준으로 정리한다.
- 자동 수집으로 생성된 `research_summary`, `research_topics`, `recommendation_keywords`, `recent_papers`는 이후 검색·추천·비교에서 재사용한다.
- `dist/favorites-compare.js`는 즐겨찾기와 최대 4개 연구실의 간결 비교를 제공한다.
- 대표 상세 예시는 송재준 교수 고정이 아니라 최신 자동 snapshot에서 가장 완성도가 높은 레코드를 선택한다.
- 아이디/비밀번호 계정과 계정 단위 Gemini key 동기화는 GitHub Pages 정적 호스팅만으로 안전하게 제공할 수 없으므로 별도 인증/DB backend가 필요하다. 현재 공개 앱은 사용자의 Gemini key를 sessionStorage에 보관하며, 즐겨찾기는 브라우저 로컬 저장이다.
- 대형 원본 ZIP/XLSX 전체는 저장소에 복제하지 않고, 새 채팅 재개에 필요한 코드·규칙·상태·생성 경로를 문서화한다.
