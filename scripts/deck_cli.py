#!/usr/bin/env python3
"""
deck_cli.py - 통합 CLI for Value Architect Agent

워크플로우 오케스트레이션:
  - new: 새 클라이언트 팩 생성
  - predeck: 덱 작성 전 리서치 구조화 리포트 생성
  - analyze: 고객사 분석 전략/준비도 리포트 생성
  - recommend: 고객 요건/집중영역 기반 전략 추천
  - sync-layout: 고객 지정 레이아웃 선호를 deck_spec에 반영
  - densify: 본문 밀도 자동 보강 (표/차트 중심 슬라이드 보강)
  - enrich-evidence: 불릿 evidence/source_anchor 자동 보강
  - validate: Deck Spec 스키마 검증
  - render: PPTX 렌더링
  - qa: 렌더링된 PPTX QA 검사
  - polish: 렌더링된 PPTX 미세 편집
  - pipeline: 전체 파이프라인 (validate → render)
  - full-pipeline: 전체 파이프라인 + QA (+ optional polish)
  - status: 클라이언트 상태 확인
  - list: 모든 클라이언트 목록
"""

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional, List

import yaml

# Repository root detection
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CLIENTS_DIR = REPO_ROOT / "clients"
TEMPLATE_DIR = CLIENTS_DIR / "_template"
SCHEMA_DIR = REPO_ROOT / "schema"
TEMPLATES_DIR = REPO_ROOT / "templates" / "company"


def load_yaml(path: Path) -> dict:
    """YAML 파일 로드"""
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_json(path: Path) -> dict:
    """JSON 파일 로드"""
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_yaml(path: Path, data: dict) -> None:
    """YAML 파일 저장"""
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)


def get_client_dir(client_name: str) -> Path:
    """클라이언트 디렉토리 경로 반환"""
    return CLIENTS_DIR / client_name


def client_exists(client_name: str) -> bool:
    """클라이언트 존재 여부 확인"""
    return get_client_dir(client_name).exists()


def get_all_clients() -> list:
    """모든 클라이언트 목록 반환 (_template 제외)"""
    if not CLIENTS_DIR.exists():
        return []
    return [
        d.name for d in CLIENTS_DIR.iterdir()
        if d.is_dir() and d.name != "_template" and not d.name.startswith(".")
    ]


def _bullet_text(item) -> str:
    """불릿 항목에서 텍스트를 추출"""
    if isinstance(item, str):
        return item
    if isinstance(item, dict):
        return str(item.get("text", ""))
    return ""


def _collect_slide_bullets(slide: dict) -> List[str]:
    """슬라이드의 bullets/columns/content_blocks에서 불릿 텍스트를 수집"""
    texts: List[str] = []

    # Top-level bullets
    for bullet in slide.get("bullets", []):
        text = _bullet_text(bullet).strip()
        if text:
            texts.append(text)

    # Columns bullets
    for column in slide.get("columns", []):
        for bullet in column.get("bullets", []):
            text = _bullet_text(bullet).strip()
            if text:
                texts.append(text)

        # Column-level content_blocks bullets
        for block in column.get("content_blocks", []):
            if block.get("type") == "bullets":
                for bullet in block.get("bullets", []):
                    text = _bullet_text(bullet).strip()
                    if text:
                        texts.append(text)

    # Slide-level content_blocks bullets
    for block in slide.get("content_blocks", []):
        if block.get("type") == "bullets":
            for bullet in block.get("bullets", []):
                text = _bullet_text(bullet).strip()
                if text:
                    texts.append(text)

    return texts


# =============================================================================
# Command: new
# =============================================================================
def cmd_new(args) -> int:
    """새 클라이언트 팩 생성"""
    client_name = args.client_name.strip()

    if not client_name:
        print("Error: 클라이언트 이름이 비어있습니다.")
        return 1

    # 이름 검증 (알파벳, 숫자, 하이픈, 언더스코어만 허용)
    import re
    if not re.match(r'^[a-zA-Z0-9_-]+$', client_name):
        print(f"Error: 클라이언트 이름은 영문, 숫자, 하이픈, 언더스코어만 가능합니다: {client_name}")
        return 1

    dest = get_client_dir(client_name)

    if dest.exists():
        print(f"Error: 이미 존재하는 클라이언트입니다: {dest}")
        return 1

    if not TEMPLATE_DIR.exists():
        print(f"Error: 템플릿 폴더를 찾을 수 없습니다: {TEMPLATE_DIR}")
        return 1

    # 템플릿 복사
    shutil.copytree(TEMPLATE_DIR, dest)

    # deck_spec.yaml 초기화 (날짜 자동 설정)
    spec_path = dest / "deck_spec.yaml"
    if spec_path.exists():
        spec = load_yaml(spec_path)
        spec["client_meta"] = spec.get("client_meta", {})
        spec["client_meta"]["client_name"] = client_name
        spec["client_meta"]["date"] = datetime.now().strftime("%Y-%m-%d")
        save_yaml(spec_path, spec)

    print(f"✓ 클라이언트 팩 생성 완료: {dest}")
    print(f"\n다음 단계:")
    print(f"  1. brief.md 작성: {dest / 'brief.md'}")
    print(f"  2. constraints.md 확인: {dest / 'constraints.md'}")
    print(f"  3. strategy_input.yaml에 고객 요건/집중영역 입력")
    print(f"  4. 리서치 후 sources.md 업데이트")
    print(f"  5. deck_outline.md → deck_spec.yaml 작성")
    print(f"  6. python scripts/deck_cli.py recommend {client_name} --apply-layout")
    print(f"  7. python scripts/deck_cli.py analyze {client_name}")
    print(f"  8. python scripts/deck_cli.py full-pipeline {client_name} --sync-layout --enrich-evidence --polish")

    return 0


