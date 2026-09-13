/* Verified directly from SNU College of Fine Arts official professor pages. */
(() => {
  'use strict';
  const units=[...(window.RESEARCH_UNITS||[]),...(window.RESEARCH_UNIT_SUPPLEMENTS||[])];
  const data=window.PRECOMPUTED_ENRICHMENT=window.PRECOMPUTED_ENRICHMENT||{};
  const samples={
    '김정한':{
      research_summary:'다매체와 융합예술을 중심으로 활동하며 미술과 영상매체, 인지과학을 연결하는 교육·연구 활동을 수행합니다.',
      recent_solo_exhibitions:[
        {title:'BirdMan’s Irises: Ophthalmic surgery',year:'2024',venue:'BRADWOLFF PROJECTS, 암스테르담',url:'https://art.snu.ac.kr/members/%EA%B9%80%EC%A0%95%ED%95%9C/?cate=painting&catemenu=Faculty&type=major'},
        {title:'감각질 풍경 II',year:'2021',venue:'밤부갤러리, 서울',url:'https://art.snu.ac.kr/members/%EA%B9%80%EC%A0%95%ED%95%9C/?cate=painting&catemenu=Faculty&type=major'},
        {title:'감각질 풍경',year:'2013',venue:'아트센터나비, 서울·대전',url:'https://art.snu.ac.kr/members/%EA%B9%80%EC%A0%95%ED%95%9C/?cate=painting&catemenu=Faculty&type=major'}
      ],
      recent_group_exhibitions:[
        {title:'네오토피아: 데이터와 휴머니티',year:'2017',venue:'아트센터나비 타작마당, 서울',url:'https://art.snu.ac.kr/members/%EA%B9%80%EC%A0%95%ED%95%9C/?cate=painting&catemenu=Faculty&type=major'},
        {title:'성찰의 공동체, 국가, 개인 그리고 우리',year:'2017',venue:'북서울시립미술관, 서울',url:'https://art.snu.ac.kr/members/%EA%B9%80%EC%A0%95%ED%95%9C/?cate=painting&catemenu=Faculty&type=major'},
        {title:'인지과학특별전: 눈이 보는 것, 뇌가 보는 것',year:'2017',venue:'국립과천과학관, 과천',url:'https://art.snu.ac.kr/members/%EA%B9%80%EC%A0%95%ED%95%9C/?cate=painting&catemenu=Faculty&type=major'}
      ],
      education_summary:'서울대학교 서양화과 교수로서 다매체·융합예술을 담당하며 연합전공 영상매체예술 및 학습과학연구소와 연계된 활동을 수행합니다.',
      source_urls_used:['https://art.snu.ac.kr/members/%EA%B9%80%EC%A0%95%ED%95%9C/?cate=painting&catemenu=Faculty&type=major'],
      _quality_gate:'official_fine_arts_page_verified'
    },
    '박관택':{
      research_summary:'드로잉과 복합매체를 중심으로 작업하며 회화적 표현과 다양한 매체를 결합한 예술 활동을 수행합니다.',
      recent_solo_exhibitions:[
        {title:'Back and Forth',year:'2024',venue:'씨알콜렉티브, 서울',url:'https://art.snu.ac.kr/members/%EB%B0%95%EA%B4%80%ED%83%9D/?cate=painting&catemenu=Faculty&type=major'},
        {title:'페어링',year:'2021',venue:'인천아트플랫폼 G1, 인천',url:'https://art.snu.ac.kr/members/%EB%B0%95%EA%B4%80%ED%83%9D/?cate=painting&catemenu=Faculty&type=major'},
        {title:'어제모레',year:'2020',venue:'경기도미술관, 안산',url:'https://art.snu.ac.kr/members/%EB%B0%95%EA%B4%80%ED%83%9D/?cate=painting&catemenu=Faculty&type=major'}
      ],
      recent_group_exhibitions:[
        {title:'내면의 초상',year:'2024',venue:'에디트프로젝트, 서울',url:'https://art.snu.ac.kr/members/%EB%B0%95%EA%B4%80%ED%83%9D/?cate=painting&catemenu=Faculty&type=major'},
        {title:'언박싱프로젝트',year:'2022',venue:'뉴스프링프로젝트, 서울',url:'https://art.snu.ac.kr/members/%EB%B0%95%EA%B4%80%ED%83%9D/?cate=painting&catemenu=Faculty&type=major'},
        {title:'마인드붐: 달빛이 연못을 뚫어도',year:'2021',venue:'로얄빌딩 지하1층, 서울',url:'https://art.snu.ac.kr/members/%EB%B0%95%EA%B4%80%ED%83%9D/?cate=painting&catemenu=Faculty&type=major'}
      ],
      education_summary:'서울대학교 서양화과에서 드로잉과 복합매체를 중심으로 교육·창작 활동을 수행합니다.',
      source_urls_used:['https://art.snu.ac.kr/members/%EB%B0%95%EA%B4%80%ED%83%9D/?cate=painting&catemenu=Faculty&type=major'],
      _quality_gate:'official_fine_arts_page_verified'
    }
  };
  for(const u of units){
    if(String(u.college||'').includes('미술대학')&&samples[u.name]) data[u.id]={...(data[u.id]||{}),...samples[u.name],_unit_id:u.id};
  }
})();
