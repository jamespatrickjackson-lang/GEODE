from __future__ import annotations

import argparse
import json
import sys
import zipfile
from pathlib import Path

from utah_phase2c_wells import (
    Phase2CWellsAuditError,
    audit_phase2c_wells,
    write_audit_json,
)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate a clean Utah_FORGE_Phase2C_wells shapefile package.",
    )
    parser.add_argument("--input", required=True, help="Directory or zip containing shapefile sidecars")
    parser.add_argument("--out", help="Optional JSON audit output path")
    args = parser.parse_args()

    try:
        audit = audit_phase2c_wells(Path(args.input))
    except (OSError, zipfile.BadZipFile, Phase2CWellsAuditError) as exc:
        print(f"Phase2C wells shapefile audit failed: {exc}", file=sys.stderr)
        return 1

    if args.out:
        write_audit_json(audit, Path(args.out))
    else:
        print(json.dumps(audit, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
