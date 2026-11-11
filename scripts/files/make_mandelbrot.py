"""Build files/mandelbrot.xlsm: the Mandelbrot fractal drawn in Excel cells (VBA), zoom by double-click.

    pip install pyOpenVBA
    python3 scripts/files/make_mandelbrot.py

The VBA lives in files/mandelbrot.bas. ThisWorkbook draws the fractal when the file is opened and
handles double-click (zoom in x3 around the cell) and right-click (zoom out x3) on the Fractal sheet.
"""
from pathlib import Path

import pyopenvba as pv

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "files" / "mandelbrot.xlsm"
SRC = (ROOT / "files" / "mandelbrot.bas").read_text(encoding="utf-8")

THISWB = """Private Sub Workbook_Open()
    If ActiveSheet.Cells(1, 2).Value <> "MANDELBROT - tech3almashi" Then SetupBoard Else Draw
End Sub

Private Sub Workbook_SheetBeforeDoubleClick(ByVal Sh As Object, ByVal Target As Range, Cancel As Boolean)
    If Sh.Name = "Fractal" And Target.Row >= R0 Then
        Cancel = True
        ZoomAt Target, 1# / 3#
    End If
End Sub

Private Sub Workbook_SheetBeforeRightClick(ByVal Sh As Object, ByVal Target As Range, Cancel As Boolean)
    If Sh.Name = "Fractal" And Target.Row >= R0 Then
        Cancel = True
        ZoomAt Target, 3#
    End If
End Sub
"""

if OUT.exists():
    OUT.unlink()
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
    assert "Sub Draw()" in mods["Module1"], "Draw missing"
    assert "BeforeDoubleClick" in mods["ThisWorkbook"], "zoom handler missing"
    print("modules:", list(mods), "issues:", issues or "none")
print("wrote", OUT)
