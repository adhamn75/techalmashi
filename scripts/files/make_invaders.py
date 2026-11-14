"""Build files/invaders.xlsm: a real, playable Space Invaders in Excel cells (VBA).

    pip install pyOpenVBA
    python3 scripts/files/make_invaders.py

The VBA lives in files/invaders.bas. A fresh macro-enabled workbook is created with pyOpenVBA,
the module is added and ThisWorkbook paints the first frame when the file is opened.
"""
from pathlib import Path

import pyopenvba as pv

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "files" / "invaders.xlsm"
SRC = (ROOT / "files" / "invaders.bas").read_text(encoding="utf-8")

THISWB = """Private Sub Workbook_Open()
    If ActiveSheet.Cells(3, 41).Value <> "SCORE" Then SetupScreen
End Sub
"""

wb = pv.ExcelFile.create_new(OUT)
proj = wb.vba_project()
body = SRC.split("\n", 1)[1]  # drop the Attribute VB_Name line; Module1 keeps its own header
wb.set_module("Module1", body)
wb.set_module("ThisWorkbook", THISWB)
wb.save()
wb.close()

with pv.ExcelFile(OUT) as chk:
    issues = chk.validate()
    mods = chk.vba_modules()
    assert "Sub Invaders()" in mods["Module1"], "Invaders module missing"
    assert "SetupScreen" in mods["ThisWorkbook"], "Workbook_Open missing"
    print("modules:", list(mods), "issues:", issues or "none")
print("wrote", OUT)
