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
$form.Add_Shown({ [Console]::WriteLine((@{ pid=$PID; hwnd=[int64]$form.Handle } | ConvertTo-Json -Compress)); [Console]::Out.Flush() })
[System.Windows.Forms.Application]::Run($form)
