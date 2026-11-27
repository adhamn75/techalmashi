"""Build files/tictactoe.xlsm: playable tic-tac-toe with minimax (VBA). pip install pyOpenVBA; python3 scripts/files/make_tictactoe.py"""
from pathlib import Path
import pyopenvba as pv
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "files" / "tictactoe.xlsm"
MOD = (ROOT / "files" / "tictactoe.bas").read_text(encoding="utf-8").split("\n", 1)[1]
SHEET = (ROOT / "files" / "tictactoe_sheet.bas").read_text(encoding="utf-8")
THISWB = """Private Sub Workbook_Open()
    If ActiveSheet.Cells(2, 2).Value <> "TIC-TAC-TOE" Then NewGame
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
    assert "Minimax" in mods["Module1"] and "SelectionChange" in mods["Sheet1"]
print("wrote", OUT)
