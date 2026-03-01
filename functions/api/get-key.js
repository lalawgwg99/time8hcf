export async function onRequest(context) { return new Response(context.env.AI_API_KEY, { headers: { "Access-Control-Allow-Origin": "*" } }); }
