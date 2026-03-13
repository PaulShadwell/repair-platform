$ErrorActionPreference = "Stop"
$taskName = "RepairPlatformPrintAgent"
$scriptPath = Join-Path $PSScriptRoot "run-agent.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File \"$scriptPath\""
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Description "Repair Platform print agent" -Force | Out-Null
Write-Host "Installed startup task: $taskName"
