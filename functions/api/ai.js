export async function onRequestPost({ request, env }) {
    try {
        const apiKey = env.AI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({ error: "Missing AI_API_KEY in Cloudflare Environment Variables" }), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }

        const reqBody = await request.clone().json();

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': request.headers.get('origin') || 'https://time8hcf.pages.dev',
                'X-Title': 'TimeTracker',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "arcee-ai/trinity-mini:free",
                messages: reqBody.messages
            })
        });

        const data = await response.json();

        return new Response(JSON.stringify(data), {
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            }
        });
    }
}
