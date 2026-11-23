Attribute VB_Name = "PlatformerGame"
' =====================================================================
'  CELL RUNNER (platformer) inside Excel  -  tech3almashi  (@tech3almashi)
'  1) Open the file and click "Enable Content".
'  2) Click "Play" (or Alt+F8 > Platformer).
'     Left / Right = run    Up or Space = jump    Esc = stop
'  Every cell is one pixel (48 x 27 on screen, the level is 200 wide and
'  scrolls with the hero). Gravity is one line: vy = vy + G every frame.
'  Collect the coins, jump over the pits and spikes, reach the flag.
'  Original character "Kubi" (tech3almashi). 3 lives.
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

Private Const W As Long = 48            ' screen width (cells)
Private Const H As Long = 27            ' screen height (cells)
Private Const LW As Long = 200          ' level width (cells)
Private Const ROW0 As Long = 3
Private Const COL0 As Long = 2
Private Const HW As Long = 2            ' hero width
Private Const HH As Long = 3            ' hero height
Private Const G As Double = 0.22        ' gravity per frame
Private Const JUMP As Double = -1.8     ' jump speed
Private Const RUN As Double = 0.55      ' run speed
Private Const VMAX As Double = 1.2      ' fall speed cap

' tiles: 0 air, 1 ground, 2 brick, 3 coin, 4 flag, 5 spike
Private tile(0 To LW - 1, 0 To H - 1) As Byte
Private wantC(0 To W - 1, 0 To H - 1) As Long, shownC(0 To W - 1, 0 To H - 1) As Long
Private hx As Double, hy As Double, vx As Double, vy As Double, onGround As Boolean, face As Long
Private camX As Long, score As Long, best As Long, lives As Long, coins As Long, tick As Long
Private won As Boolean, hurtT As Long

Private Const C_GRASS As Long = 3462732     ' RGB(76, 214, 52)
Private Const C_DIRT As Long = 2121354      ' RGB(138, 94, 32)
Private Const C_BRICK As Long = 3895517     ' RGB(221, 112, 59)
Private Const C_COIN As Long = 3988223      ' RGB(255, 219, 60)
Private Const C_SPIKE As Long = 14737632    ' RGB(224, 224, 224)

Private Sub Fill(ByVal x0 As Long, ByVal y0 As Long, ByVal x1 As Long, ByVal y1 As Long, ByVal t As Byte)
    Dim x As Long, y As Long
    For x = x0 To x1: For y = y0 To y1
        If x >= 0 And x < LW And y >= 0 And y < H Then tile(x, y) = t
    Next y: Next x
End Sub

Private Sub BuildLevel()
    Dim x As Long, i As Long, v As Variant
    Erase tile
    Fill 0, H - 3, LW - 1, H - 1, 1                     ' ground
    ' pits (x0, x1)
    For Each v In Array(30, 59, 92, 127, 160)
        Fill CLng(v), H - 3, CLng(v) + 3 + (CLng(v) Mod 2), H - 1, 0
    Next v
    ' floating brick platforms (x, y, length)
    Dim P As Variant
    P = Array(14, 19, 6, 24, 15, 5, 40, 18, 8, 52, 14, 6, 66, 19, 5, 74, 15, 7, 86, 12, 6, _
              100, 18, 9, 114, 14, 6, 122, 10, 5, 138, 17, 7, 150, 13, 6, 168, 18, 8, 178, 14, 5)
    For i = 0 To UBound(P) Step 3
        Fill P(i), P(i + 1), P(i) + P(i + 2) - 1, P(i + 1), 2
        Fill P(i) + 1, P(i + 1) - 2, P(i) + P(i + 2) - 2, P(i + 1) - 2, 3   ' coins above it
        For x = P(i) + 2 To P(i) + P(i + 2) - 3 Step 2: tile(x, P(i + 1) - 2) = 0: Next x
    Next i
    ' spikes on the ground
    For Each v In Array(46, 47, 80, 81, 108, 109, 145, 146, 186)
        tile(CLng(v), H - 4) = 5
    Next v
    ' coin arcs over the pits
    For Each v In Array(30, 59, 92, 127, 160)
        For i = 0 To 4: tile(CLng(v) + i, H - 7 - Array(0, 1, 2, 1, 0)(i)) = 3: Next i
    Next v
    ' flag pole at the end
    Fill LW - 6, H - 14, LW - 6, H - 4, 4
End Sub

Private Function Solid(ByVal x As Long, ByVal y As Long) As Boolean
    If x < 0 Or x >= LW Then Solid = True: Exit Function
    If y < 0 Or y >= H Then Exit Function
    Solid = (tile(x, y) = 1 Or tile(x, y) = 2)
End Function

Private Function Hits(ByVal x As Double, ByVal y As Double) As Boolean
    Dim cx As Long, cy As Long
    For cx = Int(x) To Int(x + HW - 0.001)
        For cy = Int(y) To Int(y + HH - 0.001)
            If Solid(cx, cy) Then Hits = True: Exit Function
        Next cy
    Next cx
