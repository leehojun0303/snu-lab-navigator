# URL Registry

전체 URL 원본은 이전 인수인계 `inventory/url_registry.csv`에 47,251개 고유 URL로 정리되어 있었다. GitHub에는 대용량 원본 전체 대신 운영상 필요한 경로와 생성 규칙을 문서화한다.

## 자동 수집 root
각 교수×소속 unit의 `profile`, `homepage`, `departmentUrl`을 사용한다. 이후 동일 공식/연구실 host의 publication/member/recruitment/poster 관련 하위 링크를 자동 발견한다.

## 허용 factual source
- `snu.ac.kr` 및 하위 도메인
- `snu.elsevierpure.com`
- 해당 unit에 이미 공급된 연구실 host

## 대표 기준 URL
- 앱: https://snu-lab-navigator.snu-chatgpt-5678.chatgpt.site
- GitHub: https://github.com/leehojun0303/snu-lab-navigator
- SNU Research: https://snu.elsevierpure.com/
- Google AI Studio: https://aistudio.google.com/app/apikey
- Gemini URL Context docs: https://ai.google.dev/gemini-api/docs/url-context

## 과거 대표 예시의 공식 URL
송재준 사례는 한때 showcase로 고정했지만 현재 대표 예시 선정은 자동화되므로 특정 교수 예시로 취급하지 않는다.
- 연구실 소개: https://ere.snu.ac.kr/sub3_1_d.php
- 교수 소개: https://ere.snu.ac.kr/bbs/board.php?bo_table=sub2_1&wr_id=12
- SNU Research: https://snu.elsevierpure.com/en/persons/jae-joon-song/
