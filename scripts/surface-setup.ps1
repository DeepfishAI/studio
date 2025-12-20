# Surface Quick Setup Script for DeepFish Auto-Sync
# Run this in PowerShell AS ADMINISTRATOR on your Surface

Write-Host "=== DeepFish Auto-Sync Setup ===" -ForegroundColor Cyan

$repoPath = "C:\REPOS\DF.1.251216.2033"
$repoUrl = "https://github.com/DeepfishAI/Studio.git"

# Step 1: Create REPOS folder if needed
if (-not (Test-Path "C:\REPOS")) {
    Write-Host "Creating C:\REPOS folder..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "C:\REPOS" | Out-Null
}

# Step 2: Clone or pull repo
if (Test-Path $repoPath) {
    Write-Host "Repo exists, pulling latest..." -ForegroundColor Yellow
    Set-Location $repoPath
    git pull
}
else {
    Write-Host "Cloning repo..." -ForegroundColor Yellow
    Set-Location "C:\REPOS"
    git clone $repoUrl
}

# Step 3: Register the scheduled task
Write-Host "Registering scheduled task..." -ForegroundColor Yellow
$taskExists = schtasks /query /tn "DeepFish-GitSync" 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Task already exists, updating..." -ForegroundColor Yellow
    schtasks /delete /tn "DeepFish-GitSync" /f
}
schtasks /create /tn "DeepFish-GitSync" /xml "$repoPath\scripts\git-auto-sync-task.xml"

# Step 4: Run initial sync
Write-Host "Running initial sync..." -ForegroundColor Yellow
& "$repoPath\scripts\git-auto-sync.ps1"

# Step 5: Verify
Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
Write-Host "Task status:" -ForegroundColor Cyan
schtasks /query /tn "DeepFish-GitSync" /fo list | Select-String -Pattern "Status|Next Run"
Write-Host "`nYour Surface will now auto-sync with GitHub every 5 minutes!" -ForegroundColor Green
