Attribute VB_Name = "RacingGame"
' =====================================================================
'  TRAFFIC RACER (top-down car racing) inside Excel  -  tech3almashi
'  1) Open the file and click "Enable Content".
'  2) Click "Play" (or Alt+F8 > Racer).
'     Left / Right = steer    Esc = stop
'  Every cell is one pixel (26 x 40 on screen). Each frame one loop
'  shifts the road down (stripes, grass, traffic), your speed rises
'  by itself, and a box test finds the crash. Dodge the traffic.
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

Private Const W As Long = 26            ' screen width (cells)
Private Const H As Long = 40            ' screen height (cells)
Private Const ROW0 As Long = 3
Private Const COL0 As Long = 2
Private Const RL As Long = 3            ' road: first column
Private Const LANES As Long = 4
Private Const LW As Long = 5            ' lane width
Private Const CW As Long = 3            ' car width
Private Const CH As Long = 5            ' car height
Private Const NT As Long = 8            ' traffic slots
Private Const V0 As Double = 0.45       ' start speed (rows per frame)
Private Const ACC As Double = 0.0009    ' speed gained every frame
Private Const VMAX As Double = 1.6

Private wantC(0 To W - 1, 0 To H - 1) As Long, shownC(0 To W - 1, 0 To H - 1) As Long
Private tx(0 To NT - 1) As Long, ty(0 To NT - 1) As Double, tc(0 To NT - 1) As Long, tOn(0 To NT - 1) As Boolean
Private px As Long, py As Long, speed As Double, roadY As Double, dist As Double
Private score As Long, passed As Long, best As Long, tick As Long, nextSpawn As Double, crashed As Boolean

Private Function LaneX(ByVal lane As Long) As Long
    LaneX = RL + lane * LW + 1
End Function

Private Function Overlap(ByVal ax As Long, ByVal ay As Double, ByVal bx As Long, ByVal by As Double) As Boolean
    Overlap = (ax < bx + CW) And (bx < ax + CW) And (ay < by + CH) And (by < ay + CH)
End Function

Private Sub Spawn()
    Dim i As Long, lane As Long, tries As Long, j As Long, ok As Boolean, free As Long
    Dim cols As Variant
    cols = Array(RGB(60, 140, 255), RGB(255, 200, 40), RGB(150, 90, 230), RGB(40, 200, 150), RGB(255, 130, 40), RGB(235, 235, 235))
    For i = 0 To NT - 1
        If Not tOn(i) Then Exit For
    Next i
    If i = NT Then Exit Sub
    For tries = 1 To 6
        lane = Int(Rnd * LANES)
        ok = True: free = 0
        For j = 0 To NT - 1          ' never close all four lanes at the same height
            If tOn(j) Then
                If ty(j) < CH * 2 Then
                    If tx(j) = LaneX(lane) Then ok = False
                    free = free + 1
                End If
            End If
        Next j
        If ok And free < LANES - 1 Then
            tOn(i) = True: tx(i) = LaneX(lane): ty(i) = -CH: tc(i) = cols(Int(Rnd * 6))
            Exit Sub
        End If
    Next tries
End Sub

' One frame. key: -1 none, 0 left, 1 right. Returns False on a crash.
Private Function StepGame(ByVal key As Long) As Boolean
    Dim i As Long
    StepGame = True
    tick = tick + 1
    speed = speed + ACC                        ' <- the speed rises by itself
    If speed > VMAX Then speed = VMAX
    If key = 0 And px > RL Then px = px - 1
    If key = 1 And px < RL + LANES * LW - CW Then px = px + 1

    roadY = roadY + speed                      ' the road slides down
    If roadY >= 720 Then roadY = roadY - 720   ' every pattern repeats after 180 rows
    dist = dist + speed
    score = Int(dist) + passed * 5
    For i = 0 To NT - 1                        ' traffic is slower than you, so it comes down
        If tOn(i) Then
            ty(i) = ty(i) + speed * 0.62
            If ty(i) > H Then tOn(i) = False: passed = passed + 1
            If Overlap(px, py, tx(i), ty(i)) Then crashed = True: StepGame = False
        End If
    Next i
    If dist >= nextSpawn Then
        Spawn
        nextSpawn = dist + 16 + Rnd * 14 - speed * 4
    End If
End Function

Private Sub PaintP(ByVal x As Long, ByVal y As Long, ByVal c As Long)
    If x >= 0 And x < W And y >= 0 And y < H Then wantC(x, y) = c
End Sub

Private Sub DrawCar(ByVal x As Long, ByVal y As Long, ByVal body As Long, ByVal player As Boolean)
    Dim i As Long, j As Long
    For j = 0 To CH - 1
        For i = 0 To CW - 1
            PaintP x + i, y + j, body
        Next i
    Next j
    ' windshield faces the way the car drives (up for you, up for traffic too)
    PaintP x + 1, y + 1, RGB(25, 35, 60)
    PaintP x + 1, y + 3, RGB(60, 70, 95)
    ' wheels
    PaintP x - 1, y + 1, RGB(15, 15, 15): PaintP x + CW, y + 1, RGB(15, 15, 15)
    PaintP x - 1, y + 3, RGB(15, 15, 15): PaintP x + CW, y + 3, RGB(15, 15, 15)
    If player Then
        PaintP x, y, RGB(255, 250, 190): PaintP x + 2, y, RGB(255, 250, 190)      ' headlights
    Else
        PaintP x, y + CH - 1, RGB(255, 40, 40): PaintP x + 2, y + CH - 1, RGB(255, 40, 40)  ' tail lights
    End If
End Sub

