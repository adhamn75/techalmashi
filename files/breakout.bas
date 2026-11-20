Attribute VB_Name = "BreakoutGame"
' =====================================================================
'  BREAKOUT (brick breaker) inside Excel  -  tech3almashi  (@tech3almashi)
'  1) Open the file and click "Enable Content".
'  2) Click "Play" (or Alt+F8 > Breakout).
'     Left / Right arrows = move the paddle   Space = launch   Esc = stop
'  Every cell is one pixel (40 x 36). One VBA loop moves the ball,
'  bounces it off walls, bricks and the paddle (the edge of the paddle
'  sends it sideways) and repaints only the cells that changed.
'  Clear all 60 bricks to win a faster round. 3 lives.
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

Private Const W As Long = 40
Private Const H As Long = 36
Private Const ROW0 As Long = 3
Private Const COL0 As Long = 2
Private Const BR As Long = 6            ' brick rows
Private Const BC As Long = 10           ' bricks per row
Private Const BW As Long = 4            ' brick width (cells)
Private Const BH As Long = 2            ' brick height (cells)
Private Const BY0 As Long = 4           ' first brick row (y)
Private Const PY As Long = 33           ' paddle row
Private Const PW As Long = 7            ' paddle width

Private brick(0 To BR - 1, 0 To BC - 1) As Boolean
Private wantC(0 To W - 1, 0 To H - 1) As Long, shownC(0 To W - 1, 0 To H - 1) As Long
Private bx As Long, by As Long, dx As Long, dy As Long, stuck As Boolean
Private px As Long, score As Long, best As Long, lives As Long, tick As Long, lvl As Long
Private tickSec As Double, flashT As Long

Private Const C_BG As Long = 2492942        ' RGB(14, 10, 38)
Private Const C_WALL As Long = 6566720      ' RGB(64, 50, 100)
Private Const C_BALL As Long = 16777215
Private Const C_PAD As Long = 16764006      ' RGB(102, 204, 255)

Private Function RowColor(ByVal r As Long) As Long
    Select Case r
        Case 0: RowColor = RGB(255, 64, 96)
        Case 1: RowColor = RGB(255, 140, 50)
        Case 2: RowColor = RGB(255, 210, 60)
        Case 3: RowColor = RGB(80, 220, 110)
        Case 4: RowColor = RGB(60, 190, 255)
        Case Else: RowColor = RGB(170, 110, 255)
    End Select
End Function

Private Function Dark(ByVal c As Long) As Long
    Dark = RGB((c And 255) * 0.6, ((c \ 256) And 255) * 0.6, ((c \ 65536) And 255) * 0.6)
End Function

' brick under cell x, y? returns r*BC+c or -1
Private Function BrickAt(ByVal x As Long, ByVal y As Long) As Long
    Dim r As Long, c As Long
    BrickAt = -1
    If y < BY0 Or y >= BY0 + BR * BH Or x < 0 Or x >= W Then Exit Function
    r = (y - BY0) \ BH: c = x \ BW
    If brick(r, c) Then BrickAt = r * BC + c
End Function

Private Function BricksLeft() As Long
    Dim r As Long, c As Long
    For r = 0 To BR - 1: For c = 0 To BC - 1
        If brick(r, c) Then BricksLeft = BricksLeft + 1
    Next c: Next r
End Function

Private Sub HitBrick(ByVal id As Long)
    brick(id \ BC, id Mod BC) = False
    score = score + 10 * (BR - id \ BC)
    flashT = 2
End Sub

Private Function Solid(ByVal x As Long, ByVal y As Long) As Boolean
    Solid = (x < 0 Or x >= W Or y < 0)
End Function

Private Sub NewRound()
    Dim r As Long, c As Long
    For r = 0 To BR - 1: For c = 0 To BC - 1: brick(r, c) = True: Next c: Next r
    lvl = lvl + 1
    tickSec = 0.05 - 0.008 * (lvl - 1)
    If tickSec < 0.022 Then tickSec = 0.022
End Sub

Private Sub Serve()
    stuck = True: dx = 1: dy = -1
    bx = px + PW \ 2: by = PY - 1
End Sub

