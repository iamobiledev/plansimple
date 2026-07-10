#!/usr/bin/env python3
"""Generate a large multi-page construction PDF fixture for manual/nightly acceptance.

Default: 50 pages (~CI-friendly). Use --pages 300 for the brief's large-set check.
Note: A true 800MB vector-heavy set is not synthesized here; use --pages and optional
--pad-mb to approximate size for storage/upload stress.

Examples:
  python3 scripts/generate-large-fixture.py --pages 50
  python3 scripts/generate-large-fixture.py --pages 300 --pad-mb 50
"""

from __future__ import annotations

import argparse
from pathlib import Path

from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfgen import canvas


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pages", type=int, default=50)
    parser.add_argument("--pad-mb", type=float, default=0.0, help="Append binary padding stream to grow file")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parent / "fixtures" / "large-drawing-set.pdf",
    )
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)

    page_size = landscape(letter)
    c = canvas.Canvas(str(args.out), pagesize=page_size)
    width, height = page_size

    disciplines = [
        ("A", "Architectural"),
        ("S", "Structural"),
        ("M", "Mechanical"),
        ("E", "Electrical"),
        ("P", "Plumbing"),
    ]

    for i in range(1, args.pages + 1):
        code, discipline = disciplines[(i - 1) % len(disciplines)]
        sheet = f"{code}-{100 + (i % 50):03d}"
        c.setFont("Helvetica-Bold", 22)
        c.drawString(48, height - 48, f"PlanSimple Large Fixture — {sheet}")
        c.setFont("Helvetica", 12)
        c.drawString(48, height - 72, f"Discipline: {discipline}  |  Page {i} of {args.pages}")
        c.drawString(48, height - 90, "SEARCHABLE_TOKEN_ROOF_DRAIN  SEARCHABLE_TOKEN_GRIDLINE_C")
        # Dense-ish linework to stress tile generation a bit
        c.setStrokeColorRGB(0.2, 0.2, 0.2)
        for x in range(40, int(width) - 40, 40):
            c.line(x, 40, x, height - 120)
        for y in range(40, int(height) - 120, 40):
            c.line(40, y, width - 40, y)
        c.rect(80, 120, 280, 160)
        c.drawString(90, 260, f"Room {i:03d}")
        c.showPage()
    c.save()

    size = args.out.stat().st_size
    if args.pad_mb > 0:
        pad = int(args.pad_mb * 1024 * 1024)
        with open(args.out, "ab") as f:
            # Non-PDF trailing bytes — useful only for upload/storage stress, not valid PDF content.
            f.write(b"\0" * pad)
        size = args.out.stat().st_size

    print(f"wrote {args.out} pages={args.pages} bytes={size}")


if __name__ == "__main__":
    main()
