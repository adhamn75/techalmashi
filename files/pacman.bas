Attribute VB_Name = "PacmanGame"
' =====================================================================
'  PAC-MAN inside Excel  -  tech3almashi  (@tech3almashi)
'  1) Open the file and click "Enable Content".
'  2) Click "Play" (or Alt+F8 > Pacman).
'     Arrow keys = move      Esc = stop
'  Every cell is one tile of the maze. Every tick a breadth-first search
'  floods the maze from Pac-Man and writes the distance (in steps) into
'  every open tile; each ghost steps to the neighbour with the smallest
'  number = the shortest path to you. Eat a power pellet and they turn
'  blue and run to the biggest number instead.
'  Press D during a game to show / hide the distance numbers.
'  Windows Excel (32 or 64 bit). Keep it as .xlsm.
' =====================================================================
Option Explicit

#If VBA7 Then
    Private Declare PtrSafe Function GetAsyncKeyState Lib "user32" (ByVal vKey As Long) As Integer
    Private Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal ms As Long)
#Else
    Private Declare Function GetAsyncKeyState Lib "user32" (ByVal vKey As Long) As Integer
    Private Declare Sub Sleep Lib "kernel32" (ByVal ms As Long)
#End If

Private Const W As Long = 19
Private Const H As Long = 21
Private Const ROW0 As Long = 3
Private Const COL0 As Long = 2
Private Const FRIGHT_TICKS As Long = 40
Private Const TICK_SEC As Double = 0.13

Private maze(0 To W - 1, 0 To H - 1) As String   ' # wall, - door, G house, else open
Private dots(0 To W - 1, 0 To H - 1) As String   ' . dot, o pellet, " " empty
Private dist(0 To W - 1, 0 To H - 1) As Long     ' BFS distance from Pac-Man
Private homeDist(0 To W - 1, 0 To H - 1) As Long ' BFS distance from the ghost house
Private shownC(0 To W - 1, 0 To H - 1) As Long, wantC(0 To W - 1, 0 To H - 1) As Long
Private shownT(0 To W - 1, 0 To H - 1) As String, wantT(0 To W - 1, 0 To H - 1) As String

Private px As Long, py As Long, pd As Long
Private gx(0 To 3) As Long, gy(0 To 3) As Long, gd(0 To 3) As Long, gm(0 To 3) As Long, gs(0 To 3) As Long
' gm: 0 house, 1 chase, 2 fright, 3 eyes
Private score As Long, best As Long, lives As Long, tick As Long, fright As Long, eaten As Long
Private showNums As Boolean, prevD As Boolean
Private DX(0 To 3) As Long, DY(0 To 3) As Long, release(0 To 3) As Long

Private Const COL_WALL As Long = 12611072      ' RGB(0, 110, 192) deep blue
Private Const COL_FLOOR As Long = 1314828      ' RGB(12, 16, 20)

Private Function MazeRows() As Variant
    MazeRows = Array( _
        "###################", _
        "#........#........#", _
        "#o##.###.#.###.##o#", _
        "#.................#", _
        "#.##.#.#####.#.##.#", _
        "#....#...#...#....#", _
        "####.###.#.###.####", _
        "   #.#.......#.#   ", _
        "####.#.##-##.#.####", _
        "......##GGG##......", _
        "####.#.#####.#.####", _
        "   #.#.......#.#   ", _
        "####.#.#####.#.####", _
        "#........#........#", _
        "#.##.###.#.###.##.#", _
        "#o.#.....P.....#.o#", _
        "##.#.#.#####.#.#.##", _
        "#....#...#...#....#", _
        "#.######.#.######.#", _
        "#.................#", _
        "###################")
End Function

