const apiKey = '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';
const model = 'meta/llama-3.1-8b-instruct';
const url = 'https://integrate.api.nvidia.com/v1/chat/completions';

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
