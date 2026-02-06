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

def main():
    if len(sys.argv) != 2:
        print("Usage: python scripts/new_client.py <client-name>")
        sys.exit(1)

    client_name = sys.argv[1].strip()
    if not client_name:
        print("Error: client-name is empty.")
        sys.exit(1)

    if not re.match(r"^[a-zA-Z0-9_-]+$", client_name):
        print(f"Error: invalid client-name: {client_name} (allowed: letters, numbers, '-', '_').")
        sys.exit(1)

    dest = CLIENTS_DIR / client_name
    if dest.exists():
        print(f"Error: client folder already exists: {dest}")
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
        spec["client_meta"]["client_name"] = client_name
        spec["client_meta"]["date"] = datetime.now().strftime("%Y-%m-%d")
        with spec_path.open("w", encoding="utf-8") as f:
            yaml.dump(spec, f, allow_unicode=True, default_flow_style=False, sort_keys=False)

    print(f"Created client pack: {dest}")
    print("Next: fill brief/constraints/sources/deck_outline, then run validate/render.")

if __name__ == "__main__":
    main()
