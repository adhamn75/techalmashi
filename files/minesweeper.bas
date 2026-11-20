Attribute VB_Name = "MinesweeperGame"
' =====================================================================
'  MINESWEEPER inside Excel  -  tech3almashi  (@tech3almashi)
'  1) Open the file and click "Enable Content".
'  2) Click any grey cell = open it.  Right-click = flag / unflag.
'  3) Click the green "NEW GAME" cell (or run NewGame with Alt+F8) to restart.
'  First click is always safe. Empty cells open their neighbours by flood-fill
'  (a loop with a stack, no recursion). 14 x 14 board, 30 mines.
'  Windows or Mac Excel. Keep it as .xlsm.
' =====================================================================
Option Explicit

Public Const N As Long = 14
Public Const MINES As Long = 30
Public Const R0 As Long = 5          ' first board row
Public Const C0 As Long = 2          ' first board column

Public mine(0 To N - 1, 0 To N - 1) As Boolean
Public opened(0 To N - 1, 0 To N - 1) As Boolean
Public flagged(0 To N - 1, 0 To N - 1) As Boolean
Public started As Boolean, over As Boolean, openedCount As Long, flagCount As Long

Private Function NumColor(ByVal k As Long) As Long
    Select Case k
        Case 1: NumColor = RGB(0, 90, 255)
        Case 2: NumColor = RGB(0, 150, 40)
        Case 3: NumColor = RGB(230, 30, 30)
        Case 4: NumColor = RGB(20, 20, 140)
        Case 5: NumColor = RGB(140, 20, 20)
        Case 6: NumColor = RGB(0, 150, 150)
        Case 7: NumColor = RGB(0, 0, 0)
        Case Else: NumColor = RGB(90, 90, 90)
    End Select
End Function

Public Sub NewGame()
    Dim x As Long, y As Long, ws As Worksheet
    Set ws = ActiveSheet
    Application.ScreenUpdating = False
    ws.Cells.Clear
    ws.Cells.RowHeight = 24: ws.Columns.ColumnWidth = 3.6
    ws.Range(ws.Cells(1, 1), ws.Cells(R0 + N + 1, C0 + N + 1)).Interior.Color = RGB(20, 22, 40)
    For y = 0 To N - 1
        For x = 0 To N - 1
            mine(x, y) = False: opened(x, y) = False: flagged(x, y) = False
        Next x
    Next y
    started = False: over = False: openedCount = 0: flagCount = 0
    With ws.Range(ws.Cells(R0, C0), ws.Cells(R0 + N - 1, C0 + N - 1))
        .Interior.Color = RGB(150, 155, 175)
        .Font.Bold = True: .Font.Size = 13: .HorizontalAlignment = xlCenter: .VerticalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous: .Borders.Color = RGB(60, 62, 90)
    End With
    With ws.Range(ws.Cells(2, C0), ws.Cells(2, C0 + 4))
        .Merge: .Value = "MINESWEEPER": .Font.Bold = True: .Font.Size = 16: .Font.Color = RGB(255, 210, 60)
    End With
    With ws.Range(ws.Cells(2, C0 + 6), ws.Cells(2, C0 + 9))
        .Merge: .Value = "NEW GAME": .Interior.Color = RGB(60, 190, 110): .Font.Bold = True
        .Font.Color = RGB(255, 255, 255): .HorizontalAlignment = xlCenter
    End With
    ShowStatus ws, "Click a cell. Right-click = flag", RGB(255, 255, 255)
    ws.Cells(R0 + N + 1, C0).Select
    Application.ScreenUpdating = True
End Sub

Private Sub ShowStatus(ByVal ws As Worksheet, ByVal t As String, ByVal c As Long)
    With ws.Range(ws.Cells(3, C0), ws.Cells(3, C0 + N - 1))
        .UnMerge: .Merge: .Value = t & "   |   Mines left: " & (MINES - flagCount)
        .Font.Bold = True: .Font.Color = c: .HorizontalAlignment = xlLeft
    End With
End Sub

