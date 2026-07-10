#!/usr/bin/env python3
"""Generate three small public-demo construction drawing PDFs for PlanSimple seed."""

from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

OUT = Path(__file__).resolve().parent / "fixtures"
OUT.mkdir(parents=True, exist_ok=True)

SETS = [
    {
        "filename": "architectural-set.pdf",
        "title": "Architectural Drawing Set",
        "sheets": [
            ("A-101", "Floor Plan — Level 1", "SEARCHABLE_TOKEN_ROOF_DRAIN"),
            ("A-102", "Floor Plan — Level 2", "SEARCHABLE_TOKEN_STAIR"),
            ("A-201", "Exterior Elevations", "SEARCHABLE_TOKEN_FACADE"),
        ],
    },
    {
        "filename": "structural-set.pdf",
        "title": "Structural Drawing Set",
        "sheets": [
            ("S-101", "Foundation Plan", "SEARCHABLE_TOKEN_FOOTING"),
            ("S-201", "Framing Plan", "SEARCHABLE_TOKEN_BEAM"),
        ],
    },
    {
        "filename": "mep-set.pdf",
        "title": "MEP Drawing Set",
        "sheets": [
            ("M-101", "HVAC Plan", "SEARCHABLE_TOKEN_VAV"),
            ("E-101", "Lighting Plan", "SEARCHABLE_TOKEN_RECEPTACLE"),
            ("P-101", "Plumbing Plan", "SEARCHABLE_TOKEN_FLOOR_DRAIN"),
        ],
    },
]


def write_set(spec: dict) -> Path:
    path = OUT / spec["filename"]
    c = canvas.Canvas(str(path), pagesize=letter)
    for sheet_number, sheet_title, token in spec["sheets"]:
        c.setFont("Helvetica-Bold", 22)
        c.drawString(72, 720, f"PlanSimple — {spec['title']}")
        c.setFont("Helvetica-Bold", 16)
        c.drawString(72, 680, f"{sheet_number}  |  {sheet_title}")
        c.setFont("Helvetica", 12)
        c.drawString(72, 650, token)
        c.rect(80, 180, 450, 400)
        c.drawString(100, 540, f"Demo content for {sheet_number}")
        c.showPage()
    c.save()
    print(f"wrote {path} ({path.stat().st_size} bytes)")
    return path


def main() -> None:
    for spec in SETS:
        write_set(spec)


if __name__ == "__main__":
    main()
