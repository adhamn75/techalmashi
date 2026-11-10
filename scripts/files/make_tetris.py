"""Build files/tetris.xlsm: a real, playable Tetris in Excel cells (VBA).

    pip install pyOpenVBA
    python3 scripts/files/make_tetris.py

The VBA lives in files/tetris.bas. A fresh macro-enabled workbook is created with pyOpenVBA,
the module is added and ThisWorkbook draws the board when the file is opened.
"""
from pathlib import Path

import pyopenvba as pv

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "files" / "tetris.xlsm"
SRC = (ROOT / "files" / "tetris.bas").read_text(encoding="utf-8")

THISWB = """Private Sub Workbook_Open()
    If ActiveSheet.Cells(3, 14).Value <> "SCORE" Then SetupBoard
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
    assert "Sub Tetris()" in mods["Module1"], "Tetris module missing"
    assert "SetupBoard" in mods["ThisWorkbook"], "Workbook_Open missing"
    print("modules:", list(mods), "issues:", issues or "none")
print("wrote", OUT)
