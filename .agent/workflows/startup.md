---
description: Boot script for Railway sync and initialization
---

// turbo-all

1. Ensure Railway CLI is logged in
```powershell
railway.cmd login
```

2. Sync Railway API keys to local configuration
```powershell
npm run secrets:sync
```

3. Login to GitHub
```powershell
gh auth login
```

4. Login to ElevenLabs
```powershell
elevenlabs auth login
```

5. Login to Dashlane
```powershell
dashlane login
```
