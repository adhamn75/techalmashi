Attribute VB_Name = "TetrisGame"
' =====================================================================
'  TETRIS inside Excel  -  tech3almashi  (@tech3almashi)
'  1) Open the file and click "Enable Content".
'  2) Click "Play" (or Alt+F8 > Tetris).
'     Left/Right = move   Up = rotate   Down = drop faster   Esc = stop
'  Rotation with wall kicks, line clears, score, levels, next piece.
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

Private Const W As Long = 10          ' board width  (columns)
Private Const H As Long = 20          ' board height (rows)
Private Const ROW0 As Long = 3        ' first board row
Private Const COL0 As Long = 2        ' first board column (B)
Private Const HUD As Long = 14        ' column of the side panel (N)

Private grid(0 To 9, 0 To 19) As Long     ' 0 = empty, otherwise the colour of a locked block
Private kind As Long, nextKind As Long, rot As Long, ox As Long, oy As Long
Private score As Long, linesDone As Long, level As Long
Private prevKey(0 To 255) As Boolean, repeatAt(0 To 255) As Double

' ---------------------------------------------------------------- helpers
Private Function BoardColor() As Long
    BoardColor = RGB(18, 18, 28)
End Function

Private Function PieceColor(ByVal k As Long) As Long
    Select Case k
        Case 0: PieceColor = RGB(0, 229, 255)    ' I
        Case 1: PieceColor = RGB(255, 214, 0)    ' O
        Case 2: PieceColor = RGB(170, 70, 255)   ' T
        Case 3: PieceColor = RGB(40, 210, 90)    ' S
        Case 4: PieceColor = RGB(255, 60, 70)    ' Z
        Case 5: PieceColor = RGB(50, 110, 255)   ' J
        Case Else: PieceColor = RGB(255, 140, 0) ' L
    End Select
End Function

Private Function Cell(ByVal x As Long, ByVal y As Long) As Range
    Set Cell = ActiveSheet.Cells(ROW0 + y, COL0 + x)
End Function

Private Function Board() As Range
    Set Board = ActiveSheet.Range(ActiveSheet.Cells(ROW0, COL0), ActiveSheet.Cells(ROW0 + H - 1, COL0 + W - 1))
End Function

' The 4 blocks of piece k in rotation r, inside its 3x3 (or 4x4 for I) box.
Private Sub ShapeCells(ByVal k As Long, ByVal r As Long, xs() As Long, ys() As Long)
    Dim s As String, i As Long, j As Long, x As Long, y As Long, t As Long, n As Long
    s = Choose(k + 1, "01112131", "10201121", "10011121", "10200111", "00101121", "00011121", "20011121")
    If k = 0 Then n = 4 Else n = 3
    For i = 0 To 3
        x = CLng(Mid$(s, i * 2 + 1, 1))
        y = CLng(Mid$(s, i * 2 + 2, 1))
        If k <> 1 Then                       ' the O piece never rotates
            For j = 1 To r
                t = x: x = n - 1 - y: y = t  ' 90 degrees clockwise
            Next j
        End If
        xs(i) = x: ys(i) = y
    Next i
End Sub

Private Function Fits(ByVal k As Long, ByVal r As Long, ByVal x0 As Long, ByVal y0 As Long) As Boolean
    Dim xs(0 To 3) As Long, ys(0 To 3) As Long, i As Long, gx As Long, gy As Long
    ShapeCells k, r, xs, ys
    For i = 0 To 3
        gx = x0 + xs(i): gy = y0 + ys(i)
        If gx < 0 Or gx >= W Or gy >= H Then Exit Function
        If gy >= 0 Then
            If grid(gx, gy) <> 0 Then Exit Function
        End If
    Next i
    Fits = True
End Function

Private Sub DrawPiece(ByVal show As Boolean)
    Dim xs(0 To 3) As Long, ys(0 To 3) As Long, i As Long, c As Long
    ShapeCells kind, rot, xs, ys
    If show Then c = PieceColor(kind) Else c = BoardColor()
    For i = 0 To 3
        If oy + ys(i) >= 0 Then Cell(ox + xs(i), oy + ys(i)).Interior.Color = c
    Next i
End Sub

Private Sub RedrawBoard()
    Dim x As Long, y As Long
    Application.ScreenUpdating = False
    For y = 0 To H - 1
        For x = 0 To W - 1
            If grid(x, y) = 0 Then
                Cell(x, y).Interior.Color = BoardColor()
            Else
                Cell(x, y).Interior.Color = grid(x, y)
            End If
        Next x
    Next y
    Application.ScreenUpdating = True
End Sub

Private Sub UpdateHud()
    With ActiveSheet
        .Cells(ROW0 + 1, HUD).Value = score
        .Cells(ROW0 + 4, HUD).Value = linesDone
        .Cells(ROW0 + 7, HUD).Value = level
    End With
End Sub

