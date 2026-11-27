Attribute VB_Name = "TicTacToeGame"
' =====================================================================
'  TIC-TAC-TOE (X-O) inside Excel that NEVER loses  -  tech3almashi
'  1) Open the file and click "Enable Content".
'  2) You are X. Click any empty square of the big board to play.
'  3) Excel (O) answers with MINIMAX: it plays every possible game to
'     the end and scores each empty square: +win / 0 draw / -loss.
'     The scores appear in the SCORES board on the right.
'  4) Click the green "NEW GAME" cell to restart (Excel then lets you
'     start; click "EXCEL STARTS" to let Excel move first).
'  Best you can get is a draw. Windows or Mac Excel. Keep it as .xlsm.
' =====================================================================
Option Explicit

Public Const R0 As Long = 5          ' first board row
Public Const C0 As Long = 2          ' first board column (B)
Public Const S0 As Long = 7          ' first column of the SCORES board (G)

Public b(0 To 8) As Long             ' 0 empty, 1 = X (you), 2 = O (Excel)
Public over As Boolean
Public lastScore(0 To 8) As Variant

Private Function Winner() As Long
    Dim L As Variant, i As Long
    L = Array(0, 1, 2, 3, 4, 5, 6, 7, 8, 0, 3, 6, 1, 4, 7, 2, 5, 8, 0, 4, 8, 2, 4, 6)
    For i = 0 To 21 Step 3
        If b(L(i)) <> 0 And b(L(i)) = b(L(i + 1)) And b(L(i)) = b(L(i + 2)) Then Winner = b(L(i)): Exit Function
    Next i
    Winner = 0
End Function

Private Function Full() As Boolean
    Dim i As Long
    For i = 0 To 8
        If b(i) = 0 Then Full = False: Exit Function
    Next i
    Full = True
End Function

