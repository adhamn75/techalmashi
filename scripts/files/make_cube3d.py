from openpyxl import Workbook
from openpyxl.chart import ScatterChart, Reference, Series
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.drawing.line import LineProperties

wb = Workbook(); ws = wb.active; ws.title = "Cube3D"
ws.sheet_view.rightToLeft = False
B = Font(bold=True)
ws["A1"] = "مكعّب 3D يدور بالمعادلات فقط — اسحب الشريط تحت الرسمة، أو غيّر الرقم في H4"; ws["A1"].font = Font(bold=True, size=13)
ws["G2"] = "θ الزاوية (راديان)"; ws["H1"] = "θ"; ws["H2"] = "=H4/20"
ws["G4"] = "غيّر هذا الرقم ←"; ws["H4"] = 12
ws["G3"] = "φ الميل"; ws["H3"] = 0.45
for c in ("H4", "H3"):
    ws[c].fill = PatternFill("solid", fgColor="FFF2CC"); ws[c].font = Font(bold=True, size=14, color="7030A0")
ws["H1"].font = B
hdr = ["#", "x", "y", "z", "x'", "y'"]
for i, h in enumerate(hdr):
    c = ws.cell(row=2, column=1 + i, value=h); c.font = B; c.alignment = Alignment(horizontal="center")
pts = [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
for k, (x, y, z) in enumerate(pts):
    r = 3 + k
    ws.cell(r, 1, k + 1); ws.cell(r, 2, x); ws.cell(r, 3, y); ws.cell(r, 4, z)
    ws.cell(r, 5, f"=B{r}*COS($H$2)-D{r}*SIN($H$2)")
    ws.cell(r, 6, f"=C{r}*COS($H$3)-(B{r}*SIN($H$2)+D{r}*COS($H$2))*SIN($H$3)")
    for col in (5, 6): ws.cell(r, col).number_format = "0.00"
# edges table: each edge = 2 rows (from, to)
edges = [(1,2),(2,3),(3,4),(4,1),(5,6),(6,7),(7,8),(8,5),(1,5),(2,6),(3,7),(4,8)]
ws["J2"] = "ضلع"; ws["K2"] = "نقطة"; ws["L2"] = "X"; ws["M2"] = "Y"
for c in ("J2","K2","L2","M2"): ws[c].font = B
chart = ScatterChart(); chart.title = "Excel 3D Cube"; chart.style = 13
chart.height = 12; chart.width = 12; chart.legend = None
chart.x_axis.scaling.min = -2; chart.x_axis.scaling.max = 2
chart.y_axis.scaling.min = -2; chart.y_axis.scaling.max = 2
chart.x_axis.delete = False; chart.y_axis.delete = False
colors = ["F472B6"]*4 + ["22D3EE"]*4 + ["7C3AED"]*4
for e, (a, b) in enumerate(edges):
    r = 3 + e * 2
    for j, p in enumerate((a, b)):
        ws.cell(r + j, 10, e + 1); ws.cell(r + j, 11, p)
        ws.cell(r + j, 12, f"=INDEX($E$3:$E$10,K{r+j})"); ws.cell(r + j, 13, f"=INDEX($F$3:$F$10,K{r+j})")
        ws.cell(r + j, 12).number_format = ws.cell(r + j, 13).number_format = "0.00"
    xs = Reference(ws, min_col=12, min_row=r, max_row=r + 1)
    ys = Reference(ws, min_col=13, min_row=r, max_row=r + 1)
    s = Series(ys, xs)
    s.marker.symbol = "circle"; s.marker.size = 7
    s.graphicalProperties.line.solidFill = colors[e]; s.graphicalProperties.line.width = 38100
    s.smooth = False
    chart.series.append(s)
ws.add_chart(chart, "O2")
ws["A13"] = "الفكرة: كل زاوية من 8 زوايا تدور بمعادلة COS/SIN، ومخطط XY Scatter يرسم الأضلاع الـ12."
ws["A14"] = "أو اسحب الشريط تحت الرسمة (مربوط بالخلية H4) وشاهد المكعّب يدور."
ws["A16"] = "تك عالماشي · خلّيك ذكي!  @tech3almashi"
for col, w in zip("ABCDEFGH", (5, 6, 6, 6, 8, 8, 18, 8)): ws.column_dimensions[col].width = w
wb.save("files/cube3d.xlsx")

# ---- add a real Scroll Bar form control linked to H4 (openpyxl cannot, so patch the package) ----
import zipfile, shutil, os
SRC = "files/cube3d.xlsx"; TMP = SRC + ".tmp"
VML = '''<xml xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
 <o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="1"/></o:shapelayout>
 <v:shapetype id="_x0000_t201" coordsize="21600,21600" o:spt="201" path="m,l,21600r21600,l21600,xe">
  <v:stroke joinstyle="miter"/><v:path shadowok="f" o:extrusionok="f" strokeok="f" fillok="f" o:connecttype="rect"/><o:lock v:ext="edit" shapetype="t"/>
 </v:shapetype>
 <v:shape id="_x0000_s1025" type="#_x0000_t201" style="position:absolute;margin-left:0;margin-top:0;width:300pt;height:24pt;z-index:1" filled="f" fillcolor="window [65]" stroked="f" strokecolor="windowText [64]" o:insetmode="auto">
  <x:ClientData ObjectType="Scroll">
   <x:Anchor>14, 0, 26, 0, 22, 0, 28, 0</x:Anchor>
   <x:PrintObject>False</x:PrintObject><x:AutoFill>False</x:AutoFill>
   <x:FmlaLink>$H$4</x:FmlaLink>
   <x:Val>12</x:Val><x:Min>0</x:Min><x:Max>126</x:Max><x:Inc>1</x:Inc><x:Page>10</x:Page><x:Horiz/><x:Dx>22</x:Dx>
  </x:ClientData>
 </v:shape>
</xml>'''
CTRL = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<formControlPr xmlns="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" '
        'objectType="Scroll" dx="22" fmlaLink="$H$4" horiz="1" max="126" min="0" page="10" val="12"/>')
