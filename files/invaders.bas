Attribute VB_Name = "InvadersGame"
' =====================================================================
'  SPACE INVADERS inside Excel  -  tech3almashi  (@tech3almashi)
'  1) Open the file and click "Enable Content".
'  2) Click "Play" (or Alt+F8 > Invaders).
'     Left / Right arrows = move     Space = fire     Esc = stop
'  Every cell is one pixel (37 x 36). One VBA loop moves the fleet,
'  drops the bombs, flies the saucer and repaints only the cells that
'  changed. The fleet speeds up as it shrinks. Don't let it land!
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

Private Const W As Long = 37
Private Const H As Long = 36
Private Const ROW0 As Long = 3
Private Const COL0 As Long = 2
Private Const PY As Long = 34          ' cannon rows 34-35
Private Const BUNKER_Y As Long = 29
Private Const IC As Long = 5           ' invader columns
Private Const IR As Long = 4           ' invader rows
Private Const SX As Long = 7
Private Const SY As Long = 4
Private Const TICK_SEC As Double = 0.066
Private Const MAXB As Long = 3

Private alive(0 To IR - 1, 0 To IC - 1) As Boolean
Private bunker(0 To W - 1, 0 To H - 1) As Long
Private wantC(0 To W - 1, 0 To H - 1) As Long, shownC(0 To W - 1, 0 To H - 1) As Long
Private fx As Long, fy As Long, fdir As Long, anim As Long
Private px As Long, shotOn As Boolean, shotX As Long, shotY As Long
Private bOn(1 To MAXB) As Boolean, bX(1 To MAXB) As Long, bY(1 To MAXB) As Long
Private ufoOn As Boolean, ufoX As Long
Private boomX(1 To 8) As Long, boomY(1 To 8) As Long, boomT(1 To 8) As Long
Private score As Long, best As Long, lives As Long, tick As Long, wave As Long

Private Const C_SPACE As Long = 1966600     ' RGB(8, 2, 30)
Private Const C_CANNON As Long = 6946617    ' RGB(57, 255, 105)
Private Const C_SHOT As Long = 16777215
Private Const C_BOMB As Long = 4227327      ' RGB(255, 128, 64)
Private Const C_UFO As Long = 3947775       ' RGB(255, 60, 60)
Private Const C_BOOM As Long = 65535        ' RGB(255, 255, 0)

Private Function Sprite(ByVal r As Long, ByVal a As Long) As Variant
    Select Case r
        Case 0: If a = 0 Then Sprite = Array("..#..", ".###.", "#.#.#") Else Sprite = Array("..#..", ".###.", ".#.#.")
        Case 1, 2: If a = 0 Then Sprite = Array(".#.#.", "#####", "#...#") Else Sprite = Array(".#.#.", "#####", ".#.#.")
        Case Else: If a = 0 Then Sprite = Array("#####", "#.#.#", "#...#") Else Sprite = Array("#####", "#.#.#", ".#.#.")
    End Select
End Function

Private Function RowColor(ByVal r As Long) As Long
    Select Case r
        Case 0: RowColor = RGB(255, 61, 240)
        Case 1, 2: RowColor = RGB(61, 245, 255)
        Case Else: RowColor = RGB(57, 255, 106)
    End Select
End Function

Private Function Points(ByVal r As Long) As Long
    Select Case r
        Case 0: Points = 30
        Case 1, 2: Points = 20
        Case Else: Points = 10
    End Select
End Function

' Which invader (if any) has a lit pixel at x, y. Returns r*IC+c or -1.
Private Function InvaderAt(ByVal x As Long, ByVal y As Long) As Long
    Dim r As Long, c As Long, s As Variant, ox As Long, oy As Long
    InvaderAt = -1
    For r = 0 To IR - 1
        oy = fy + r * SY
        If y >= oy And y < oy + 3 Then
            For c = 0 To IC - 1
                ox = fx + c * SX
                If alive(r, c) And x >= ox And x < ox + 5 Then
                    s = Sprite(r, anim)
                    If Mid$(s(y - oy), x - ox + 1, 1) = "#" Then InvaderAt = r * IC + c: Exit Function
                End If
            Next c
        End If
    Next r
End Function

Private Function AliveCount() As Long
    Dim r As Long, c As Long
    For r = 0 To IR - 1: For c = 0 To IC - 1
        If alive(r, c) Then AliveCount = AliveCount + 1
    Next c: Next r
