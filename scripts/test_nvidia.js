import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const config = JSON.parse(readFileSync(join(__dirname, '..', 'config.secrets.json'), 'utf8'));
const apiKey = config.llm_providers?.nvidia?.api_key;
const model = 'meta/llama-3.1-8b-instruct';
const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

console.log(`Using NVIDIA API key from config: ${apiKey ? apiKey.substring(0, 15) + '...' : 'NOT FOUND'}`);

async function test() {
    console.log(`Testing ${model}...`);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: 'user', content: 'Hi' }
                ],
                max_tokens: 10
            })
        });
        console.log(`Status: ${response.status}`);
        const text = await response.text();
        console.log(`Response: ${text.substring(0, 200)}`);
    } catch (err) {
        console.log(`Fetch error: ${err.message}`);
    }
}

test();
