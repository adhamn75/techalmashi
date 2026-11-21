"""Build files/game2048.xlsm: playable 2048 in cells (VBA, arrow keys via OnKey). pip install pyOpenVBA; python3 scripts/files/make_2048.py"""
from pathlib import Path
import pyopenvba as pv
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "files" / "game2048.xlsm"
MOD = (ROOT / "files" / "game2048.bas").read_text(encoding="utf-8").split("\n", 1)[1]
SHEET = (ROOT / "files" / "game2048_sheet.bas").read_text(encoding="utf-8")
THISWB = """Private Sub Workbook_Open()
    If ActiveSheet.Cells(2, 2).Value <> 2048 Then NewGame Else StartKeys
End Sub

Private Sub Workbook_BeforeClose(Cancel As Boolean)
    StopKeys
End Sub
"""
if OUT.exists():
    OUT.unlink()
wb = pv.ExcelFile.create_new(OUT)
wb.vba_project()
wb.set_module("Module1", MOD)
wb.set_module("Sheet1", SHEET)
wb.set_module("ThisWorkbook", THISWB)
wb.save(); wb.close()
with pv.ExcelFile(OUT) as chk:
    mods = chk.vba_modules()
    print("modules:", list(mods), "issues:", chk.validate() or "none")
    assert "SlideLine" in mods["Module1"] and "StartKeys" in mods["Sheet1"]
print("wrote", OUT)