End Function

Private Sub Bounds(ByRef minX As Long, ByRef maxX As Long, ByRef maxY As Long)
    Dim r As Long, c As Long
    minX = W: maxX = -1: maxY = -1
    For r = 0 To IR - 1: For c = 0 To IC - 1
        If alive(r, c) Then
            If fx + c * SX < minX Then minX = fx + c * SX
            If fx + c * SX + 4 > maxX Then maxX = fx + c * SX + 4
            If fy + r * SY + 2 > maxY Then maxY = fy + r * SY + 2
        End If
    Next c: Next r
End Sub

Private Sub NewWave()
    Dim r As Long, c As Long
    For r = 0 To IR - 1: For c = 0 To IC - 1: alive(r, c) = True: Next c: Next r
    fx = 2: fy = 4 + IIf(wave > 3, 3, wave): fdir = 1: anim = 0
    wave = wave + 1
End Sub

Private Sub NewBunkers()
    Dim b As Variant, s As Variant, i As Long, dx As Long, dy As Long, x As Long, y As Long
    For y = 0 To H - 1: For x = 0 To W - 1: bunker(x, y) = 0: Next x: Next y
    s = Array(".####.", "######", "##..##")
    For Each b In Array(3, 12, 20, 28)
        For dy = 0 To 2: For dx = 0 To 5
            If Mid$(s(dy), dx + 1, 1) = "#" Then bunker(b + dx, BUNKER_Y + dy) = 2
        Next dx: Next dy
    Next b
End Sub

Private Sub AddBoom(ByVal x As Long, ByVal y As Long)
    Dim i As Long
    For i = 1 To 8
        If boomT(i) = 0 Then boomX(i) = x: boomY(i) = y: boomT(i) = 6: Exit Sub
    Next i
End Sub

' ---------------------------------------------------------------- one tick (same order as the video)
Private Function StepGame(ByVal key As Long, ByVal fire As Boolean) As Boolean
    Dim i As Long, k As Long, hit As Long, minX As Long, maxX As Long, maxY As Long
    Dim n As Long, col As Long, r As Long, botY As Long, tries As Long
    tick = tick + 1
    For i = 1 To 8
        If boomT(i) > 0 Then boomT(i) = boomT(i) - 1
    Next i
    n = AliveCount()

    ' cannon
    If key = 0 And px > 0 Then px = px - 1
    If key = 1 And px < W - 5 Then px = px + 1
    If fire And Not shotOn Then shotOn = True: shotX = px + 2: shotY = PY - 1

    ' fleet marches, faster as it shrinks
    If tick Mod (3 + n \ 3) = 0 And n > 0 Then
        Bounds minX, maxX, maxY
        If (fdir > 0 And maxX + 1 >= W) Or (fdir < 0 And minX - 1 < 0) Then
            fy = fy + 1: fdir = -fdir
        Else
            fx = fx + fdir
        End If
        anim = 1 - anim
        Bounds minX, maxX, maxY
        If maxY >= PY - 1 Then StepGame = False: Exit Function   ' they landed
    End If

    ' saucer
    If Not ufoOn And tick Mod 120 = 60 Then
        ufoOn = True: ufoX = W - 1
    ElseIf ufoOn Then
        ufoX = ufoX - 1
        If ufoX < -5 Then ufoOn = False
    End If

    ' bombs from the bottom invader of a random column
    If tick Mod 9 = 0 And n > 0 Then
        For k = 1 To MAXB
            If Not bOn(k) Then
                For tries = 1 To 10
                    col = Int(Rnd * IC)
                    botY = -1
                    For r = IR - 1 To 0 Step -1
                        If alive(r, col) Then botY = fy + r * SY + 3: Exit For
                    Next r
                    If botY >= 0 Then bOn(k) = True: bX(k) = fx + col * SX + 2: bY(k) = botY: Exit For
                Next tries
                Exit For
            End If
        Next k
    End If
    For k = 1 To MAXB
        If bOn(k) Then
            bY(k) = bY(k) + 1
            If bY(k) >= H Then
                bOn(k) = False
            ElseIf bunker(bX(k), bY(k)) > 0 Then
                bunker(bX(k), bY(k)) = bunker(bX(k), bY(k)) - 1: bOn(k) = False
            ElseIf bY(k) >= PY And bX(k) >= px And bX(k) < px + 5 Then
                bOn(k) = False: lives = lives - 1: AddBoom px, PY - 1: UpdateHud
                Compose: Flush: Sleep 500
                If lives <= 0 Then StepGame = False: Exit Function
            End If
        End If
    Next k

    ' the shot: two cells per tick
    For i = 1 To 2
        If Not shotOn Then Exit For
        shotY = shotY - 1
        If shotY < 0 Then shotOn = False: Exit For
        If bunker(shotX, shotY) > 0 Then bunker(shotX, shotY) = bunker(shotX, shotY) - 1: shotOn = False: Exit For
        hit = InvaderAt(shotX, shotY)
        If hit >= 0 Then
            alive(hit \ IC, hit Mod IC) = False
            score = score + Points(hit \ IC)
            AddBoom fx + (hit Mod IC) * SX, fy + (hit \ IC) * SY
            shotOn = False: UpdateHud: Exit For
        End If
        If ufoOn And shotY >= 1 And shotY <= 2 And shotX >= ufoX And shotX < ufoX + 5 Then
            score = score + 300: AddBoom ufoX, 1: ufoOn = False: shotOn = False: UpdateHud: Exit For
        End If
        For k = 1 To MAXB
            If bOn(k) And bX(k) = shotX And (bY(k) = shotY Or bY(k) = shotY + 1) Then bOn(k) = False: shotOn = False
        Next k
    Next i

    If AliveCount() = 0 Then NewWave
    StepGame = True
