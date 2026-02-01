#!/usr/bin/env python3
"""
deck_cli.py - 통합 CLI for Value Architect Agent

워크플로우 오케스트레이션:
  - new: 새 클라이언트 팩 생성
  - validate: Deck Spec 스키마 검증
  - render: PPTX 렌더링
  - qa: 렌더링된 PPTX QA 검사
  - pipeline: 전체 파이프라인 (validate → render)
  - full-pipeline: 전체 파이프라인 + QA (validate → render → qa)
  - status: 클라이언트 상태 확인
  - list: 모든 클라이언트 목록
"""

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

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
    print(f"  3. 리서치 후 sources.md 업데이트")
    print(f"  4. deck_outline.md → deck_spec.yaml 작성")
    print(f"  5. python scripts/deck_cli.py pipeline {client_name}")

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
    warnings = validate_business_rules(spec)

    print(f"✓ Deck Spec 검증 통과: {spec_path}")

    if warnings:
        print(f"\n경고 ({len(warnings)}개):")
        for w in warnings:
            print(f"  ⚠ {w}")

    # 슬라이드 요약 출력
    slides = spec.get("slides", [])
    print(f"\n슬라이드 수: {len(slides)}")
    for i, slide in enumerate(slides, 1):
        layout = slide.get("layout", "unknown")
        title = slide.get("title", "Untitled")[:40]
        bullets = len(slide.get("bullets", []))
        print(f"  {i:2}. [{layout:15}] {title}... (bullets: {bullets})")

    return 0


def validate_business_rules(spec: dict) -> list:
    """비즈니스 규칙 검증 (경고 반환)"""
    warnings = []

    slides = spec.get("slides", [])

    for i, slide in enumerate(slides, 1):
        bullets = slide.get("bullets", [])
        layout = slide.get("layout", "")

        # 불릿 수 검증 (cover, section_divider 제외)
        if layout not in ("cover", "section_divider"):
            if len(bullets) > 6:
                warnings.append(f"슬라이드 {i}: 불릿이 6개를 초과합니다 ({len(bullets)}개)")
            elif len(bullets) < 3 and len(bullets) > 0:
                warnings.append(f"슬라이드 {i}: 불릿이 3개 미만입니다 ({len(bullets)}개)")

        # 불릿 길이 검증
        for j, bullet in enumerate(bullets, 1):
            if len(bullet) > 80:
                warnings.append(f"슬라이드 {i}, 불릿 {j}: 80자 초과 ({len(bullet)}자)")

        # governing_message 길이 검증
        gm = slide.get("governing_message", "")
        if len(gm) > 100:
            warnings.append(f"슬라이드 {i}: governing_message가 100자 초과 ({len(gm)}자)")

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

        # 가장 최근 파일 선택
        pptx_path = max(pptx_files, key=lambda x: x.stat().st_mtime)

    if not pptx_path.exists():
        print(f"Error: 파일을 찾을 수 없습니다: {pptx_path}")
        return 1

    spec_path = client_dir / "deck_spec.yaml"
    tokens_path = TEMPLATES_DIR / "tokens.yaml"

    # QA 실행
    try:
        from qa_ppt import PPTQAChecker
        checker = PPTQAChecker(
            pptx_path=str(pptx_path),
            spec_path=str(spec_path) if spec_path.exists() else None,
            tokens_path=str(tokens_path) if tokens_path.exists() else None
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
        cmd = [
            sys.executable,
            str(SCRIPT_DIR / "qa_ppt.py"),
            str(pptx_path),
            "--spec", str(spec_path) if spec_path.exists() else "",
            "--tokens", str(tokens_path) if tokens_path.exists() else "",
        ]
        # 빈 문자열 제거
        cmd = [c for c in cmd if c]

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
    """전체 파이프라인 + QA 실행 (validate → render → qa)"""
    client_name = args.client_name

    print(f"=== Full Pipeline 시작: {client_name} ===\n")

    # Step 1: Validate
    print("[1/3] 스키마 검증 중...")
    args.schema = None
    if cmd_validate(args) != 0:
        print("\n✗ 검증 실패. 파이프라인 중단.")
        return 1

    # Step 2: Render
    print("\n[2/3] PPTX 렌더링 중...")
    args.output = None
    args.template = None
    if cmd_render(args) != 0:
        print("\n✗ 렌더링 실패. 파이프라인 중단.")
        return 1

    # Step 3: QA
    print("\n[3/3] QA 검사 중...")
    args.pptx = None  # 가장 최근 파일 사용
    args.output = None
    qa_result = cmd_qa(args)

    if qa_result != 0:
        print("\n⚠ QA 검사에서 이슈가 발견되었습니다.")
        if not args.ignore_qa_errors:
            print("  - 이슈를 수정 후 다시 실행하거나")
            print("  - --ignore-qa-errors 옵션으로 경고 무시 가능")
            return 1
        else:
            print("  - QA 오류 무시 모드로 계속 진행")

    print(f"\n=== Full Pipeline 완료: {client_name} ===")
    return 0


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
        ("deck_outline.md", "덱 아웃라인"),
        ("deck_spec.yaml", "덱 스펙"),
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
  %(prog)s status my-client        # 상태 확인
  %(prog)s validate my-client      # 스키마 검증
  %(prog)s render my-client        # PPTX 렌더링
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

    # pipeline
    p_pipeline = subparsers.add_parser("pipeline", help="전체 파이프라인 (validate → render)")
    p_pipeline.add_argument("client_name", help="클라이언트 이름")
    p_pipeline.set_defaults(func=cmd_pipeline)

    # full-pipeline
    p_full = subparsers.add_parser("full-pipeline", help="전체 파이프라인 + QA (validate → render → qa)")
    p_full.add_argument("client_name", help="클라이언트 이름")
    p_full.add_argument("--ignore-qa-errors", action="store_true", help="QA 오류 무시하고 계속 진행")
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
