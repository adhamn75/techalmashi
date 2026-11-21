Private Sub Worksheet_SelectionChange(ByVal Target As Range)
    If Target.Cells.Count <> 1 Then Exit Sub
    If Target.Row = 2 And Target.Column = 5 Then NewGame
End Sub

Private Sub Worksheet_Activate()
    StartKeys
End Sub

Private Sub Worksheet_Deactivate()
    StopKeys
End Sub
