Attribute VB_Name = "FlappyGame"
' =====================================================================
'  FLAPPY BIRD inside Excel  -  tech3almashi  (@tech3almashi)
'  1) Open the file and click "Enable Content".
'  2) Click "Play" (or Alt+F8 > Flappy).
'     Space (or Up) = flap      Esc = stop
'  Gravity, scrolling pipes with random gaps, collisions, score, best score.
'  Every frame the loop recomputes the whole picture and only repaints the
'  cells that changed. Windows Excel (32 or 64 bit). Keep it as .xlsm.
' =====================================================================
Option Explicit

#If VBA7 Then
    Private Declare PtrSafe Function GetAsyncKeyState Lib "user32" (ByVal vKey As Long) As Integer
    Private Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal ms As Long)
#Else
    Private Declare Function GetAsyncKeyState Lib "user32" (ByVal vKey As Long) As Integer
    Private Declare Sub Sleep Lib "kernel32" (ByVal ms As Long)
#End If

Private Const W As Long = 36          ' screen width  (columns)
Private Const H As Long = 32          ' screen height (rows)
Private Const ROW0 As Long = 3        ' first screen row
Private Const COL0 As Long = 2        ' first screen column (B)
Private Const GROUND As Long = 28     ' rows 28..31 are the ground
Private Const BIRDX As Long = 8       ' the bird's left column
Private Const PIPEW As Long = 4       ' pipe width
Private Const GAP As Long = 9         ' gap height between the two pipes
Private Const SPACING As Long = 14    ' columns between two pipes
Private Const NP As Long = 3          ' pipes alive at once

Private Const GRAVITY As Double = 0.11
Private Const FLAP As Double = -1.05
Private Const MAXFALL As Double = 1.3

Private shown(0 To W - 1, 0 To H - 1) As Long   ' what the cells show now
Private want(0 To W - 1, 0 To H - 1) As Long    ' what they must show this frame
Private px(0 To NP - 1) As Double, gapTop(0 To NP - 1) As Long, passed(0 To NP - 1) As Boolean
Private birdY As Double, vy As Double, score As Long, best As Long, tick As Long
Private prevFlap As Boolean

' ---------------------------------------------------------------- colours
Private Function SkyColor(ByVal y As Long) As Long
    ' a vertical gradient, light at the horizon
    Dim t As Double: t = y / GROUND
    SkyColor = RGB(40 + 70 * t, 150 + 50 * t, 230 - 10 * t)
End Function

Private Function Cell(ByVal x As Long, ByVal y As Long) As Range
    Set Cell = ActiveSheet.Cells(ROW0 + y, COL0 + x)
End Function

Private Function Screen() As Range
    Set Screen = ActiveSheet.Range(ActiveSheet.Cells(ROW0, COL0), ActiveSheet.Cells(ROW0 + H - 1, COL0 + W - 1))
End Function

' ---------------------------------------------------------------- the picture
Private Sub Background()
    Dim x As Long, y As Long, c As Long
    For y = 0 To H - 1
        For x = 0 To W - 1
            If y < GROUND Then
                c = SkyColor(y)
            ElseIf y = GROUND Then
                If (((x + tick) \ 2) Mod 2) = 0 Then c = RGB(120, 220, 70) Else c = RGB(95, 195, 55)
            Else
                c = RGB(222, 200, 140)
            End If
            want(x, y) = c
        Next x
    Next y
    ' two slow clouds
    Dim cx As Long
    For x = 0 To 1
        cx = ((W + 6) - ((tick \ 6 + x * 19) Mod (W + 12))) - 6
        Puff cx, 4 + x * 6
    Next x
End Sub

Private Sub Puff(ByVal cx As Long, ByVal cy As Long)
    Dim x As Long, y As Long
    For y = cy To cy + 1
        For x = cx To cx + 4 - (y - cy) * 2 + 1
            If x >= 0 And x < W Then want(x, y) = RGB(245, 250, 255)
        Next x
    Next y
End Sub

