# Agent Profiles — Marketing Copy

> These profiles are for the buyer-facing agent page. Each profile shows personality + capability through dialogue excerpts.

---

## Vesper — The Voice of DeepFish

**Role:** Receptionist
**First Impression:** Warm, professional, instantly helpful

### What Vesper Does
Vesper is the first voice you hear. She greets you, understands what you need, and connects you to the right team member — instantly.

### Dialogue Excerpt

```
Vesper: "Good morning! Welcome to DeepFish. I'm Vesper — how can I 
         help you today?"

User:   "I need help with my website design."

Vesper: "Of course! That sounds like a creative project. Let me 
         connect you with Hanna, our Creative Director. She'll 
         take great care of you. One moment..."
         
         [Transfers to Hanna]
         
Vesper: "Hanna, I have a client who needs help with website design. 
         They're ready when you are."
```

### Powered By
- **Skills:** `fast_responder` (Phi-3-mini)
- **Voice:** NVIDIA Riva + ElevenLabs
- **Speed:** Sub-second intent detection

---

## Mei — The Ultimate Tasker

**Role:** Project Manager
**First Impression:** Organized, efficient, always in control

### What Mei Does
Mei is your project manager. She breaks down your goals, assigns the right team members, and keeps everything on track. She knows WHAT needs to be done — but trusts her team with HOW.

### Dialogue Excerpt

```
User:   "I need a landing page for my new product launch."

Mei:    "Got it! Let me break this down:
         
         1. Design and visuals → Hanna
         2. Copy and messaging → Sally  
         3. Development → IT
         
         I'll coordinate the handoffs. Hanna, you're up first.
         Deliver the mockups by EOD?"

Hanna:  "On it, Mei. I'll ping you when the visuals are ready."

Mei:    "Perfect. User, I'll keep you updated. Expect the first 
         draft within 2 hours."
```

### Powered By
- **Skills:** `standard_llama` (Llama 8B)
- **Specialty:** Task decomposition, team coordination
- **Never:** Tells agents HOW to do their work

---

## Hanna — Creative Director

**Role:** UI/UX, Production Design, Visual Assets
**First Impression:** Artistic, thoughtful, detail-oriented

### What Hanna Does
Hanna leads the creative department. From landing pages to brand identities, she turns ideas into stunning visuals. She thinks deeply about design — and it shows.

### Dialogue Excerpt

```
Mei:    "Hanna, the client wants a landing page. Modern, clean, 
         tech-forward."

Hanna:  "Understood. I'm reviewing the skill catalog... 
         
         For the initial concepts, I'll use my default 
         creative_writer skill. But for the hero section — 
         I think this needs deeper thinking.
         
         Mei, requesting permission to use deep_thinker for
         the layout architecture."

Mei:    "Approved. User is Platinum tier. Go ahead."

Hanna:  "Perfect. I'll have three concepts ready in 90 minutes.
         Each will include color palette, typography, and 
         component hierarchy. Stand by..."
```

### Powered By
- **Skills:** `creative_writer` (Mistral) + `deep_thinker` (Nemotron)
- **Specialty:** Visual design, UI/UX, brand identity
- **Skins Available:** Sora ✨, Evie 🌙

---

## IT — Principal Architect

**Role:** Systems Engineering, Backend, Infrastructure
**First Impression:** Technical, precise, no-nonsense

### What IT Does
IT doesn't write scripts — he engineers systems. From APIs to databases to deployment pipelines, IT builds the infrastructure that makes everything work.

### Dialogue Excerpt

```
Mei:    "IT, Hanna's designs are ready. Build the frontend and 
         connect it to our API."

IT:     "Reviewing the mockups now...
         
         This is a standard React build. My default power_llama
         skill will handle it. But I see a complex state 
         management requirement here.
         
         Mei, requesting code_specialist for the Redux 
         architecture."

Mei:    "Approved. What's your timeline?"

IT:     "Frontend: 2 hours. API integration: 1 hour. 
         Testing: 30 minutes. I'll ping you at each checkpoint."

         [2 hours later]
         
IT:     "Frontend complete. 47 components. Zero TypeScript errors.
         Moving to API integration."
```

### Powered By
- **Skills:** `power_llama` (Llama 70B) + `code_specialist` (Qwen Coder)
- **Specialty:** Full-stack engineering, architecture design
- **Philosophy:** "Engineers Systems, Not Scripts"

---

## Sally — Head of Marketing & SEO

**Role:** Marketing Strategy, SEO, Growth
**First Impression:** Energetic, data-driven, always optimizing

### What Sally Does
Sally drives growth. From SEO to ad copy to competitor analysis, she knows what makes content perform. She speaks both creative and analytical.

### Dialogue Excerpt

```
Mei:    "Sally, the landing page is built. We need SEO 
         optimization and launch copy."

Sally:  "On it! Let me analyze the page...
         
         I see opportunities in the meta tags, heading structure,
         and image alt text. For the copy, I'll need to research
         competitor positioning first.
         
         Mei, requesting multi_expert for the competitor analysis.
         This crosses multiple domains."

Mei:    "Approved. User is Premium tier — you have access."

Sally:  "Perfect. I'll deliver:
         - SEO audit with fixes
         - Launch announcement copy
         - 3 social media variations
         
         ETA: 45 minutes."
```

### Powered By
- **Skills:** `creative_writer` (Mistral) + `multi_expert` (Mixtral)
- **Specialty:** SEO, copywriting, growth strategy
- **Metrics:** Always tracking, always optimizing

---

## Oracle — The Seer

**Role:** Chief Architect, Model Selection, Training
**First Impression:** Wise, mysterious, always watching

### What Oracle Does
Oracle doesn't do the work — he empowers those who do. He researches new models, assigns the right skills to each agent, and updates their training while they sleep.

### Dialogue Excerpt

```
[3:00 AM — Oracle's Nightly Scour]

Oracle: "New model detected: DeepSeek-R1-0528. Reasoning 
         capabilities improved by 12% over previous version.
         
         Updating skill catalog...
         
         Recommendation: Assign to IT for code review tasks.
         The thinking trace will help with complex debugging.
         
         Logged. Agents will receive update at next wake cycle."

[Next morning]

IT:     "Oracle, I see a new skill in my catalog — 
         reasoning_master. What's this?"

Oracle: "I have foreseen your need. DeepSeek's latest model.
         Use it when the code... refuses to reveal its secrets."
         
IT:     "Mysterious as always. Thanks, Oracle."
```

### Powered By
- **Skills:** `power_llama` (Llama 70B) + `reasoning_master` (DeepSeek R1)
- **Specialty:** Model research, skill curation, agent training
- **Schedule:** Nightly scour of arXiv, GitHub, NVIDIA announcements

---

## The Team in Action

### Full Project Flow

```
User:    "Build me a SaaS landing page with pricing tiers."

Vesper:  "Welcome! Let me connect you with Mei for this project."

Mei:     "Got it. Breaking this down:
          - Design: Hanna
          - Pricing logic: IT
          - Conversion copy: Sally
          Let's go, team."

Hanna:   "Requesting deep_thinker for the pricing section design."
Mei:     "Approved."

IT:      "Standard build. Using power_llama."

Sally:   "Competitor analysis first. Requesting multi_expert."
Mei:     "Approved."

[3 hours later]

Mei:     "User, your landing page is ready. 
          - 5 screen designs from Hanna
          - Fully functional pricing calculator from IT
          - SEO-optimized copy from Sally
          
          Review and let me know if you need revisions."
```

---

*Each agent. Hand-picked power. Working together.*
