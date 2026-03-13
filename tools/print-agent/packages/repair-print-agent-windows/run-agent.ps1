$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
node .\agent.mjs run