Private Sub LoadMaze()
    Dim r As Variant, x As Long, y As Long, c As String
    r = MazeRows()
    DX(0) = 1: DY(0) = 0: DX(1) = 0: DY(1) = 1: DX(2) = -1: DY(2) = 0: DX(3) = 0: DY(3) = -1
    release(0) = 0: release(1) = 12: release(2) = 30: release(3) = 50
    For y = 0 To H - 1
        For x = 0 To W - 1
            c = Mid$(r(y), x + 1, 1)
            maze(x, y) = c
            If c = "." Or c = "o" Then dots(x, y) = c Else dots(x, y) = " "
        Next x
    Next y
End Sub

Private Function Wrap(ByVal x As Long) As Long
    Wrap = (x + W) Mod W
End Function

Private Function IsWall(ByVal x As Long, ByVal y As Long) As Boolean
    If y < 0 Or y >= H Then IsWall = True Else IsWall = (maze(Wrap(x), y) = "#")
End Function

Private Function PacOpen(ByVal x As Long, ByVal y As Long) As Boolean
    If IsWall(x, y) Then Exit Function
    PacOpen = (maze(Wrap(x), y) <> "-" And maze(Wrap(x), y) <> "G")
End Function

' ---------------------------------------------------------------- the brain: breadth-first flood
Private Sub Flood(ByVal sx As Long, ByVal sy As Long, ByRef d() As Long)
    Dim qx(0 To W * H) As Long, qy(0 To W * H) As Long, head As Long, tail As Long
    Dim x As Long, y As Long, k As Long, nx As Long, ny As Long
    For y = 0 To H - 1: For x = 0 To W - 1: d(x, y) = -1: Next x: Next y
    d(sx, sy) = 0: qx(0) = sx: qy(0) = sy: tail = 1
    Do While head < tail
        x = qx(head): y = qy(head): head = head + 1
        For k = 0 To 3
            nx = Wrap(x + DX(k)): ny = y + DY(k)
            If Not IsWall(nx, ny) Then
                If d(nx, ny) < 0 Then
                    d(nx, ny) = d(x, y) + 1
                    qx(tail) = nx: qy(tail) = ny: tail = tail + 1
                End If
            End If
        Next k
    Loop
End Sub

Private Sub MoveGhost(ByVal i As Long)
    Dim k As Long, nx As Long, ny As Long, v As Long, bestK As Long, bestV As Long, n As Long
    Dim opts(0 To 3) As Long
    If gm(i) = 0 Then Exit Sub
    If gm(i) = 2 Then
        gs(i) = 1 - gs(i)
        If gs(i) = 1 Then Exit Sub            ' blue ghosts move every other tick
    End If
    bestK = -1
    If gm(i) = 2 Then bestV = -1 Else bestV = 1000000000
    For k = 0 To 3
        nx = Wrap(gx(i) + DX(k)): ny = gy(i) + DY(k)
        If Not IsWall(nx, ny) Then
            If Not (gm(i) <> 3 And maze(nx, ny) = "-" And DY(k) > 0) Then     ' never back into the house
                If ((k + 2) Mod 4) <> gd(i) Then                                 ' no U-turns
                    opts(n) = k: n = n + 1
                    If gm(i) = 3 Then v = homeDist(nx, ny) Else v = dist(nx, ny)
                    If gm(i) = 2 Then
                        If v > bestV Then bestV = v: bestK = k
                    Else
                        If v < bestV Then bestV = v: bestK = k
                    End If
                End If
            End If
        End If
    Next k
    If n = 0 Then
        bestK = (gd(i) + 2) Mod 4
    ElseIf i > 0 And gm(i) = 1 Then
        If Rnd < 0.2 Then bestK = opts(Int(Rnd * n))             ' a little personality
    End If
    gx(i) = Wrap(gx(i) + DX(bestK)): gy(i) = gy(i) + DY(bestK): gd(i) = bestK
    If gm(i) = 3 And gx(i) = 9 And gy(i) = 9 Then gm(i) = 1
End Sub

' ---------------------------------------------------------------- drawing
Private Function Cell(ByVal x As Long, ByVal y As Long) As Range
    Set Cell = ActiveSheet.Cells(ROW0 + y, COL0 + x)
