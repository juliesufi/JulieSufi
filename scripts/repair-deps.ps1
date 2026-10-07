# Repair broken node_modules after mixed npm/pnpm installs (Windows).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "Stopping stray Node processes in this project is recommended if dev is running."
if (Test-Path "node_modules\.ignored") {
  Write-Host "Removing node_modules\.ignored ..."
  Remove-Item -Recurse -Force "node_modules\.ignored"
}
if (Test-Path "node_modules\.vite") {
  Remove-Item -Recurse -Force "node_modules\.vite"
}
Write-Host "Reinstalling dependencies with npm ..."
npm install
node scripts/verify-vinext.mjs
Write-Host "Done. Run: npm run dev"
