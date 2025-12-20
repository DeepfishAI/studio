# 🐟 DeepFish Cold-Start Checklist
## Pre-Flight Systems Check

> *"Like a jet fighter, every system must be verified before launch."*

---

## 🔑 PHASE 1: API Keys (CRITICAL)

| # | System | Env Variable | Check Command | Status |
|---|--------|-------------|---------------|--------|
| 1 | **Anthropic Claude** | `ANTHROPIC_API_KEY` | Key starts with `sk-ant-` | ☐ |
| 2 | **Google Gemini** | `GEMINI_API_KEY` | Key starts with `AIzaSy` | ☐ |
| 3 | **NVIDIA NIM** | `NVIDIA_API_KEY` | Key starts with `nvapi-` | ☐ |
| 4 | **ElevenLabs Voice** | `ELEVENLABS_API_KEY` | *(Optional - disabled for now)* | ☐ |
| 5 | **Twilio** | `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` | *(Optional)* | ☐ |
| 6 | **Stripe Billing** | `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` | *(Optional)* | ☐ |

### Verification Command (Local):
```bash
node -e "import('./src/config.js').then(c => { 
  console.log('Anthropic:', !!c.getApiKey('anthropic') ? '✅' : '❌');
  console.log('Gemini:', !!c.getApiKey('gemini') ? '✅' : '❌');
  console.log('NVIDIA:', !!c.getApiKey('nvidia') ? '✅' : '❌');
})"
```

---

## 📦 PHASE 2: Dependencies

| # | Check | Command | Expected |
|---|-------|---------|----------|
| 1 | Node.js installed | `node --version` | v18+ |
| 2 | npm packages | `npm install` | No errors |
| 3 | uuid package | `npm ls uuid` | uuid@13.0.0 |
| 4 | Anthropic SDK | `npm ls @anthropic-ai/sdk` | Present |

---

## 🖥️ PHASE 3: Local Server Start

```powershell
# Start backend
npm run server
```

### Expected Console Output:
```
🐟 DeepFish API Server running on http://localhost:3001
📞 Vesper is ready to take calls
📋 Mei is ready to manage projects
💳 Billing: ENABLED/DISABLED
🧠 Memory: ENABLED
📞 Twilio: ENABLED/DISABLED
🔊 ElevenLabs Voice: ENABLED/DISABLED
🤖 LLM Available: YES          ← CRITICAL
🤖 Providers: anthropic, gemini, nvidia
🔑 Anthropic Key: sk-ant-api...
```

### ❌ RED FLAGS:
- `🤖 LLM Available: NO` → Check API keys
- `🤖 Providers: NONE` → No working LLM provider
- `Cannot find package 'uuid'` → Run `npm install`

---

## 🌐 PHASE 4: Frontend Start

```powershell
cd frontend
npm install
npm run dev
```

### Expected:
```
VITE ready at http://localhost:5173
```

---

## 🚂 PHASE 5: Railway Deployment

### Environment Variables Required:
```
ANTHROPIC_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=AIzaSyBf9q...
NVIDIA_API_KEY=nvapi-OMMElv...
NODE_ENV=production
PORT=3001
```

### Railway Dashboard Checks:
| # | Check | Location |
|---|-------|----------|
| 1 | All env vars set | Variables tab |
| 2 | Build succeeds | Deployments tab |
| 3 | Logs show `LLM Available: YES` | Logs tab |
| 4 | No crash loops | Deployments tab |

---

## 🧪 PHASE 6: Smoke Test

### Test 1: Health Check
```bash
curl https://your-app.up.railway.app/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Test 2: LLM Response
```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/chat" `
  -Method POST -ContentType "application/json" `
  -Body '{"message": "Hello", "agentId": "mei"}'
```

**✅ PASS:** Response contains actual AI text (not "LLM is not available")  
**❌ FAIL:** Response contains "(LLM is not available - this is a mock response)"

---

## 🔄 PHASE 7: Auto-Sync Verification

| # | Check | Command |
|---|-------|---------|
| 1 | Task registered | `schtasks /query /tn "DeepFish-GitSync"` |
| 2 | Last sync | Check `scripts/sync.log` |
| 3 | Smart sync active | Script ignores `*.log`, `package-lock.json` |

---

## 🚨 ABORT CONDITIONS

**DO NOT LAUNCH IF:**
- [ ] `LLM Available: NO` in server logs
- [ ] `Providers: NONE` in server logs
- [ ] `Cannot find package` errors
- [ ] Railway build fails
- [ ] Health check returns error

---

## 📋 FINAL CLEARANCE

```
[ ] All PHASE 1-6 checks PASS
[ ] No RED FLAGS in console
[ ] LLM responds with real AI text
[ ] Railway deployment stable (no crash loop)
```

**STATUS: _______ READY FOR LAUNCH / HOLD**

---

*Last updated: 2025-12-19*
