"""Build files/minesweeper.xlsm: playable Minesweeper in cells (VBA). pip install pyOpenVBA; python3 scripts/files/make_minesweeper.py"""
from pathlib import Path
import pyopenvba as pv
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "files" / "minesweeper.xlsm"
MOD = (ROOT / "files" / "minesweeper.bas").read_text(encoding="utf-8").split("\n", 1)[1]
SHEET = (ROOT / "files" / "minesweeper_sheet.bas").read_text(encoding="utf-8")
THISWB = """Private Sub Workbook_Open()
    If ActiveSheet.Cells(2, 2).Value <> "MINESWEEPER" Then NewGame
End Sub
"""
wb = pv.ExcelFile.create_new(OUT)
wb.vba_project()
wb.set_module("Module1", MOD)
wb.set_module("Sheet1", SHEET)
wb.set_module("ThisWorkbook", THISWB)
wb.save(); wb.close()
with pv.ExcelFile(OUT) as chk:
    mods = chk.vba_modules()
    print("modules:", list(mods), "issues:", chk.validate() or "none")
    assert "OpenCell" in mods["Module1"] and "BeforeRightClick" in mods["Sheet1"]
print("wrote", OUT)
