Attribute VB_Name = "Maze3D"
' =====================================================================
'  3D MAZE inside Excel (first-person raycaster)  -  tech3almashi
'  1) Open the file and click "Enable Content".
'  2) Click "Play" (or Alt+F8 > Maze).
'     Up/Down = walk   Left/Right = turn   Esc = stop
'  Find the green wall to escape. Every column of cells is one ray:
'  the farther the wall, the shorter and darker its column.
'  Windows Excel (32 or 64 bit). Keep the workbook as .xlsm.
' =====================================================================
Option Explicit

#If VBA7 Then
    Private Declare PtrSafe Function GetAsyncKeyState Lib "user32" (ByVal vKey As Long) As Integer
    Private Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal ms As Long)
#Else
    Private Declare Function GetAsyncKeyState Lib "user32" (ByVal vKey As Long) As Integer
    Private Declare Sub Sleep Lib "kernel32" (ByVal ms As Long)
#End If

Private Const VW As Long = 54         ' screen width  (columns = rays)
Private Const VH As Long = 40         ' screen height (rows)
Private Const ROW0 As Long = 3        ' first screen row
Private Const COL0 As Long = 2        ' first screen column (B)
Private Const MAPN As Long = 12       ' map is 12 x 12
Private Const MCOL As Long = 58       ' first column of the mini-map

Private mapRows(0 To 11) As String
Private posX As Double, posY As Double, dirX As Double, dirY As Double, planeX As Double, planeY As Double
Private lastTop(0 To 53) As Long, lastBot(0 To 53) As Long, lastCol(0 To 53) As Long

Private Sub LoadMap()
    mapRows(0) = "############"
    mapRows(1) = "#..#.......#"
    mapRows(2) = "#..#.##.##.#"
    mapRows(3) = "#....#...#.#"
    mapRows(4) = "####.#.#.#.#"
    mapRows(5) = "#....#.#...#"
    mapRows(6) = "#.####.###.#"
    mapRows(7) = "#......#...#"
    mapRows(8) = "#.##.#.#.###"
    mapRows(9) = "#..#.#...#.E"
    mapRows(10) = "#..#.#.#...#"
    mapRows(11) = "############"
End Sub

Private Function Tile(ByVal x As Long, ByVal y As Long) As String
    If x < 0 Or y < 0 Or x >= MAPN Or y >= MAPN Then Tile = "#": Exit Function
    Tile = Mid$(mapRows(y), x + 1, 1)
End Function

Private Function Solid(ByVal x As Double, ByVal y As Double) As Boolean
    Solid = (Tile(Int(x), Int(y)) <> ".")
End Function

Private Function Shade(ByVal r As Double, ByVal g As Double, ByVal b As Double, ByVal k As Double) As Long
    If k > 1 Then k = 1
    If k < 0.12 Then k = 0.12
    Shade = RGB(CLng(r * k), CLng(g * k), CLng(b * k))
End Function

Private Function ViewRange() As Range
    Set ViewRange = ActiveSheet.Range(ActiveSheet.Cells(ROW0, COL0), ActiveSheet.Cells(ROW0 + VH - 1, COL0 + VW - 1))
End Function

