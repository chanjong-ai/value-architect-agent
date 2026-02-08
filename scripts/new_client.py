#!/usr/bin/env python3
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
CLIENTS_DIR = REPO_ROOT / "clients"
TEMPLATE_DIR = CLIENTS_DIR / "_template"


def slugify(text: str) -> str:
    value = re.sub(r"[^\w\s-]", "", (text or "").strip().lower())
    value = re.sub(r"[\s]+", "-", value).strip("-_")
    return value or "topic"


def _default_slides() -> list:
    return [
        {
            "layout": "cover",
            "title": "고객사 전략 제언",
            "subtitle": "프로젝트 킥오프 버전",
            "governing_message": "핵심 의사결정 질문을 명확히 정의하고, 근거 기반 실행 프레임을 설계합니다.",
            "metadata": {
                "section": "Cover",
                "source_refs": ["sources.md#client"],
            },
        },
        {
            "layout": "exec_summary",
            "title": "Executive Summary",
            "governing_message": "초기 진단 결과를 바탕으로 우선순위 과제를 정의하고 검증 가능한 가치 가설을 제시합니다.",
            "bullets": [
                {
                    "text": "핵심 질문: 이번 과제에서 경영진이 반드시 결정해야 할 항목을 3개 이내로 정리합니다.",
                    "icon": "insight",
                    "evidence": {"source_anchor": "sources.md#client", "confidence": "medium"},
                },
                {
                    "text": "핵심 가설: 성과 영향도가 큰 과제를 먼저 선정하고 단기·중기 KPI를 함께 정의합니다.",
                    "icon": "check",
                    "evidence": {"source_anchor": "sources.md#market", "confidence": "medium"},
                },
                {
                    "text": "실행 원칙: 실행 오너·일정·검증 기준을 한 장표에서 연결해 의사결정 속도를 높입니다.",
                    "icon": "arrow",
                    "evidence": {"source_anchor": "sources.md#client", "confidence": "medium"},
                },
            ],
            "layout_intent": {"emphasis": "content", "content_density": "dense"},
            "metadata": {
                "section": "Executive",
                "source_refs": ["sources.md#market", "sources.md#client"],
            },
        },
        {
            "layout": "thank_you",
            "title": "결론 및 다음 단계",
            "governing_message": "상세 리서치와 페이지 블루프린트를 반영해 본 보고서를 고도화합니다.",
            "metadata": {
                "section": "Closing",
                "source_refs": ["sources.md#client"],
            },
        },
    ]

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/new_client.py <client-name> [topic]")
        sys.exit(1)

    client_name = sys.argv[1].strip()
    topic = sys.argv[2].strip() if len(sys.argv) >= 3 else ""
    if not client_name:
        print("Error: client-name is empty.")
        sys.exit(1)

    if not re.match(r"^[a-zA-Z0-9_-]+$", client_name):
        print(f"Error: invalid client-name: {client_name} (allowed: letters, numbers, '-', '_').")
        sys.exit(1)

    dest = CLIENTS_DIR / client_name
    if dest.exists():
        if topic:
            suffix = f"{slugify(topic)[:32]}-{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            dest = CLIENTS_DIR / f"{client_name}--{suffix}"
        else:
            print(f"Error: client folder already exists: {dest}")
            print("Hint: pass topic as second arg to create a new variant folder.")
            sys.exit(1)

    if not TEMPLATE_DIR.exists():
        print(f"Error: template folder not found: {TEMPLATE_DIR}")
        sys.exit(1)

    shutil.copytree(TEMPLATE_DIR, dest)

    # template deck_spec 메타데이터 기본값 채우기
    spec_path = dest / "deck_spec.yaml"
    if spec_path.exists():
        with spec_path.open("r", encoding="utf-8") as f:
            spec = yaml.safe_load(f) or {}
        spec["client_meta"] = spec.get("client_meta", {})
        spec["client_meta"]["client_name"] = dest.name
        if not str(spec["client_meta"].get("industry", "")).strip():
            spec["client_meta"]["industry"] = "TBD"
        spec["client_meta"]["date"] = datetime.now().strftime("%Y-%m-%d")
        if not str(spec["client_meta"].get("audience", "")).strip():
            spec["client_meta"]["audience"] = "Executive"
        if not str(spec["client_meta"].get("language", "")).strip():
            spec["client_meta"]["language"] = "ko"
        if topic:
            spec["client_meta"]["objective"] = topic
        elif not str(spec["client_meta"].get("objective", "")).strip():
            spec["client_meta"]["objective"] = "핵심 과제 정의 필요"

        spec["global_constraints"] = spec.get("global_constraints", {})
        spec["global_constraints"].setdefault("max_slides", 35)
        spec["global_constraints"].setdefault("default_max_bullets", 9)
        spec["global_constraints"].setdefault("default_max_chars_per_bullet", 180)
        spec["global_constraints"].setdefault("forbidden_words", ["아마", "대충"])
        spec["global_constraints"].setdefault("required_sections", ["cover", "exec_summary", "thank_you"])

        if not isinstance(spec.get("slides"), list) or not spec.get("slides"):
            spec["slides"] = _default_slides()
        with spec_path.open("w", encoding="utf-8") as f:
            yaml.dump(spec, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    print(f"Created client pack: {dest}")
    print("Next: fill brief/constraints/sources/deck_outline, then run validate/render.")

if __name__ == "__main__":
    main()
