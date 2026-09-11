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
- 상세 수집은 HTML뿐 아니라 이미지/PDF 자산, 관련 하위 페이지, Gemini URL Context와 hard-case Search grounding을 사용한다.
- 논문·모집·구성원·포스터는 후보와 검증 결과를 분리한다. 학과 뉴스/일반 입학/타 교수 성과/로고 등은 canonical activity로 승격하지 않는다.
- 구성원은 current members와 Alumni를 분리하고, 공식 역할이 명시된 경우 박사과정·석사과정·박사후연구원·학부연구생·연구원 등으로 구분한다. 역할이 불명확하면 임의로 추정하지 않는다.
- 포스터는 `verified / unverified_candidate / none_detected / inaccessible`로 구분하며 verified만 공개한다.
- 자동 수집으로 생성된 `research_summary`, `research_topics`, `recommendation_keywords`, `recent_papers`는 이후 검색·추천·비교에서 재사용한다.
- 대표 상세 예시는 특정 교수명을 하드코딩하지 않고 최신 정상 snapshot에서 completeness가 가장 높은 unit을 자동 선택한다.
- 관심 연구실은 즐겨찾기로 저장하고, 최대 4개 연구실을 비교할 수 있다. 비교는 저장된 요약·keyword·최근 1년 논문 수·구성원·모집 정보를 우선 사용하고 AI는 핵심 차이만 보조한다.
- 사용자 계정은 **개인정보·비밀번호 없이 고유 ID만 사용하는 단순 계정 모델**이다. 회원가입 시 고유 ID가 `lab_accounts`에 등록되고, 로그인 시 동일 ID가 존재하면 현재 계정으로 사용한다. ID를 알면 접근할 수 있으므로 민감한 개인정보용 인증이 아니다.
- 가입자 ID/가입시각은 선택적으로 `data/account-registry.json`에 기록한다. GitHub 토큰은 Supabase Edge Function secret으로만 보관한다.
- 서버 Gemini는 사용자 키를 저장하지 않고 운영자가 관리하는 `GEMINI_API_KEY` secret으로 호출한다.
- GitHub Pages에는 service-role key, GitHub token, Gemini secret을 넣지 않는다.
