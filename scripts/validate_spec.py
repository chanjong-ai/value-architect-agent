#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import yaml
from jsonschema import Draft202012Validator

def load_yaml(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

def main():
    if len(sys.argv) != 3:
        print("Usage: python scripts/validate_spec.py <deck_spec.yaml> <schema.json>")
        sys.exit(1)

    spec_path = Path(sys.argv[1]).resolve()
    schema_path = Path(sys.argv[2]).resolve()

    if not spec_path.exists():
        print(f"Error: spec file not found: {spec_path}")
        sys.exit(1)
    if not schema_path.exists():
        print(f"Error: schema file not found: {schema_path}")
        sys.exit(1)

    spec = load_yaml(spec_path)
    schema = load_json(schema_path)

    validator = Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(spec), key=lambda e: e.path)

    if errors:
        print("Deck Spec validation FAILED:")
        for e in errors:
            path = ".".join([str(p) for p in e.path]) if e.path else "(root)"
            print(f"- {path}: {e.message}")
        sys.exit(2)

    print("Deck Spec validation PASSED.")
    sys.exit(0)

if __name__ == "__main__":
    main()
