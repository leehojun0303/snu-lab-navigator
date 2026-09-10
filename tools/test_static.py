#!/usr/bin/env python3
"""Small release checks for the static prototype bundle."""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    index = (ROOT / "dist/index.html").read_text(encoding="utf-8")
    app = (ROOT / "dist/app.js").read_text(encoding="utf-8")
    activity = (ROOT / "dist/activity-data.js").read_text(encoding="utf-8")
    showcase = (ROOT / "dist/showcase-data.js").read_text(encoding="utf-8")
    automation = (ROOT / "dist/automation-data.js").read_text(encoding="utf-8")
    css = (ROOT / "dist/override.css").read_text(encoding="utf-8")
    assert 'activity-data.js' in index
    assert 'data-loader.js' in index and 'automation-data.js' in index
    assert 'showcase-data.js' in index
    assert 'id="welcomeDialog"' in index
    assert 'id="showcaseOpen"' in index
    assert '프로토타입 제공 범위' not in index + app
    assert 'function displayTitle' in app
    assert 'function activityHtml' in app
    assert 'gemini-2.5-flash-lite' not in app
    assert 'gemini-3.1-flash-lite' in app
    assert 'supportedGenerationMethods' in app
    assert 'url_context' in app
    assert '검증된 연구 주제 요약' not in app
    assert '저장된 AI 분석' in app
    assert 'if (!detail.open) detail.showModal()' in app
    assert '확인 논문수순' in index and '<option value="ai">추천순</option>' in index
    assert 'localStorage.setItem' in app and 'source_fingerprint' in app
    assert 'sessionStorage.setItem' in app and 'connectGemini' in app
    assert 'PRECOMPUTED_ENRICHMENT' in app
    assert 'current_members' in app and 'members_summary' not in app
    assert '논문별 제목은 아직 추출·검증 전' in app
    assert '현재 모집 공고인지는 아직 검증 전' in app
    assert '{google_search: {}}' in app
    assert 'id="professorCount"' in index
    assert 'SNU-RU-7E86905934781C' in activity
    assert 'SNU-RU-6E5D0FD6BFDE9D' in showcase
    assert 'International Journal of Rock Mechanics and Mining Sciences' in showcase
    assert 'undergraduateStatus' in showcase
    assert 'AUTOMATION_META' in automation and 'automationStatus' in app
    assert '최근 논문' in app and '구성원·동문' in app and '모집' in app and '포스터' in app
    assert '.avatar[hidden]{display:none!important}' in css
    assert '.avatar-initial[hidden]{display:none!important}' in css
    print("PASS: static UI, activity evidence, and avatar fallback checks")


if __name__ == "__main__":
    main()
