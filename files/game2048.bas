Attribute VB_Name = "Game2048"
' =====================================================================
'  2048 inside Excel  -  tech3almashi  (@tech3almashi)
'  1) Open the file and click "Enable Content".
'  2) Press the ARROW KEYS: every tile slides, equal tiles merge (2+2=4 ...).
'  3) Reach 2048 to win. Click the green "NEW GAME" cell (or Alt+F8 > NewGame).
'  One small routine (SlideLine) slides and merges a single row; the four
'  directions just read the board in a different order.
'  Arrow keys are taken over while this sheet is active (Esc-free: switch sheet
'  or run StopKeys to give them back). Windows or Mac Excel. Keep it as .xlsm.
' =====================================================================
Option Explicit

Public Const N As Long = 4
Public Const R0 As Long = 5          ' first board row
Public Const C0 As Long = 2          ' first board column

Public b(0 To N - 1, 0 To N - 1) As Long   ' b(row, col), 0 = empty
Public score As Long, best As Long, over As Boolean, won As Boolean

Public Sub NewGame()
    Dim r As Long, c As Long, ws As Worksheet
    Set ws = ActiveSheet
    Application.ScreenUpdating = False
    ws.Cells.Clear
    ws.Cells.Interior.Color = RGB(250, 248, 239)
    ws.Columns(1).ColumnWidth = 3
    ws.Range(ws.Columns(C0), ws.Columns(C0 + N - 1)).ColumnWidth = 12
    ws.Range(ws.Rows(R0), ws.Rows(R0 + N - 1)).RowHeight = 66
    With ws.Range(ws.Cells(R0, C0), ws.Cells(R0 + N - 1, C0 + N - 1))
        .Font.Bold = True: .Font.Size = 26: .HorizontalAlignment = xlCenter: .VerticalAlignment = xlCenter
        .Borders.LineStyle = xlContinuous: .Borders.Weight = xlThick: .Borders.Color = RGB(187, 173, 160)
    End With
    ws.Cells(2, C0).Value = "2048": ws.Cells(2, C0).Font.Size = 28: ws.Cells(2, C0).Font.Bold = True
    ws.Cells(2, C0).Font.Color = RGB(119, 110, 101)
    With ws.Cells(2, C0 + 3)
        .Value = "NEW GAME": .Interior.Color = RGB(60, 170, 100): .Font.Bold = True
        .Font.Color = RGB(255, 255, 255): .HorizontalAlignment = xlCenter
    End With
    For r = 0 To N - 1
        For c = 0 To N - 1
            b(r, c) = 0
        Next c
    Next r
    score = 0: over = False: won = False
    AddTile: AddTile
    Draw ws
    ws.Cells(R0 + N + 1, C0).Select
    Application.ScreenUpdating = True
    StartKeys
End Sub

Public Sub StartKeys()
    Application.OnKey "{UP}", "MoveUp"
    Application.OnKey "{DOWN}", "MoveDown"
    Application.OnKey "{LEFT}", "MoveLeft"
    Application.OnKey "{RIGHT}", "MoveRight"
End Sub

Public Sub StopKeys()
    Application.OnKey "{UP}"
    Application.OnKey "{DOWN}"
    Application.OnKey "{LEFT}"
    Application.OnKey "{RIGHT}"
End Sub

Private Sub AddTile()
    Dim r As Long, c As Long, free As Long, pick As Long
    For r = 0 To N - 1
        For c = 0 To N - 1
            If b(r, c) = 0 Then free = free + 1
        Next c
    Next r
    If free = 0 Then Exit Sub
    Randomize
    pick = Int(Rnd * free)
    For r = 0 To N - 1
        For c = 0 To N - 1
            If b(r, c) = 0 Then
                If pick = 0 Then
                    If Rnd < 0.9 Then b(r, c) = 2 Else b(r, c) = 4
                    Exit Sub
                End If
                pick = pick - 1
            End If
        Next c
    Next r
End Sub

' Slide one line of 4 numbers toward index 0 and merge equal neighbours once.
' Returns True if anything moved; adds merged values to score.
Private Function SlideLine(v() As Long) As Boolean
    Dim t(0 To N - 1) As Long, k As Long, i As Long, last As Long
    k = 0: last = 0
    For i = 0 To N - 1
        If v(i) <> 0 Then
            If last = v(i) Then
                t(k - 1) = last * 2: score = score + last * 2
                If last * 2 = 2048 Then won = True
                last = 0
            Else
                t(k) = v(i): last = v(i): k = k + 1
            End If
        End If
    Next i
    For i = 0 To N - 1
        If v(i) <> t(i) Then SlideLine = True
        v(i) = t(i)
    Next i
