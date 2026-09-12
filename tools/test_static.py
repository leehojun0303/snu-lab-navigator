#!/usr/bin/env python3
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def main():
    readme=(ROOT/'README.md').read_text(encoding='utf-8')
    index=(ROOT/'dist/index.html').read_text(encoding='utf-8')
    automation=(ROOT/'dist/automation-data.js').read_text(encoding='utf-8')
    quality=(ROOT/'dist/quality-overrides.js').read_text(encoding='utf-8')
    favorites=(ROOT/'dist/favorites-compare-fixed.js').read_text(encoding='utf-8')
    account=(ROOT/'dist/account.js').read_text(encoding='utf-8')
    bridge=(ROOT/'dist/account-ai-bridge.js').read_text(encoding='utf-8')
    config=(ROOT/'dist/supabase-config.js').read_text(encoding='utf-8')
    account_css=(ROOT/'dist/account.css').read_text(encoding='utf-8')
    roster=(ROOT/'tools/roster_sync.py').read_text(encoding='utf-8')
    entry=(ROOT/'tools/collector_entry.py').read_text(encoding='utf-8')
    workflow=(ROOT/'.github/workflows/collect.yml').read_text(encoding='utf-8')
    migration=(ROOT/'supabase/migrations/20260911_user_accounts.sql').read_text(encoding='utf-8')
    proxy=(ROOT/'supabase/functions/gemini-proxy/index.ts').read_text(encoding='utf-8')
    setup=(ROOT/'docs/handoff/SUPABASE_SETUP.md').read_text(encoding='utf-8')

    assert 'https://leehojun0303.github.io/snu-lab-navigator/' in readme
    assert 'account.js' in index and 'supabase-config.js' in index and 'account.css' in index
    assert 'favorites-compare-fixed.js' in index and 'account-ai-bridge.js' in index and 'id="accountOpen"' in index
    assert 'showcase_unit_id' in automation and 'Song Jaejoon' not in (ROOT/'dist/showcase-data.js').read_text(encoding='utf-8')
    assert 'stored_keywords' in quality and 'stored_topics' in quality and '저장된 AI 추천 결과를 사용했습니다' in quality
    assert 'MAX_COMPARE = 4' in favorites and 'SnuAccount' in bridge\n    assert 'isResearchOriented' in favorites and 'latest_papers' in favorites and '논문 기반 최근 관심 분야' in favorites\n    assert 'SnuAffiliationLabel' in (ROOT/'dist/app.js').read_text(encoding='utf-8')\n    assert 'ai-search-row' in (ROOT/'dist/discipline-detail-and-search.js').read_text(encoding='utf-8')
    assert 'UNION' in roster and 'absent_from_all_successful_official_rosters_for_two_consecutive_syncs' in roster
    assert 'roster_sync.py' in workflow
    assert 'on:\n  schedule:' in workflow and '\n  push:' not in workflow
    assert 'future_to_unit' in entry and 'verify_with_gemini' in entry
    assert 'SUPABASE_CONFIG' in config
    assert 'signInAnonymously' in account and 'claim_username' in account
    assert '비밀번호<input' not in account and 'Gemini API 키<input' not in account
    assert 'profiles' in migration and 'favorites' in migration and 'compare_cache' in migration
    assert 'claim_username' in migration
    assert not re.search(r'create\s+table[^;]*gemini_keys', migration, re.I | re.S)
    assert 'drop table if exists public.gemini_keys cascade' in migration.lower()
    assert 'GEMINI_API_KEY' in proxy and 'SUPABASE_SERVICE_ROLE_KEY' in proxy
    assert 'SERVICE_ROLE_KEY' in proxy
    assert 'account-ai-bridge.js' in index
    assert 'SnuAccount.callGemini' in bridge
    assert 'Anonymous Auth' in setup and '비밀번호·이메일·전화번호' in setup
    assert 'service-role' not in account.lower()
    assert 'account.css' in index and len(account_css) > 100
    print('PASS: static app, quality layer, passwordless ID-only account, favorites/compare, roster union, and collector workflow checks')

if __name__=='__main__': main()
