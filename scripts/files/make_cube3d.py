from openpyxl import Workbook
from openpyxl.chart import ScatterChart, Reference, Series
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.chart.shapes import GraphicalProperties
from openpyxl.drawing.line import LineProperties

wb = Workbook(); ws = wb.active; ws.title = "Cube3D"
ws.sheet_view.rightToLeft = False
B = Font(bold=True)
ws["A1"] = "مكعّب 3D يدور بالمعادلات فقط — غيّر الرقم في H4 (13، 14، 15...) وشاهده يدور"; ws["A1"].font = Font(bold=True, size=13)
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
ws["A14"] = "للتدوير بالسحب: Developer ← Insert ← Scroll Bar (من 0 إلى 126) واربطه بالخلية H4."
ws["A16"] = "تك عالماشي · خلّيك ذكي!  @tech3almashi"
for col, w in zip("ABCDEFGH", (5, 6, 6, 6, 8, 8, 18, 8)): ws.column_dimensions[col].width = w
wb.save("files/cube3d.xlsx")