End Function

Private Sub DoMove(ByVal d As Long)
    Dim ln() As Long, j As Long, i As Long, r As Long, c As Long, moved As Boolean
    If over Then Exit Sub
    ReDim ln(0 To N - 1)
    For j = 0 To N - 1
        For i = 0 To N - 1
            MapCell d, j, i, r, c: ln(i) = b(r, c)
        Next i
        If SlideLine(ln) Then moved = True
        For i = 0 To N - 1
            MapCell d, j, i, r, c: b(r, c) = ln(i)
        Next i
    Next j
    If moved Then AddTile
    If score > best Then best = score
    If Not CanMove() Then over = True
    Application.ScreenUpdating = False
    Draw ActiveSheet
    Application.ScreenUpdating = True
End Sub

' i = 0 is the cell the tiles move toward. d: 0 left, 1 right, 2 up, 3 down
Private Sub MapCell(ByVal d As Long, ByVal j As Long, ByVal i As Long, ByRef r As Long, ByRef c As Long)
    Select Case d
        Case 0: r = j: c = i
        Case 1: r = j: c = N - 1 - i
        Case 2: r = i: c = j
        Case Else: r = N - 1 - i: c = j
    End Select
End Sub

Private Function CanMove() As Boolean
    Dim r As Long, c As Long
    For r = 0 To N - 1
        For c = 0 To N - 1
            If b(r, c) = 0 Then CanMove = True: Exit Function
            If c < N - 1 Then If b(r, c) = b(r, c + 1) Then CanMove = True: Exit Function
            If r < N - 1 Then If b(r, c) = b(r + 1, c) Then CanMove = True: Exit Function
        Next c
    Next r
End Function

Private Function TileColor(ByVal v As Long) As Long
    Select Case v
        Case 0: TileColor = RGB(205, 193, 180)
        Case 2: TileColor = RGB(238, 228, 218)
        Case 4: TileColor = RGB(237, 224, 200)
        Case 8: TileColor = RGB(242, 177, 121)
        Case 16: TileColor = RGB(245, 149, 99)
        Case 32: TileColor = RGB(246, 124, 95)
        Case 64: TileColor = RGB(246, 94, 59)
        Case 128: TileColor = RGB(237, 207, 114)
        Case 256: TileColor = RGB(237, 204, 97)
        Case 512: TileColor = RGB(237, 200, 80)
        Case 1024: TileColor = RGB(237, 197, 63)
        Case Else: TileColor = RGB(237, 194, 46)
    End Select
End Function

Private Sub Draw(ByVal ws As Worksheet)
    Dim r As Long, c As Long, v As Long
    For r = 0 To N - 1
        For c = 0 To N - 1
            v = b(r, c)
            With ws.Cells(R0 + r, C0 + c)
                .Interior.Color = TileColor(v)
                If v = 0 Then .Value = "" Else .Value = v
                If v <= 4 Then .Font.Color = RGB(119, 110, 101) Else .Font.Color = RGB(255, 255, 255)
                If v >= 1024 Then .Font.Size = 20 Else .Font.Size = 26
            End With
        Next c
    Next r
    ws.Cells(3, C0).Value = "SCORE " & score & "    BEST " & best
    ws.Cells(3, C0).Font.Bold = True: ws.Cells(3, C0).Font.Color = RGB(119, 110, 101)
    If won Then
        ws.Cells(R0 + N, C0).Value = "YOU MADE 2048!  Keep going or click NEW GAME"
        ws.Cells(R0 + N, C0).Font.Color = RGB(60, 170, 100)
    ElseIf over Then
        ws.Cells(R0 + N, C0).Value = "No moves left. Click NEW GAME"
        ws.Cells(R0 + N, C0).Font.Color = RGB(220, 60, 60)
    Else
        ws.Cells(R0 + N, C0).Value = "Arrow keys = slide all tiles"
        ws.Cells(R0 + N, C0).Font.Color = RGB(119, 110, 101)
    End If
    ws.Cells(R0 + N, C0).Font.Bold = True
End Sub

Public Sub MoveLeft()
    DoMove 0
End Sub

Public Sub MoveRight()
    DoMove 1
End Sub

Public Sub MoveUp()
    DoMove 2
End Sub

Public Sub MoveDown()
    DoMove 3
End Sub

