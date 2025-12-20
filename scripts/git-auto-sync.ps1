# Git Auto-Sync Script for DeepFish
# Runs periodically to sync local changes with GitHub
# SMART SYNC: Only pushes when meaningful changes exist
# Safe to run from Task Scheduler

$repoPath = "C:\REPOS\DF.1.251216.2033"
$logFile = "$repoPath\scripts\sync.log"

# Files/patterns to IGNORE when deciding if we should push
# These are noise - changes to these don't warrant a deploy
$ignorePatterns = @(
    "*.log",
    "sync.log",
    "package-lock.json",
    "*.tmp",
    "*.temp",
    ".DS_Store",
    "Thumbs.db",
    "node_modules/*",
    "frontend/node_modules/*",
    "*.pyc",
    "__pycache__/*",
    ".env.local",
    "output/*"
)

function Write-Log {
    param($Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$timestamp - $Message" | Out-File -Append -FilePath $logFile
}

function Has-MeaningfulChanges {
    # Get list of changed files
    $changedFiles = git diff --name-only HEAD 2>$null
    $stagedFiles = git diff --name-only --cached 2>$null
    $untrackedFiles = git ls-files --others --exclude-standard 2>$null
    
    $allChanges = @($changedFiles) + @($stagedFiles) + @($untrackedFiles) | Where-Object { $_ }
    
    if ($allChanges.Count -eq 0) {
        return $false
    }
    
    # Filter out ignored patterns
    $meaningfulChanges = $allChanges | Where-Object {
        $file = $_
        $isIgnored = $false
        foreach ($pattern in $ignorePatterns) {
            if ($file -like $pattern) {
                $isIgnored = $true
                break
            }
        }
        -not $isIgnored
    }
    
    if ($meaningfulChanges.Count -gt 0) {
        Write-Log "Meaningful changes detected: $($meaningfulChanges -join ', ')"
        return $true
    }
    
    Write-Log "Only noise files changed, skipping push"
    return $false
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
}
catch {
    Write-Log "SKIP: No network connection to GitHub"
    exit 0
}

Write-Log "Starting sync..."

# Fetch latest from remote
git fetch origin 2>&1 | Out-Null

# Check if remote is ahead
$behind = git rev-list HEAD..origin/main --count 2>$null
$hasRemoteChanges = $behind -gt 0

# Pull remote changes first (always do this to stay in sync)
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

# Only commit and push if we have MEANINGFUL changes
if (Has-MeaningfulChanges) {
    Write-Log "Committing meaningful changes..."
    git add -A
    $commitMsg = "Auto-sync from $env:COMPUTERNAME at $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
    git commit -m $commitMsg 2>&1 | Out-Null
    
    Write-Log "Pushing to remote..."
    $pushResult = git push 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: Push failed - $pushResult"
        exit 1
    }
    Write-Log "Pushed meaningful changes successfully"
}
else {
    # Still stage ignored files locally but don't push
    $status = git status --porcelain
    if ($status.Length -gt 0) {
        Write-Log "Local noise changes exist but not pushing (no meaningful changes)"
    }
    else {
        Write-Log "No changes to sync"
    }
}

Write-Log "Sync complete"
