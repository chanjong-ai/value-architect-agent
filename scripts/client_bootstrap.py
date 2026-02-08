#!/usr/bin/env python3
"""
client_bootstrap.py - 고객 생성/초기화 공통 로직

중복 제거 대상:
- deck_cli.py cmd_new
- new_client.py
"""

from __future__ import annotations

import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict

import yaml


CLIENT_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]+$")


def load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_yaml(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def slugify(text: str) -> str:
    value = re.sub(r"[^\w\s-]", "", (text or "").strip().lower())
    value = re.sub(r"[\s]+", "-", value).strip("-_")
    return value or "topic"


def resolve_new_client_name(
    clients_dir: Path,
    client_name: str,
    topic: str = "",
    new_folder_if_exists: bool = False,
    topic_creates_variant: bool = True,
) -> str:
    """
    동일 고객사/다른 주제 대응:
    - 대상 폴더가 없으면 원본 이름 사용
    - 대상 폴더가 있고 topic 제공(기본) 또는 new_folder_if_exists면 변형 폴더 생성
    - 그 외에는 원본 이름 유지
    """
    base_dest = clients_dir / client_name
    if not base_dest.exists():
        return client_name

    should_variant = bool(new_folder_if_exists or (topic_creates_variant and topic))
    if not should_variant:
        return client_name

    suffix_parts = []
    if topic:
        suffix_parts.append(slugify(topic)[:32])
    suffix_parts.append(datetime.now().strftime("%Y%m%d_%H%M%S"))
    return f"{client_name}--{'-'.join(suffix_parts)}"


def default_seed_slides() -> list:
    return [
        {
            "layout": "cover",
            "title": "고객사 전략 제언",
            "subtitle": "프로젝트 킥오프 버전",
            "governing_message": "핵심 의사결정 질문을 명확히 정의하고, 근거 기반 실행 프레임을 설계합니다.",
            "metadata": {"section": "Cover", "source_refs": ["sources.md#client"]},
        },
        {
            "layout": "exec_summary",
            "title": "Executive Summary",
            "governing_message": "초기 진단 결과를 바탕으로 우선순위 과제를 정의하고 검증 가능한 가치 가설을 제시합니다.",
            "blocks": [
                {
                    "type": "bullets",
                    "slot": "main_bullets",
                    "items": [
                        {
                            "text": "핵심 질문은 시장·운영·재무 관점을 함께 반영해 구조화해야 의사결정 우선순위를 명확히 설정할 수 있습니다.",
                            "icon": "insight",
                            "evidence": {"source_anchor": "sources.md#client", "confidence": "medium"},
                        },
                        {
                            "text": "성과 영향도가 큰 과제를 선별하고 KPI 기준선을 통일하면 실행 속도와 조직 간 정렬 수준을 동시에 개선할 수 있습니다.",
                            "icon": "check",
                            "evidence": {"source_anchor": "sources.md#market", "confidence": "medium"},
                        },
                        {
                            "text": "실행 오너·검증 지표·의사결정 게이트를 한 프레임으로 제시해야 계획과 실제 운영 간 편차를 빠르게 보정할 수 있습니다.",
                            "icon": "arrow",
                            "evidence": {"source_anchor": "sources.md#client", "confidence": "medium"},
                        },
                        {
                            "text": "단기 성과와 중장기 경쟁우위 과제를 분리하지 않고 포트폴리오 관점에서 연결할 때 전략의 지속 가능성이 높아집니다.",
                            "icon": "risk",
                            "evidence": {"source_anchor": "sources.md#market", "confidence": "medium"},
                        },
                    ],
                },
                {
                    "type": "action_list",
                    "slot": "action_box",
                    "items": [
                        {"text": "100일 실행과제와 KPI 기준선을 확정합니다."},
                        {"text": "분기별 Value Review와 투자 게이트를 정례화합니다."},
                    ],
                },
            ],
            "layout_intent": {"emphasis": "content", "content_density": "dense"},
            "metadata": {"section": "Executive", "source_refs": ["sources.md#market", "sources.md#client"]},
        },
        {
            "layout": "kpi_cards",
            "title": "Value Case Snapshot",
            "governing_message": "핵심 KPI와 가정을 동시에 검증해 실행 우선순위와 투자 타이밍을 명확히 설정합니다.",
            "blocks": [
                {
                    "type": "kpi_cards",
                    "slot": "kpi_cards",
                    "cards": [
                        {"label": "Revenue Uplift", "value": "+6~10%", "comparison": "3Y cumulative"},
                        {"label": "EBITDA Margin", "value": "+1.5~2.5%p", "comparison": "Year 3"},
                        {"label": "Inventory Turn", "value": "+12~18%", "comparison": "Year 2"},
                        {"label": "Payback", "value": "24~30M", "comparison": "scenario range"},
                    ],
                },
                {
                    "type": "action_list",
                    "slot": "assumptions_box",
                    "items": [
                        {"text": "시장·정책 가정은 분기 단위로 재검증합니다."},
                        {"text": "KPI 편차 발생 시 투자 게이트를 재평가합니다."},
                    ],
                },
            ],
            "metadata": {"section": "Value Case", "source_refs": ["sources.md#market", "sources.md#client"]},
        },
    ]


def initialize_deck_spec_defaults(spec: dict, resolved_name: str, topic: str = "") -> dict:
    spec = dict(spec or {})

    spec["client_meta"] = spec.get("client_meta", {})
    spec["client_meta"]["client_name"] = resolved_name
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
    spec["global_constraints"].setdefault("default_max_bullets", 8)
    spec["global_constraints"].setdefault("default_max_chars_per_bullet", 180)
    spec["global_constraints"].setdefault("forbidden_words", ["아마", "대충"])
    spec["global_constraints"].setdefault("required_sections", ["cover", "exec_summary"])

    if not isinstance(spec.get("slides"), list) or not spec.get("slides"):
        spec["slides"] = default_seed_slides()

    return spec


def inject_topic_to_brief(brief_path: Path, topic: str) -> bool:
    if not topic or not brief_path.exists():
        return False
    brief_text = read_text(brief_path)
    if not brief_text or topic in brief_text:
        return False
    marker = "- Why now? (trigger / pain points / strategic agenda)"
    if marker not in brief_text:
        return False
    updated = brief_text.replace(
        marker,
        f"{marker}\n- Topic focus: {topic}",
        1,
    )
    write_text(brief_path, updated)
    return True


def create_client_pack(
    clients_dir: Path,
    template_dir: Path,
    client_name: str,
    topic: str = "",
    new_folder_if_exists: bool = False,
    topic_creates_variant: bool = True,
    update_brief_topic: bool = True,
) -> Dict[str, str]:
    """
    고객 폴더 생성 및 deck_spec 초기화 공통 진입점.
    예외:
    - ValueError: 입력값 오류
    - FileNotFoundError: template_dir 미존재
    - FileExistsError: 생성 대상 폴더가 이미 존재
    """
    client_name = (client_name or "").strip()
    topic = (topic or "").strip()

    if not client_name:
        raise ValueError("클라이언트 이름이 비어있습니다.")

    if not CLIENT_NAME_PATTERN.match(client_name):
        raise ValueError(f"클라이언트 이름은 영문, 숫자, 하이픈, 언더스코어만 가능합니다: {client_name}")

    if not template_dir.exists():
        raise FileNotFoundError(f"템플릿 폴더를 찾을 수 없습니다: {template_dir}")

    resolved_name = resolve_new_client_name(
        clients_dir=clients_dir,
        client_name=client_name,
        topic=topic,
        new_folder_if_exists=new_folder_if_exists,
        topic_creates_variant=topic_creates_variant,
    )
    dest = clients_dir / resolved_name

    if dest.exists():
        raise FileExistsError(f"이미 존재하는 클라이언트입니다: {dest}")

    shutil.copytree(template_dir, dest)

    spec_path = dest / "deck_spec.yaml"
    if spec_path.exists():
        spec = initialize_deck_spec_defaults(load_yaml(spec_path), resolved_name, topic)
        save_yaml(spec_path, spec)

    if update_brief_topic:
        inject_topic_to_brief(dest / "brief.md", topic)

    return {
        "client_name": client_name,
        "resolved_name": resolved_name,
        "dest": str(dest),
    }