End Function

Private Sub Compose()
    Dim x As Long, y As Long, i As Long, c As Long
    For y = 0 To H - 1
        For x = 0 To W - 1
            If maze(x, y) = "#" Then
                wantC(x, y) = COL_WALL: wantT(x, y) = ""
            ElseIf maze(x, y) = "-" Then
                wantC(x, y) = RGB(255, 170, 200): wantT(x, y) = ""
            Else
                wantC(x, y) = COL_FLOOR
                If showNums And dist(x, y) >= 0 Then
                    wantT(x, y) = CStr(dist(x, y))      ' the BFS numbers the ghosts follow
                ElseIf dots(x, y) = "." Then
                    wantT(x, y) = ChrW(8226)
                ElseIf dots(x, y) = "o" Then
                    If (tick \ 3) Mod 2 = 0 Then wantT(x, y) = ChrW(9679) Else wantT(x, y) = ""
                Else
                    wantT(x, y) = ""
                End If
            End If
        Next x
    Next y
    For i = 0 To 3
        Select Case gm(i)
            Case 2
                If fright < 10 And (tick Mod 2 = 0) Then c = RGB(240, 240, 255) Else c = RGB(40, 60, 255)
            Case 3: c = RGB(200, 200, 220)
            Case Else
                c = Choose(i + 1, RGB(255, 0, 0), RGB(255, 184, 255), RGB(0, 255, 255), RGB(255, 184, 82))
        End Select
        wantC(gx(i), gy(i)) = c: wantT(gx(i), gy(i)) = ""
    Next i
    wantC(px, py) = RGB(255, 230, 0): wantT(px, py) = ""
End Sub

' Repaint only the cells whose colour or text changed since the last frame.
Private Sub Flush()
    Dim x As Long, y As Long
    Application.ScreenUpdating = False
    For y = 0 To H - 1
        For x = 0 To W - 1
            If wantC(x, y) <> shownC(x, y) Then Cell(x, y).Interior.Color = wantC(x, y): shownC(x, y) = wantC(x, y)
            If wantT(x, y) <> shownT(x, y) Then
                Cell(x, y).Value = wantT(x, y): shownT(x, y) = wantT(x, y)
                If dots(x, y) = " " Then Cell(x, y).Font.Color = RGB(90, 200, 255) Else Cell(x, y).Font.Color = RGB(255, 210, 170)
            End If
        Next x
    Next y
    Application.ScreenUpdating = True
End Sub

Private Sub UpdateHud()
    With ActiveSheet
        .Cells(ROW0 + 1, COL0 + W + 2).Value = score
        .Cells(ROW0 + 4, COL0 + W + 2).Value = best
        .Cells(ROW0 + 7, COL0 + W + 2).Value = String(lives, ChrW(9679))
    End With
End Sub

' ---------------------------------------------------------------- the world
Private Sub ResetActors()
    Dim i As Long
    px = 9: py = 15: pd = 2: tick = 0: fright = 0
    gx(0) = 9: gy(0) = 7: gx(1) = 8: gy(1) = 9: gx(2) = 9: gy(2) = 9: gx(3) = 10: gy(3) = 9
    For i = 0 To 3
        gd(i) = 3: gs(i) = 0
        If i = 0 Then gm(i) = 1 Else gm(i) = 0
    Next i
End Sub

Private Function DotsLeft() As Boolean
    Dim x As Long, y As Long
    For y = 0 To H - 1: For x = 0 To W - 1
        If dots(x, y) <> " " Then DotsLeft = True: Exit Function
    Next x: Next y
End Function

Private Function KeyDir() As Long
    KeyDir = -1
    If (GetAsyncKeyState(vbKeyRight) And &H8000) <> 0 Then KeyDir = 0
    If (GetAsyncKeyState(vbKeyDown) And &H8000) <> 0 Then KeyDir = 1
    If (GetAsyncKeyState(vbKeyLeft) And &H8000) <> 0 Then KeyDir = 2
    If (GetAsyncKeyState(vbKeyUp) And &H8000) <> 0 Then KeyDir = 3
