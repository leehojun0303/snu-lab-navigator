# Supabase 계정/AI 기능 설정

현재 앱은 개인정보를 요구하지 않는 **ID-only 계정**을 사용한다.

## 1. 계정 DB

Supabase SQL Editor에서 최신 `supabase/migrations/20260911_id_only_accounts.sql`을 실행한다.

이 migration은 `lab_accounts`와 `lab_favorites`, 그리고 다음 RPC를 만든다.

- `create_lab_account(p_username)`
- `login_lab_account(p_username)`
- `get_lab_favorites(p_username)`
- `set_lab_favorite(p_username, p_lab_id, p_enabled)`

회원가입은 ID가 없을 때만 성공하고, 로그인은 DB에 등록된 ID가 존재하면 성공한다. 비밀번호·이메일·전화번호는 받지 않는다.

## 2. Gemini proxy

`supabase/functions/gemini-proxy/index.ts`를 배포한다.

Edge Function secrets:

- `GEMINI_API_KEY`: Gemini server API key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase에서 제공되는 기본 service role 환경변수는 함수가 직접 읽는다. 별도 이름으로 중복 생성할 필요가 없다.

현재 함수는 요청의 `x-lab-username`이 `lab_accounts`에 존재하는지 확인한 후 서버 Gemini를 호출한다.

## 3. GitHub 가입자 registry (선택 기능)

`supabase/functions/account-registry/index.ts`를 배포한다.

Secrets:

- `GITHUB_TOKEN`: `data/account-registry.json`에 쓸 수 있는 GitHub token
- `GITHUB_REPO`: `leehojun0303/snu-lab-navigator`

회원가입 성공 후 프런트가 `account-registry`를 호출하여 ID와 `lab_accounts.created_at`을 GitHub JSON에 누적한다.

GitHub token은 절대로 `dist/`나 공개 repository 코드에 넣지 않는다.

## 4. 공개 프런트 설정

`dist/supabase-config.js`에는 공개 값만 둔다.

- `url`: Supabase project URL
- `anonKey`: public/anon key
- `functionsBase`: `${url}/functions/v1`

service role key와 Gemini secret은 공개 코드에 넣지 않는다.

## 5. 배포 후 테스트

1. 앱에서 회원가입으로 새 ID를 생성한다.
2. 로그인 화면에서 같은 ID를 입력해 로그인한다.
3. 즐겨찾기를 추가하고 새로 로그인한 뒤 다시 불러온다.
4. 두 연구실을 선택해 비교표가 열리는지 확인한다.
5. 로그인되어 있으면 비교창 아래 AI 핵심 차이가 자동 생성되는지 확인한다.
6. 새 ID 가입 후 `data/account-registry.json`에 ID/가입시각이 추가되는지 확인한다.

## 보안 주의

ID-only 방식은 ID를 아는 사람이 그 계정으로 접근할 수 있으므로 민감한 개인정보/결제/비공개 문서를 저장하는 용도로 사용하지 않는다. 이 프로젝트는 비개인 연구실 탐색, 즐겨찾기, 비교 서비스라는 범위에서 사용한다.
