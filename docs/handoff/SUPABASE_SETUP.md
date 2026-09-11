# Supabase 계정 기능 설정

현재 저장소에는 회원가입/로그인, 계정 즐겨찾기 동기화, 암호화된 Gemini key 저장, Gemini proxy의 코드가 들어 있다. 공개 앱에서 계정 기능을 실제 활성화하려면 다음 한 번의 관리자 설정이 필요하다.

1. Supabase 프로젝트를 생성한다.
2. SQL Editor에서 `supabase/migrations/20260911_user_accounts.sql` 전체를 실행한다.
3. Edge Function 두 개를 배포한다.
   - `supabase/functions/user-secret/index.ts`
   - `supabase/functions/gemini-proxy/index.ts`
4. Edge Function secrets를 설정한다.
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GEMINI_KEY_ENCRYPTION_SECRET` (충분히 긴 랜덤 문자열)
5. Supabase Auth에서 이메일 확인을 사용하지 않는 아이디/비밀번호 서비스로 운영할 경우 Email confirmation을 끈다. 켠 상태라면 synthetic auth email의 확인 절차 때문에 즉시 로그인할 수 없다.
6. `dist/supabase-config.js`에 다음 공개 값만 넣는다.
   - `url`: Supabase project URL
   - `anonKey`: Supabase publishable/anon key
   - `functionsBase`: 보통 `${url}/functions/v1`
7. `service-role key`, Gemini server secret, 암호화 secret은 `dist/`나 GitHub 저장소에 넣지 않는다.

## 동작

사용자는 회원가입 때 `아이디 + 비밀번호 + Gemini API key`를 입력한다. 인증은 Supabase Auth가 담당하고 Gemini key는 `user-secret` 함수가 암호화해 DB에 저장한다. 이후 로그인할 때 최근 사용한 아이디를 클릭하고 비밀번호만 입력하면 서버가 저장된 Gemini key를 복구하고 활성 세션에서 AI 기능을 다시 사용할 수 있다.

즐겨찾기는 로그인 상태에서는 `favorites` 테이블에 저장되므로 다른 브라우저에서도 계정으로 다시 로그인하면 복구된다. 로그인을 사용하지 않는 경우에는 브라우저 localStorage fallback으로 동작한다.

연구실 비교는 저장된 summary/topic/keyword/recent-paper metadata를 먼저 사용하고, AI 문장 비교가 필요한 경우에만 인증된 Gemini 호출을 사용한다.
