#!/usr/bin/env python3
"""
quality_gate.py - repository quality gate for CI/local checks

Checks:
1) Python syntax compile for scripts/*.py
2) deck_spec validation for all clients (except clients/_template)
3) Render + QA smoke test for qa-sanity-client in layout-driven mode
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import datetime
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CLIENTS_DIR = REPO_ROOT / "clients"
DECK_CLI = SCRIPT_DIR / "deck_cli.py"


def run_cmd(cmd: list[str], *, label: str) -> subprocess.CompletedProcess:
    print(f"\n[RUN] {label}")
    print(f"      $ {' '.join(cmd)}")
    proc = subprocess.run(cmd, cwd=REPO_ROOT, capture_output=True, text=True)
    if proc.stdout.strip():
        print(proc.stdout.rstrip())
    if proc.returncode != 0:
        if proc.stderr.strip():
            print(proc.stderr.rstrip())
        raise RuntimeError(f"{label} failed with exit code {proc.returncode}")
    return proc


def get_clients(explicit_clients: list[str] | None = None) -> list[str]:
    if explicit_clients:
        return explicit_clients
    clients = []
    for d in sorted(CLIENTS_DIR.iterdir()):
        if not d.is_dir():
            continue
        if d.name == "_template" or d.name.startswith("."):
            continue
        clients.append(d.name)
    return clients


def check_py_compile(python_exe: str) -> None:
    py_files = sorted(str(p) for p in SCRIPT_DIR.glob("*.py"))
    if not py_files:
        raise RuntimeError("No Python files found in scripts/")
    run_cmd([python_exe, "-m", "py_compile", *py_files], label="py_compile scripts")


def check_validate_all_clients(python_exe: str, clients: list[str]) -> None:
    if not clients:
        raise RuntimeError("No clients found to validate")

    for client in clients:
        run_cmd(
            [python_exe, str(DECK_CLI), "validate", client],
            label=f"validate:{client}",
        )


def check_smoke_render_qa(python_exe: str, client_name: str, template_mode: str) -> None:
    client_dir = CLIENTS_DIR / client_name
    if not client_dir.exists():
        raise RuntimeError(f"Smoke client not found: {client_dir}")

    outputs_dir = client_dir / "outputs"
    outputs_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    pptx_path = outputs_dir / f"{client_name}_quality_gate_{ts}.pptx"
    qa_report_path = outputs_dir / f"{client_name}_quality_gate_{ts}_qa_report.json"

    run_cmd(
        [
            python_exe,
            str(DECK_CLI),
            "render",
            client_name,
            "--template-mode",
            template_mode,
            "--output",
            str(pptx_path),
        ],
        label=f"render-smoke:{client_name}",
    )

    run_cmd(
        [
            python_exe,
            str(DECK_CLI),
            "qa",
            client_name,
            "--pptx",
            str(pptx_path),
            "--output",
            str(qa_report_path),
        ],
        label=f"qa-smoke:{client_name}",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run repository quality gate checks")
    parser.add_argument("--python", default=sys.executable, help="Python executable path")
    parser.add_argument("--clients", nargs="*", help="Optional explicit clients to validate")
    parser.add_argument("--skip-compile", action="store_true", help="Skip py_compile check")
    parser.add_argument("--skip-validate", action="store_true", help="Skip validate-all-clients check")
    parser.add_argument("--skip-smoke", action="store_true", help="Skip render+qa smoke check")
    parser.add_argument("--smoke-client", default="qa-sanity-client", help="Client used for render+qa smoke check")
    parser.add_argument(
        "--template-mode",
        default="layout",
        choices=["layout", "blank", "auto"],
        help="Template mode for smoke render",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    try:
        if not args.skip_compile:
            check_py_compile(args.python)

        clients = get_clients(args.clients)
        if not args.skip_validate:
            check_validate_all_clients(args.python, clients)

        if not args.skip_smoke:
            check_smoke_render_qa(args.python, args.smoke_client, args.template_mode)

    except RuntimeError as exc:
        print(f"\n[FAIL] {exc}")
        return 1

    print("\n[PASS] Quality gate completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