' One game step. key: -1 none, 0 left, 1 right. Returns False when the game is over.
Private Function StepGame(ByVal key As Long, ByVal launch As Boolean) As Boolean
    Dim nx As Long, ny As Long, id As Long, hx As Boolean, hy As Boolean, off As Long
    StepGame = True
    tick = tick + 1
    If flashT > 0 Then flashT = flashT - 1
    If key = 0 Then px = px - 2
    If key = 1 Then px = px + 2
    If px < 0 Then px = 0
    If px > W - PW Then px = W - PW
    If stuck Then
        bx = px + PW \ 2: by = PY - 1
        If launch Then stuck = False
        Exit Function
    End If

    ' side wall / brick next to the ball horizontally
    nx = bx + dx
    If Solid(nx, by) Then
        dx = -dx: hx = True
    Else
        id = BrickAt(nx, by)
        If id >= 0 Then HitBrick id: dx = -dx: hx = True
    End If
    ' ceiling / brick above or below
    ny = by + dy
    If Solid(bx, ny) Then
        dy = -dy: hy = True
    Else
        id = BrickAt(bx, ny)
        If id >= 0 Then HitBrick id: dy = -dy: hy = True
    End If
    ' corner hit (only when nothing straight was hit)
    If Not hx And Not hy Then
        id = BrickAt(bx + dx, by + dy)
        If id >= 0 Then HitBrick id: dx = -dx: dy = -dy
    End If
    ' paddle: the edge sends the ball sideways
    If dy = 1 And by + dy = PY And bx + dx >= px And bx + dx < px + PW Then
        off = bx + dx - px
        If off <= 1 Then dx = -1 Else If off >= PW - 2 Then dx = 1
        dy = -1
    End If

    bx = bx + dx: by = by + dy
    If bx < 0 Then bx = 0
    If bx > W - 1 Then bx = W - 1
    If by < 0 Then by = 0

    If by >= H - 1 Then            ' missed
        lives = lives - 1
        UpdateHud
        If lives <= 0 Then StepGame = False: Exit Function
        Serve
    End If
    If BricksLeft() = 0 Then NewRound: Serve
End Function

Private Sub Paint(ByVal x As Long, ByVal y As Long, ByVal c As Long)
    If x >= 0 And x < W And y >= 0 And y < H Then wantC(x, y) = c
End Sub

Private Sub Compose()
    Dim x As Long, y As Long, r As Long, c As Long, col As Long
    For y = 0 To H - 1: For x = 0 To W - 1
        wantC(x, y) = C_BG
    Next x: Next y
    For r = 0 To BR - 1
        col = RowColor(r)
        For c = 0 To BC - 1
            If brick(r, c) Then
                For y = 0 To BH - 1: For x = 0 To BW - 1      ' top row bright, bottom row and right edge shaded
                    Paint c * BW + x, BY0 + r * BH + y, IIf(y = 0 And x < BW - 1, col, Dark(col))
                Next x: Next y
            End If
        Next c
    Next r
    For x = 0 To PW - 1: Paint px + x, PY, IIf(flashT > 0, RGB(255, 255, 255), C_PAD): Next x
    Paint bx, by, C_BALL
End Sub

Private Function Cell(ByVal x As Long, ByVal y As Long) As Range
    Set Cell = ActiveSheet.Cells(ROW0 + y, COL0 + x)
End Function

' Repaint only the cells whose colour changed since the last frame.
Private Sub Flush()
    Dim x As Long, y As Long
    Application.ScreenUpdating = False
    For y = 0 To H - 1
        For x = 0 To W - 1
            If wantC(x, y) <> shownC(x, y) Then Cell(x, y).Interior.Color = wantC(x, y): shownC(x, y) = wantC(x, y)
        Next x
    Next y
    Application.ScreenUpdating = True
End Sub

Private Sub UpdateHud()
    With ActiveSheet
        .Cells(ROW0 + 1, COL0 + W + 2).Value = score
        .Cells(ROW0 + 4, COL0 + W + 2).Value = best
        .Cells(ROW0 + 7, COL0 + W + 2).Value = String(IIf(lives > 0, lives, 0), ChrW(9679))
        .Cells(ROW0 + 10, COL0 + W + 2).Value = lvl
    End With
End Sub

Private Sub ResetGame()
    Dim x As Long, y As Long
    For y = 0 To H - 1: For x = 0 To W - 1: shownC(x, y) = -1: Next x: Next y
    lvl = 0: NewRound
    px = (W - PW) \ 2: tick = 0: flashT = 0
    score = 0: lives = 3
    Serve
End Sub

Private Sub LockKeys(ByVal lockThem As Boolean)
    Dim k As Variant
    For Each k In Array("{LEFT}", "{RIGHT}", "{UP}", "{DOWN}", " ")
        If lockThem Then Application.OnKey k, "" Else Application.OnKey k
    Next k
End Sub