' ---------------------------------------------------------------- one frame
Private Sub Render()
    Dim c As Long, camX As Double, rdx As Double, rdy As Double
    Dim mx As Long, my As Long, sx As Long, sy As Long, side As Long
    Dim sdx As Double, sdy As Double, ddx As Double, ddy As Double, dist As Double
    Dim hgt As Long, top As Long, bot As Long, col As Long, t As String, k As Double
    Dim ws As Worksheet: Set ws = ActiveSheet

    Application.ScreenUpdating = False
    For c = 0 To VW - 1
        camX = 2 * c / VW - 1
        rdx = dirX + planeX * camX: rdy = dirY + planeY * camX
        mx = Int(posX): my = Int(posY)
        If rdx = 0 Then ddx = 1E+30 Else ddx = Abs(1 / rdx)
        If rdy = 0 Then ddy = 1E+30 Else ddy = Abs(1 / rdy)
        If rdx < 0 Then sx = -1: sdx = (posX - mx) * ddx Else sx = 1: sdx = (mx + 1 - posX) * ddx
        If rdy < 0 Then sy = -1: sdy = (posY - my) * ddy Else sy = 1: sdy = (my + 1 - posY) * ddy
        Do                                       ' DDA: walk the grid until a wall
            If sdx < sdy Then
                sdx = sdx + ddx: mx = mx + sx: side = 0
            Else
                sdy = sdy + ddy: my = my + sy: side = 1
            End If
            t = Tile(mx, my)
        Loop While t = "."
        If side = 0 Then dist = sdx - ddx Else dist = sdy - ddy
        If dist < 0.05 Then dist = 0.05
        hgt = CLng(VH / dist)
        top = (VH - hgt) \ 2: bot = top + hgt - 1
        If top < 0 Then top = 0
        If bot > VH - 1 Then bot = VH - 1
        k = 1.15 / (1 + dist * 0.35)
        If side = 1 Then k = k * 0.72
        If t = "E" Then col = Shade(40, 230, 110, k) Else col = Shade(255, 150, 60, k)

        If top <> lastTop(c) Or bot <> lastBot(c) Or col <> lastCol(c) Then
            If top > 0 Then ws.Range(ws.Cells(ROW0, COL0 + c), ws.Cells(ROW0 + top - 1, COL0 + c)).Interior.Color = RGB(14, 12, 24)
            ws.Range(ws.Cells(ROW0 + top, COL0 + c), ws.Cells(ROW0 + bot, COL0 + c)).Interior.Color = col
            If bot < VH - 1 Then ws.Range(ws.Cells(ROW0 + bot + 1, COL0 + c), ws.Cells(ROW0 + VH - 1, COL0 + c)).Interior.Color = RGB(40, 34, 30)
            lastTop(c) = top: lastBot(c) = bot: lastCol(c) = col
        End If
    Next c
    DrawPlayerOnMap
    Application.ScreenUpdating = True
End Sub

Private Sub DrawMap()
    Dim x As Long, y As Long, t As String, ws As Worksheet: Set ws = ActiveSheet
    For y = 0 To MAPN - 1
        For x = 0 To MAPN - 1
            t = Tile(x, y)
            If t = "#" Then
                ws.Cells(ROW0 + y, MCOL + x).Interior.Color = RGB(150, 90, 40)
            ElseIf t = "E" Then
                ws.Cells(ROW0 + y, MCOL + x).Interior.Color = RGB(40, 230, 110)
            Else
                ws.Cells(ROW0 + y, MCOL + x).Interior.Color = RGB(24, 22, 30)
            End If
        Next x
    Next y
End Sub

Private Sub DrawPlayerOnMap()
    Static lx As Long, ly As Long
    Dim ws As Worksheet: Set ws = ActiveSheet
    If lx > 0 Then ws.Cells(ly, lx).Interior.Color = RGB(24, 22, 30)
    lx = MCOL + Int(posX): ly = ROW0 + Int(posY)
    ws.Cells(ly, lx).Interior.Color = RGB(0, 200, 255)
End Sub

' ---------------------------------------------------------------- setup
Public Sub SetupBoard()
    Dim ws As Worksheet: Set ws = ActiveSheet
    Dim s As Shape
    Application.ScreenUpdating = False
    ws.Cells.Clear
    ActiveWindow.DisplayGridlines = False
    ws.Cells.Interior.Color = RGB(8, 8, 12)
    ws.Cells.Font.Color = RGB(230, 230, 240)
    ws.Columns(1).ColumnWidth = 2
    ws.Range(ws.Columns(COL0), ws.Columns(COL0 + VW - 1)).ColumnWidth = 1.3
    ws.Range(ws.Rows(ROW0), ws.Rows(ROW0 + VH - 1)).RowHeight = 9.6
    ws.Columns(COL0 + VW).ColumnWidth = 1.3
    ws.Columns(COL0 + VW + 1).ColumnWidth = 1.3
    ws.Range(ws.Columns(MCOL), ws.Columns(MCOL + MAPN - 1)).ColumnWidth = 1.3
    ViewRange.Interior.Color = RGB(14, 12, 24)
    ViewRange.BorderAround xlContinuous, xlThick, , RGB(255, 150, 60)
    With ws.Cells(1, COL0)
        .Value = "3D MAZE - tech3almashi"
        .Font.Bold = True: .Font.Size = 16: .Font.Color = RGB(255, 150, 60)
    End With
    LoadMap
    DrawMap
    On Error Resume Next: ws.Shapes("PlayButton").Delete: On Error GoTo 0
    Set s = ws.Shapes.AddShape(msoShapeRoundedRectangle, ws.Cells(ROW0 + MAPN + 2, MCOL).Left, ws.Cells(ROW0 + MAPN + 2, MCOL).Top, 100, 34)
    s.Name = "PlayButton"
    s.Fill.ForeColor.RGB = RGB(230, 120, 30)
    s.Line.Visible = msoFalse
    s.TextFrame2.TextRange.Text = "Play"
    s.TextFrame2.TextRange.Font.Bold = msoTrue
    s.TextFrame2.TextRange.Font.Size = 15
    s.TextFrame2.TextRange.ParagraphFormat.Alignment = msoAlignCenter
    s.TextFrame2.VerticalAnchor = msoAnchorMiddle
    s.OnAction = "Maze"
    ws.Cells(ROW0 + MAPN + 7, MCOL).Value = "Up/Down = walk"
    ws.Cells(ROW0 + MAPN + 9, MCOL).Value = "Left/Right = turn"
    ws.Cells(ROW0 + MAPN + 11, MCOL).Value = "Find the green wall!"
    ws.Cells(ROW0 + MAPN + 13, MCOL).Value = "Esc = stop"
    ws.Cells(1, 1).Select
    Application.ScreenUpdating = True