End Function

' One tick: same order as the video (Pac-Man, food, timers, flood, ghosts, collisions).
Private Function StepGame(ByVal want As Long) As Boolean
    Dim i As Long, c As String, hit As Boolean
    Dim ox(0 To 3) As Long, oy(0 To 3) As Long, opx As Long, opy As Long
    tick = tick + 1
    opx = px: opy = py
    If want >= 0 Then
        If PacOpen(px + DX(want), py + DY(want)) Then pd = want
    End If
    If PacOpen(px + DX(pd), py + DY(pd)) Then px = Wrap(px + DX(pd)): py = py + DY(pd)
    c = dots(px, py)
    If c = "." Or c = "o" Then
        dots(px, py) = " "
        If c = "." Then score = score + 10 Else score = score + 50
        If c = "o" Then
            fright = FRIGHT_TICKS: eaten = 0
            For i = 0 To 3
                If gm(i) = 1 Then gm(i) = 2: gd(i) = (gd(i) + 2) Mod 4: gs(i) = 0
            Next i
        End If
        UpdateHud
    End If
    If fright > 0 Then
        fright = fright - 1
        If fright = 0 Then
            For i = 0 To 3
                If gm(i) = 2 Then gm(i) = 1
            Next i
        End If
    End If
    For i = 0 To 3
        If gm(i) = 0 And tick >= release(i) Then gm(i) = 1: gx(i) = 9: gy(i) = 7: gd(i) = 2
        ox(i) = gx(i): oy(i) = gy(i)
    Next i
    Flood px, py, dist
    For i = 0 To 3: MoveGhost i: Next i
    For i = 0 To 3
        hit = (gx(i) = px And gy(i) = py) Or (ox(i) = px And oy(i) = py And gx(i) = opx And gy(i) = opy)
        If hit And (gm(i) = 1 Or gm(i) = 2) Then
            If gm(i) = 2 Then
                eaten = eaten + 1: score = score + 100 * 2 ^ eaten: gm(i) = 3: UpdateHud
            Else
                lives = lives - 1: UpdateHud
                If lives <= 0 Then StepGame = False: Exit Function
                Compose: Flush
                Sleep 700
                ResetActors
                Exit For
            End If
        End If
    Next i
    If Not DotsLeft() Then LoadMaze: ResetActors
    StepGame = True
End Function

Private Sub LockKeys(ByVal lockThem As Boolean)
    Dim k As Variant
    For Each k In Array("{UP}", "{DOWN}", "{LEFT}", "{RIGHT}", "d", "D")
        If lockThem Then Application.OnKey k, "" Else Application.OnKey k
    Next k
End Sub

