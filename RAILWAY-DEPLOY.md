# DeepFish - Railway Deployment Guide

## Quick Deploy

### 1. Connect GitHub Repository
```
Railway Dashboard → New Project → Deploy from GitHub
→ Select: JiffyAviation/DF.1.251216.2033
→ Branch: main
```

### 2. Configure Environment Variables

In Railway Dashboard → Variables, add:

```
# LLM Providers
ANTHROPIC_API_KEY=sk-ant-api03-...
GEMINI_API_KEY=AIzaSyBf9q...
NVIDIA_API_KEY=nvapi-OMMElv...
OPENROUTER_API_KEY=sk-or-v1-...
ELEVENLABS_API_KEY=2966fd9df8bb...

# Stripe Billing
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET
FRONTEND_URL=https://deepfish.app

# App Config
NODE_ENV=production
PORT=3001
```

### 3. Deploy Settings
- **Build Command**: `npm install`
- **Start Command**: `npm run server`

Railway will auto-detect these from `railway.json`.

### 4. Get Your URL
Railway provides: `https://your-app.up.railway.app`

### 5. Configure Stripe Webhook (Required for Billing)
1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://your-app.up.railway.app/api/billing/webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET` in Railway

---

## Frontend Deployment (Vercel)

The frontend should be deployed separately to Vercel:

### 1. Connect to Vercel
```
Vercel Dashboard → New Project
→ Import: JiffyAviation/DF.1.251216.2033
→ Root Directory: frontend
→ Framework: Vite
```

### 2. Environment Variables
```
VITE_API_URL=https://your-railway-app.up.railway.app
```

### 3. Build Settings
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

---

## Deployment Checklist

- [ ] Railway: GitHub connected
- [ ] Railway: Environment variables set
- [ ] Railway: Build successful → API running
- [ ] Vercel: Frontend deployed
- [ ] Vercel: VITE_API_URL points to Railway
- [ ] Test: Chat shows "Connected"
- [ ] Test: Real AI responses working

---

## Estimated Time
- Railway backend: ~3 minutes
- Vercel frontend: ~2 minutes
- Total: ~5 minutes

## Cost
- Railway: Free tier (500 hours/month)
- Vercel: Free tier (hobby projects)
