#!/usr/bin/env python3
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def main():
    readme=(ROOT/'README.md').read_text(encoding='utf-8')
    index=(ROOT/'dist/index.html').read_text(encoding='utf-8')
    app=(ROOT/'dist/app.js').read_text(encoding='utf-8')
    automation=(ROOT/'dist/automation-data.js').read_text(encoding='utf-8')
    quality=(ROOT/'dist/quality-overrides.js').read_text(encoding='utf-8')
    favorites=(ROOT/'dist/favorites-compare.js').read_text(encoding='utf-8')
    account=(ROOT/'dist/account.js').read_text(encoding='utf-8')
    config=(ROOT/'dist/supabase-config.js').read_text(encoding='utf-8')
    roster=(ROOT/'tools/roster_sync.py').read_text(encoding='utf-8')
    entry=(ROOT/'tools/collector_entry.py').read_text(encoding='utf-8')
    workflow=(ROOT/'.github/workflows/collect.yml').read_text(encoding='utf-8')
    migration=(ROOT/'supabase/migrations/20260911_user_accounts.sql').read_text(encoding='utf-8')
    secret=(ROOT/'supabase/functions/user-secret/index.ts').read_text(encoding='utf-8')
    proxy=(ROOT/'supabase/functions/gemini-proxy/index.ts').read_text(encoding='utf-8')
    assert 'https://leehojun0303.github.io/snu-lab-navigator/' in readme
    assert 'account.js' in index and 'supabase-config.js' in index and 'account.css' in index
    assert 'favorites-compare.js' in index and 'id="accountOpen"' in index
    assert 'showcase_unit_id' in automation and 'Song Jaejoon' not in (ROOT/'dist/showcase-data.js').read_text(encoding='utf-8')
    assert 'stored_keywords' in quality and 'stored_topics' in quality and '저장된 AI 추천 결과를 사용했습니다' in quality
    assert 'COMPARE_MAX = 4' in favorites and 'SnuAccount' in favorites
    assert 'UNION' in roster and 'absent_from_all_successful_official_rosters_for_two_consecutive_syncs' in roster
    assert 'roster_sync.py' in workflow
    assert 'future_to_unit' in entry and 'verify_with_gemini' in entry
    assert 'SUPABASE_CONFIG' in config
    assert 'profiles' in migration and 'favorites' in migration and 'gemini_keys' in migration and 'compare_cache' in migration
    assert 'GEMINI_KEY_ENCRYPTION_SECRET' in secret and 'SUPABASE_SERVICE_ROLE_KEY' in secret and 'AES-GCM' in secret
    assert 'gemini_keys' in proxy and 'x-goog-api-key' in proxy
    assert 'service_role' not in account.lower()
    print('PASS: static app, quality layer, roster union, favorites/compare, and Supabase account scaffolding')

if __name__=='__main__': main()
