#!/usr/bin/env python3
import shutil
import sys
from pathlib import Path

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

    dest = CLIENTS_DIR / client_name
    if dest.exists():
        print(f"Error: client folder already exists: {dest}")
        sys.exit(1)

    if not TEMPLATE_DIR.exists():
        print(f"Error: template folder not found: {TEMPLATE_DIR}")
        sys.exit(1)

    shutil.copytree(TEMPLATE_DIR, dest)
    print(f"Created client pack: {dest}")

if __name__ == "__main__":
    main()