Private Sub DrawNext()
    Dim xs(0 To 3) As Long, ys(0 To 3) As Long, i As Long
    With ActiveSheet
        .Range(.Cells(ROW0 + 10, HUD), .Cells(ROW0 + 11, HUD + 3)).Interior.Color = BoardColor()
        ShapeCells nextKind, 0, xs, ys
        For i = 0 To 3
            .Cells(ROW0 + 10 + ys(i) - IIf(nextKind = 0, 1, 0), HUD + xs(i)).Interior.Color = PieceColor(nextKind)
        Next i
    End With
End Sub

' ---------------------------------------------------------------- moves
Private Function TryMove(ByVal dx As Long, ByVal dy As Long) As Boolean
    If Fits(kind, rot, ox + dx, oy + dy) Then
        DrawPiece False
        ox = ox + dx: oy = oy + dy
        DrawPiece True
        TryMove = True
    End If
End Function

Private Sub TryRotate()
    Dim nr As Long, kick As Variant
    nr = (rot + 1) Mod 4
    For Each kick In Array(0, -1, 1, -2, 2)
        If Fits(kind, nr, ox + kick, oy) Then
            DrawPiece False
            rot = nr: ox = ox + kick
            DrawPiece True
            Exit Sub
        End If
    Next kick
End Sub

Private Function Spawn() As Boolean
    kind = nextKind
    nextKind = Int(Rnd * 7)
    rot = 0: ox = 3
    If kind = 0 Then oy = -1 Else oy = 0
    DrawNext
    If Not Fits(kind, rot, ox, oy) Then Exit Function
    DrawPiece True
    Spawn = True
End Function

Private Sub ClearLines()
    Dim x As Long, y As Long, yy As Long, full As Boolean, cleared As Long
    y = H - 1
    Do While y >= 0
        full = True
        For x = 0 To W - 1
            If grid(x, y) = 0 Then full = False: Exit For
        Next x
        If full Then
            For yy = y To 1 Step -1
                For x = 0 To W - 1: grid(x, yy) = grid(x, yy - 1): Next x
            Next yy
            For x = 0 To W - 1: grid(x, 0) = 0: Next x
            cleared = cleared + 1                ' check the same row again
        Else
            y = y - 1
        End If
    Loop
    If cleared > 0 Then
        score = score + Choose(cleared, 100, 300, 500, 800) * level
        linesDone = linesDone + cleared
        level = 1 + linesDone \ 10
        RedrawBoard
    End If
End Sub

' Lock the falling piece into the grid, clear lines and bring the next one. False = game over.
Private Function LockAndNext() As Boolean
    Dim xs(0 To 3) As Long, ys(0 To 3) As Long, i As Long
    ShapeCells kind, rot, xs, ys
    For i = 0 To 3
        If oy + ys(i) < 0 Then Exit Function
        grid(ox + xs(i), oy + ys(i)) = PieceColor(kind)
    Next i
    ClearLines
    UpdateHud
    LockAndNext = Spawn()
End Function

Private Function DropDelay() As Double
    DropDelay = 0.55 - (level - 1) * 0.05
    If DropDelay < 0.08 Then DropDelay = 0.08
End Function

' ---------------------------------------------------------------- keyboard
Private Function IsDown(ByVal k As Long) As Boolean
    IsDown = (GetAsyncKeyState(k) And &H8000) <> 0
End Function

' True on the press and then again while held (auto-repeat).
Private Function Pressed(ByVal k As Long, ByVal firstDelay As Double, ByVal rate As Double) As Boolean
    Dim d As Boolean: d = IsDown(k)
    If d Then
        If Not prevKey(k) Then
            Pressed = True: repeatAt(k) = Timer + firstDelay
        ElseIf Timer >= repeatAt(k) Or Timer < repeatAt(k) - 5 Then
            Pressed = True: repeatAt(k) = Timer + rate
        End If
    End If
    prevKey(k) = d
End Function

' True only on the press.
Private Function Tapped(ByVal k As Long) As Boolean
    Dim d As Boolean: d = IsDown(k)
    Tapped = d And Not prevKey(k)
    prevKey(k) = d
End Function

Private Sub LockArrowKeys(ByVal lockThem As Boolean)
    Dim k As Variant
    For Each k In Array("{LEFT}", "{RIGHT}", "{UP}", "{DOWN}")
        If lockThem Then Application.OnKey k, "" Else Application.OnKey k
    Next k
End Sub

