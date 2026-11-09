Attribute VB_Name = "SnakeGame"
' =====================================================================
'  Snake inside Excel  -  tech3almashi  (@tech3almashi)
'  1) Alt+F8 > SetupBoard   (once, draws the board and a Play button)
'  2) Click "Play" (or Alt+F8 > Snake). Arrow keys to move, Esc to stop.
'  Windows Excel (32 or 64 bit). Save the workbook as .xlsm.
' =====================================================================
Option Explicit

#If VBA7 Then
    Private Declare PtrSafe Function GetAsyncKeyState Lib "user32" (ByVal vKey As Long) As Integer
    Private Declare PtrSafe Sub Sleep Lib "kernel32" (ByVal ms As Long)
#Else
    Private Declare Function GetAsyncKeyState Lib "user32" (ByVal vKey As Long) As Integer
    Private Declare Sub Sleep Lib "kernel32" (ByVal ms As Long)
#End If

Private Const W As Long = 16          ' board width  (columns)
Private Const H As Long = 18          ' board height (rows)
Private Const ROW0 As Long = 3        ' first board row
Private Const COL0 As Long = 2        ' first board column (B)
Private Const SPEED_MS As Long = 100  ' lower = faster

Private Const C_BOARD As Long = 16777215   ' white
Private Const C_BODY As Long = 6074415     ' green  RGB(47,177,92)
Private Const C_HEAD As Long = 3963406     ' dark green RGB(14,122,60)
Private Const C_APPLE As Long = 3881189    ' red RGB(229,56,59)

Private bx() As Long, by() As Long
Private snakeLen As Long
Private ax As Long, ay As Long
Private score As Long

Private Function Cell(ByVal x As Long, ByVal y As Long) As Range
    Set Cell = ActiveSheet.Cells(ROW0 + y, COL0 + x)
End Function

Private Function Board() As Range
    Set Board = ActiveSheet.Range(ActiveSheet.Cells(ROW0, COL0), ActiveSheet.Cells(ROW0 + H - 1, COL0 + W - 1))
End Function

Public Sub SetupBoard()
    Dim ws As Worksheet: Set ws = ActiveSheet
    Application.ScreenUpdating = False
    ws.Cells.Clear
    ActiveWindow.DisplayGridlines = False
    ws.Range(ws.Columns(COL0), ws.Columns(COL0 + W - 1)).ColumnWidth = 3.3
    ws.Range(ws.Rows(ROW0), ws.Rows(ROW0 + H - 1)).RowHeight = 22
    With Board
        .Interior.Color = C_BOARD
        .Borders.LineStyle = xlContinuous
        .Borders.Color = RGB(226, 226, 226)
        .BorderAround xlContinuous, xlMedium, , RGB(29, 111, 66)
    End With
    With ws.Cells(1, COL0)
        .Value = "SNAKE - tech3almashi"
        .Font.Bold = True: .Font.Size = 14: .Font.Color = RGB(29, 111, 66)
    End With
    ws.Cells(1, COL0 + W + 1).Value = "Score:"
    ws.Cells(1, COL0 + W + 1).Font.Bold = True
    ws.Cells(1, COL0 + W + 2).Value = 0
    ws.Cells(1, COL0 + W + 2).Font.Bold = True
    ws.Cells(1, COL0 + W + 2).Font.Size = 14

    Dim s As Shape
    On Error Resume Next: ws.Shapes("PlayButton").Delete: On Error GoTo 0
    Set s = ws.Shapes.AddShape(msoShapeRoundedRectangle, ws.Cells(ROW0, COL0 + W + 1).Left, ws.Cells(ROW0, COL0 + W + 1).Top, 90, 32)
    s.Name = "PlayButton"
    s.Fill.ForeColor.RGB = RGB(29, 111, 66)
    s.Line.Visible = msoFalse
    s.TextFrame2.TextRange.Text = "Play"
    s.TextFrame2.TextRange.Font.Bold = msoTrue
    s.TextFrame2.TextRange.Font.Size = 14
    s.TextFrame2.TextRange.ParagraphFormat.Alignment = msoAlignCenter
    s.TextFrame2.VerticalAnchor = msoAnchorMiddle
    s.OnAction = "Snake"
    ws.Cells(ROW0 + 2, COL0 + W + 1).Value = "Arrows = move, Esc = stop"
    Application.ScreenUpdating = True
