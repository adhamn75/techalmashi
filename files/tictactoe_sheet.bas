Private Sub Worksheet_SelectionChange(ByVal Target As Range)
    Dim x As Long, y As Long
    If Target.Cells.Count <> 1 Then Exit Sub
    If Target.Row = 2 And Target.Column = 7 Then NewGame: Exit Sub
    If Target.Row = 2 And Target.Column = 8 Then ExcelStarts: Exit Sub
    x = Target.Column - C0: y = Target.Row - R0
    If x < 0 Or x > 2 Or y < 0 Or y > 2 Then Exit Sub
    Application.EnableEvents = False
    PlayAt y * 3 + x
    ActiveSheet.Range("A1").Select
    Application.EnableEvents = True
End Sub
