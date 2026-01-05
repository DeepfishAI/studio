import { useEffect, useState } from 'react';

const codeSnippets = [
    'const deepfish = await agent.initialize()',
    'function processTask(input) { return llm.chat(input) }',
    'export default { model: "gemini-1.5-pro", temperature: 0.7 }',
    'if (user.authenticated) { dispatch(GRANT_ACCESS) }',
    'const response = await fetch("/api/agents/vesper")',
    'return agents.map(a => ({ ...a, status: "active" }))',
    'logger.info(`Task complete: ${task.id}`)',
    'const tokens = await tokenize(prompt, { maxLength: 4096 })',
    '{agents: 6, llms: 5, status: "operational"}',
    'while (queue.length > 0) { await process(queue.shift()) }',
    'import { createContext, useContext } from "react"',
    'SELECT * FROM beta_leads WHERE tier="free" LIMIT 20',
    'redis.set(`session:${id}`, JSON.stringify(data))',
    'app.post("/api/leads", async (req, res) => {...})',
    'const jwt = sign({ userId, email }, SECRET, { expiresIn: "7d" })'
];

export default function ScrollingCodeBackground() {
    const [lines, setLines] = useState([]);

    useEffect(() => {
        // Generate 5 random code lines with different speeds & colors
        const colors = ['#1E90FF', '#9B59B6', '#2ECC71', '#FF9F43', '#E74C99', '#00D4FF'];
        const newLines = Array.from({ length: 6 }, (_, i) => ({
            id: i,
            code: codeSnippets[Math.floor(Math.random() * codeSnippets.length)],
            color: colors[i % colors.length],
            duration: 40 + i * 10, // Stagger speeds: 40s, 50s, 60s, etc.
            delay: i * -8 // Stagger start positions
        }));
        setLines(newLines);
    }, []);

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 0,
            opacity: 0.15
        }}>
            {lines.map(line => (
                <div
                    key={line.id}
                    style={{
                        position: 'absolute',
                        top: `${20 + line.id * 18}%`,
                        whiteSpace: 'nowrap',
                        fontFamily: 'Consolas, "Courier New", monospace',
                        fontSize: '14px',
                        color: line.color,
                        animation: `scrollLeft ${line.duration}s linear infinite`,
                        animationDelay: `${line.delay}s`
                    }}
                >
                    {line.code}
                </div>
            ))}

            <style>{`
        @keyframes scrollLeft {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100vw);
          }
        }
      `}</style>
        </div>
    );
}
