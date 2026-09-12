from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import automated_enrichment_v2 as ae

def test_parser_and_poster_candidates():
    html='''<html><body><a href="/papers">Publications</a><a href="/poster.pdf">Research Poster 2026</a><img src="/poster.png" alt="Research poster"></body></html>'''
    original=ae.fetch; ae.fetch=lambda u:(u,html)
    try:p=ae.page('https://demo.snu.ac.kr/',0)
    finally:ae.fetch=original
    found=ae.classify(p.links,{'homepage':'https://demo.snu.ac.kr/'})
    assert found['publication'] and found['poster']
    assert ae.assets_for(p)

def test_chunked_roster_loader():
    import collector_entry as entry
    units=entry.load_units_compatible()
    assert len(units)>=2000
    assert all(unit.get('id') for unit in units)

def test_showcase_selection():
    units=[{'id':'a','labs':'Research Lab','fields':'topic'},{'id':'b','labs':'교수 연구그룹','fields':''}]
    records={'a':{'activity':{'posterStatus':'verified','sourcePagesScanned':['1','2','3']},'enrichment':{'research_summary':'x','research_topics':['a','b'],'recent_papers':[{'title':'paper title'}],'current_members':[{'name':'X','role':'PhD'}]}},'b':{'activity':{},'enrichment':{}}}
    uid,score,why=ae.showcase(units,records)
    assert uid=='a' and score>50

if __name__=='__main__':
    test_parser_and_poster_candidates(); test_chunked_roster_loader(); test_showcase_selection(); print('PASS: chunk loader, poster candidate parsing, and automatic showcase selection')