End Sub

Private Sub LockArrowKeys(ByVal lockThem As Boolean)
    Dim k As Variant
    For Each k In Array("{LEFT}", "{RIGHT}", "{UP}", "{DOWN}")
        If lockThem Then Application.OnKey k, "" Else Application.OnKey k
    Next k
End Sub

Private Function IsDown(ByVal k As Long) As Boolean
    IsDown = (GetAsyncKeyState(k) And &H8000) <> 0
End Function

' ---------------------------------------------------------------- game loop
Public Sub Maze()
    Dim c As Long, mv As Double, rt As Double, ox As Double, nx As Double, ny As Double
    Dim won As Boolean, t0 As Double

    If ActiveSheet.Cells(1, COL0).Value <> "3D MAZE - tech3almashi" Then SetupBoard
    LoadMap
    DrawMap
    posX = 1.5: posY = 1.5
    dirX = 1: dirY = 0
    planeX = 0: planeY = 0.66
    For c = 0 To VW - 1: lastTop(c) = -1: lastBot(c) = -1: lastCol(c) = -1: Next c
    GetAsyncKeyState vbKeyLeft: GetAsyncKeyState vbKeyRight: GetAsyncKeyState vbKeyUp: GetAsyncKeyState vbKeyDown
    LockArrowKeys True
    Application.EnableCancelKey = xlDisabled
    t0 = Timer
    Render

    Do
        If IsDown(vbKeyEscape) Then Exit Do
        mv = 0: rt = 0
        If IsDown(vbKeyUp) Then mv = 0.11
        If IsDown(vbKeyDown) Then mv = -0.08
        If IsDown(vbKeyLeft) Then rt = -0.07
        If IsDown(vbKeyRight) Then rt = 0.07
        If rt <> 0 Then
            ox = dirX
            dirX = dirX * Cos(rt) - dirY * Sin(rt): dirY = ox * Sin(rt) + dirY * Cos(rt)
            ox = planeX
            planeX = planeX * Cos(rt) - planeY * Sin(rt): planeY = ox * Sin(rt) + planeY * Cos(rt)
        End If
        If mv <> 0 Then
            nx = posX + dirX * mv: ny = posY + dirY * mv
            ' slide along walls, keep 0.2 away from them
            If Not Solid(nx + Sgn(dirX * mv) * 0.2, posY) Then posX = nx
            If Not Solid(posX, ny + Sgn(dirY * mv) * 0.2) Then posY = ny
            If Tile(Int(posX + 0.6), Int(posY)) = "E" Then won = True
        End If
        If mv <> 0 Or rt <> 0 Then Render
        If won Then Exit Do
        DoEvents
        Sleep 12
    Loop

    Application.EnableCancelKey = xlInterrupt
    LockArrowKeys False
    If won Then
        MsgBox "You escaped in " & Format(Timer - t0, "0.0") & " seconds!" & vbCrLf & "@tech3almashi", vbInformation, "3D Maze"
    End If
End Sub