Private Sub Compose()
    Dim x As Long, y As Long, i As Long, c As Long, sy As Long
    For y = 0 To H - 1
        sy = y - Int(roadY) + 1080             ' scrolled row (kept positive)
        For x = 0 To W - 1
            If x < RL - 1 Or x > RL + LANES * LW Then
                c = IIf(((sy \ 3) + x) Mod 5 = 0, RGB(40, 150, 60), RGB(50, 175, 70))   ' grass
                If (x = 0 Or x = W - 1) And ((sy \ 6) Mod 3 = 0) Then c = RGB(30, 110, 45)
            ElseIf x = RL - 1 Or x = RL + LANES * LW Then
                c = IIf(((sy \ 2) Mod 2) = 0, RGB(230, 40, 40), RGB(245, 245, 245))     ' kerb
            Else
                c = RGB(62, 64, 72)                                                    ' asphalt
                If ((x - RL) Mod LW = 0) And x > RL Then
                    If (sy Mod 6) < 3 Then c = RGB(240, 240, 240)              ' lane dashes
                End If
            End If
            wantC(x, y) = c
        Next x
    Next y
    For i = 0 To NT - 1
        If tOn(i) Then DrawCar tx(i), Int(ty(i)), tc(i), False
    Next i
    If crashed And (tick Mod 2 = 0) Then
        DrawCar px, py, RGB(255, 240, 80), True
    Else
        DrawCar px, py, RGB(230, 30, 50), True
    End If
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
        .Cells(ROW0 + 7, COL0 + W + 2).Value = Int(speed * 100) & " km/h"
    End With
End Sub

Private Sub ResetGame()
    Dim x As Long, y As Long, i As Long
    For y = 0 To H - 1: For x = 0 To W - 1: shownC(x, y) = -1: Next x: Next y
    For i = 0 To NT - 1: tOn(i) = False: Next i
    Randomize
    px = LaneX(1): py = H - CH - 3
    speed = V0: roadY = 0: dist = 0: score = 0: passed = 0: tick = 0: nextSpawn = 4: crashed = False
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
    ws.Cells.Interior.Color = RGB(14, 16, 26)
    ws.Cells.Font.Color = RGB(235, 235, 255)
    ws.Columns(1).ColumnWidth = 2
    ws.Range(ws.Columns(COL0), ws.Columns(COL0 + W - 1)).ColumnWidth = 1.57
    ws.Range(ws.Rows(ROW0), ws.Rows(ROW0 + H - 1)).RowHeight = 12
    ws.Range(ws.Cells(ROW0 - 1, COL0 - 1), ws.Cells(ROW0 + H, COL0 + W)).Interior.Color = RGB(255, 205, 40)
    ws.Columns(COL0 + W).ColumnWidth = 2
    ws.Columns(hud).ColumnWidth = 18
    With ws.Cells(1, COL0)
        .Value = "TRAFFIC RACER - tech3almashi"
        .Font.Bold = True: .Font.Size = 16: .Font.Color = RGB(255, 205, 40)
    End With
    ws.Cells(ROW0, hud).Value = "SCORE"
    ws.Cells(ROW0 + 3, hud).Value = "BEST"
    ws.Cells(ROW0 + 6, hud).Value = "SPEED"
    ws.Range(ws.Cells(ROW0, hud), ws.Cells(ROW0 + 7, hud)).Font.Bold = True
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 7, hud)).Font.Size = 18
    ws.Cells(ROW0 + 7, hud).Font.Color = RGB(255, 90, 90)
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 7, hud)).HorizontalAlignment = xlLeft

    On Error Resume Next: ws.Shapes("PlayButton").Delete: On Error GoTo 0
    Set s = ws.Shapes.AddShape(msoShapeRoundedRectangle, ws.Cells(ROW0 + 10, hud).Left, ws.Cells(ROW0 + 10, hud).Top, 110, 34)
    s.Name = "PlayButton"
    s.Fill.ForeColor.RGB = RGB(230, 30, 50)
    s.Line.Visible = msoFalse
    s.TextFrame2.TextRange.Text = "Play"
    s.TextFrame2.TextRange.Font.Bold = msoTrue
    s.TextFrame2.TextRange.Font.Size = 15
    s.TextFrame2.TextRange.Font.Fill.ForeColor.RGB = RGB(255, 255, 255)
    s.TextFrame2.TextRange.ParagraphFormat.Alignment = msoAlignCenter
    s.TextFrame2.VerticalAnchor = msoAnchorMiddle
    s.OnAction = "Racer"
    ws.Cells(ROW0 + 14, hud).Value = "Left / Right = steer"
    ws.Cells(ROW0 + 15, hud).Value = "Esc = stop"
    ws.Cells(ROW0 + 16, hud).Value = "Speed rises by itself!"

    ResetGame
    Compose: Flush: UpdateHud
    ws.Cells(1, 1).Select
    Application.ScreenUpdating = True
End Sub

' ---------------------------------------------------------------- game loop
Public Sub Racer()
    Dim running As Boolean, nextTick As Double, key As Long, lastMove As Long, i As Long

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
            running = StepGame(key)
            Compose: Flush
            If tick Mod 6 = 0 Then UpdateHud
        End If
        DoEvents
        Sleep 4
    Loop

    If crashed Then                            ' short flash on the crash
        For i = 1 To 6
            tick = tick + 1: Compose: Flush: Sleep 90
        Next i
    End If
    Application.EnableCancelKey = xlInterrupt
    LockKeys False
    If score > best Then best = score
    UpdateHud
    MsgBox IIf(crashed, "Crash!", "Stopped.") & vbCrLf & "Score: " & score & "   Best: " & best & vbCrLf & "@tech3almashi", vbInformation, "Traffic Racer"
End Sub
