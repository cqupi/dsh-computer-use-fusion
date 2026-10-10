Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing -TypeDefinition @'
public class FusionTestForm : System.Windows.Forms.Form {
  protected override bool ShowWithoutActivation { get { return true; } }
}
'@
$form = New-Object FusionTestForm
$form.Text = "DSH Fusion Test Fixture $PID"
$form.Size = New-Object System.Drawing.Size(1280, 800)
$form.StartPosition = 'Manual'
$form.Location = New-Object System.Drawing.Point(120, 120)
$edit = New-Object System.Windows.Forms.TextBox
$edit.Name = 'FusionEditor'
$edit.AccessibleName = 'FusionEditor'
$edit.Location = New-Object System.Drawing.Point(20, 20)
$edit.Width = 440
$form.Controls.Add($edit)
# Give the fixture an explicit application shortcut, then verify delivery
# through the resulting selection/replacement rather than assuming EDIT defaults.
$edit.Add_KeyDown({ param($sender, $eventArgs)
  if ($eventArgs.Control -and $eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::A) {
    $edit.SelectAll()
    $eventArgs.SuppressKeyPress = $true
  }
})
$label = New-Object System.Windows.Forms.Label
$label.Text = 'Status: waiting'
$label.AccessibleName = 'FusionStatus'
$label.Location = New-Object System.Drawing.Point(20, 65)
$label.Width = 440
$form.Controls.Add($label)
$button = New-Object System.Windows.Forms.Button
$button.Text = 'Run fixture action'
$button.AccessibleName = 'FusionAction'
$button.Location = New-Object System.Drawing.Point(20, 100)
$button.Width = 200
$button.Add_Click({ $label.Text = 'Status: clicked'; $label.AccessibleName = 'Status: clicked' })
$form.Controls.Add($button)
$password = New-Object System.Windows.Forms.TextBox
$password.UseSystemPasswordChar = $true
$password.AccessibleName = 'FusionPassword'
$password.Location = New-Object System.Drawing.Point(20, 150)
$password.Add_TextChanged({ $label.Text = "Password length: $($password.Text.Length)"; $label.AccessibleName = $label.Text })
$form.Controls.Add($password)
$keyTrace = New-Object System.Windows.Forms.Label
$keyTrace.Text = 'Key trace: waiting'
$keyTrace.AccessibleName = $keyTrace.Text
$keyTrace.Location = New-Object System.Drawing.Point(20, 200)
$keyTrace.Width = 600
$form.Controls.Add($keyTrace)
$edit.Add_KeyUp({ param($sender, $eventArgs)
  if ($eventArgs.KeyCode -eq [System.Windows.Forms.Keys]::A) {
    $keyTrace.Text = "Key trace: A control=$($eventArgs.Control) selected=$($edit.SelectionLength)"
    $keyTrace.AccessibleName = $keyTrace.Text
  }
})
$form.Add_Shown({ [Console]::WriteLine((@{ pid=$PID; hwnd=[int64]$form.Handle } | ConvertTo-Json -Compress)); [Console]::Out.Flush() })
[System.Windows.Forms.Application]::Run($form)