CONTROLS = ('<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice Requires="x14">'
            '<controls><mc:AlternateContent><mc:Choice Requires="x14"><control shapeId="1025" r:id="rIdCtrl1" name="Scroll Bar 1">'
            '<controlPr defaultSize="0" autoPict="0"><anchor moveWithCells="1"><from><xdr:col>14</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>26</xdr:row><xdr:rowOff>0</xdr:rowOff></from>'
            '<to><xdr:col>22</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>28</xdr:row><xdr:rowOff>0</xdr:rowOff></to></anchor></controlPr></control></mc:Choice></mc:AlternateContent></controls>'
            '</mc:Choice></mc:AlternateContent>')
with zipfile.ZipFile(SRC) as zin, zipfile.ZipFile(TMP, "w", zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename == "xl/worksheets/sheet1.xml":
            s = data.decode()
            s = s.replace('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
                'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" '
                'xmlns:x14="http://schemas.microsoft.com/office/spreadsheetml/2009/9/main" '
                'xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" mc:Ignorable="x14">')
            s = s.replace('<drawing xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/>',
                          '<drawing r:id="rId1"/><legacyDrawing r:id="rIdVml1"/>' + CONTROLS)
            data = s.encode()
        elif item.filename == "xl/worksheets/_rels/sheet1.xml.rels":
            s = data.decode().replace("</Relationships>",
                '<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="/xl/drawings/vmlDrawing1.vml" Id="rIdVml1"/>'
                '<Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/ctrlProp" Target="/xl/ctrlProps/ctrlProp1.xml" Id="rIdCtrl1"/></Relationships>')
            data = s.encode()
        elif item.filename == "[Content_Types].xml":
            s = data.decode().replace('<Default Extension="xml" ContentType="application/xml"/>',
                '<Default Extension="xml" ContentType="application/xml"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/>'
                '<Override PartName="/xl/ctrlProps/ctrlProp1.xml" ContentType="application/vnd.ms-excel.controlproperties+xml"/>')
            data = s.encode()
        elif item.filename == "xl/workbook.xml":
            s = data.decode()
            if "<calcPr" not in s:
                s = s.replace("</workbook>", '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>')
            data = s.encode()
        zout.writestr(item, data)
    zout.writestr("xl/drawings/vmlDrawing1.vml", VML)
    zout.writestr("xl/ctrlProps/ctrlProp1.xml", CTRL)
shutil.move(TMP, SRC)