End Function

Private Sub Respawn()
    hx = 4: hy = H - 3 - HH: vx = 0: vy = 0: face = 1: hurtT = 20
End Sub

' One game step. key: -1 none, 0 left, 1 right. Returns False when the game is over.
Private Function StepGame(ByVal key As Long, ByVal jumpKey As Boolean) As Boolean
    Dim nx As Double, ny As Double, cx As Long, cy As Long
    StepGame = True
    tick = tick + 1
    If hurtT > 0 Then hurtT = hurtT - 1

    vx = 0
    If key = 0 Then vx = -RUN: face = -1
    If key = 1 Then vx = RUN: face = 1
    If jumpKey And onGround Then vy = JUMP
    vy = vy + G                                ' <- gravity: the whole physics engine
    If vy > VMAX Then vy = VMAX

    nx = hx + vx                               ' move X, stop at walls
    If Hits(nx, hy) Then
        If vx > 0 Then nx = Int(nx + HW - 0.001) - HW Else nx = Int(nx) + 1
    End If
    hx = nx
    ny = hy + vy                               ' move Y, land on ground / bump head
    onGround = False
    If Hits(hx, ny) Then
        If vy > 0 Then ny = Int(ny + HH - 0.001) - HH: onGround = True Else ny = Int(ny) + 1
        vy = 0
    End If
    hy = ny

    ' coins, spikes, flag under the hero
    For cx = Int(hx) To Int(hx + HW - 0.001)
        For cy = Int(hy) To Int(hy + HH - 0.001)
            If cx >= 0 And cx < LW And cy >= 0 And cy < H Then
                Select Case tile(cx, cy)
                    Case 3: tile(cx, cy) = 0: score = score + 10: coins = coins + 1
                    Case 4: won = True: score = score + 500: StepGame = False
                    Case 5: If hurtT = 0 Then hy = H + 5
                End Select
            End If
        Next cy
    Next cx

    If hy > H Then                             ' fell into a pit (or hit a spike)
        lives = lives - 1
        UpdateHud
        If lives <= 0 Then StepGame = False: Exit Function
        Respawn
    End If

    camX = Int(hx) - 16
    If camX < 0 Then camX = 0
    If camX > LW - W Then camX = LW - W
End Function

Private Function Sky(ByVal y As Long) As Long
    Dim t As Double: t = y / (H - 1)
    Sky = RGB(40 + 90 * t, 70 + 110 * t, 150 + 80 * t)
End Function

