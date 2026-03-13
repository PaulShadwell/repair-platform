$ErrorActionPreference = "Stop"
$taskName = "RepairPlatformPrintAgent"
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "Removed startup task: $taskName"
