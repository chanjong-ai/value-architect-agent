#!/usr/bin/env python3
"""
validate_spec.py - Deck Spec 검증기 v2.1

기능:
1. JSON Schema (Draft 2020-12) 기반 구조 검증
2. 비즈니스 규칙 검증 (불릿 개수/길이, columns 불릿 등)
3. global_constraints + slide_constraints 적용
4. Evidence 앵커 포맷 검증

사용법:
    python scripts/validate_spec.py <deck_spec.yaml> <schema.json> [--strict]
"""

import json
import re
import sys
from pathlib import Path
from typing import List, Tuple

import yaml
from jsonschema import Draft202012Validator

# 상수 임포트 시도
try:
    from constants import (
        BULLET_MAX_CHARS, BULLET_MAX_COUNT, BULLET_MIN_COUNT,
        TITLE_MAX_CHARS, GOVERNING_MAX_CHARS,
        NO_BULLET_LAYOUTS, COLUMN_LAYOUTS, EVIDENCE_ANCHOR_PATTERN,
        get_max_bullets, get_max_chars_per_bullet, get_forbidden_words
    )
except ImportError:
    # 폴백 상수
    BULLET_MAX_CHARS = 100
    BULLET_MAX_COUNT = 6
    BULLET_MIN_COUNT = 3
    TITLE_MAX_CHARS = 100
    GOVERNING_MAX_CHARS = 200
    NO_BULLET_LAYOUTS = ["cover", "section_divider", "thank_you", "quote"]
    COLUMN_LAYOUTS = ["two_column", "three_column", "comparison"]
    EVIDENCE_ANCHOR_PATTERN = r"^sources\.md#[\w-]+$"

    def get_max_bullets(gc=None, sc=None):
        if sc and "max_bullets" in sc:
            return sc["max_bullets"]
        if gc and "default_max_bullets" in gc:
            return gc["default_max_bullets"]
        return BULLET_MAX_COUNT

    def get_max_chars_per_bullet(gc=None, sc=None):
        if sc and "max_chars_per_bullet" in sc:
            return sc["max_chars_per_bullet"]
        if gc and "default_max_chars_per_bullet" in gc:
            return gc["default_max_chars_per_bullet"]
        return BULLET_MAX_CHARS

    def get_forbidden_words(gc=None, sc=None):
        words = []
        if gc and "forbidden_words" in gc:
            words.extend(gc["forbidden_words"])
        if sc and "forbidden_words" in sc:
            words.extend(sc["forbidden_words"])
        return list(set(words))


def load_yaml(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


class ValidationIssue:
    """검증 이슈"""
    def __init__(self, severity: str, path: str, message: str):
        self.severity = severity  # "error", "warning", "info"
        self.path = path
        self.message = message

    def __str__(self):
        icon = {"error": "❌", "warning": "⚠️", "info": "ℹ️"}.get(self.severity, "•")
        return f"{icon} [{self.severity.upper()}] {self.path}: {self.message}"


def validate_schema(spec: dict, schema: dict) -> List[ValidationIssue]:
    """JSON Schema 기반 구조 검증"""
    issues = []
    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(spec), key=lambda e: e.path)

    for e in errors:
        path = ".".join([str(p) for p in e.path]) if e.path else "(root)"
        issues.append(ValidationIssue("error", path, e.message))

    return issues