End Function

' ---------------------------------------------------------------- drawing
Private Sub Paint(ByVal x As Long, ByVal y As Long, ByVal c As Long)
    If x >= 0 And x < W And y >= 0 And y < H Then wantC(x, y) = c
End Sub

Private Sub Compose()
    Dim x As Long, y As Long, r As Long, c As Long, s As Variant, dx As Long, dy As Long, i As Long
    For y = 0 To H - 1: For x = 0 To W - 1
        wantC(x, y) = C_SPACE
        If bunker(x, y) = 2 Then wantC(x, y) = RGB(40, 200, 90)
        If bunker(x, y) = 1 Then wantC(x, y) = RGB(20, 110, 50)
    Next x: Next y
    If (tick \ 40) Mod 2 = 0 Then Paint 5, 8, RGB(60, 60, 110): Paint 31, 20, RGB(60, 60, 110): Paint 18, 26, RGB(60, 60, 110)
    For r = 0 To IR - 1
        s = Sprite(r, anim)
        For c = 0 To IC - 1
            If alive(r, c) Then
                For dy = 0 To 2: For dx = 0 To 4
                    If Mid$(s(dy), dx + 1, 1) = "#" Then Paint fx + c * SX + dx, fy + r * SY + dy, RowColor(r)
                Next dx: Next dy
            End If
        Next c
    Next r
    If ufoOn Then
        s = Array(".###.", "#.#.#")
        For dy = 0 To 1: For dx = 0 To 4
            If Mid$(s(dy), dx + 1, 1) = "#" Then Paint ufoX + dx, 1 + dy, C_UFO
        Next dx: Next dy
    End If
    For i = 1 To 8
        If boomT(i) > 0 Then
            s = Array("#.#.#", ".###.", "#.#.#")
            If boomT(i) < 3 Then s = Array("#...#", "..#..", "#...#")
            For dy = 0 To 2: For dx = 0 To 4
                If Mid$(s(dy), dx + 1, 1) = "#" Then Paint boomX(i) + dx, boomY(i) + dy, C_BOOM
            Next dx: Next dy
        End If
    Next i
    For i = 1 To MAXB
        If bOn(i) Then Paint bX(i), bY(i), C_BOMB: Paint bX(i), bY(i) - 1, RGB(140, 60, 30)
    Next i
    If shotOn Then Paint shotX, shotY, C_SHOT: Paint shotX, shotY + 1, RGB(150, 150, 200)
    Paint px + 2, PY, C_CANNON
    For dx = 0 To 4: Paint px + dx, PY + 1, C_CANNON: Next dx
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
        .Cells(ROW0 + 7, COL0 + W + 2).Value = String(IIf(lives > 0, lives, 0), ChrW(9650))
    End With
End Sub

