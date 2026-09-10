(() => {
  const id = 'SNU-RU-6E5D0FD6BFDE9D';
  const patchUnit = unit => {
    if (unit?.id !== id) return;
    Object.assign(unit, {
      title: '송재준 교수 / 암반 공학 연구실',
      labs: '암반 공학 연구실',
      fields: '암석과 불연속면의 역학적·열수리학적 거동을 이론과 실험으로 규명하고, 암반구조물의 효율적 건설과 안정적 유지에 적용하는 기술을 연구합니다.',
      keywords: '디지털 암반 조사; 절리면 전단거동; 암석블록 거동 해석; 불연속 암반; 지하공간',
      profile: 'https://ere.snu.ac.kr/bbs/board.php?bo_table=sub2_1&wr_id=12',
      homepage: 'https://ere.snu.ac.kr/sub3_1_d.php',
      departmentUrl: 'https://ere.snu.ac.kr/'
    });
  };
  (window.RESEARCH_UNITS || []).forEach(patchUnit);
  (window.RESEARCH_UNIT_SUPPLEMENTS || []).forEach(patchUnit);

  window.PRECOMPUTED_ENRICHMENT = window.PRECOMPUTED_ENRICHMENT || {};
  window.PRECOMPUTED_ENRICHMENT[id] = {
    research_summary: '암석 및 불연속면의 역학적·열수리학적 거동을 이론·실험·수치해석으로 규명하고, 디지털 암반 조사와 절리·암석블록 거동 해석을 암반구조물의 설계와 안정성 평가에 적용합니다.',
    research_topics: ['디지털 암반 조사', '절리면 전단거동', '암석블록 거동 해석', '불연속 암반 모델링', '터널·사면 안정성'],
    paper_count_visible: 5,
    paper_count_scope: '2026년 SNU Research 프로필 상단에 공개된 최근 연구성과 5편',
    recent_output_summary: '2026년 최근 공식 기록 5편: International Journal of Rock Mechanics and Mining Sciences 2편, Rock Mechanics and Rock Engineering 1편, Tunnelling and Underground Space Technology 1편, Underground Space 1편.',
    total_output_count: 115,
    total_output_scope: 'SNU Research에 집계된 전체 연구성과',
    recent_papers: [
      {title: 'Genetic discrete fracture network modeling by 3D polygonal growth-based simulation calibrated with trace map observations', venue: 'International Journal of Rock Mechanics and Mining Sciences', year: '2026', url: 'https://snu.elsevierpure.com/en/publications/genetic-discrete-fracture-network-modeling-by-3d-polygonal-growth/'},
      {title: 'Efficient and Intelligent Positioning of Potentially Unstable Rock Masses in Rock Slope Engineering: Case Study from a Hydropower Station in Southwest China', venue: 'Rock Mechanics and Rock Engineering', year: '2026', url: 'https://snu.elsevierpure.com/en/publications/efficient-and-intelligent-positioning-of-potentially-unstable-roc/'},
      {title: 'Numerical study on pillar stress distribution in room-and-pillar hard rock mines using stress concentration factor based on tributary area: Bridging to pressure arch effect', venue: 'International Journal of Rock Mechanics and Mining Sciences', year: '2026', url: 'https://snu.elsevierpure.com/en/publications/numerical-study-on-pillar-stress-distribution-in-room-and-pillar-/'},
      {title: 'Experimental insights into tunnel stability affected by offset distance from fully non-persistent structural planes with inclination using 3D-printed physical models', venue: 'Tunnelling and Underground Space Technology', year: '2026', url: 'https://snu.elsevierpure.com/en/publications/experimental-insights-into-tunnel-stability-affected-by-offset-di/'},
      {title: 'Influence of roughness on the mechanical response of rock-like specimens with nonpersistent joints under uniaxial compression based on joint deformation analysis', venue: 'Underground Space', year: '2026', url: 'https://snu.elsevierpure.com/en/publications/influence-of-roughness-on-the-mechanical-response-of-rock-like-sp/'}
    ],
    recruitment_summary: '',
    current_members: [],
    alumni: [],
    source_urls_used: [
      'https://ere.snu.ac.kr/sub3_1_d.php',
      'https://ere.snu.ac.kr/bbs/board.php?bo_table=sub2_1&wr_id=12',
      'https://snu.elsevierpure.com/en/persons/jae-joon-song/'
    ],
    _model: 'gemini-3.1-flash-lite',
    _saved_at: '2026-09-10T00:00:00Z',
    _batch_saved: true
  };

  window.RESEARCH_ACTIVITY = window.RESEARCH_ACTIVITY || {};
  window.RESEARCH_ACTIVITY[id] = {
    labName: '암반 공학 연구실',
    papers: window.PRECOMPUTED_ENRICHMENT[id].recent_papers,
    publicationPages: [{title: 'SNU Research 연구성과 전체 보기', url: 'https://snu.elsevierpure.com/en/persons/jae-joon-song/'}],
    outputStats: [
      {label: '전체 연구성과', value: '115건'},
      {label: '2026 최근 공개', value: '5편'},
      {label: '최근 게재 학술지', value: '4곳'}
    ],
    recentOutputSummary: window.PRECOMPUTED_ENRICHMENT[id].recent_output_summary,
    posterStatus: '공식 출처에서 송재준 교수 연구실 귀속이 확인된 포스터 이미지는 아직 찾지 못했습니다.',
    recruitmentStatus: '현재 진행 중인 송재준 교수 연구실 학부연구생 모집 공고는 공식 출처에서 확인되지 않았습니다.',
    undergraduateStatus: '공식 명단에서 학부연구생 이름과 인원은 확인되지 않았습니다. 확인 전까지 0명으로 표시하지 않습니다.',
    participantEvidence: {
      label: '최근 학과 공식 소식에서 연구팀으로 확인',
      names: ['김진언', '윤동호', 'Yulong Shao', 'Seyedahmad Mehrishal', '임준수', '최지원'],
      note: '현재 재학·재직 여부와 과정은 별도 명단에서 확인되지 않아 현 구성원 수에는 포함하지 않습니다.'
    },
    membersUrl: 'https://ere.snu.ac.kr/bbs/board.php?bo_table=sub5_5',
    sourceNote: '연구분야는 학과 공식 연구분야 페이지, 논문 수와 제목은 SNU Research, 연구팀 참여자는 학과 공식 소식에서 확인했습니다.'
  };
})();