End Sub

Private Sub PlaceApple()
    Dim ok As Boolean, i As Long
    Do
        ax = Int(Rnd * W): ay = Int(Rnd * H)
        ok = True
        For i = 0 To snakeLen - 1
            If bx(i) = ax And by(i) = ay Then ok = False: Exit For
        Next i
    Loop Until ok
    Cell(ax, ay).Interior.Color = C_APPLE
End Sub

Public Sub Snake()
    Dim dx As Long, dy As Long, nx As Long, ny As Long
    Dim i As Long, ate As Boolean, alive As Boolean

    Randomize
    Board.Interior.Color = C_BOARD
    ReDim bx(0 To W * H - 1): ReDim by(0 To W * H - 1)
    snakeLen = 3
    For i = 0 To 2: bx(i) = 5 - i: by(i) = H \ 2: Next i
    For i = 0 To snakeLen - 1: Cell(bx(i), by(i)).Interior.Color = IIf(i = 0, C_HEAD, C_BODY): Next i
    dx = 1: dy = 0: score = 0
    ActiveSheet.Cells(1, COL0 + W + 2).Value = 0
    PlaceApple
    ' clear any key presses made before the game started
    GetAsyncKeyState vbKeyLeft: GetAsyncKeyState vbKeyRight: GetAsyncKeyState vbKeyUp: GetAsyncKeyState vbKeyDown
    alive = True

    Do While alive
        If GetAsyncKeyState(vbKeyEscape) <> 0 Then Exit Do
        If GetAsyncKeyState(vbKeyLeft) <> 0 And dx <> 1 Then
            dx = -1: dy = 0
        ElseIf GetAsyncKeyState(vbKeyRight) <> 0 And dx <> -1 Then
            dx = 1: dy = 0
        ElseIf GetAsyncKeyState(vbKeyUp) <> 0 And dy <> 1 Then
            dx = 0: dy = -1
        ElseIf GetAsyncKeyState(vbKeyDown) <> 0 And dy <> -1 Then
            dx = 0: dy = 1
        End If

        nx = bx(0) + dx: ny = by(0) + dy
        If nx < 0 Or nx >= W Or ny < 0 Or ny >= H Then
            alive = False
        Else
            ate = (nx = ax And ny = ay)
            ' hitting the body is fatal (the tail cell is free unless we just ate)
            For i = 0 To snakeLen - IIf(ate, 1, 2)
                If bx(i) = nx And by(i) = ny Then alive = False: Exit For
            Next i
        End If
        If Not alive Then Exit Do

        If Not ate Then Cell(bx(snakeLen - 1), by(snakeLen - 1)).Interior.Color = C_BOARD
        If ate Then snakeLen = snakeLen + 1
        For i = snakeLen - 1 To 1 Step -1
            bx(i) = bx(i - 1): by(i) = by(i - 1)
        Next i
        bx(0) = nx: by(0) = ny
        Cell(bx(1), by(1)).Interior.Color = C_BODY
        Cell(nx, ny).Interior.Color = C_HEAD

        If ate Then
            score = score + 1
            ActiveSheet.Cells(1, COL0 + W + 2).Value = score
            If snakeLen = W * H Then MsgBox "You win! Score: " & score: Exit Sub
            PlaceApple
        End If

        DoEvents
        Sleep SPEED_MS
    Loop

    MsgBox "Game over!  Score: " & score & vbCrLf & "@tech3almashi", vbInformation, "Snake"
End Sub
