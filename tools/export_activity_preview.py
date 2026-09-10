#!/usr/bin/env python3
"""Export conservative, display-safe activity pointers from v31 evidence.

Only explicit publication-page and recruitment observations are exported.
Poster candidates are intentionally withheld until lab identity is verified.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pandas as pd


SOURCE = Path("/workspace/scratch/192cf3ff2523/upload/snu_lab_activity_v31_result (1).xlsx")
OUT = Path(__file__).resolve().parents[1] / "dist" / "activity-data.js"


def text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def main() -> None:
    if not SOURCE.exists():
        raise FileNotFoundError(SOURCE)
    items = pd.read_excel(SOURCE, sheet_name="activity_items_v31", dtype=str).fillna("")
    output: dict[str, dict[str, list[dict[str, str]]]] = {}
    publication_pattern = re.compile(r"publication|journal|paper|논문|연구성과", re.I)
    for _, row in items.iterrows():
        unit_id = text(row.get("research_unit_id"))
        category = text(row.get("category"))
        url = text(row.get("source_url"))
        title = text(row.get("title"))
        if not unit_id or not url.startswith(("http://", "https://")):
            continue
        record = output.setdefault(unit_id, {"publicationPages": [], "recruitmentPages": []})
        if category == "publications_page_detected" and publication_pattern.search(f"{title} {url}"):
            target = record["publicationPages"]
            label = title if publication_pattern.search(title) else "공식 논문·연구성과 페이지"
        elif category == "recruiting_explicit":
            target = record["recruitmentPages"]
            label = title or "공식 모집 안내 페이지"
        else:
            continue
        if not any(item["url"] == url for item in target) and len(target) < 3:
            target.append({"title": label[:120], "url": url})
    output = {key: value for key, value in output.items() if value["publicationPages"] or value["recruitmentPages"]}

    # Official, current representative record used by the detail-view showcase.
    output["SNU-RU-7E86905934781C"] = {
        **output.get("SNU-RU-7E86905934781C", {}),
        "labName": "Landscape Architecture & Urbanism Studio (LAUS)",
        "papers": [
            {
                "year": "2026",
                "title": "1980-2025년 출판된 국내 도시설계 학술 논문의 연구 주제-사례지 관계 메타분석",
                "url": "https://laus.snu.ac.kr/publications",
            },
            {
                "year": "2026",
                "title": "Segregated aging: Neighborhood environments and mobility among vulnerable older adults in Seoul",
                "url": "https://laus.snu.ac.kr/publications",
            },
            {
                "year": "2026",
                "title": "LLM 기반 건축가능영역 설계 자동화 - 일조권 사선제한 개정안 효과 시뮬레이션을 중심으로",
                "url": "https://laus.snu.ac.kr/publications",
            },
        ],
        "members": {
            "연구원": ["최소영", "이선재", "김정우"],
            "박사과정": ["심준형", "이수진", "황동은", "오정석"],
            "석사과정": ["윤소정", "신민주", "권주헌", "이지훈", "이수경", "최진규"],
        },
        "membersUrl": "https://laus.snu.ac.kr/members",
        "alumniUrl": "https://laus.snu.ac.kr/members",
        "recruitment": {
            "title": "학부연구생 모집 안내",
            "status": "공식 연구실 홈페이지에서 모집 안내 확인",
            "url": "https://laus.snu.ac.kr/",
        },
        "posterStatus": "공식 출처에서 연구실 귀속이 확인된 포스터 이미지가 아직 없습니다.",
    }
    OUT.write_text("window.RESEARCH_ACTIVITY = " + json.dumps(output, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"WROTE {OUT} | units={len(output)} | publication_pages={sum(len(v.get('publicationPages', [])) for v in output.values())} | recruitment_pages={sum(len(v.get('recruitmentPages', [])) for v in output.values())}")


if __name__ == "__main__":
    main()
