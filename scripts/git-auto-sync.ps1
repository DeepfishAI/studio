# Git Auto-Sync Script for DeepFish
# Runs periodically to sync local changes with GitHub
# Safe to run from Task Scheduler

$repoPath = "C:\REPOS\DF.1.251216.2033"
$logFile = "$repoPath\scripts\sync.log"

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -Append -FilePath $logFile
}

Set-Location $repoPath

# Check if we're in a git repo
if (-not (Test-Path ".git")) {
    Write-Log "ERROR: Not a git repository"
    exit 1
}

# Check for network connectivity to GitHub
try {
    $null = Test-Connection github.com -Count 1 -ErrorAction Stop
} catch {
    Write-Log "SKIP: No network connection to GitHub"
    exit 0
}

Write-Log "Starting sync..."

# Fetch latest from remote
git fetch origin 2>&1 | Out-Null

# Check if there are local changes
$status = git status --porcelain
$hasLocalChanges = $status.Length -gt 0

# Check if remote is ahead
$behind = git rev-list HEAD..origin/main --count 2>$null
$hasRemoteChanges = $behind -gt 0

# If both have changes, we might have a conflict - just pull with rebase
if ($hasRemoteChanges) {
    Write-Log "Pulling remote changes..."
    $pullResult = git pull --rebase 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: Pull failed - $pullResult"
        git rebase --abort 2>&1 | Out-Null
        exit 1
    }
    Write-Log "Pulled $behind commit(s) from remote"
}

# If we have local changes, commit and push
if ($hasLocalChanges) {
    Write-Log "Committing local changes..."
    git add -A
    $commitMsg = "Auto-sync from $env:COMPUTERNAME at $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    git commit -m $commitMsg 2>&1 | Out-Null
    
    Write-Log "Pushing to remote..."
    $pushResult = git push 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: Push failed - $pushResult"
        exit 1
    }
    Write-Log "Pushed local changes successfully"
} else {
    Write-Log "No local changes to sync"
}

Write-Log "Sync complete"
