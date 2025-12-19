# Frontend

DeepFish React frontend with chat UI and agent profiles.

## Setup

```bash
cd frontend
npm install
npm run dev
```

Opens at http://localhost:3000

## Structure

```
frontend/
├── public/
│   └── deepfish.svg          # Logo
├── src/
│   ├── components/
│   │   └── Layout.jsx        # Sidebar + main content
│   ├── data/
│   │   └── agents.js         # Agent data
│   ├── pages/
│   │   ├── ChatPage.jsx      # Chat with agents
│   │   ├── AgentsPage.jsx    # Team overview
│   │   └── AgentProfilePage.jsx  # Individual agent
│   ├── services/
│   │   └── api.js            # Backend API calls
│   ├── styles/
│   │   ├── design-system.css # Core design tokens
│   │   └── app.css           # Component styles
│   ├── App.jsx               # Router
│   └── main.jsx              # Entry point
├── index.html
├── package.json
└── vite.config.js
```

## Features

- **Chat UI** — Message agents with typing indicators
- **Agent Profiles** — View and customize each agent
- **Voice Selection** — Change agent voices via ElevenLabs
- **Training Drop Zone** — Upload files to train agents
- **Premium Design** — Dark mode, glassmorphism, micro-animations

## Tech Stack

- React 18
- React Router 6
- Vite 5
- Vanilla CSS (no frameworks)
