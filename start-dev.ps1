# Start GhostBuster API + UI for local development (Windows)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "npm not found. Install Node.js LTS, then open a NEW terminal and run this script again."
  Write-Host "  winget install OpenJS.NodeJS.LTS --source winget"
  exit 1
}

if (-not (Test-Path "$root\GhostBuster\node_modules")) {
  Write-Host "Installing UI dependencies..."
  Push-Location "$root\GhostBuster"
  npm install --no-fund --no-audit
  Pop-Location
}

if (-not (Test-Path "$root\ghostbuster-server\node_modules")) {
  Write-Host "Installing API dependencies..."
  Push-Location "$root\ghostbuster-server"
  npm install --no-fund --no-audit
  Pop-Location
}

Write-Host "Starting API on http://127.0.0.1:3001 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\ghostbuster-server'; npm start"

Start-Sleep -Seconds 2

Write-Host "Starting UI on http://localhost:5173 ..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$root\GhostBuster'; npm run dev"

Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "Done. Two terminal windows should stay open (API + UI)."
Write-Host "Open in browser: http://localhost:5173"
Write-Host "Press Ctrl+C in each terminal window to stop."
