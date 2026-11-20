"""Build files/breakout.xlsm: a real, playable Breakout (brick breaker) in Excel cells (VBA).

    pip install pyOpenVBA
    python3 scripts/files/make_breakout.py

The VBA lives in files/breakout.bas. A fresh macro-enabled workbook is created with pyOpenVBA,
the module is added and ThisWorkbook paints the first frame when the file is opened.
"""
from pathlib import Path

import pyopenvba as pv

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "files" / "breakout.xlsm"
SRC = (ROOT / "files" / "breakout.bas").read_text(encoding="utf-8")

THISWB = """Private Sub Workbook_Open()
    If ActiveSheet.Cells(3, 44).Value <> "SCORE" Then SetupScreen
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
    assert "Sub Breakout()" in mods["Module1"], "Breakout module missing"
    assert "SetupScreen" in mods["ThisWorkbook"], "Workbook_Open missing"
    print("modules:", list(mods), "issues:", issues or "none")
print("wrote", OUT)
