$ErrorActionPreference = 'Stop'
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$pidFile = Join-Path $PSScriptRoot 'server.pid'
if (Test-Path $pidFile) {
    $existingServer = Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue
    if ($existingServer -and $existingServer.Path -eq $nodeExe) {
        Write-Output 'Apex Digital is running: http://localhost:8100'
        return
    }
}
$serverProcess = Start-Process -FilePath $nodeExe -ArgumentList 'server.js' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $PSScriptRoot 'server.log') -RedirectStandardError (Join-Path $PSScriptRoot 'server.error.log') -PassThru
Set-Content $pidFile $serverProcess.Id
Write-Output 'Apex Digital: http://localhost:8100'
