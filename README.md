# SNU Lab Navigator

서울대학교 공식 페이지를 기반으로 교수·연구실을 탐색하고 Gemini로 관심 분야 적합도를 설명하는 공개 프로토타입입니다.

## 공개 앱

GitHub Pages 배포가 끝나면 `https://leehojun0303.github.io/snu-lab-navigator/`에서 열립니다. 앱 열람에는 ChatGPT 로그인이 필요하지 않습니다. 사용자가 입력한 Gemini API 키는 브라우저 탭의 `sessionStorage`에만 보관되며 자연어 추천에 사용됩니다.

## 자동 수집

`Refresh official SNU lab data` 워크플로가 매일 03:17(KST)에 전체 연구 단위를 80개씩 순환 점검합니다. 한 번에 전부 실행하지 않아 시간 초과와 대상 사이트 부하를 줄입니다.

1. 교수·연구실·학과 공식 URL을 방문합니다.
2. 논문·구성원·모집·포스터 후보 페이지를 공통 규칙으로 찾습니다.
3. 공식 URL 지문과 결과를 `data/automation-state.json`에 저장합니다.
4. Gemini 비밀값이 있으면 가져온 공식 본문만 근거로 요약합니다.
5. `dist/automation-data.js`가 갱신되면 공개 앱이 자동 재배포됩니다.

공식 페이지 내용의 SHA-256 지문이 이전 실행과 같으면 저장된 AI 분석을 재사용하므로 Gemini 토큰을 다시 소비하지 않습니다. 페이지가 바뀐 경우에만 새 요약을 생성합니다.

확인되지 않은 구성원, 논문 수, 모집 여부, 포스터는 추정하지 않습니다. 현재 데이터는 완전한 서울대학교 연구실 총계가 아니라 교수와 공식 소속의 조합입니다.

## Gemini 서버 키

자동 AI 요약을 사용하려면 저장소 `Settings → Secrets and variables → Actions → New repository secret`에서 이름을 `GEMINI_API_KEY`로 등록합니다. 키가 없어도 공식 페이지 탐색과 링크 변경 감지는 계속 실행됩니다.

## 로컬 검사

```bash
python tools/test_static.py
python tools/automated_enrichment.py --max-units 3
```

자동 수집기는 Python 표준 라이브러리만 사용하므로 별도 패키지 설치가 필요하지 않습니다.
