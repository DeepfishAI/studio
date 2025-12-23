// Node native fetch used
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const config = JSON.parse(readFileSync(join(__dirname, '..', 'config.secrets.json'), 'utf8'));
const apiKey = config.llm_providers?.google?.gemini_api_key;
const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

console.log(`Using API key from config: ${apiKey ? apiKey.substring(0, 12) + '...' : 'NOT FOUND'}`);

async function test() {
    for (const model of models) {
        console.log(`Testing ${model}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: "You are a helpful assistant." }] },
                    contents: [{ parts: [{ text: "Hi" }] }]
                })
            });
            console.log(`Status: ${response.status}`);
            if (response.ok) {
                const data = await response.json();
                console.log(`Success: ${JSON.stringify(data).substring(0, 100)}...`);
            } else {
                const text = await response.text();
                console.log(`Error: ${text}`);
            }
        } catch (err) {
            console.log(`Fetch error: ${err.message}`);
        }
        console.log('---');
    }
}

test();
