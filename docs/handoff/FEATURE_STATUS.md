# 기능 구현 상태

기준일: 2026-09-11

| 기능 | 코드 반영 | 실제 사용 조건 |
|---|---|---|
| 공식 roster 합집합 자동 동기화 | 완료 | 매일 collector 실행 시 동작 |
| 신규 교수 자동 추가 | 완료 | 공식 roster source에 신규 교수가 노출되어야 함 |
| 퇴직 교수 보수적 자동 제거 | 완료 | 명시적 종료 또는 2회 연속 전체 공식 source 미확인 |
| 상세 HTML/이미지/PDF 수집 | 완료 | 접근 가능한 공식 페이지 기준 |
| 논문 AI 검증 | 완료 | 자동 수집 Gemini secret 필요 |
| 모집 AI 검증 | 완료 | 자동 수집 Gemini secret 필요 |
| 구성원/Alumni 분류 | 완료 | 공식 member/people 정보가 존재해야 함 |
| 포스터 candidate/verified 분리 | 완료 | verified만 공개 |
| 저장 AI summary/topic/keyword 재사용 | 완료 | 자동 수집 snapshot에 데이터가 있어야 함 |
| 대표 상세 자동 선정 | 완료 | 최신 snapshot의 completeness score 사용 |
| 즐겨찾기 | 완료 | 로그인 전 브라우저 로컬, 로그인 후 계정 동기화 가능 |
| 2~4개 연구실 비교 | 완료 | 비교 대상 데이터가 존재해야 함 |
| 최근 논문 trend 요약 | 완료 | 저장 논문의 연도 metadata가 존재해야 함 |
| AI 비교 문장 | 완료 | 계정 Gemini key 또는 직접 연결 key가 필요 |
| ID/비밀번호 회원가입 | 코드 완료 | Supabase 프로젝트 설정 필요 |
| 최근 ID 버튼 + 비밀번호만 로그인 | 코드 완료 | Supabase 프로젝트 설정 필요 |
| 계정별 Gemini key 암호화 저장 | 코드 완료 | Supabase Edge Function + secrets 설정 필요 |
| 여러 기기에서 계정/즐겨찾기 동기화 | 코드 완료 | Supabase 프로젝트 설정 필요 |

## 안전한 배포 구조

GitHub Pages에는 비밀번호, service-role key, Gemini secret을 저장하지 않는다.

- GitHub Pages: 정적 UI + 공개 Supabase URL/anon key만 사용
- Supabase Auth: ID/비밀번호 인증
- Supabase PostgreSQL: profiles, favorites, compare cache 저장
- Supabase Edge Function `user-secret`: Gemini API key를 서버 암호화 후 저장/복호화
- Supabase Edge Function `gemini-proxy`: 인증된 사용자의 암호화된 key를 사용해 Gemini 호출

현재 저장소에는 schema와 Edge Function 코드까지 반영되어 있다. 실제 계정 기능을 활성화하려면 별도 Supabase 프로젝트에서 migration을 적용하고 `supabase-config.js`의 public URL/anon key/functions base를 설정해야 한다. service-role key와 암호화 secret은 Edge Function secrets에만 넣는다.