# =============================================================================
# Command: validate
# =============================================================================
def cmd_validate(args) -> int:
    """Deck Spec 스키마 검증"""
    client_name = args.client_name

    if not client_exists(client_name):
        print(f"Error: 클라이언트를 찾을 수 없습니다: {client_name}")
        return 1

    client_dir = get_client_dir(client_name)
    spec_path = client_dir / "deck_spec.yaml"
    schema_path = args.schema or (SCHEMA_DIR / "deck_spec.schema.json")

    if not spec_path.exists():
        print(f"Error: deck_spec.yaml이 없습니다: {spec_path}")
        return 1

    if not schema_path.exists():
        print(f"Error: 스키마 파일이 없습니다: {schema_path}")
        return 1

    try:
        from jsonschema import Draft202012Validator
    except ImportError:
        print("Error: jsonschema 패키지가 필요합니다. pip install jsonschema")
        return 1

    spec = load_yaml(spec_path)
    schema = load_json(Path(schema_path))

    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(spec), key=lambda e: list(e.path))

    if errors:
        print(f"✗ Deck Spec 검증 실패: {spec_path}")
        for e in errors:
            path = ".".join([str(p) for p in e.path]) if e.path else "(root)"
            print(f"  - {path}: {e.message}")
        return 2

    # 추가 비즈니스 검증
    try:
        from validate_spec import (
            validate_business_rules as validate_business_rules_v2,
            parse_sources_anchors,
            validate_evidence_existence
        )
    except ImportError:
        validate_business_rules_v2 = None
        parse_sources_anchors = None
        validate_evidence_existence = None

    warnings = []
    infos = []
    if validate_business_rules_v2:
        business_issues = validate_business_rules_v2(spec)
        errors = [i for i in business_issues if i.severity == "error"]
        warnings = [i for i in business_issues if i.severity == "warning"]
        infos = [i for i in business_issues if i.severity == "info"]

        if errors:
            print(f"✗ Deck Spec 검증 실패: {spec_path}")
            for issue in errors:
                print(f"  - {issue.path}: {issue.message}")
            return 2

        # sources.md가 있으면 Evidence 앵커 존재 검사 추가
        if parse_sources_anchors and validate_evidence_existence:
            sources_path = client_dir / "sources.md"
            if sources_path.exists():
                source_anchors = parse_sources_anchors(sources_path)
                existence_issues = validate_evidence_existence(spec, source_anchors)
                warnings.extend([i for i in existence_issues if i.severity == "warning"])
                infos.extend([i for i in existence_issues if i.severity == "info"])
    else:
        warnings = validate_business_rules(spec)

    print(f"✓ Deck Spec 검증 통과: {spec_path}")

    if warnings:
        print(f"\n경고 ({len(warnings)}개):")
        for w in warnings:
            if isinstance(w, str):
                print(f"  ⚠ {w}")
            else:
                print(f"  ⚠ {w.path}: {w.message}")

    if infos:
        print(f"\n참고 ({len(infos)}개):")
        for info in infos:
            print(f"  ℹ {info.path}: {info.message}")

    # 슬라이드 요약 출력
    slides = spec.get("slides", [])
    print(f"\n슬라이드 수: {len(slides)}")
    for i, slide in enumerate(slides, 1):
        layout = slide.get("layout", "unknown")
        title = slide.get("title", "Untitled")[:40]
        bullets = len(_collect_slide_bullets(slide))
        print(f"  {i:2}. [{layout:15}] {title}... (bullets: {bullets})")

    return 0


