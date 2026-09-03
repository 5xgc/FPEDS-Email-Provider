/*
 * Cloudflare Email Routing adapter.
 *
 * Configure an Email Worker for the fpeds.2bd.net route and set:
 *   INBOUND_URL = https://YOUR-RENDER-SERVICE.onrender.com/webhook/inbound
 *   WEBHOOK_SECRET = the same value as the Render INBOUND_WEBHOOK_SECRET
 *
 * A production worker should use a MIME parser to extract the subject/body
 * from message.raw. This adapter documents the JSON contract expected by the
 * Flask endpoint; it can also be called by an upstream parser.
 */
export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const payload = await request.json();
    const response = await fetch(env.INBOUND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": env.WEBHOOK_SECRET,
      },
      body: JSON.stringify(payload),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  },
};