Private Sub PlaceMines(ByVal sx As Long, ByVal sy As Long)
    Dim k As Long, x As Long, y As Long
    Randomize
    k = 0
    Do While k < MINES
        x = Int(Rnd * N): y = Int(Rnd * N)
        If Not mine(x, y) And (Abs(x - sx) > 1 Or Abs(y - sy) > 1) Then mine(x, y) = True: k = k + 1
    Loop
End Sub

Private Function Around(ByVal x As Long, ByVal y As Long) As Long
    Dim i As Long, j As Long, n As Long
    For j = y - 1 To y + 1
        For i = x - 1 To x + 1
            If i >= 0 And i < N And j >= 0 And j < N Then If mine(i, j) Then n = n + 1
        Next i
    Next j
    Around = n
End Function

Private Sub Paint(ByVal ws As Worksheet, ByVal x As Long, ByVal y As Long)
    Dim c As Range, k As Long
    Set c = ws.Cells(R0 + y, C0 + x)
    If opened(x, y) Then
        If mine(x, y) Then
            c.Interior.Color = RGB(230, 40, 40): c.Value = "*": c.Font.Color = RGB(0, 0, 0)
        Else
            k = Around(x, y)
            c.Interior.Color = RGB(225, 228, 240)
            If k > 0 Then c.Value = k: c.Font.Color = NumColor(k) Else c.Value = ""
        End If
    ElseIf flagged(x, y) Then
        c.Interior.Color = RGB(255, 200, 60): c.Value = "F": c.Font.Color = RGB(200, 0, 0)
    Else
        c.Interior.Color = RGB(150, 155, 175): c.Value = ""
    End If
End Sub

Public Sub OpenCell(ByVal sx As Long, ByVal sy As Long)
    Dim ws As Worksheet, sx2(0 To N * N) As Long, sy2(0 To N * N) As Long, sp As Long
    Dim queued(0 To N - 1, 0 To N - 1) As Boolean
    Dim x As Long, y As Long, i As Long, j As Long
    If over Then Exit Sub
    Set ws = ActiveSheet
    If flagged(sx, sy) Or opened(sx, sy) Then Exit Sub
    Application.ScreenUpdating = False
    If Not started Then PlaceMines sx, sy: started = True
    If mine(sx, sy) Then
        opened(sx, sy) = True: Paint ws, sx, sy
        Lose ws
        Application.ScreenUpdating = True
        Exit Sub
    End If
    sx2(0) = sx: sy2(0) = sy: sp = 1: queued(sx, sy) = True
    Do While sp > 0
        sp = sp - 1: x = sx2(sp): y = sy2(sp)
        If Not opened(x, y) And Not flagged(x, y) And Not mine(x, y) Then
            opened(x, y) = True: openedCount = openedCount + 1: Paint ws, x, y
            If Around(x, y) = 0 Then
                For j = y - 1 To y + 1
                    For i = x - 1 To x + 1
                        If i >= 0 And i < N And j >= 0 And j < N Then
                            If Not opened(i, j) And Not queued(i, j) Then
                                queued(i, j) = True: sx2(sp) = i: sy2(sp) = j: sp = sp + 1
                            End If
                        End If
                    Next i
                Next j
            End If
        End If
    Loop
    If openedCount = N * N - MINES Then Win ws
    Application.ScreenUpdating = True
End Sub

Public Sub ToggleFlag(ByVal x As Long, ByVal y As Long)
    Dim ws As Worksheet
    If over Or opened(x, y) Then Exit Sub
    Set ws = ActiveSheet
    flagged(x, y) = Not flagged(x, y)
    If flagged(x, y) Then flagCount = flagCount + 1 Else flagCount = flagCount - 1
    Paint ws, x, y
    ShowStatus ws, "Click a cell. Right-click = flag", RGB(255, 255, 255)
End Sub

Private Sub Lose(ByVal ws As Worksheet)
    Dim x As Long, y As Long
    over = True
    For y = 0 To N - 1
        For x = 0 To N - 1
            If mine(x, y) Then opened(x, y) = True: Paint ws, x, y
        Next x
    Next y
    ShowStatus ws, "BOOM! You hit a mine. Click NEW GAME", RGB(255, 90, 90)
End Sub

Private Sub Win(ByVal ws As Worksheet)
    over = True
    ShowStatus ws, "YOU WIN! Every safe cell is open", RGB(90, 255, 140)
End Sub
