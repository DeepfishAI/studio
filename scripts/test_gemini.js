// Node native fetch used

const apiKey = 'AIzaSyA4_J7ALCf7YFvQPbp1on5XkINeuRd2QFI';
const models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

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