' ---------------------------------------------------------------- setup
Public Sub SetupScreen()
    Dim ws As Worksheet: Set ws = ActiveSheet
    Dim s As Shape, hud As Long, x As Long, y As Long
    hud = COL0 + W + 2
    Application.ScreenUpdating = False
    ws.Cells.Clear
    ActiveWindow.DisplayGridlines = False
    ws.Cells.Interior.Color = RGB(6, 6, 12)
    ws.Cells.Font.Color = RGB(235, 235, 240)
    ws.Columns(1).ColumnWidth = 2
    ws.Range(ws.Columns(COL0), ws.Columns(COL0 + W - 1)).ColumnWidth = 3.3
    ws.Range(ws.Rows(ROW0), ws.Rows(ROW0 + H - 1)).RowHeight = 22
    With ws.Range(ws.Cells(ROW0, COL0), ws.Cells(ROW0 + H - 1, COL0 + W - 1))
        .HorizontalAlignment = xlCenter: .VerticalAlignment = xlCenter
        .Font.Size = 9: .Font.Bold = True: .Font.Name = "Consolas"
    End With
    ws.Columns(hud).ColumnWidth = 16
    With ws.Cells(1, COL0)
        .Value = "PAC-MAN - tech3almashi"
        .Font.Bold = True: .Font.Size = 16: .Font.Color = RGB(255, 230, 0)
    End With
    ws.Cells(ROW0, hud).Value = "SCORE"
    ws.Cells(ROW0 + 3, hud).Value = "BEST"
    ws.Cells(ROW0 + 6, hud).Value = "LIVES"
    ws.Range(ws.Cells(ROW0, hud), ws.Cells(ROW0 + 7, hud)).Font.Bold = True
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 7, hud)).Font.Size = 18
    ws.Cells(ROW0 + 7, hud).Font.Color = RGB(255, 230, 0)
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 7, hud)).HorizontalAlignment = xlLeft

    On Error Resume Next: ws.Shapes("PlayButton").Delete: On Error GoTo 0
    Set s = ws.Shapes.AddShape(msoShapeRoundedRectangle, ws.Cells(ROW0 + 10, hud).Left, ws.Cells(ROW0 + 10, hud).Top, 100, 34)
    s.Name = "PlayButton"
    s.Fill.ForeColor.RGB = RGB(255, 200, 0)
    s.Line.Visible = msoFalse
    s.TextFrame2.TextRange.Text = "Play"
    s.TextFrame2.TextRange.Font.Bold = msoTrue
    s.TextFrame2.TextRange.Font.Size = 15
    s.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = RGB(20, 20, 30)
    s.TextFrame2.TextRange.ParagraphFormat.Alignment = msoAlignCenter
    s.TextFrame2.VerticalAnchor = msoAnchorMiddle
    s.OnAction = "Pacman"
    ws.Cells(ROW0 + 13, hud).Value = "Arrows = move"
    ws.Cells(ROW0 + 14, hud).Value = "D = show the BFS numbers"
    ws.Cells(ROW0 + 15, hud).Value = "Esc = stop"

    For y = 0 To H - 1: For x = 0 To W - 1: shownC(x, y) = -1: shownT(x, y) = "?": Next x: Next y
    LoadMaze: ResetActors: score = 0: lives = 3
    Flood px, py, dist: Flood 9, 9, homeDist
    Compose: Flush: UpdateHud
    ws.Cells(1, 1).Select
    Application.ScreenUpdating = True
End Sub

' ---------------------------------------------------------------- game loop
Public Sub Pacman()
    Dim alive As Boolean, nextTick As Double, want As Long, k As Long, x As Long, y As Long, dDown As Boolean

    If ActiveSheet.Cells(ROW0, COL0 + W + 2).Value <> "SCORE" Then SetupScreen
    Randomize
    For y = 0 To H - 1: For x = 0 To W - 1: shownC(x, y) = -1: shownT(x, y) = "?": Next x: Next y
    LoadMaze: ResetActors
    Flood 9, 9, homeDist
    score = 0: lives = 3: want = -1
    UpdateHud
    LockKeys True
    Application.EnableCancelKey = xlDisabled
    alive = True
    nextTick = Timer

    Do While alive
        If (GetAsyncKeyState(vbKeyEscape) And &H8000) <> 0 Then Exit Do
        k = KeyDir(): If k >= 0 Then want = k
        dDown = (GetAsyncKeyState(vbKeyD) And &H8000) <> 0
        If dDown And Not prevD Then showNums = Not showNums
        prevD = dDown
        If Timer >= nextTick Or Timer < nextTick - 5 Then
            nextTick = Timer + TICK_SEC
            alive = StepGame(want)
            Compose: Flush
        End If
        DoEvents
        Sleep 5
    Loop

    Application.EnableCancelKey = xlInterrupt
    LockKeys False
    If score > best Then best = score
    UpdateHud
    MsgBox "Game over!" & vbCrLf & "Score: " & score & "   Best: " & best & vbCrLf & "@tech3almashi", vbInformation, "Pac-Man"
End Sub
