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
| 즐겨찾기 | 완료 | Supabase 연결 시 계정 동기화, 미연결 시 브라우저 로컬 |
| 2~4개 연구실 비교 | 완료 | 비교 대상 데이터가 존재해야 함 |
| 최근 논문 trend 요약 | 완료 | 저장 논문의 연도 metadata가 존재해야 함 |
| AI 비교 문장 | 완료 | ID 계정 로그인 + server Gemini secret 필요 |
| 고유 ID 계정 생성 | 코드 완료 | Supabase Anonymous Auth + migration 설정 필요 |
| ID 중복 방지 | 코드 완료 | `claim_username` unique constraint/RPC 사용 |
| 최근 ID 표시 | 코드 완료 | 해당 브라우저에 최근 사용 ID가 남아 있어야 함 |
| 비밀번호 없는 세션 인증 | 코드 완료 | Supabase Anonymous Sign-Ins 활성화 필요 |
| 여러 기기에서 같은 ID만으로 계정 복구 | 의도적으로 미제공 | ID만으로 인증하면 계정 탈취 위험이 있으므로 제공하지 않음 |
| 서버 Gemini 사용 | 코드 완료 | Supabase Edge Function + `GEMINI_API_KEY` secret 필요 |

## 안전한 배포 구조

GitHub Pages에는 비밀번호, service-role key, Gemini secret을 저장하지 않는다.

- GitHub Pages: 정적 UI + 공개 Supabase URL/anon key
- Supabase Anonymous Auth: 실제 세션 인증
- Supabase PostgreSQL: profiles, favorites, compare cache
- Supabase Edge Function `gemini-proxy`: 인증된 세션만 서버 Gemini secret을 사용

사용자 개인 Gemini API key를 저장하지 않으며, 개인정보(비밀번호·이메일·전화번호)를 받지 않는다.

현재 저장소에는 ID 계정 schema, 고유 ID claim, favorites/compare 연결, Gemini proxy 코드까지 반영되어 있다. 실제 계정 기능을 활성화하려면 별도 Supabase 프로젝트에서 Anonymous Sign-Ins를 켜고 migration/Edge Function을 적용한 뒤 `dist/supabase-config.js`의 public URL/anon key/functions base를 설정해야 한다.