' ---------------------------------------------------------------- setup
Public Sub SetupBoard()
    Dim ws As Worksheet: Set ws = ActiveSheet
    Dim s As Shape
    Application.ScreenUpdating = False
    ws.Cells.Clear
    ActiveWindow.DisplayGridlines = False
    ws.Cells.Interior.Color = RGB(8, 8, 14)
    ws.Cells.Font.Color = RGB(230, 230, 240)
    ws.Columns(1).ColumnWidth = 2
    ws.Range(ws.Columns(COL0), ws.Columns(COL0 + W - 1)).ColumnWidth = 3.6
    ws.Columns(COL0 + W).ColumnWidth = 2
    ws.Range(ws.Columns(HUD), ws.Columns(HUD + 3)).ColumnWidth = 3.6
    ws.Range(ws.Rows(ROW0), ws.Rows(ROW0 + H - 1)).RowHeight = 21
    With Board
        .Interior.Color = BoardColor()
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(40, 40, 58)
        .BorderAround xlContinuous, xlThick, , RGB(0, 229, 255)
    End With
    With ws.Cells(1, COL0)
        .Value = "TETRIS - tech3almashi"
        .Font.Bold = True: .Font.Size = 16: .Font.Color = RGB(0, 229, 255)
    End With
    ws.Cells(ROW0, HUD).Value = "SCORE"
    ws.Cells(ROW0 + 3, HUD).Value = "LINES"
    ws.Cells(ROW0 + 6, HUD).Value = "LEVEL"
    ws.Cells(ROW0 + 9, HUD).Value = "NEXT"
    ws.Range(ws.Cells(ROW0, HUD), ws.Cells(ROW0 + 9, HUD)).Font.Bold = True
    ws.Range(ws.Cells(ROW0 + 1, HUD), ws.Cells(ROW0 + 7, HUD)).Font.Size = 16
    ws.Range(ws.Cells(ROW0 + 1, HUD), ws.Cells(ROW0 + 7, HUD)).HorizontalAlignment = xlLeft
    ws.Range(ws.Cells(ROW0 + 10, HUD), ws.Cells(ROW0 + 11, HUD + 3)).Interior.Color = BoardColor()

    On Error Resume Next: ws.Shapes("PlayButton").Delete: On Error GoTo 0
    Set s = ws.Shapes.AddShape(msoShapeRoundedRectangle, ws.Cells(ROW0 + 13, HUD).Left, ws.Cells(ROW0 + 13, HUD).Top, 100, 34)
    s.Name = "PlayButton"
    s.Fill.ForeColor.RGB = RGB(0, 170, 200)
    s.Line.Visible = msoFalse
    s.TextFrame2.TextRange.Text = "Play"
    s.TextFrame2.TextRange.Font.Bold = msoTrue
    s.TextFrame2.TextRange.Font.Size = 15
    s.TextFrame2.TextRange.ParagraphFormat.Alignment = msoAlignCenter
    s.TextFrame2.VerticalAnchor = msoAnchorMiddle
    s.OnAction = "Tetris"
    ws.Cells(ROW0 + 16, HUD).Value = "Left/Right = move"
    ws.Cells(ROW0 + 17, HUD).Value = "Up = rotate"
    ws.Cells(ROW0 + 18, HUD).Value = "Down = faster"
    ws.Cells(ROW0 + 19, HUD).Value = "Esc = stop"
    ws.Cells(1, 1).Select
    Application.ScreenUpdating = True
End Sub

' ---------------------------------------------------------------- game loop
Public Sub Tetris()
    Dim nextDrop As Double, alive As Boolean, k As Long

    If ActiveSheet.Cells(ROW0, HUD).Value <> "SCORE" Then SetupBoard
    Randomize
    Erase grid
    score = 0: linesDone = 0: level = 1
    For k = 0 To 255: prevKey(k) = False: Next k
    RedrawBoard
    UpdateHud
    nextKind = Int(Rnd * 7)
    alive = Spawn()
    ' forget key presses made before the game started
    GetAsyncKeyState vbKeyLeft: GetAsyncKeyState vbKeyRight: GetAsyncKeyState vbKeyUp: GetAsyncKeyState vbKeyDown
    LockArrowKeys True
    Application.EnableCancelKey = xlDisabled
    nextDrop = Timer + DropDelay()

    Do While alive
        If IsDown(vbKeyEscape) Then Exit Do
        If Pressed(vbKeyLeft, 0.17, 0.05) Then TryMove -1, 0
        If Pressed(vbKeyRight, 0.17, 0.05) Then TryMove 1, 0
        If Tapped(vbKeyUp) Then TryRotate
        If Pressed(vbKeyDown, 0.05, 0.04) Then
            If TryMove(0, 1) Then
                score = score + 1
            Else
                alive = LockAndNext()
            End If
            nextDrop = Timer + DropDelay()
        End If
        If alive And (Timer >= nextDrop Or Timer < nextDrop - 5) Then
            If Not TryMove(0, 1) Then alive = LockAndNext()
            nextDrop = Timer + DropDelay()
        End If
        DoEvents
        Sleep 15
    Loop

    Application.EnableCancelKey = xlInterrupt
    LockArrowKeys False
    UpdateHud
    MsgBox "Game over!" & vbCrLf & "Score: " & score & "   Lines: " & linesDone & vbCrLf & "@tech3almashi", vbInformation, "Tetris"
End Sub
