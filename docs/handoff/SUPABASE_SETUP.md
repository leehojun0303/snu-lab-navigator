# Supabase 계정 기능 설정

현재 저장소는 개인정보를 요구하지 않는 ID-only 계정 구조를 사용한다. 사용자는 원하는 고유 ID만 정하고, 실제 인증은 Supabase Anonymous Auth 세션이 담당한다. 비밀번호·이메일·전화번호·Gemini 개인키는 받지 않는다.

## 관리자 설정

1. Supabase 프로젝트를 생성한다.
2. Supabase Auth에서 Anonymous Sign-Ins를 활성화한다.
3. SQL Editor에서 `supabase/migrations/20260911_user_accounts.sql`을 실행한다.
4. Edge Function `supabase/functions/gemini-proxy/index.ts`를 배포한다.
5. Edge Function secrets에 다음을 설정한다.
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_API_KEY`
6. `dist/supabase-config.js`에 다음 공개 값만 입력한다.
   - `url`: Supabase project URL
   - `anonKey`: Supabase publishable/anon key
   - `functionsBase`: 보통 `${url}/functions/v1`
7. `service-role key`와 Gemini server key는 `dist/`나 GitHub 저장소에 넣지 않는다.

## ID 정책

- ID는 영문·숫자·`._-` 조합의 3~40자.
- 대소문자를 구분하지 않고 비교해 같은 ID의 중복 생성을 막는다.
- 이미 존재하는 ID를 입력하면 `claim_username`이 실패하고 다른 ID를 입력하도록 안내한다.
- 회원가입 완료 후 해당 브라우저의 익명 인증 세션이 계정을 유지하므로 다음 방문에는 ID를 다시 입력할 필요가 없다.
- 브라우저의 인증 세션을 삭제하면 ID만으로 계정을 복구할 수 없다. 이것은 ID만을 인증수단으로 사용해 다른 사용자가 계정을 탈취하는 일을 막기 위한 의도된 제한이다.

## Gemini

사용자별 Gemini API key를 저장하지 않는다. 사용자 AI 기능은 로그인한 익명 계정 세션을 확인한 뒤 `gemini-proxy`를 호출하고, 서버의 `GEMINI_API_KEY` secret을 사용한다. 따라서 사용자에게 Google AI Studio 키를 반복 입력하게 하지 않는다.

## 즐겨찾기/비교

즐겨찾기는 로그인한 익명 계정의 `favorites` 테이블에 저장한다. 비교 cache는 사용자별 `compare_cache` 테이블에 저장할 수 있다. 앱의 연구실 비교는 자동 수집에서 저장한 AI summary/topic/keyword/recent-paper metadata를 우선 사용하고 필요한 경우에만 서버 Gemini를 호출한다.

## 배포 순서

`dist/supabase-config.js` 설정 → GitHub Pages 배포 → Supabase 프로젝트에서 Anonymous Auth 및 SQL/Edge Function 설정 순서로 활성화한다. 설정 전에도 앱의 공개 연구실 탐색 자체는 동작한다.
