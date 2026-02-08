#!/usr/bin/env python3
"""
new_client.py - legacy wrapper for client pack creation

This script keeps backward-compatible CLI usage while delegating all
creation/initialization logic to scripts/client_bootstrap.py.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
CLIENTS_DIR = REPO_ROOT / "clients"
TEMPLATE_DIR = CLIENTS_DIR / "_template"

try:
    from client_bootstrap import create_client_pack
except ImportError:
    create_client_pack = None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create a new client pack from clients/_template"
    )
    parser.add_argument("client_name", help="Client folder slug (letters, numbers, '-' and '_')")
    parser.add_argument("topic", nargs="?", default="", help="Optional topic. When provided and the base folder exists, a variant folder is created.")
    parser.add_argument(
        "--new-folder-if-exists",
        action="store_true",
        help="Always create a variant folder when the base client folder already exists.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    if not create_client_pack:
        print("Error: client_bootstrap module is unavailable.")
        return 1

    args = build_parser().parse_args(argv)

    try:
        created = create_client_pack(
            clients_dir=CLIENTS_DIR,
            template_dir=TEMPLATE_DIR,
            client_name=args.client_name,
            topic=args.topic,
            new_folder_if_exists=bool(args.new_folder_if_exists),
            topic_creates_variant=True,
            update_brief_topic=True,
        )
    except ValueError as exc:
        print(f"Error: {exc}")
        return 1
    except FileNotFoundError as exc:
        print(f"Error: {exc}")
        return 1
    except FileExistsError as exc:
        print(f"Error: {exc}")
        print("Hint: pass topic or --new-folder-if-exists to create a variant folder.")
        return 1

    resolved_name = created.get("resolved_name", args.client_name)
    dest = Path(created.get("dest", str(CLIENTS_DIR / resolved_name)))

    print(f"Created client pack: {dest}")
    if resolved_name != args.client_name:
        print(f"Resolved name: {resolved_name} (from base: {args.client_name})")
    print("Next: fill brief/constraints/sources/deck_outline, then run validate/render.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