def validate_business_rules(spec: dict) -> List[ValidationIssue]:
    """
    비즈니스 규칙 검증
    - 불릿 개수/길이 (bullets, columns[].bullets, content_blocks 포함)
    - 제목/거버닝 메시지 길이
    - Evidence 앵커 포맷
    - global_constraints + slide_constraints 적용
    """
    issues = []
    global_constraints = spec.get("global_constraints", {})
    evidence_pattern = re.compile(EVIDENCE_ANCHOR_PATTERN)

    for slide_idx, slide in enumerate(spec.get("slides", []), start=1):
        slide_path = f"slides[{slide_idx-1}]"
        layout = slide.get("layout", "content")
        slide_constraints = slide.get("slide_constraints", {})

        # 제약조건 계산 (global + slide override)
        max_bullets = get_max_bullets(global_constraints, slide_constraints)
        max_chars = get_max_chars_per_bullet(global_constraints, slide_constraints)
        forbidden_words = get_forbidden_words(global_constraints, slide_constraints)

        # 1. 제목 길이 검사
        title = slide.get("title", "")
        if len(title) > TITLE_MAX_CHARS:
            issues.append(ValidationIssue(
                "warning",
                f"{slide_path}.title",
                f"제목이 {TITLE_MAX_CHARS}자를 초과합니다 ({len(title)}자)"
            ))

        # 2. 거버닝 메시지 길이 검사
        governing = slide.get("governing_message", "")
        if len(governing) > GOVERNING_MAX_CHARS:
            issues.append(ValidationIssue(
                "warning",
                f"{slide_path}.governing_message",
                f"거버닝 메시지가 {GOVERNING_MAX_CHARS}자를 초과합니다 ({len(governing)}자)"
            ))

        # 3. 불릿 검증 (NO_BULLET_LAYOUTS가 아닌 경우)
        if layout not in NO_BULLET_LAYOUTS:
            # 3a. 일반 bullets 검사
            bullets = slide.get("bullets", [])
            if bullets:
                _validate_bullets(
                    issues, bullets, max_bullets, max_chars,
                    f"{slide_path}.bullets", forbidden_words
                )

            # 3b. columns[].bullets 검사
            columns = slide.get("columns", [])
            for col_idx, col in enumerate(columns):
                col_bullets = col.get("bullets", [])
                if col_bullets:
                    _validate_bullets(
                        issues, col_bullets, max_bullets, max_chars,
                        f"{slide_path}.columns[{col_idx}].bullets", forbidden_words
                    )

            # 3c. content_blocks 내 bullets 검사
            content_blocks = slide.get("content_blocks", [])
            for block_idx, block in enumerate(content_blocks):
                if block.get("type") == "bullets":
                    block_bullets = block.get("bullets", [])
                    if block_bullets:
                        _validate_bullets(
                            issues, block_bullets, max_bullets, max_chars,
                            f"{slide_path}.content_blocks[{block_idx}].bullets", forbidden_words
                        )

                # 블록 레벨 evidence 검사
                if "evidence" in block:
                    _validate_evidence(
                        issues, block["evidence"], evidence_pattern,
                        f"{slide_path}.content_blocks[{block_idx}].evidence"
                    )

        # 4. Evidence 검사 (모든 슬라이드)
        # 4a. bullets 내 evidence
        for bullet_idx, bullet in enumerate(slide.get("bullets", [])):
            if isinstance(bullet, dict) and "evidence" in bullet:
                _validate_evidence(
                    issues, bullet["evidence"], evidence_pattern,
                    f"{slide_path}.bullets[{bullet_idx}].evidence"
                )

        # 4b. columns 내 evidence
        for col_idx, col in enumerate(slide.get("columns", [])):
            for bullet_idx, bullet in enumerate(col.get("bullets", [])):
                if isinstance(bullet, dict) and "evidence" in bullet:
                    _validate_evidence(
                        issues, bullet["evidence"], evidence_pattern,
                        f"{slide_path}.columns[{col_idx}].bullets[{bullet_idx}].evidence"
                    )

        # 4c. metadata.source_refs 검사
        metadata = slide.get("metadata", {})
        for ref_idx, ref in enumerate(metadata.get("source_refs", [])):
            if not evidence_pattern.match(ref):
                issues.append(ValidationIssue(
                    "warning",
                    f"{slide_path}.metadata.source_refs[{ref_idx}]",
                    f"잘못된 앵커 포맷: '{ref}' (expected: sources.md#anchor-name)"
                ))

        # 5. 금지어 검사
        if forbidden_words:
            all_text = title + " " + governing
            for bullet in slide.get("bullets", []):
                text = bullet if isinstance(bullet, str) else bullet.get("text", "")
                all_text += " " + text

            all_text_lower = all_text.lower()
            for word in forbidden_words:
                if word.lower() in all_text_lower:
                    issues.append(ValidationIssue(
                        "error",
                        slide_path,
                        f"금지어 발견: '{word}'"
                    ))

    return issues


