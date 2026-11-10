"""Build files/maze3d.xlsm: a real, first-person 3D maze (raycaster) in Excel cells (VBA).

    pip install pyOpenVBA
    python3 scripts/files/make_maze3d.py

The VBA lives in files/maze3d.bas. A fresh macro-enabled workbook is created with pyOpenVBA,
the module is added and ThisWorkbook draws the board when the file is opened.
"""
from pathlib import Path

import pyopenvba as pv

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "files" / "maze3d.xlsm"
SRC = (ROOT / "files" / "maze3d.bas").read_text(encoding="utf-8")

THISWB = """Private Sub Workbook_Open()
    If ActiveSheet.Cells(1, 2).Value <> "3D MAZE - tech3almashi" Then SetupBoard
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
    assert "Sub Maze()" in mods["Module1"], "Maze module missing"
    assert "SetupBoard" in mods["ThisWorkbook"], "Workbook_Open missing"
    print("modules:", list(mods), "issues:", issues or "none")
print("wrote", OUT)