def validate_business_rules(spec: dict) -> list:
    """비즈니스 규칙 검증 (경고 반환)"""
    warnings = []
    global_constraints = spec.get("global_constraints", {})
    no_bullet_layouts = {"cover", "section_divider", "thank_you", "quote"}
    visual_bullet_layouts = {"chart_focus", "image_focus"}
    chars_per_line = 42

    slides = spec.get("slides", [])

    for i, slide in enumerate(slides, 1):
        bullet_texts = _collect_slide_bullets(slide)
        layout = slide.get("layout", "")
        slide_constraints = slide.get("slide_constraints", {})

        max_bullets = slide_constraints.get(
            "max_bullets",
            global_constraints.get("default_max_bullets", 6)
        )
        max_chars = slide_constraints.get(
            "max_chars_per_bullet",
            global_constraints.get("default_max_chars_per_bullet", 100)
        )

        if layout in no_bullet_layouts:
            min_bullets, max_bullets = 0, 0
        elif layout in visual_bullet_layouts:
            min_bullets, max_bullets = 0, min(max_bullets, 4)
        else:
            min_bullets = 3

        # 불릿 수 검증 (cover, section_divider 제외)
        if len(bullet_texts) > max_bullets:
            if max_bullets == 0:
                warnings.append(f"슬라이드 {i}: {layout} 레이아웃에는 불릿이 없어야 합니다 ({len(bullet_texts)}개)")
            else:
                warnings.append(f"슬라이드 {i}: 불릿이 {max_bullets}개를 초과합니다 ({len(bullet_texts)}개)")
        elif len(bullet_texts) < min_bullets:
            warnings.append(f"슬라이드 {i}: 불릿이 {min_bullets}개 미만입니다 ({len(bullet_texts)}개)")

        # 불릿 길이 검증
        for j, text in enumerate(bullet_texts, 1):
            if len(text) > max_chars:
                warnings.append(f"슬라이드 {i}, 불릿 {j}: {max_chars}자 초과 ({len(text)}자)")
            estimated_lines = max(1, (len(text) - 1) // chars_per_line + 1)
            if estimated_lines > 2:
                warnings.append(f"슬라이드 {i}, 불릿 {j}: 2줄 초과 가능성 (추정 {estimated_lines}줄)")

        # governing_message 길이 검증
        gm = slide.get("governing_message", "")
        if len(gm) > 200:
            warnings.append(f"슬라이드 {i}: governing_message가 200자 초과 ({len(gm)}자)")

    return warnings


# =============================================================================
# Command: render
# =============================================================================
def cmd_render(args) -> int:
    """PPTX 렌더링"""
    client_name = args.client_name

    if not client_exists(client_name):
        print(f"Error: 클라이언트를 찾을 수 없습니다: {client_name}")
        return 1

    client_dir = get_client_dir(client_name)
    spec_path = client_dir / "deck_spec.yaml"

    # 출력 경로 결정
    if args.output:
        output_path = Path(args.output).resolve()
    else:
        outputs_dir = client_dir / "outputs"
        outputs_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = outputs_dir / f"{client_name}_{timestamp}.pptx"

    # 템플릿 경로
    template_path = Path(args.template) if args.template else (TEMPLATES_DIR / "base-template.pptx")
    tokens_path = TEMPLATES_DIR / "tokens.yaml"
    layouts_path = TEMPLATES_DIR / "layouts.yaml"

    # 필수 파일 확인
    if not spec_path.exists():
        print(f"Error: deck_spec.yaml이 없습니다: {spec_path}")
        return 1

    if not tokens_path.exists():
        print(f"Error: tokens.yaml이 없습니다: {tokens_path}")
        return 1

    if not layouts_path.exists():
        print(f"Error: layouts.yaml이 없습니다: {layouts_path}")
        return 1

    # 렌더링 실행
    try:
        from render_ppt import render
        render(spec_path, template_path, output_path, tokens_path, layouts_path)
        print(f"✓ PPTX 렌더링 완료: {output_path}")
        return 0
    except ImportError:
        # render_ppt.py를 직접 import할 수 없는 경우 subprocess로 실행
        import subprocess
        result = subprocess.run([
            sys.executable,
            str(SCRIPT_DIR / "render_ppt.py"),
            str(spec_path),
            str(template_path),
            str(output_path),
            str(TEMPLATES_DIR)
        ], capture_output=True, text=True)

        if result.returncode != 0:
            print(f"Error: 렌더링 실패")
            print(result.stderr)
            return 1

        print(result.stdout)
        return 0


# =============================================================================
# Command: qa
# =============================================================================
def cmd_qa(args) -> int:
    """렌더링된 PPTX QA 검사"""
    client_name = args.client_name

    if not client_exists(client_name):
        print(f"Error: 클라이언트를 찾을 수 없습니다: {client_name}")
        return 1

    client_dir = get_client_dir(client_name)
    outputs_dir = client_dir / "outputs"

    # PPTX 파일 찾기
    if args.pptx:
        pptx_path = Path(args.pptx)
    else:
        if not outputs_dir.exists():
            print(f"Error: 출력 폴더가 없습니다: {outputs_dir}")
            return 1

        pptx_files = list(outputs_dir.glob("*.pptx"))
        if not pptx_files:
            print(f"Error: PPTX 파일이 없습니다: {outputs_dir}")
            return 1

        # 기본은 가장 최근 원본 파일(_polished 제외), 없으면 전체에서 최근 파일
        raw_files = [f for f in pptx_files if "_polished" not in f.stem]
        candidate_files = raw_files if raw_files else pptx_files
        pptx_path = max(candidate_files, key=lambda x: x.stat().st_mtime)

    if not pptx_path.exists():
        print(f"Error: 파일을 찾을 수 없습니다: {pptx_path}")
        return 1

    spec_path = client_dir / "deck_spec.yaml"
    tokens_path = TEMPLATES_DIR / "tokens.yaml"
    sources_path = client_dir / "sources.md"

    # QA 실행
    try:
        from qa_ppt import PPTQAChecker
        checker = PPTQAChecker(
            pptx_path=str(pptx_path),
            spec_path=str(spec_path) if spec_path.exists() else None,
            tokens_path=str(tokens_path) if tokens_path.exists() else None,
            sources_path=str(sources_path) if sources_path.exists() else None
        )
        report = checker.run_all_checks()

        # 결과 출력
        print(report.to_markdown())

        # 보고서 저장
        if args.output:
            output_path = Path(args.output)
        else:
            output_path = outputs_dir / f"{pptx_path.stem}_qa_report.json"

        import json
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
        print(f"\n📄 QA 보고서 저장: {output_path}")

        return 0 if report.passed else 1

    except ImportError:
        # qa_ppt.py를 직접 import할 수 없는 경우 subprocess로 실행
        import subprocess
        cmd = [sys.executable, str(SCRIPT_DIR / "qa_ppt.py"), str(pptx_path)]
        if spec_path.exists():
            cmd.extend(["--spec", str(spec_path)])
        if tokens_path.exists():
            cmd.extend(["--tokens", str(tokens_path)])
        if sources_path.exists():
            cmd.extend(["--sources", str(sources_path)])
        if args.output:
            cmd.extend(["--output", str(args.output)])

        result = subprocess.run(cmd, capture_output=False, text=True)
        return result.returncode


# =============================================================================
# Command: polish
# =============================================================================
def cmd_polish(args) -> int:
    """렌더링된 PPTX 미세 편집"""
    client_name = args.client_name

    if not client_exists(client_name):
        print(f"Error: 클라이언트를 찾을 수 없습니다: {client_name}")
        return 1

    client_dir = get_client_dir(client_name)
    outputs_dir = client_dir / "outputs"

    # 입력 PPTX 결정
    input_pptx = getattr(args, "pptx", None)
    if input_pptx:
        pptx_path = Path(input_pptx)
    else:
        if not outputs_dir.exists():
            print(f"Error: 출력 폴더가 없습니다: {outputs_dir}")
            return 1
        pptx_files = list(outputs_dir.glob("*.pptx"))
        # 이미 polished인 파일은 제외해 원본 최신 파일 선택
        pptx_files = [f for f in pptx_files if "_polished" not in f.stem]
        if not pptx_files:
            print(f"Error: 원본 PPTX 파일이 없습니다: {outputs_dir}")
            return 1
        pptx_path = max(pptx_files, key=lambda x: x.stat().st_mtime)

    if not pptx_path.exists():
        print(f"Error: 파일을 찾을 수 없습니다: {pptx_path}")
        return 1

    # 출력 경로
    output_arg = getattr(args, "output", None)
    report_arg = getattr(args, "report", None)
    if output_arg:
        output_path = Path(output_arg).resolve()
    else:
        output_path = pptx_path.with_name(f"{pptx_path.stem}_polished.pptx")

    if report_arg:
        report_path = Path(report_arg).resolve()
    else:
        report_path = output_path.with_suffix(".polish.json")

    tokens_path = TEMPLATES_DIR / "tokens.yaml"

    try:
        from polish_ppt import polish_ppt
        result = polish_ppt(
            input_pptx=pptx_path,
            output_pptx=output_path,
            tokens_path=tokens_path if tokens_path.exists() else None,
            report_path=report_path
        )
        stats = result.get("stats", {})
        print(f"✓ PPTX 미세 편집 완료: {output_path}")
        print(
            "  - 폰트 변경: {font_updates}, 텍스트 정리: {text_normalizations}, 줄간격 조정: {line_spacing_updates}, weight 정리: {weight_normalizations}".format(
                font_updates=stats.get("font_updates", 0),
                text_normalizations=stats.get("text_normalizations", 0),
                line_spacing_updates=stats.get("line_spacing_updates", 0),
                weight_normalizations=stats.get("weight_normalizations", 0),
            )
        )
        print(f"  - 편집 로그: {report_path}")
        return 0
    except ImportError:
        import subprocess
        cmd = [sys.executable, str(SCRIPT_DIR / "polish_ppt.py"), str(pptx_path), "--output", str(output_path)]
        if tokens_path.exists():
            cmd.extend(["--tokens", str(tokens_path)])
        cmd.extend(["--report", str(report_path)])
        result = subprocess.run(cmd, capture_output=False, text=True)
        return result.returncode


# =============================================================================
# Command: pipeline
# =============================================================================
def cmd_pipeline(args) -> int:
    """전체 파이프라인 실행 (validate → render)"""
    client_name = args.client_name

    print(f"=== Pipeline 시작: {client_name} ===\n")

    # Step 1: Validate
    print("[1/2] 검증 중...")
    args.schema = None  # 기본 스키마 사용
    if cmd_validate(args) != 0:
        print("\n✗ 검증 실패. 파이프라인 중단.")
        return 1

    # Step 2: Render
    print("\n[2/2] 렌더링 중...")
    args.output = None  # 기본 출력 경로 사용
    args.template = None  # 기본 템플릿 사용
    if cmd_render(args) != 0:
        print("\n✗ 렌더링 실패. 파이프라인 중단.")
        return 1

    print(f"\n=== Pipeline 완료: {client_name} ===")
    return 0


# =============================================================================
# Command: full-pipeline (validate → render → qa)
# =============================================================================
def cmd_full_pipeline(args) -> int:
    """전체 파이프라인 + QA (+ optional polish) 실행"""
    client_name = args.client_name

    print(f"=== Full Pipeline 시작: {client_name} ===\n")

    pre_steps = []
    if not getattr(args, "skip_densify_content", False):
        pre_steps.append("densify_content")
    if getattr(args, "sync_layout", False):
        pre_steps.append("sync_layout")
    if getattr(args, "enrich_evidence", False):
        pre_steps.append("enrich_evidence")

    total_steps = 3 + len(pre_steps) + (1 if getattr(args, "polish", False) else 0)
    current_step = 1

    for step_name in pre_steps:
        if step_name == "densify_content":
            print(f"[{current_step}/{total_steps}] 본문 밀도 보강 중...")
            densify_args = argparse.Namespace(
                client_name=client_name,
                spec=None,
                output=None,
                dry_run=False,
            )
            if cmd_densify(densify_args) != 0:
                print("\n✗ 본문 밀도 보강 실패. 파이프라인 중단.")
                return 1

        elif step_name == "sync_layout":
            print(f"[{current_step}/{total_steps}] 레이아웃 선호 반영 중...")
            sync_args = argparse.Namespace(
                client_name=client_name,
                pref=None,
                output=None,
                dry_run=False,
            )
            if cmd_sync_layout(sync_args) != 0:
                print("\n✗ 레이아웃 반영 실패. 파이프라인 중단.")
                return 1

        elif step_name == "enrich_evidence":
            print(f"\n[{current_step}/{total_steps}] evidence 자동 보강 중...")
            enrich_args = argparse.Namespace(
                client_name=client_name,
                spec=None,
                sources=None,
                output=None,
                confidence=getattr(args, "evidence_confidence", "medium"),
                overwrite=getattr(args, "overwrite_evidence", False),
                dry_run=False,
            )
            if cmd_enrich_evidence(enrich_args) != 0:
                print("\n✗ evidence 보강 실패. 파이프라인 중단.")
                return 1

        current_step += 1

    # Step: Validate
    print(f"\n[{current_step}/{total_steps}] 스키마 검증 중...")
    args.schema = None
    if cmd_validate(args) != 0:
        print("\n✗ 검증 실패. 파이프라인 중단.")
        return 1
    current_step += 1

    # Step: Render
    print(f"\n[{current_step}/{total_steps}] PPTX 렌더링 중...")
    args.output = None
    args.template = None
    if cmd_render(args) != 0:
        print("\n✗ 렌더링 실패. 파이프라인 중단.")
        return 1
    current_step += 1

    # Step: QA
    print(f"\n[{current_step}/{total_steps}] QA 검사 중...")
    args.pptx = None  # 가장 최근 파일 사용
    args.output = None
    qa_result = cmd_qa(args)
    current_step += 1

    if qa_result != 0:
        print("\n⚠ QA 검사에서 이슈가 발견되었습니다.")
        if not args.ignore_qa_errors:
            print("  - 이슈를 수정 후 다시 실행하거나")
            print("  - --ignore-qa-errors 옵션으로 경고 무시 가능")
            return 1
        else:
            print("  - QA 오류 무시 모드로 계속 진행")

    # Step 4 (optional): Polish
    if getattr(args, "polish", False):
        print(f"\n[{current_step}/{total_steps}] PPT 미세 편집 중...")
        # 최근 원본 결과물을 대상으로 polish 실행
        args.pptx = None
        args.output = None
        args.report = None
        if cmd_polish(args) != 0:
            print("\n✗ 미세 편집 실패.")
            return 1

    print(f"\n=== Full Pipeline 완료: {client_name} ===")
    return 0


# =============================================================================
# Command: predeck
# =============================================================================
def cmd_predeck(args) -> int:
    """덱 작성 전 리서치 구조화 리포트 생성"""
    client_name = args.client_name

    if not client_exists(client_name):
        print(f"Error: 클라이언트를 찾을 수 없습니다: {client_name}")
        return 1

    try:
        from predeck_research import main as predeck_main
    except ImportError:
        print("Error: predeck_research 모듈을 불러올 수 없습니다.")
        return 1

    # predeck_research.main()은 argparse를 사용하므로 subprocess 호출
    import subprocess
    cmd = [sys.executable, str(SCRIPT_DIR / "predeck_research.py"), client_name]
    if getattr(args, "output", None):
        cmd.extend(["--output", str(Path(args.output).resolve())])
    if getattr(args, "json", None):
        cmd.extend(["--json", str(Path(args.json).resolve())])

    result = subprocess.run(cmd, capture_output=False, text=True)
    return result.returncode


# =============================================================================
# Command: status
# =============================================================================
def cmd_analyze(args) -> int:
    """고객사 분석 전략/준비도 리포트 생성"""
    target_all = getattr(args, "all", False)
    client_name = getattr(args, "client_name", None)

    try:
        from analyze_client import analyze_client, write_reports
    except ImportError:
        print("Error: analyze_client 모듈을 불러올 수 없습니다.")
        return 1

    if target_all:
        clients = get_all_clients()
        if not clients:
            print("분석할 클라이언트가 없습니다.")
            return 1

        reports = []
        for name in sorted(clients):
            try:
                report = analyze_client(name)
            except FileNotFoundError as exc:
                print(f"⚠ 건너뜀: {exc}")
                continue

            client_dir = get_client_dir(name)
            md_path = client_dir / "analysis_report.md"
            json_path = client_dir / "analysis_report.json"
            write_reports(report, md_path, json_path)
            reports.append(report)
            print(f"✓ {name}: {md_path}")

        if not reports:
            print("생성된 리포트가 없습니다.")
            return 1

        summary_dir = REPO_ROOT / "reports"
        summary_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        md_summary_path = summary_dir / f"client_analysis_summary_{timestamp}.md"
        json_summary_path = summary_dir / f"client_analysis_summary_{timestamp}.json"

        lines = [
            "# Client Analysis Summary",
            "",
            f"- Generated at: {datetime.now().isoformat(timespec='seconds')}",
            f"- Clients analyzed: {len(reports)}",
            "",
            "| Client | Readiness | Maturity | Spec Errors | Spec Warnings | Gap Count |",
            "|---|---:|---|---:|---:|---:|",
        ]

        for report in reports:
            readiness = report.get("readiness", {})
            spec_v = report.get("spec_validation", {})
            lines.append(
                f"| {report['client_name']} | {readiness.get('overall_score', 0)} | "
                f"{readiness.get('maturity', 'N/A')} | {spec_v.get('errors', 0)} | "
                f"{spec_v.get('warnings', 0)} | {len(report.get('gaps', []))} |"
            )

        md_summary_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
        json_summary_path.write_text(json.dumps(reports, ensure_ascii=False, indent=2), encoding="utf-8")

        print(f"\n✓ 전체 요약 리포트: {md_summary_path}")
        print(f"✓ 전체 요약 JSON: {json_summary_path}")
        return 0

    if not client_name:
        print("Error: client_name 또는 --all 중 하나를 지정하세요.")
        return 1

    if not client_exists(client_name):
        print(f"Error: 클라이언트를 찾을 수 없습니다: {client_name}")
        return 1

    report = analyze_client(client_name)
    client_dir = get_client_dir(client_name)
    md_path = Path(args.output).resolve() if getattr(args, "output", None) else (client_dir / "analysis_report.md")
    json_path = Path(args.json).resolve() if getattr(args, "json", None) else (client_dir / "analysis_report.json")
    write_reports(report, md_path, json_path)

    readiness = report["readiness"]
    print(f"✓ 분석 리포트 생성: {md_path}")
    print(f"✓ JSON 리포트 생성: {json_path}")
    print(f"  - Readiness: {readiness['overall_score']}/100 ({readiness['maturity']})")

    if report.get("gaps"):
        print("\n주요 갭:")
        for gap in report["gaps"][:5]:
            print(f"  - [{gap['severity']}] {gap['item']}")

    return 0


# =============================================================================
# Command: recommend
# =============================================================================
def cmd_recommend(args) -> int:
    """고객 요건/집중영역 입력 기반 전략 추천 리포트 생성"""
    client_name = args.client_name

    if not client_exists(client_name):
        print(f"Error: 클라이언트를 찾을 수 없습니다: {client_name}")
        return 1

    client_dir = get_client_dir(client_name)
    input_path = Path(args.input).resolve() if getattr(args, "input", None) else (client_dir / "strategy_input.yaml")

    try:
        from recommend_strategy import recommend_for_client, write_outputs
    except ImportError:
        print("Error: recommend_strategy 모듈을 불러올 수 없습니다.")
        return 1

    try:
        report, generated_pref = recommend_for_client(client_name, input_path)
    except FileNotFoundError as exc:
        print(f"Error: {exc}")
        print(f"Hint: 템플릿 파일을 생성하려면 `clients/_template/strategy_input.yaml`을 참고하세요.")
        return 1

    md_path = Path(args.output).resolve() if getattr(args, "output", None) else (client_dir / "strategy_report.md")
    json_path = Path(args.json).resolve() if getattr(args, "json", None) else (client_dir / "strategy_report.json")
    pref_path = Path(args.pref_output).resolve() if getattr(args, "pref_output", None) else (client_dir / "layout_preferences.generated.yaml")

    write_outputs(report, generated_pref, md_path, json_path, pref_path)

    print(f"✓ 전략 리포트 생성: {md_path}")
    print(f"✓ JSON 리포트 생성: {json_path}")
    print(f"✓ 생성 레이아웃 선호: {pref_path}")

    top_focus = report.get("focus_priority", [])
    if top_focus:
        labels = ", ".join([item.get("label", "") for item in top_focus[:3]])
        print(f"  - Top focus: {labels}")
    print(f"  - 권장 슬라이드 수: {len(report.get('recommended_layout_sequence', []))}")

    if getattr(args, "apply_layout", False):
        print("\n생성 레이아웃 선호를 deck_spec.yaml에 즉시 반영합니다... (안전모드: 키워드 기반)")
        try:
            from layout_sync import load_yaml as load_layout_yaml, save_yaml as save_layout_yaml, apply_layout_preferences
        except ImportError:
            print("⚠ layout_sync 모듈을 불러오지 못해 자동 반영을 건너뜁니다.")
            return 1

        spec_path = client_dir / "deck_spec.yaml"
        spec = load_layout_yaml(spec_path)
        apply_pref = dict(generated_pref)
        apply_pref["layout_sequence"] = []  # 안전모드: 위치 강제 치환 방지
        updated_spec, changes, warnings = apply_layout_preferences(spec, apply_pref)

        for warning in warnings:
            print(f"⚠ {warning}")

        if not changes:
            print("✓ 안전모드 적용 변경사항이 없습니다.")
            return 0

        save_layout_yaml(spec_path, updated_spec)
        print(f"✓ 안전모드 레이아웃 반영 {len(changes)}건: {spec_path}")
        for line in changes[:20]:
            print(f"  - {line}")

    return 0


# =============================================================================
# Command: sync-layout
# =============================================================================
def cmd_sync_layout(args) -> int:
    """layout_preferences를 deck_spec.yaml에 동기화"""
    client_name = args.client_name

    if not client_exists(client_name):
        print(f"Error: 클라이언트를 찾을 수 없습니다: {client_name}")
        return 1

    client_dir = get_client_dir(client_name)
    spec_path = client_dir / "deck_spec.yaml"
    pref_path = Path(args.pref).resolve() if args.pref else (client_dir / "layout_preferences.yaml")

    if not spec_path.exists():
        print(f"Error: deck_spec.yaml이 없습니다: {spec_path}")
        return 1
    if not pref_path.exists():
        print(f"Error: layout preferences 파일이 없습니다: {pref_path}")
        return 1

    try:
        from layout_sync import load_yaml as load_layout_yaml, save_yaml as save_layout_yaml, apply_layout_preferences
    except ImportError:
        print("Error: layout_sync 모듈을 불러올 수 없습니다.")
        return 1

    spec = load_layout_yaml(spec_path)
    pref = load_layout_yaml(pref_path)
    updated_spec, changes, warnings = apply_layout_preferences(spec, pref)

    for w in warnings:
        print(f"⚠ {w}")

    if not changes:
        print("✓ 적용할 레이아웃 변경사항이 없습니다.")
        return 0

    print(f"✓ 레이아웃 변경사항 {len(changes)}건")
    for line in changes[:30]:
        print(f"  - {line}")

    if args.dry_run:
        print("\n(dry-run) 파일 저장 없이 종료")
        return 0

    output_path = Path(args.output).resolve() if args.output else spec_path
    save_layout_yaml(output_path, updated_spec)
    print(f"✓ 저장 완료: {output_path}")
    return 0


# =============================================================================
# Command: enrich-evidence
# =============================================================================
def cmd_enrich_evidence(args) -> int:
    """deck_spec 불릿 evidence 자동 보강"""
    client_name = args.client_name

    if not client_exists(client_name):
        print(f"Error: 클라이언트를 찾을 수 없습니다: {client_name}")
        return 1

    client_dir = get_client_dir(client_name)
    spec_path = Path(args.spec).resolve() if getattr(args, "spec", None) else (client_dir / "deck_spec.yaml")
    sources_path = Path(args.sources).resolve() if getattr(args, "sources", None) else (client_dir / "sources.md")

    if not spec_path.exists():
        print(f"Error: deck_spec.yaml이 없습니다: {spec_path}")
        return 1
    if not sources_path.exists():
        print(f"Error: sources.md가 없습니다: {sources_path}")
        return 1

    try:
        from enrich_evidence import load_yaml as load_enrich_yaml, save_yaml as save_enrich_yaml
        from enrich_evidence import parse_anchors_from_sources, enrich_spec
    except ImportError:
        print("Error: enrich_evidence 모듈을 불러올 수 없습니다.")
        return 1

    spec = load_enrich_yaml(spec_path)
    anchors = parse_anchors_from_sources(sources_path)
    if not anchors:
        print("Error: sources.md에서 사용 가능한 앵커를 찾지 못했습니다.")
        return 1

    updated_spec, stats = enrich_spec(
        spec=spec,
        anchors=anchors,
        confidence=getattr(args, "confidence", "medium"),
        overwrite=getattr(args, "overwrite", False),
    )

    print(f"✓ anchors: {len(anchors)}개")
    print(
        "✓ bullets total: {total}, updated: {updated}".format(
            total=stats.get("bullets_total", 0),
            updated=stats.get("bullets_updated", 0),
        )
    )
    if stats.get("slides_without_anchor", 0) > 0:
        print(f"⚠ 기본 앵커 추론 실패 슬라이드: {stats['slides_without_anchor']}개")

    if stats.get("bullets_updated", 0) == 0:
        print("✓ evidence 보강할 불릿이 없습니다.")
        return 0

    if getattr(args, "dry_run", False):
        print("(dry-run) 파일 저장 없이 종료")
        return 0

    output_path = Path(args.output).resolve() if getattr(args, "output", None) else spec_path
    save_enrich_yaml(output_path, updated_spec)
    print(f"✓ 저장 완료: {output_path}")
    return 0


# =============================================================================
# Command: densify
# =============================================================================
def cmd_densify(args) -> int:
    """deck_spec 본문 밀도 자동 보강"""
    client_name = args.client_name

    if not client_exists(client_name):
        print(f"Error: 클라이언트를 찾을 수 없습니다: {client_name}")
        return 1

    try:
        from densify_spec import main as _densify_main  # noqa: F401
    except ImportError:
        print("Error: densify_spec 모듈을 불러올 수 없습니다.")
        return 1

    import subprocess

    cmd = [sys.executable, str(SCRIPT_DIR / "densify_spec.py"), client_name]
    if getattr(args, "spec", None):
        cmd.extend(["--spec", str(Path(args.spec).resolve())])
    if getattr(args, "output", None):
        cmd.extend(["--output", str(Path(args.output).resolve())])
    if getattr(args, "dry_run", False):
        cmd.append("--dry-run")

    result = subprocess.run(cmd, capture_output=False, text=True)
    return result.returncode


# =============================================================================
# Command: status
# =============================================================================
def cmd_status(args) -> int:
    """클라이언트 상태 확인"""
    client_name = args.client_name

    if not client_exists(client_name):
        print(f"Error: 클라이언트를 찾을 수 없습니다: {client_name}")
        return 1

    client_dir = get_client_dir(client_name)

    print(f"=== 클라이언트 상태: {client_name} ===\n")

    # 필수 파일 체크
    required_files = [
        ("brief.md", "클라이언트 브리프"),
        ("constraints.md", "제약사항"),
        ("sources.md", "출처 목록"),
        ("research_report.md", "덱 전 리서치 구조화 리포트"),
        ("deck_outline.md", "덱 아웃라인"),
        ("deck_spec.yaml", "덱 스펙"),
        ("layout_preferences.yaml", "레이아웃 선호 설정"),
        ("strategy_input.yaml", "요건/집중영역 입력 (권장)"),
        ("analysis_report.md", "고객사 분석 리포트"),
        ("strategy_report.md", "요건 기반 전략 리포트 (권장)"),
        ("lessons.md", "학습 내용"),
    ]

    print("파일 상태:")
    for filename, desc in required_files:
        path = client_dir / filename
        if path.exists():
            size = path.stat().st_size
            status = f"✓ {size:>6} bytes"
        else:
            status = "✗ 없음"
        print(f"  {status}  {filename:20} ({desc})")

    # outputs 폴더 확인
    outputs_dir = client_dir / "outputs"
    if outputs_dir.exists():
        pptx_files = list(outputs_dir.glob("*.pptx"))
        print(f"\n출력 파일 ({len(pptx_files)}개):")
        for f in sorted(pptx_files, key=lambda x: x.stat().st_mtime, reverse=True)[:5]:
            mtime = datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M")
            print(f"  - {f.name} ({mtime})")
    else:
        print("\n출력 파일: 없음")

    # deck_spec 요약
    spec_path = client_dir / "deck_spec.yaml"
    if spec_path.exists():
        spec = load_yaml(spec_path)
        meta = spec.get("client_meta", {})
        slides = spec.get("slides", [])
        print(f"\nDeck Spec 요약:")
        print(f"  클라이언트: {meta.get('client_name', 'N/A')}")
        print(f"  산업: {meta.get('industry', 'N/A')}")
        print(f"  날짜: {meta.get('date', 'N/A')}")
        print(f"  슬라이드 수: {len(slides)}")

    return 0


# =============================================================================
# Command: list
# =============================================================================
def cmd_list(args) -> int:
    """모든 클라이언트 목록"""
    clients = get_all_clients()

    if not clients:
        print("등록된 클라이언트가 없습니다.")
        print(f"\n새 클라이언트 생성: python scripts/deck_cli.py new <client-name>")
        return 0

    print(f"=== 클라이언트 목록 ({len(clients)}개) ===\n")

    for client in sorted(clients):
        client_dir = get_client_dir(client)
        spec_path = client_dir / "deck_spec.yaml"

        # 상태 아이콘
        if spec_path.exists():
            spec = load_yaml(spec_path)
            slides = len(spec.get("slides", []))
            status = f"[{slides:2} slides]"
        else:
            status = "[no spec]"

        # 최근 출력 확인
        outputs_dir = client_dir / "outputs"
        if outputs_dir.exists():
            pptx_files = list(outputs_dir.glob("*.pptx"))
            if pptx_files:
                latest = max(pptx_files, key=lambda x: x.stat().st_mtime)
                mtime = datetime.fromtimestamp(latest.stat().st_mtime).strftime("%m/%d")
                status += f" → PPTX ({mtime})"

        print(f"  {client:30} {status}")

    return 0


# =============================================================================
# Main
# =============================================================================
def main():
    parser = argparse.ArgumentParser(
        description="Value Architect Agent CLI - 컨설팅 덱 생성 워크플로우",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
예시:
  %(prog)s new my-client           # 새 클라이언트 생성
  %(prog)s predeck my-client       # 덱 전 리서치 구조화 리포트
  %(prog)s analyze my-client       # 고객사 분석 전략/준비도 리포트
  %(prog)s recommend my-client     # 요건 입력 기반 전략 추천
  %(prog)s sync-layout my-client   # 레이아웃 선호를 deck_spec에 반영
  %(prog)s densify my-client       # 본문 밀도 자동 보강
  %(prog)s enrich-evidence my-client # 불릿 evidence 자동 보강
  %(prog)s analyze --all           # 전체 고객사 분석 요약
  %(prog)s status my-client        # 상태 확인
  %(prog)s validate my-client      # 스키마 검증
  %(prog)s render my-client        # PPTX 렌더링
  %(prog)s polish my-client        # PPTX 미세 편집
  %(prog)s pipeline my-client      # 전체 파이프라인
  %(prog)s list                    # 클라이언트 목록
        """
    )

    subparsers = parser.add_subparsers(dest="command", help="명령어")

    # new
    p_new = subparsers.add_parser("new", help="새 클라이언트 팩 생성")
    p_new.add_argument("client_name", help="클라이언트 이름 (영문, 숫자, 하이픈, 언더스코어)")
    p_new.set_defaults(func=cmd_new)

    # validate
    p_validate = subparsers.add_parser("validate", help="Deck Spec 스키마 검증")
    p_validate.add_argument("client_name", help="클라이언트 이름")
    p_validate.add_argument("--schema", help="커스텀 스키마 경로 (기본: schema/deck_spec.schema.json)")
    p_validate.set_defaults(func=cmd_validate)

    # predeck
    p_predeck = subparsers.add_parser("predeck", help="덱 작성 전 리서치 구조화 리포트 생성")
    p_predeck.add_argument("client_name", help="클라이언트 이름")
    p_predeck.add_argument("--output", "-o", help="리포트(Markdown) 출력 경로")
    p_predeck.add_argument("--json", help="리포트(JSON) 출력 경로")
    p_predeck.set_defaults(func=cmd_predeck)

    # render
    p_render = subparsers.add_parser("render", help="PPTX 렌더링")
    p_render.add_argument("client_name", help="클라이언트 이름")
    p_render.add_argument("--output", "-o", help="출력 파일 경로 (기본: outputs/<client>_<timestamp>.pptx)")
    p_render.add_argument("--template", "-t", help="템플릿 경로 (기본: templates/company/base-template.pptx)")
    p_render.set_defaults(func=cmd_render)

    # qa
    p_qa = subparsers.add_parser("qa", help="렌더링된 PPTX QA 검사")
    p_qa.add_argument("client_name", help="클라이언트 이름")
    p_qa.add_argument("--pptx", help="검사할 PPTX 파일 (기본: 가장 최근 출력)")
    p_qa.add_argument("--output", "-o", help="QA 보고서 출력 경로")
    p_qa.set_defaults(func=cmd_qa)

    # polish
    p_polish = subparsers.add_parser("polish", help="렌더링된 PPTX 미세 편집")
    p_polish.add_argument("client_name", help="클라이언트 이름")
    p_polish.add_argument("--pptx", help="편집할 PPTX 파일 (기본: 최근 원본)")
    p_polish.add_argument("--output", "-o", help="편집된 PPTX 출력 경로")
    p_polish.add_argument("--report", help="편집 로그(JSON) 출력 경로")
    p_polish.set_defaults(func=cmd_polish)

    # analyze
    p_analyze = subparsers.add_parser("analyze", help="고객사 분석 전략/준비도 리포트 생성")
    p_analyze.add_argument("client_name", nargs="?", help="클라이언트 이름")
    p_analyze.add_argument("--all", action="store_true", help="모든 클라이언트 분석")
    p_analyze.add_argument("--output", "-o", help="분석 리포트(Markdown) 출력 경로")
    p_analyze.add_argument("--json", help="분석 리포트(JSON) 출력 경로")
    p_analyze.set_defaults(func=cmd_analyze)

    # recommend
    p_recommend = subparsers.add_parser("recommend", help="고객 요건/집중영역 기반 전략 추천")
    p_recommend.add_argument("client_name", help="클라이언트 이름")
    p_recommend.add_argument("--input", help="요건 입력 파일 경로 (기본: clients/<client>/strategy_input.yaml)")
    p_recommend.add_argument("--output", "-o", help="전략 리포트(Markdown) 출력 경로")
    p_recommend.add_argument("--json", help="전략 리포트(JSON) 출력 경로")
    p_recommend.add_argument("--pref-output", help="생성 layout_preferences 출력 경로")
    p_recommend.add_argument("--apply-layout", action="store_true", help="생성 레이아웃을 키워드 기반 안전모드로 즉시 deck_spec에 반영")
    p_recommend.set_defaults(func=cmd_recommend)

    # sync-layout
    p_sync = subparsers.add_parser("sync-layout", help="layout_preferences를 deck_spec에 반영")
    p_sync.add_argument("client_name", help="클라이언트 이름")
    p_sync.add_argument("--pref", help="layout_preferences.yaml 경로 (기본: clients/<client>/layout_preferences.yaml)")
    p_sync.add_argument("--output", "-o", help="적용 결과 출력 경로 (기본: deck_spec.yaml 덮어쓰기)")
    p_sync.add_argument("--dry-run", action="store_true", help="변경사항만 확인하고 저장하지 않음")
    p_sync.set_defaults(func=cmd_sync_layout)

    # densify
    p_densify = subparsers.add_parser("densify", help="deck_spec 본문 밀도 자동 보강")
    p_densify.add_argument("client_name", help="클라이언트 이름")
    p_densify.add_argument("--spec", help="deck_spec.yaml 경로 (기본: clients/<client>/deck_spec.yaml)")
    p_densify.add_argument("--output", "-o", help="출력 경로 (기본: deck_spec.yaml 덮어쓰기)")
    p_densify.add_argument("--dry-run", action="store_true", help="변경사항만 확인하고 저장하지 않음")
    p_densify.set_defaults(func=cmd_densify)

    # enrich-evidence
    p_enrich = subparsers.add_parser("enrich-evidence", help="deck_spec 불릿 evidence 자동 보강")
    p_enrich.add_argument("client_name", help="클라이언트 이름")
    p_enrich.add_argument("--spec", help="deck_spec.yaml 경로 (기본: clients/<client>/deck_spec.yaml)")
    p_enrich.add_argument("--sources", help="sources.md 경로 (기본: clients/<client>/sources.md)")
    p_enrich.add_argument("--output", "-o", help="출력 경로 (기본: deck_spec.yaml 덮어쓰기)")
    p_enrich.add_argument("--confidence", default="medium", help="evidence confidence 기본값")
    p_enrich.add_argument("--overwrite", action="store_true", help="기존 evidence도 덮어쓰기")
    p_enrich.add_argument("--dry-run", action="store_true", help="변경사항만 확인하고 저장하지 않음")
    p_enrich.set_defaults(func=cmd_enrich_evidence)

    # pipeline
    p_pipeline = subparsers.add_parser("pipeline", help="전체 파이프라인 (validate → render)")
    p_pipeline.add_argument("client_name", help="클라이언트 이름")
    p_pipeline.set_defaults(func=cmd_pipeline)

    # full-pipeline
    p_full = subparsers.add_parser("full-pipeline", help="전체 파이프라인 + QA (+optional polish)")
    p_full.add_argument("client_name", help="클라이언트 이름")
    p_full.add_argument("--sync-layout", action="store_true", help="검증 전 layout_preferences를 deck_spec에 반영")
    p_full.add_argument("--enrich-evidence", action="store_true", help="검증 전 evidence/source_anchor 자동 보강")
    p_full.add_argument("--evidence-confidence", default="medium", help="--enrich-evidence 시 기본 confidence")
    p_full.add_argument("--overwrite-evidence", action="store_true", help="--enrich-evidence 시 기존 evidence도 덮어쓰기")
    p_full.add_argument("--skip-densify-content", action="store_true", help="본문 밀도 자동 보강 단계 건너뛰기")
    p_full.add_argument("--ignore-qa-errors", action="store_true", help="QA 오류 무시하고 계속 진행")
    p_full.add_argument("--polish", action="store_true", help="QA 후 미세 편집까지 수행")
    p_full.set_defaults(func=cmd_full_pipeline)

    # status
    p_status = subparsers.add_parser("status", help="클라이언트 상태 확인")
    p_status.add_argument("client_name", help="클라이언트 이름")
    p_status.set_defaults(func=cmd_status)

    # list
    p_list = subparsers.add_parser("list", help="모든 클라이언트 목록")
    p_list.set_defaults(func=cmd_list)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