def _validate_bullets(
    issues: List[ValidationIssue],
    bullets: list,
    max_bullets: int,
    max_chars: int,
    path: str,
    forbidden_words: list = None
):
    """불릿 리스트 검증 헬퍼"""
    # 개수 검사
    if len(bullets) > max_bullets:
        issues.append(ValidationIssue(
            "warning",
            path,
            f"불릿이 {max_bullets}개를 초과합니다 ({len(bullets)}개)"
        ))

    # 길이 검사
    for i, bullet in enumerate(bullets):
        text = bullet if isinstance(bullet, str) else bullet.get("text", "")

        if len(text) > max_chars:
            issues.append(ValidationIssue(
                "warning",
                f"{path}[{i}]",
                f"불릿이 {max_chars}자를 초과합니다 ({len(text)}자)"
            ))

        # 금지어 검사
        if forbidden_words:
            text_lower = text.lower()
            for word in forbidden_words:
                if word.lower() in text_lower:
                    issues.append(ValidationIssue(
                        "error",
                        f"{path}[{i}]",
                        f"금지어 발견: '{word}'"
                    ))


def _validate_evidence(
    issues: List[ValidationIssue],
    evidence: dict,
    pattern: re.Pattern,
    path: str
):
    """Evidence 객체 검증"""
    source_anchor = evidence.get("source_anchor", "")
    if source_anchor and not pattern.match(source_anchor):
        issues.append(ValidationIssue(
            "warning",
            f"{path}.source_anchor",
            f"잘못된 앵커 포맷: '{source_anchor}' (expected: sources.md#anchor-name)"
        ))


def print_validation_report(issues: List[ValidationIssue], spec_path: str) -> bool:
    """검증 보고서 출력"""
    errors = [i for i in issues if i.severity == "error"]
    warnings = [i for i in issues if i.severity == "warning"]
    infos = [i for i in issues if i.severity == "info"]

    print(f"\n{'='*60}")
    print(f"Deck Spec 검증 보고서: {spec_path}")
    print(f"{'='*60}")

    if not issues:
        print("\n✅ 모든 검증 통과!")
        return True

    print(f"\n요약: 오류 {len(errors)} | 경고 {len(warnings)} | 참고 {len(infos)}")

    if errors:
        print(f"\n❌ 오류 ({len(errors)}):")
        for issue in errors:
            print(f"  {issue}")

    if warnings:
        print(f"\n⚠️ 경고 ({len(warnings)}):")
        for issue in warnings:
            print(f"  {issue}")

    if infos:
        print(f"\nℹ️ 참고 ({len(infos)}):")
        for issue in infos:
            print(f"  {issue}")

    print(f"\n{'='*60}")

    if errors:
        print("❌ Deck Spec validation FAILED.")
        return False
    else:
        print("✅ Deck Spec validation PASSED (with warnings).")
        return True


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Deck Spec 검증기 v2.1",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("spec_path", help="deck_spec.yaml 파일 경로")
    parser.add_argument("schema_path", help="JSON Schema 파일 경로")
    parser.add_argument("--strict", action="store_true", help="경고도 오류로 처리")
    parser.add_argument("--json", action="store_true", help="JSON 형식으로 출력")

    args = parser.parse_args()

    spec_path = Path(args.spec_path).resolve()
    schema_path = Path(args.schema_path).resolve()

    if not spec_path.exists():
        print(f"Error: spec file not found: {spec_path}")
        sys.exit(1)
    if not schema_path.exists():
        print(f"Error: schema file not found: {schema_path}")
        sys.exit(1)

    spec = load_yaml(spec_path)
    schema = load_json(schema_path)

    # 1. Schema 검증
    schema_issues = validate_schema(spec, schema)

    # 2. 비즈니스 규칙 검증
    business_issues = validate_business_rules(spec)

    # 전체 이슈 병합
    all_issues = schema_issues + business_issues

    # JSON 출력
    if args.json:
        result = {
            "spec_path": str(spec_path),
            "passed": all(i.severity != "error" for i in all_issues),
            "summary": {
                "errors": len([i for i in all_issues if i.severity == "error"]),
                "warnings": len([i for i in all_issues if i.severity == "warning"]),
                "info": len([i for i in all_issues if i.severity == "info"])
            },
            "issues": [
                {"severity": i.severity, "path": i.path, "message": i.message}
                for i in all_issues
            ]
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))

        if args.strict:
            has_issues = any(i.severity in ["error", "warning"] for i in all_issues)
        else:
            has_issues = any(i.severity == "error" for i in all_issues)

        sys.exit(1 if has_issues else 0)

    # 일반 출력
    passed = print_validation_report(all_issues, str(spec_path))

    if args.strict:
        # strict 모드: 경고도 실패 처리
        has_warnings = any(i.severity == "warning" for i in all_issues)
        if has_warnings:
            print("\n[--strict] 경고가 있어 실패 처리됩니다.")
            sys.exit(2)

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
