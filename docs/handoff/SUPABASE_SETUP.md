# Supabase 계정 기능 설정

현재 저장소는 개인정보를 요구하지 않는 ID-only 계정 구조를 사용한다. 사용자는 원하는 고유 ID만 정하고, 실제 인증은 Supabase Anonymous Auth 세션이 담당한다. 비밀번호·이메일·전화번호·Gemini 개인키는 받지 않는다.

## 관리자 설정

1. Supabase Auth에서 **Anonymous Sign-Ins**를 활성화한다.
2. SQL Editor에서 `supabase/migrations/20260911_user_accounts.sql` 전체를 실행한다. 이미 이전 버전을 실행했다면 최신 파일을 다시 실행해 기존 email-backed trigger와 `gemini_keys` 구성을 정리한다.
3. Edge Function `supabase/functions/gemini-proxy/index.ts`를 배포한다.
4. Edge Function secrets에서 `GEMINI_API_KEY`를 설정한다.
5. `SUPABASE_SERVICE_ROLE_KEY`는 Supabase Edge Functions의 기본 제공 환경변수이므로 별도 사용자 정의 secret으로 다시 만들 필요가 없다. `SERVICE_ROLE_KEY` 같은 다른 이름으로 만들어도 현재 함수가 읽지 않는다.
6. `dist/supabase-config.js`에는 공개 값만 입력한다.
   - `url`: Supabase project URL
   - `anonKey`: Supabase publishable/anon key
   - `functionsBase`: 보통 `${url}/functions/v1`
7. service-role key와 Gemini server key는 `dist/`나 GitHub 저장소에 넣지 않는다.

## ID 정책

- ID는 영문·숫자·`._-` 조합의 3~40자.
- 대소문자를 구분하지 않고 비교해 같은 ID의 중복 생성을 막는다.
- 회원가입 전에 `username_available`으로 중복을 확인하고, 최종 등록은 `claim_username`이 원자적으로 수행한다.
- 이미 사용 중인 ID이면 새 익명 계정을 만든 뒤 남기는 방식이 아니라 등록을 실패시키고 다른 ID를 선택하게 한다.
- 회원가입 완료 후 해당 브라우저의 익명 인증 세션이 계정을 유지하므로 다음 방문에는 자동 복원된다.
- 익명 계정은 ID 자체가 인증수단이 아니므로, 인증 세션을 지운 뒤 ID만 입력해서 기존 계정을 복구할 수 없다. 이것은 ID를 알고 있는 제3자가 계정을 탈취하는 것을 막기 위한 의도된 제한이다.

## Gemini

사용자별 Gemini API key를 저장하지 않는다. AI 기능은 인증된 익명 계정 세션의 access token으로 `gemini-proxy`를 호출하고, 서버에 보관된 `GEMINI_API_KEY` secret을 사용한다.

## 즐겨찾기/비교

즐겨찾기는 로그인한 익명 계정의 `favorites` 테이블에 저장한다. 비교 cache는 사용자별 `compare_cache` 테이블에 저장할 수 있다. 앱의 연구실 비교는 자동 수집에서 저장한 AI summary/topic/keyword/recent-paper metadata를 우선 사용하고 필요한 경우에만 서버 Gemini를 호출한다.

## 배포 순서

`dist/supabase-config.js` 설정 → GitHub Pages 배포 → Supabase Anonymous Auth 활성화 → 최신 SQL migration 실행 → `gemini-proxy` 배포 → `GEMINI_API_KEY` 설정 순으로 활성화한다. 설정 전에도 앱의 공개 연구실 탐색 자체는 동작한다.
