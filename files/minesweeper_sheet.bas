Private Sub Worksheet_SelectionChange(ByVal Target As Range)
    Dim x As Long, y As Long
    If Target.Cells.Count <> 1 Then Exit Sub
    If Target.Row = 2 And Target.Column >= 8 And Target.Column <= 11 Then NewGame: Exit Sub
    x = Target.Column - C0: y = Target.Row - R0
    If x < 0 Or x >= N Or y < 0 Or y >= N Then Exit Sub
    OpenCell x, y
End Sub

Private Sub Worksheet_BeforeRightClick(ByVal Target As Range, Cancel As Boolean)
    Dim x As Long, y As Long
    x = Target.Column - C0: y = Target.Row - R0
    If x < 0 Or x >= N Or y < 0 Or y >= N Then Exit Sub
    Cancel = True
    ToggleFlag x, y
End Sub