Private Sub ResetGame()
    Dim i As Long, x As Long, y As Long
    For y = 0 To H - 1: For x = 0 To W - 1: shownC(x, y) = -1: Next x: Next y
    wave = 0: NewWave: NewBunkers
    px = 16: shotOn = False: ufoOn = False: tick = 0
    For i = 1 To MAXB: bOn(i) = False: Next i
    For i = 1 To 8: boomT(i) = 0: Next i
    score = 0: lives = 3
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
    ws.Cells.Interior.Color = RGB(4, 2, 16)
    ws.Cells.Font.Color = RGB(230, 230, 255)
    ws.Columns(1).ColumnWidth = 2
    ws.Range(ws.Columns(COL0), ws.Columns(COL0 + W - 1)).ColumnWidth = 1.57
    ws.Range(ws.Rows(ROW0), ws.Rows(ROW0 + H - 1)).RowHeight = 12
    ws.Columns(COL0 + W).ColumnWidth = 2
    ws.Columns(hud).ColumnWidth = 18
    With ws.Cells(1, COL0)
        .Value = "SPACE INVADERS - tech3almashi"
        .Font.Bold = True: .Font.Size = 16: .Font.Color = RGB(57, 255, 106)
    End With
    ws.Cells(ROW0, hud).Value = "SCORE"
    ws.Cells(ROW0 + 3, hud).Value = "BEST"
    ws.Cells(ROW0 + 6, hud).Value = "LIVES"
    ws.Range(ws.Cells(ROW0, hud), ws.Cells(ROW0 + 7, hud)).Font.Bold = True
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 7, hud)).Font.Size = 18
    ws.Cells(ROW0 + 7, hud).Font.Color = RGB(57, 255, 106)
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 7, hud)).HorizontalAlignment = xlLeft

    On Error Resume Next: ws.Shapes("PlayButton").Delete: On Error GoTo 0
    Set s = ws.Shapes.AddShape(msoShapeRoundedRectangle, ws.Cells(ROW0 + 10, hud).Left, ws.Cells(ROW0 + 10, hud).Top, 110, 34)
    s.Name = "PlayButton"
    s.Fill.ForeColor.RGB = RGB(57, 255, 106)
    s.Line.Visible = msoFalse
    s.TextFrame2.TextRange.Text = "Play"
    s.TextFrame2.TextRange.Font.Bold = msoTrue
    s.TextFrame2.TextRange.Font.Size = 15
    s.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = RGB(8, 2, 30)
    s.TextFrame2.TextRange.ParagraphFormat.Alignment = msoAlignCenter
    s.TextFrame2.VerticalAnchor = msoAnchorMiddle
    s.OnAction = "Invaders"
    ws.Cells(ROW0 + 14, hud).Value = "Left / Right = move"
    ws.Cells(ROW0 + 15, hud).Value = "Space = fire"
    ws.Cells(ROW0 + 16, hud).Value = "Esc = stop"

    ResetGame
    Compose: Flush: UpdateHud
    ws.Cells(1, 1).Select
    Application.ScreenUpdating = True
End Sub

' ---------------------------------------------------------------- game loop
Public Sub Invaders()
    Dim running As Boolean, nextTick As Double, key As Long, fire As Boolean

    If ActiveSheet.Cells(ROW0, COL0 + W + 2).Value <> "SCORE" Then SetupScreen
    Randomize
    ResetGame
    UpdateHud
    LockKeys True
    Application.EnableCancelKey = xlDisabled
    running = True
    nextTick = Timer

    Do While running
        If (GetAsyncKeyState(vbKeyEscape) And &H8000) <> 0 Then Exit Do
        If Timer >= nextTick Or Timer < nextTick - 5 Then
            nextTick = Timer + TICK_SEC
            key = -1
            If (GetAsyncKeyState(vbKeyLeft) And &H8000) <> 0 Then key = 0
            If (GetAsyncKeyState(vbKeyRight) And &H8000) <> 0 Then key = 1
            fire = (GetAsyncKeyState(vbKeySpace) And &H8000) <> 0
            running = StepGame(key, fire)
            Compose: Flush
        End If
        DoEvents
        Sleep 4
    Loop

    Application.EnableCancelKey = xlInterrupt
    LockKeys False
    If score > best Then best = score
    UpdateHud
    MsgBox "Game over!" & vbCrLf & "Score: " & score & "   Best: " & best & vbCrLf & "@tech3almashi", vbInformation, "Space Invaders"
End Sub