Private Sub DrawPipes()
    Dim i As Long, x As Long, y As Long, col As Long, edge As Long
    For i = 0 To NP - 1
        For x = 0 To PIPEW - 1
            col = CLng(Int(px(i))) + x
            If col >= 0 And col < W Then
                Select Case x
                    Case 0: edge = RGB(30, 120, 40)
                    Case PIPEW - 1: edge = RGB(40, 140, 50)
                    Case Else: edge = RGB(90, 200, 80)
                End Select
                For y = 0 To GROUND - 1
                    If y < gapTop(i) Or y >= gapTop(i) + GAP Then
                        want(col, y) = edge
                        If y = gapTop(i) - 1 Or y = gapTop(i) + GAP Then want(col, y) = RGB(60, 170, 60)   ' the lip
                    End If
                Next y
            End If
        Next x
    Next i
End Sub

Private Sub DrawBird()
    Dim by As Long: by = CLng(Int(birdY))
    Plot BIRDX, by, RGB(255, 210, 0)
    Plot BIRDX + 1, by, RGB(255, 255, 255)        ' eye
    Plot BIRDX, by + 1, RGB(255, 170, 0)
    Plot BIRDX + 1, by + 1, RGB(255, 200, 0)
    Plot BIRDX + 2, by + 1, RGB(255, 80, 30)      ' beak
    If vy < 0 Then Plot BIRDX - 1, by, RGB(255, 240, 150) Else Plot BIRDX - 1, by + 1, RGB(255, 240, 150)  ' wing
End Sub

Private Sub Plot(ByVal x As Long, ByVal y As Long, ByVal c As Long)
    If x >= 0 And x < W And y >= 0 And y < H Then want(x, y) = c
End Sub

' Repaint only the cells whose colour changed since the last frame.
Private Sub Flush()
    Dim x As Long, y As Long
    Application.ScreenUpdating = False
    For y = 0 To H - 1
        For x = 0 To W - 1
            If want(x, y) <> shown(x, y) Then
                Cell(x, y).Interior.Color = want(x, y)
                shown(x, y) = want(x, y)
            End If
        Next x
    Next y
    Application.ScreenUpdating = True
End Sub

Private Sub UpdateHud()
    With ActiveSheet
        .Cells(ROW0 + 1, COL0 + W + 2).Value = score
        .Cells(ROW0 + 4, COL0 + W + 2).Value = best
    End With
End Sub

' ---------------------------------------------------------------- the world
Private Sub NewGap(ByVal i As Long)
    gapTop(i) = 3 + Int(Rnd * (GROUND - GAP - 6))
    passed(i) = False
End Sub

Private Function Hit() As Boolean
    Dim by As Long, i As Long, col As Long, yy As Long
    by = CLng(Int(birdY))
    If by < 0 Or by + 1 >= GROUND Then Hit = True: Exit Function
    For i = 0 To NP - 1
        col = CLng(Int(px(i)))
        If BIRDX + 2 >= col And BIRDX <= col + PIPEW - 1 Then
            For yy = by To by + 1
                If yy < gapTop(i) Or yy >= gapTop(i) + GAP Then Hit = True: Exit Function
            Next yy
        End If
    Next i
End Function

Private Function FlapPressed() As Boolean
    Dim d As Boolean
    d = ((GetAsyncKeyState(vbKeySpace) Or GetAsyncKeyState(vbKeyUp)) And &H8000) <> 0
    FlapPressed = d And Not prevFlap
    prevFlap = d
End Function

