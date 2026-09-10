# 자동 수집 사양

## 실행
`.github/workflows/collect.yml`이 매일 03:00 KST 실행. schedule은 285분 budget, batch 40, 최대 Gemini 400회. cursor 기반 incremental. push smoke는 12 units.

## 수집
1. `homepage/profile/departmentUrl` root
2. 동일 공식/연구실 출처의 relevance-ranked crawl
3. publication/member/recruitment 링크 탐색
4. `<img>/<source>`에서 이미지/PDF 자산 탐색
5. poster는 명시적 poster evidence 또는 이미지/PDF 자산만 후보화
6. Gemini URL Context로 실제 URL 내용을 구조화
7. 결과가 빈약한 hard case에서만 Google Search grounding으로 공식 세부 URL 추가 발견
8. allowlist 재검증
9. source fingerprint/model/timestamp 저장
10. poster verified만 공개 이미지로 승격
11. 가장 완성도 높은 레코드를 showcase로 자동 선정

## 중요 검증 규칙
- 한 `<a>`가 존재한다고 논문/포스터로 확정하지 않는다.
- conference/seminar/gallery는 그 자체로 포스터가 아니다.
- 논문 title은 실제 확인된 제목만 저장.
- current member는 이름+role 명시가 필요.
- current recruitment만 현재 모집으로 저장.
- 애매하면 review/미확인 상태를 유지.
- 2,170을 연구실 수로 표현하지 않는다.

## 포스터
verified / unverified_candidate / none_detected / inaccessible 4단계. verified가 아니면 poster image/title/date/event 필드는 비운다.

## 저장
`data/automation-state.json`에 cursor와 record를 저장하고 `dist/automation-data.js`로 공개 snapshot을 생성한다. 상세 화면은 snapshot을 먼저 사용한다.
