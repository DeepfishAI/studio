# Git Auto-Sync Setup Instructions

## What's Been Created

Two files in `C:\REPOS\DF.1.251216.2033\scripts\`:

1. **git-auto-sync.ps1** - The sync script that:
   - Pulls any remote changes first
   - Commits and pushes any local changes
   - Logs all activity to `scripts\sync.log`
   - Handles network outages gracefully

2. **git-auto-sync-task.xml** - Task Scheduler config that runs every 5 minutes

---

## Setup on This PC (Home)

### Option A: Use Task Scheduler GUI
1. Open **Task Scheduler** (search in Start menu)
2. Click **Import Task...** in the right panel
3. Navigate to `C:\REPOS\DF.1.251216.2033\scripts\git-auto-sync-task.xml`
4. Click OK to import

### Option B: Run as Admin (one-time)
1. Right-click PowerShell → **Run as Administrator**
2. Run:
```powershell
schtasks /Create /XML "C:\REPOS\DF.1.251216.2033\scripts\git-auto-sync-task.xml" /TN "DeepFish-GitAutoSync"
```

---

## Setup on Surface

1. Clone the repo:
```powershell
cd C:\REPOS
git clone https://github.com/DeepfishAI/Studio
```

2. Open **Task Scheduler** → **Import Task...**
3. Select `C:\REPOS\DF.1.251216.2033\scripts\git-auto-sync-task.xml`
4. Done!

---

## How It Works

```
HOME PC                  GITHUB                  SURFACE
   |                        |                        |
   |---(auto-push)--------->|                        |
   |                        |<-------(auto-pull)-----|
   |                        |                        |
   |<-------(auto-pull)-----|                        |
   |                        |---------(auto-push)--->|
```

Every 5 minutes, each machine:
1. Pulls any new commits from GitHub
2. Commits local changes (if any)
3. Pushes to GitHub

---

## Checking Sync Status

View the log file:
```powershell
Get-Content C:\REPOS\DF.1.251216.2033\scripts\sync.log -Tail 20
```

---

## Workflow Tips

- **Before leaving home**: Save all files (the sync will auto-commit within 5 min)
- **At coffee shop**: Just `git pull` once to get latest if you're impatient, or wait for auto-sync
- **Avoid conflicts**: Try not to edit the same file on both machines at the same time