' ---------------------------------------------------------------- setup
Public Sub SetupScreen()
    Dim ws As Worksheet: Set ws = ActiveSheet
    Dim s As Shape, hud As Long
    hud = COL0 + W + 2
    Application.ScreenUpdating = False
    ws.Cells.Clear
    ActiveWindow.DisplayGridlines = True
    ws.Cells.Interior.Color = RGB(8, 6, 22)
    ws.Cells.Font.Color = RGB(235, 235, 255)
    ws.Columns(1).ColumnWidth = 2
    ws.Range(ws.Columns(COL0), ws.Columns(COL0 + W - 1)).ColumnWidth = 1.57
    ws.Range(ws.Rows(ROW0), ws.Rows(ROW0 + H - 1)).RowHeight = 12
    ws.Range(ws.Cells(ROW0 - 1, COL0 - 1), ws.Cells(ROW0 + H - 1, COL0 + W)).Interior.Color = C_WALL
    ws.Columns(COL0 + W).ColumnWidth = 2
    ws.Columns(hud).ColumnWidth = 18
    With ws.Cells(1, COL0)
        .Value = "BREAKOUT - tech3almashi"
        .Font.Bold = True: .Font.Size = 16: .Font.Color = RGB(255, 210, 60)
    End With
    ws.Cells(ROW0, hud).Value = "SCORE"
    ws.Cells(ROW0 + 3, hud).Value = "BEST"
    ws.Cells(ROW0 + 6, hud).Value = "LIVES"
    ws.Cells(ROW0 + 9, hud).Value = "ROUND"
    ws.Range(ws.Cells(ROW0, hud), ws.Cells(ROW0 + 10, hud)).Font.Bold = True
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 10, hud)).Font.Size = 18
    ws.Cells(ROW0 + 7, hud).Font.Color = RGB(102, 204, 255)
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 10, hud)).HorizontalAlignment = xlLeft

    On Error Resume Next: ws.Shapes("PlayButton").Delete: On Error GoTo 0
    Set s = ws.Shapes.AddShape(msoShapeRoundedRectangle, ws.Cells(ROW0 + 13, hud).Left, ws.Cells(ROW0 + 13, hud).Top, 110, 34)
    s.Name = "PlayButton"
    s.Fill.ForeColor.RGB = RGB(255, 210, 60)
    s.Line.Visible = msoFalse
    s.TextFrame2.TextRange.Text = "Play"
    s.TextFrame2.TextRange.Font.Bold = msoTrue
    s.TextFrame2.TextRange.Font.Size = 15
    s.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = RGB(14, 10, 38)
    s.TextFrame2.TextRange.ParagraphFormat.Alignment = msoAlignCenter
    s.TextFrame2.VerticalAnchor = msoAnchorMiddle
    s.OnAction = "Breakout"
    ws.Cells(ROW0 + 17, hud).Value = "Left / Right = paddle"
    ws.Cells(ROW0 + 18, hud).Value = "Space = launch"
    ws.Cells(ROW0 + 19, hud).Value = "Esc = stop"

    ResetGame
    Compose: Flush: UpdateHud
    ws.Cells(1, 1).Select
    Application.ScreenUpdating = True
End Sub

' ---------------------------------------------------------------- game loop
Public Sub Breakout()
    Dim running As Boolean, nextTick As Double, key As Long, launch As Boolean

    If ActiveSheet.Cells(ROW0, COL0 + W + 2).Value <> "SCORE" Then SetupScreen
    ResetGame
    UpdateHud
    LockKeys True
    Application.EnableCancelKey = xlDisabled
    running = True
    nextTick = Timer

    Do While running
        If (GetAsyncKeyState(vbKeyEscape) And &H8000) <> 0 Then Exit Do
        If Timer >= nextTick Or Timer < nextTick - 5 Then
            nextTick = Timer + tickSec
            key = -1
            If (GetAsyncKeyState(vbKeyLeft) And &H8000) <> 0 Then key = 0
            If (GetAsyncKeyState(vbKeyRight) And &H8000) <> 0 Then key = 1
            launch = (GetAsyncKeyState(vbKeySpace) And &H8000) <> 0 Or (GetAsyncKeyState(vbKeyUp) And &H8000) <> 0
            running = StepGame(key, launch)
            Compose: Flush
            If tick Mod 10 = 0 Then UpdateHud
        End If
        DoEvents
        Sleep 4
    Loop

    Application.EnableCancelKey = xlInterrupt
    LockKeys False
    If score > best Then best = score
    UpdateHud
    MsgBox "Game over!" & vbCrLf & "Score: " & score & "   Best: " & best & vbCrLf & "@tech3almashi", vbInformation, "Breakout"
End Sub