Private Sub Compose()
    Dim x As Long, y As Long, lx As Long, hill As Long, t As Byte, c As Long
    Dim ix As Long, iy As Long, leg As Long
    For x = 0 To W - 1
        lx = x + camX
        hill = H - 7 - Int(3 + 3 * Sin((x + camX \ 2) / 6#))     ' far hills move at half speed
        For y = 0 To H - 1
            t = tile(lx, y)
            Select Case t
                Case 1
                    c = C_GRASS
                    If y > 0 Then If tile(lx, y - 1) = 1 Then c = C_DIRT
                Case 2: c = IIf((lx + y) Mod 4 = 0, RGB(170, 80, 40), C_BRICK)
                Case 3: c = IIf((tick \ 6 + lx) Mod 4 = 0, RGB(255, 250, 200), C_COIN)
                Case 4: c = IIf(y = H - 14, RGB(255, 60, 90), RGB(230, 230, 230))
                Case 5: c = C_SPIKE
                Case Else: c = IIf(y >= hill, RGB(60, 120, 120), Sky(y))
            End Select
            wantC(x, y) = c
        Next y
    Next x
    ' pennant on the flag pole
    PaintP LW - 5 - camX, H - 14, RGB(255, 60, 90)
    PaintP LW - 4 - camX, H - 14, RGB(255, 60, 90)
    PaintP LW - 5 - camX, H - 13, RGB(255, 60, 90)
    ' hero "Kubi": cyan head with one eye, yellow body, legs that swap while running
    If hurtT Mod 4 < 2 Then
        ix = Int(hx) - camX: iy = Int(hy)
        leg = IIf(onGround And vx <> 0 And (tick \ 3) Mod 2 = 0, 1, 0)
        PaintP ix, iy, RGB(60, 220, 255): PaintP ix + 1, iy, RGB(60, 220, 255)
        PaintP IIf(face > 0, ix + 1, ix), iy, RGB(20, 30, 60)
        PaintP ix, iy + 1, RGB(255, 205, 40): PaintP ix + 1, iy + 1, RGB(255, 205, 40)
        If leg = 0 Then
            PaintP ix, iy + 2, RGB(30, 40, 110): PaintP ix + 1, iy + 2, RGB(30, 40, 110)
        Else
            PaintP IIf(face > 0, ix + 1, ix), iy + 2, RGB(30, 40, 110)
        End If
    End If
End Sub

Private Sub PaintP(ByVal x As Long, ByVal y As Long, ByVal c As Long)
    If x >= 0 And x < W And y >= 0 And y < H Then wantC(x, y) = c
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
        .Cells(ROW0 + 10, COL0 + W + 2).Value = coins
    End With
End Sub

Private Sub ResetGame()
    Dim x As Long, y As Long
    For y = 0 To H - 1: For x = 0 To W - 1: shownC(x, y) = -1: Next x: Next y
    BuildLevel
    score = 0: lives = 3: coins = 0: tick = 0: won = False: camX = 0
    Respawn: hurtT = 0
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
    ws.Cells.Interior.Color = RGB(16, 20, 44)
    ws.Cells.Font.Color = RGB(235, 235, 255)
    ws.Columns(1).ColumnWidth = 2
    ws.Range(ws.Columns(COL0), ws.Columns(COL0 + W - 1)).ColumnWidth = 1.57
    ws.Range(ws.Rows(ROW0), ws.Rows(ROW0 + H - 1)).RowHeight = 12
    ws.Range(ws.Cells(ROW0 - 1, COL0 - 1), ws.Cells(ROW0 + H, COL0 + W)).Interior.Color = RGB(70, 60, 120)
    ws.Columns(COL0 + W).ColumnWidth = 2
    ws.Columns(hud).ColumnWidth = 18
    With ws.Cells(1, COL0)
        .Value = "CELL RUNNER - tech3almashi"
        .Font.Bold = True: .Font.Size = 16: .Font.Color = RGB(255, 205, 40)
    End With
    ws.Cells(ROW0, hud).Value = "SCORE"
    ws.Cells(ROW0 + 3, hud).Value = "BEST"
    ws.Cells(ROW0 + 6, hud).Value = "LIVES"
    ws.Cells(ROW0 + 9, hud).Value = "COINS"
    ws.Range(ws.Cells(ROW0, hud), ws.Cells(ROW0 + 10, hud)).Font.Bold = True
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 10, hud)).Font.Size = 18
    ws.Cells(ROW0 + 7, hud).Font.Color = RGB(60, 220, 255)
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 10, hud)).HorizontalAlignment = xlLeft

    On Error Resume Next: ws.Shapes("PlayButton").Delete: On Error GoTo 0
    Set s = ws.Shapes.AddShape(msoShapeRoundedRectangle, ws.Cells(ROW0 + 13, hud).Left, ws.Cells(ROW0 + 13, hud).Top, 110, 34)
    s.Name = "PlayButton"
    s.Fill.ForeColor.RGB = RGB(255, 205, 40)
    s.Line.Visible = msoFalse
    s.TextFrame2.TextRange.Text = "Play"
    s.TextFrame2.TextRange.Font.Bold = msoTrue
    s.TextFrame2.TextRange.Font.Size = 15
    s.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = RGB(16, 20, 44)
    s.TextFrame2.TextRange.ParagraphFormat.Alignment = msoAlignCenter
    s.TextFrame2.VerticalAnchor = msoAnchorMiddle
    s.OnAction = "Platformer"
    ws.Cells(ROW0 + 17, hud).Value = "Left / Right = run"
    ws.Cells(ROW0 + 18, hud).Value = "Up / Space = jump"
    ws.Cells(ROW0 + 19, hud).Value = "Esc = stop"

    ResetGame
    Compose: Flush: UpdateHud
    ws.Cells(1, 1).Select
    Application.ScreenUpdating = True
End Sub

' ---------------------------------------------------------------- game loop
Public Sub Platformer()
    Dim running As Boolean, nextTick As Double, key As Long, jumpKey As Boolean

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
            nextTick = Timer + 0.04
            key = -1
            If (GetAsyncKeyState(vbKeyLeft) And &H8000) <> 0 Then key = 0
            If (GetAsyncKeyState(vbKeyRight) And &H8000) <> 0 Then key = 1
            jumpKey = (GetAsyncKeyState(vbKeySpace) And &H8000) <> 0 Or (GetAsyncKeyState(vbKeyUp) And &H8000) <> 0
            running = StepGame(key, jumpKey)
            Compose: Flush
            If tick Mod 8 = 0 Then UpdateHud
        End If
        DoEvents
        Sleep 4
    Loop

    Application.EnableCancelKey = xlInterrupt
    LockKeys False
    If score > best Then best = score
    UpdateHud
    If won Then
        MsgBox "You reached the flag!" & vbCrLf & "Score: " & score & "   Coins: " & coins & vbCrLf & "@tech3almashi", vbInformation, "Cell Runner"
    Else
        MsgBox "Game over!" & vbCrLf & "Score: " & score & "   Best: " & best & vbCrLf & "@tech3almashi", vbInformation, "Cell Runner"
    End If
End Sub
