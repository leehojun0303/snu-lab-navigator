# 팀 협업과 앱 수정

## 친구 두 명이 같이 수정하는 방법

저장소가 public이면 코드는 누구나 읽고 fork할 수 있습니다. 하지만 `main` 브랜치에 직접 push하는 권한은 GitHub 저장소 Collaborator로 추가된 사람에게만 줍니다.

1. GitHub 저장소의 **Settings → Collaborators**(또는 Manage access)로 이동합니다.
2. **Add people**를 선택합니다.
3. 친구의 GitHub username을 입력합니다.
4. 저장소에 대한 **Write** 권한을 부여합니다.
5. 친구는 초대 수락 후 clone/fork, branch 생성, commit/push, Pull Request 작성이 가능합니다.

팀원에게 필요한 저장소 정보는 README와 `docs/handoff/README_FIRST.md`에 정리되어 있습니다.

## 권한 원칙

- 공개 코드: `dist/`, `tools/`, `.github/workflows/`, `supabase/`, `docs/` 등 저장소에 포함된 코드는 읽고 수정할 수 있습니다.
- 운영 비밀값: GitHub/Supabase Secret에만 있고 repository 파일에는 넣지 않습니다.
- `main` 직접 수정은 Write 권한이 있는 팀원만 가능합니다. 더 안전하게 운영하려면 Branch protection을 켜고 Pull Request + 검사를 거쳐 merge합니다.
- GitHub Pages 배포는 `main`에 반영된 변경을 기준으로 수행됩니다.

## 새 팀원이 먼저 읽을 파일

`README.md` → `docs/handoff/README_FIRST.md` → `CURRENT_STATE.md` → `DATA_SOURCES.md` → `AUTOMATION_SPEC.md` → `USER_REQUIREMENTS.md` → `URL_REGISTRY.md` → `PROJECT_HANDOFF_COMPLETE.md`

## 주의

Supabase `service-role` key, `GEMINI_API_KEY`, `GITHUB_TOKEN`은 소스 코드에 절대 넣지 않습니다. 공개 repository의 `dist/supabase-config.js`에는 공개 Supabase URL/anon(publishable) key만 둡니다.