' Score from Excel's (O's) point of view: +10-depth if O wins, -(10-depth) if X wins, 0 draw.
Private Function Minimax(ByVal turn As Long, ByVal depth As Long) As Long
    Dim w As Long, i As Long, s As Long, best As Long
    w = Winner()
    If w = 2 Then Minimax = 10 - depth: Exit Function
    If w = 1 Then Minimax = depth - 10: Exit Function
    If Full() Then Minimax = 0: Exit Function
    If turn = 2 Then best = -1000 Else best = 1000
    For i = 0 To 8
        If b(i) = 0 Then
            b(i) = turn
            s = Minimax(3 - turn, depth + 1)
            b(i) = 0
            If turn = 2 Then
                If s > best Then best = s
            Else
                If s < best Then best = s
            End If
        End If
    Next i
    Minimax = best
End Function

Private Sub ExcelMove()
    Dim i As Long, s As Long, best As Long, pick As Long
    best = -1000: pick = -1
    For i = 0 To 8
        lastScore(i) = Empty
        If b(i) = 0 Then
            b(i) = 2
            s = Minimax(1, 1)
            b(i) = 0
            lastScore(i) = s
            If s > best Then best = s: pick = i
        End If
    Next i
    If pick >= 0 Then b(pick) = 2
    DrawScores pick
End Sub

Public Sub PlayAt(ByVal k As Long)
    If over Then Exit Sub
    If k < 0 Or k > 8 Then Exit Sub
    If b(k) <> 0 Then Exit Sub
    b(k) = 1
    If Winner() = 0 And Not Full() Then ExcelMove
    DrawBoard
End Sub

Public Sub NewGame()
    Dim i As Long
    For i = 0 To 8: b(i) = 0: lastScore(i) = Empty: Next i
    over = False
    SetupSheet
    DrawScores -1
    DrawBoard
End Sub

Public Sub ExcelStarts()
    NewGame
    ExcelMove
    DrawBoard
End Sub

Private Sub DrawBoard()
    Dim i As Long, c As Range, w As Long
    For i = 0 To 8
        Set c = ActiveSheet.Cells(R0 + i \ 3, C0 + i Mod 3)
        Select Case b(i)
            Case 1: c.Value = "X": c.Font.Color = RGB(255, 80, 80)
            Case 2: c.Value = "O": c.Font.Color = RGB(60, 200, 255)
            Case Else: c.Value = ""
        End Select
    Next i
    w = Winner()
    With ActiveSheet.Range("B9")
        If w = 2 Then
            .Value = "EXCEL WINS!": over = True
        ElseIf w = 1 Then
            .Value = "YOU WIN?! (impossible)": over = True
        ElseIf Full() Then
            .Value = "DRAW - the best you can do": over = True
        Else
            .Value = "Your turn (X)"
        End If
    End With
End Sub

Private Sub DrawScores(ByVal pick As Long)
    Dim i As Long, c As Range
    For i = 0 To 8
        Set c = ActiveSheet.Cells(R0 + i \ 3, S0 + i Mod 3)
        c.Interior.Color = RGB(30, 34, 48)
        If IsEmpty(lastScore(i)) Then
            c.Value = ""
        Else
            c.Value = lastScore(i)
            If lastScore(i) > 0 Then
                c.Font.Color = RGB(80, 230, 120)
            ElseIf lastScore(i) < 0 Then
                c.Font.Color = RGB(255, 90, 90)
            Else
                c.Font.Color = RGB(220, 220, 220)
            End If
        End If
        If i = pick Then c.Interior.Color = RGB(30, 90, 150)
    Next i
End Sub

Private Sub SetupSheet()
    Dim ws As Worksheet, r As Long, k As Long
    Set ws = ActiveSheet
    Application.ScreenUpdating = False
    ws.Cells.Clear
    ws.Cells.Interior.Color = RGB(16, 18, 28)
    ws.Cells.Font.Name = "Arial"
    ws.Cells.Font.Color = RGB(230, 230, 230)
    ws.Columns("A").ColumnWidth = 3
    ws.Columns("B:D").ColumnWidth = 14
    ws.Columns("E:F").ColumnWidth = 3
    ws.Columns("G:I").ColumnWidth = 14
    ws.Rows(R0 & ":" & R0 + 2).RowHeight = 80
    With ws.Range("B2"): .Value = "TIC-TAC-TOE": .Font.Size = 22: .Font.Bold = True: End With
    With ws.Range("B3"): .Value = "You are X. Click a square. Excel (O) uses MINIMAX and never loses.": .Font.Size = 10: End With
    With ws.Range("G2"): .Value = "NEW GAME": .Interior.Color = RGB(30, 140, 70): .Font.Bold = True: .HorizontalAlignment = xlCenter: End With
    With ws.Range("H2"): .Value = "EXCEL STARTS": .Interior.Color = RGB(40, 90, 160): .Font.Bold = True: .HorizontalAlignment = xlCenter: End With
    With ws.Range("G4"): .Value = "SCORES (Excel's view: + win, 0 draw, - loss)": .Font.Size = 9: End With
    With ws.Range(ws.Cells(R0, C0), ws.Cells(R0 + 2, C0 + 2))
        .Interior.Color = RGB(26, 30, 44)
        .Font.Size = 54: .Font.Bold = True
        .HorizontalAlignment = xlCenter: .VerticalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous: .Borders.Weight = xlThick: .Borders.Color = RGB(120, 130, 160)
    End With
    With ws.Range(ws.Cells(R0, S0), ws.Cells(R0 + 2, S0 + 2))
        .Font.Size = 28: .Font.Bold = True
        .HorizontalAlignment = xlCenter: .VerticalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous: .Borders.Color = RGB(80, 90, 120)
    End With
    With ws.Range("B9"): .Font.Size = 16: .Font.Bold = True: .Font.Color = RGB(255, 210, 60): End With
    ws.Range("B11").Value = "How it works: for each empty square Excel plays it, then plays every possible rest of the game"
    ws.Range("B12").Value = "(you play your best, it plays its best), and keeps the highest score. 10 - moves = faster wins score higher."
    ws.Range("B11:B12").Font.Size = 9
    ws.Range("B13").Value = "tech3almashi - YouTube @tech3almashi"
    ws.Range("B13").Font.Color = RGB(120, 130, 160)
    Application.ScreenUpdating = True
    ws.Range("A1").Select
End Sub
