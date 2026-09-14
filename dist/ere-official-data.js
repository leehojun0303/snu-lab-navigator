(function(){
  'use strict';
  var id='SNU-RU-54BE3AA707CBD7';
  var official='https://ere.snu.ac.kr/bbs/board.php?bo_table=sub2_1&wr_id=14';
  var lab='http://geophy.snu.ac.kr/';
  var unit=(window.RESEARCH_UNITS||[]).find(function(x){return x&&x.id===id;});
  if(unit){
    unit.title='물리탐사연구실';unit.type='verified_named_lab_linked';unit.naming='official_named_lab';unit.labs='물리탐사연구실';
    unit.fields='에너지자원탐사; 광물자원조사; 지구조 특성 연구; CCS 및 방폐장 모니터링; 딥러닝 기반 적용연구';
    unit.keywords='물리탐사; 탄성파탐사; 전자탐사; MT; 전기탐사; GPR; 에너지자원탐사; 광물자원조사; CCS; 방폐장 모니터링; 딥러닝';
    unit.profile=official;unit.homepage=lab;unit.guidance='에너지자원공학과 공식 교수 상세페이지에서 물리탐사연구실과 연구분야가 확인되었습니다.';
  }
  window.PRECOMPUTED_ENRICHMENT=window.PRECOMPUTED_ENRICHMENT||{};
  window.PRECOMPUTED_ENRICHMENT[id]={
    _unit_id:id,_batch_saved:true,_quality_gate:'official_page_verified',profile_type:'scholarly',
    research_summary:'물리적 특성을 기반으로 지하구조 영상화와 물성 특성을 파악하는 물리탐사 연구를 수행합니다. 탄성파, 전자탐사(EM·MT), 전기탐사, GPR 등 다양한 물리탐사 기법을 활용해 석유·가스·메탄가스하이드레이트 등 에너지자원과 광물자원을 조사하고, 환경오염 지대 탐지와 CCS 부지선정·CO2 거동 모니터링, 방폐장 부지선정·모니터링, 딥러닝 기반 탐사자료 처리·해석을 연구합니다.',
    research_topics:['에너지자원탐사','광물자원조사','지구조 특성 연구','CCS 및 방폐장 모니터링','딥러닝 기반 적용연구'],
    recent_papers:[
      {title:'Improvement of spectrum suppression-based deep learning interpolation technique',year:'2023',venue:'IEEE Transactions on Geoscience and Remote Sensing',url:official,summary:'결측 탄성파 자료 복원을 위한 딥러닝 보간에서 스펙트럼 억제 문제를 개선하는 기법을 다룬 연구입니다. 주파수 성분 보존을 개선해 탄성파 자료 복원 정확도를 높이는 방향을 제시합니다.'},
      {title:'Analysis of sensitivity patterns for characteristics of magnetotelluric (MT) response functions in inversion',year:'2023',venue:'Geophysical Journal International, 233(3), 1746-1771',url:official,summary:'MT 역산에서 응답함수의 특성이 지하 전기비저항 구조 변화에 어떻게 민감하게 반응하는지를 분석한 연구입니다. 민감도 패턴을 통해 MT 자료의 역산과 지하구조 해석 특성을 이해하는 데 초점을 둡니다.'},
      {title:'Synthetic modeling and field GPR survey to understand the near-surface deformation induced by coseismic groundwater dynamics following the 2019 Mirpur earthquake in Pakistan',year:'2022',venue:'The Leading Edge, 41(8), 529-539',url:official,summary:'2019년 파키스탄 미르푸르 지진 이후 지하수 동역학과 연관된 천부 변형을 이해하기 위해 합성 모델링과 현장 GPR 탐사를 결합한 연구입니다. 지진 이후의 근지표 변형을 지구물리탐사로 파악하는 사례를 제시합니다.'}
    ],
    books:[{title:'지구물리수치해석',year:'2016',venue:'씨아이알',url:official},{title:'지구물리탐사 개론',year:'2016',venue:'시그마프레스',url:official}],
    conference_presentations:[],research_projects:[],recent_performances:[],creative_works:[],awards:[],recent_solo_exhibitions:[],recent_group_exhibitions:[],
    education_summary:'서울대학교 지구과학교육과 학사(1993), 서울대학교 과학교육과 석사(1995), 서울대학교 과학교육과 박사(1999).',
    paper_count_visible:3,paper_count_scope:'공식 교수 페이지의 최근 국외 논문 5편 중 앱 상세화면에는 최근 3편 표시',
    recruitment_summary:'',current_members:[],alumni:[],member_page_url:'',poster_status:'none_detected',poster_title:'',poster_date:'',poster_event:'',poster_image_url:'',poster_source_url:'',poster_evidence:'',
    source_urls_used:[official,lab],_source_note:'서울대학교 에너지자원공학과 공식 교수 상세페이지 확인 자료',_saved_at:'2026-09-14T00:00:00Z'
  };
})();