Private Sub LockKeys(ByVal lockThem As Boolean)
    Dim k As Variant
    For Each k In Array(" ", "{UP}", "{DOWN}", "{LEFT}", "{RIGHT}")
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
    ActiveWindow.DisplayGridlines = False
    ws.Cells.Interior.Color = RGB(14, 16, 24)
    ws.Cells.Font.Color = RGB(235, 235, 240)
    ws.Columns(1).ColumnWidth = 2
    ws.Range(ws.Columns(COL0), ws.Columns(COL0 + W - 1)).ColumnWidth = 1.9
    ws.Range(ws.Rows(ROW0), ws.Rows(ROW0 + H - 1)).RowHeight = 13
    ws.Columns(hud).ColumnWidth = 14
    Screen.BorderAround xlContinuous, xlThick, , RGB(255, 210, 0)
    With ws.Cells(1, COL0)
        .Value = "FLAPPY BIRD - tech3almashi"
        .Font.Bold = True: .Font.Size = 16: .Font.Color = RGB(255, 210, 0)
    End With
    ws.Cells(ROW0, hud).Value = "SCORE"
    ws.Cells(ROW0 + 3, hud).Value = "BEST"
    ws.Range(ws.Cells(ROW0, hud), ws.Cells(ROW0 + 3, hud)).Font.Bold = True
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 4, hud)).Font.Size = 20
    ws.Range(ws.Cells(ROW0 + 1, hud), ws.Cells(ROW0 + 4, hud)).HorizontalAlignment = xlLeft

    On Error Resume Next: ws.Shapes("PlayButton").Delete: On Error GoTo 0
    Set s = ws.Shapes.AddShape(msoShapeRoundedRectangle, ws.Cells(ROW0 + 7, hud).Left, ws.Cells(ROW0 + 7, hud).Top, 100, 34)
    s.Name = "PlayButton"
    s.Fill.ForeColor.RGB = RGB(255, 170, 0)
    s.Line.Visible = msoFalse
    s.TextFrame2.TextRange.Text = "Play"
    s.TextFrame2.TextRange.Font.Bold = msoTrue
    s.TextFrame2.TextRange.Font.Size = 15
    s.TextFrame2.TextRange.ParagraphFormat.Alignment = msoAlignCenter
    s.TextFrame2.VerticalAnchor = msoAnchorMiddle
    s.OnAction = "Flappy"
    ws.Cells(ROW0 + 11, hud).Value = "Space / Up = flap"
    ws.Cells(ROW0 + 12, hud).Value = "Esc = stop"

    ' paint a first frame so the sheet already looks like the game
    Dim x As Long, y As Long
    For y = 0 To H - 1: For x = 0 To W - 1: shown(x, y) = -1: Next x: Next y
    ResetWorld
    Background: DrawPipes: DrawBird: Flush
    ws.Cells(1, 1).Select
    Application.ScreenUpdating = True
End Sub

Private Sub ResetWorld()
    Dim i As Long
    birdY = 12: vy = 0: score = 0: tick = 0
    For i = 0 To NP - 1
        px(i) = W + 2 + i * SPACING
        NewGap i
    Next i
End Sub

' ---------------------------------------------------------------- game loop
Public Sub Flappy()
    Dim alive As Boolean, nextFrame As Double, i As Long, x As Long, y As Long

    If ActiveSheet.Cells(ROW0, COL0 + W + 2).Value <> "SCORE" Then SetupScreen
    Randomize
    For y = 0 To H - 1: For x = 0 To W - 1: shown(x, y) = -1: Next x: Next y
    ResetWorld
    UpdateHud
    GetAsyncKeyState vbKeySpace: GetAsyncKeyState vbKeyUp
    prevFlap = False
    LockKeys True
    Application.EnableCancelKey = xlDisabled
    alive = True
    nextFrame = Timer

    Do While alive
        If (GetAsyncKeyState(vbKeyEscape) And &H8000) <> 0 Then Exit Do
        If FlapPressed() Then vy = FLAP
        If Timer >= nextFrame Or Timer < nextFrame - 5 Then
            nextFrame = Timer + 0.045
            tick = tick + 1
            ' gravity is one line
            vy = vy + GRAVITY: If vy > MAXFALL Then vy = MAXFALL
            birdY = birdY + vy
            ' scroll the pipes
            For i = 0 To NP - 1
                px(i) = px(i) - 0.5
                If px(i) < -PIPEW Then px(i) = px(i) + NP * SPACING: NewGap i
                If Not passed(i) And px(i) + PIPEW < BIRDX Then passed(i) = True: score = score + 1: UpdateHud
            Next i
            ' collision is another
            If Hit() Then alive = False
            Background: DrawPipes: DrawBird: Flush
        End If
        DoEvents
        Sleep 5
    Loop

    Application.EnableCancelKey = xlInterrupt
    LockKeys False
    If score > best Then best = score
    UpdateHud
    MsgBox "Game over!" & vbCrLf & "Score: " & score & "   Best: " & best & vbCrLf & "@tech3almashi", vbInformation, "Flappy Bird"
End Sub
