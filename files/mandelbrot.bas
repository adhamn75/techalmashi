Attribute VB_Name = "Module1"
' Mandelbrot fractal drawn in Excel cells - tech3almashi (أسرار Excel, episode 5)
' Every cell is one pixel. For each cell c = x + iy, repeat z = z^2 + c (up to MaxIter times);
' the cell's colour is how many steps it took z to escape (|z| > 2). Black = never escaped.
' Double-click any cell on the Fractal sheet to dive in (x3) around it, right-click to zoom out.
' Or type your own centre / width in the Settings sheet and press "Draw" (Alt+F8 > Draw).
Option Explicit

Public Const GW As Long = 120          ' grid width in cells
Public Const GH As Long = 160          ' grid height in cells
Public Const R0 As Long = 3            ' first grid row
Public Const C0 As Long = 2            ' first grid column

Private pal(0 To 63) As Long

Private Sub BuildPalette()
    Dim i As Long, t As Double, r As Double, g As Double, b As Double
    For i = 0 To 63
        t = i / 64#
        ' smooth "fire and ice" palette (polynomial, no lookups)
        r = 9 * (1 - t) * t * t * t * 255
        g = 15 * (1 - t) * (1 - t) * t * t * 255
        b = 8.5 * (1 - t) * (1 - t) * (1 - t) * t * 255
        r = r + 40 * Sin(t * 6.283): If r < 0 Then r = 0
        If r > 255 Then r = 255
        If g > 255 Then g = 255
        If b > 255 Then b = 255
        pal(i) = RGB(CLng(r), CLng(g), CLng(b))
    Next i
End Sub

Public Sub SetupBoard()
    Dim ws As Worksheet, st As Worksheet
    Application.ScreenUpdating = False
    Set ws = ThisWorkbook.Worksheets(1)
    ws.Name = "Fractal"
    On Error Resume Next
    Set st = ThisWorkbook.Worksheets("Settings")
    On Error GoTo 0
    If st Is Nothing Then
        Set st = ThisWorkbook.Worksheets.Add(After:=ws)
        st.Name = "Settings"
    End If
    st.Range("A1").Value = "MANDELBROT - tech3almashi"
    st.Range("A3").Value = "Centre X": st.Range("B3").Value = -0.6
    st.Range("A4").Value = "Centre Y": st.Range("B4").Value = 0
    st.Range("A5").Value = "Width":    st.Range("B5").Value = 3.2
    st.Range("A6").Value = "Max iterations (0 = auto)": st.Range("B6").Value = 0
    st.Range("A8").Value = "Change a number, then Alt+F8 > Draw. Nice places: X=-0.7436, Y=0.1318, Width=0.002"
    st.Columns("A").ColumnWidth = 26
    st.Columns("B").ColumnWidth = 16

    ws.Activate
    ActiveWindow.DisplayGridlines = False
    ws.Cells.Interior.Color = RGB(0, 0, 0)
    ws.Columns.ColumnWidth = 0.83
    ws.Rows.RowHeight = 7.5
    ws.Rows(1).RowHeight = 24
    ws.Range("B1").Value = "MANDELBROT - tech3almashi"
    ws.Range("B1").Font.Color = RGB(255, 255, 255)
    ws.Range("B1").Font.Bold = True
    ws.Range("B1").Font.Size = 14
    ws.Range("AZ1").Value = "double-click = zoom in x3  |  right-click = zoom out"
    ws.Range("AZ1").Font.Color = RGB(180, 180, 180)
    ws.Range("A1").Select
    Application.ScreenUpdating = True
    Draw
End Sub

Public Sub Draw()
    Dim ws As Worksheet, st As Worksheet
    Dim cx As Double, cy As Double, w As Double, h As Double, px As Double
    Dim maxIt As Long, r As Long, c As Long, n As Long, k As Long, runStart As Long
    Dim x As Double, y As Double, zx As Double, zy As Double, zx2 As Double, zy2 As Double
    Dim col() As Long, prev As Long, t As Double

    Set ws = ThisWorkbook.Worksheets("Fractal")
    Set st = ThisWorkbook.Worksheets("Settings")
    BuildPalette
    cx = st.Range("B3").Value: cy = st.Range("B4").Value: w = st.Range("B5").Value
    If w <= 0 Then w = 3.2
    maxIt = st.Range("B6").Value
    If maxIt <= 0 Then maxIt = 100 + CLng(40 * Log(3.2 / w) / Log(3#))  ' deeper zoom -> more steps
    If maxIt < 100 Then maxIt = 100
    px = w / GW
    h = px * GH
    t = Timer
    Application.ScreenUpdating = False
    Application.StatusBar = "Drawing " & GW * GH & " cells, up to " & maxIt & " steps each..."
    ReDim col(1 To GW)
    For r = 1 To GH
        y = cy + h / 2 - (r - 0.5) * px
        For c = 1 To GW
            x = cx - w / 2 + (c - 0.5) * px
            zx = 0: zy = 0: zx2 = 0: zy2 = 0: n = 0
            Do While n < maxIt And zx2 + zy2 <= 4
                zy = 2 * zx * zy + y
                zx = zx2 - zy2 + x
                zx2 = zx * zx: zy2 = zy * zy
                n = n + 1
            Loop
            If n >= maxIt Then
                col(c) = RGB(0, 0, 0)
            Else
                col(c) = pal((n * 2) Mod 64)
            End If
        Next c
        ' paint runs of equal colour in one call (much faster than cell by cell)
        runStart = 1: prev = col(1)
        For c = 2 To GW + 1
            If c > GW Then k = -1 Else k = col(c)
            If k <> prev Then
                ws.Range(ws.Cells(R0 + r - 1, C0 + runStart - 1), ws.Cells(R0 + r - 1, C0 + c - 2)).Interior.Color = prev
                runStart = c: prev = k
            End If
        Next c
        If r Mod 20 = 0 Then DoEvents
    Next r
    ws.Range("B2").Value = "x=" & Format(cx, "0.000000000") & "  y=" & Format(cy, "0.000000000") & "  zoom x" & Format(3.2 / w, "#,##0") & "  steps=" & maxIt
    ws.Range("B2").Font.Color = RGB(255, 200, 120)
    Application.ScreenUpdating = True
    Application.StatusBar = "Done in " & Format(Timer - t, "0.0") & " s. Double-click to zoom in."
End Sub

' called from ThisWorkbook on double-click (k = 1/3) and right-click (k = 3)
Public Sub ZoomAt(ByVal Target As Range, ByVal k As Double)
    Dim st As Worksheet, cx As Double, cy As Double, w As Double, px As Double
    Dim r As Long, c As Long
    Set st = ThisWorkbook.Worksheets("Settings")
    r = Target.Row - R0 + 1: c = Target.Column - C0 + 1
    If r < 1 Or r > GH Or c < 1 Or c > GW Then Exit Sub
    cx = st.Range("B3").Value: cy = st.Range("B4").Value: w = st.Range("B5").Value
    px = w / GW
    st.Range("B3").Value = cx - w / 2 + (c - 0.5) * px
    st.Range("B4").Value = cy + px * GH / 2 - (r - 0.5) * px
    w = w * k
    If w > 4 Then w = 3.2
    If w < 0.0000000000001 Then w = 0.0000000000001   ' limit of Double precision
    st.Range("B5").Value = w
    Draw
End Sub

Public Sub ResetView()
    With ThisWorkbook.Worksheets("Settings")
        .Range("B3").Value = -0.6: .Range("B4").Value = 0: .Range("B5").Value = 3.2
    End With
    Draw
End Sub
