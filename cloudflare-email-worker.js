/*
 * Cloudflare Email Routing adapter.
 *
 * Configure an Email Worker for the fpeds.2bd.net route and set:
 *   INBOUND_URL = https://YOUR-RENDER-SERVICE.onrender.com/webhook/inbound
 *   WEBHOOK_SECRET = the same value as the Render INBOUND_WEBHOOK_SECRET
 *
 * This intentionally uses no mail provider API. It converts Cloudflare's
 * Email Worker event into the JSON contract accepted by the Flask app.
 */

function decodeQuotedPrintable(value) {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

function decodeTransferEncoding(value, encoding) {
  if (encoding.toLowerCase() === "base64") {
    try {
      return atob(value.replace(/\s/g, ""));
    } catch {
      return value;
    }
  }
  return encoding.toLowerCase() === "quoted-printable"
    ? decodeQuotedPrintable(value)
    : value;
}

function headerValue(headers, name) {
  return headers
    .split(/\r?\n/)
    .map((line) => line.match(/^([^:]+):\s*(.*)$/))
    .find((match) => match && match[1].toLowerCase() === name.toLowerCase())?.[2]
    ?.trim() || "";
}

function stripMimeHeaders(part) {
  const separator = part.search(/\r?\n\r?\n/);
  if (separator < 0) return { headers: "", body: part };
  const headerText = part.slice(0, separator);
  return {
    headers: headerText,
    body: part.slice(separator).replace(/^\r?\n\r?\n/, ""),
  };
}

function extractText(raw) {
  const separator = raw.search(/\r?\n\r?\n/);
  if (separator < 0) return raw.trim();
  const headers = raw.slice(0, separator);
  const body = raw.slice(separator).replace(/^\r?\n\r?\n/, "");
  const contentType = headerValue(headers, "content-type");
  const transferEncoding = headerValue(headers, "content-transfer-encoding");
  const boundary = contentType.match(/boundary="?([^";]+)"?/i)?.[1];

  if (boundary) {
    const parts = body.split(`--${boundary}`);
    const plainPart = parts
      .map(stripMimeHeaders)
      .find(({ headers: partHeaders }) =>
        /content-type:\s*text\/plain/i.test(partHeaders),
      );
    if (plainPart) {
      return decodeTransferEncoding(
        plainPart.body.replace(/\r?\n--$/, "").trim(),
        headerValue(plainPart.headers, "content-transfer-encoding"),
      );
    }
  }

  return decodeTransferEncoding(body.trim(), transferEncoding);
}

async function forward(env, payload) {
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
}

export default {
  async email(message, env) {
    const raw = await new Response(message.raw).text();
    const rawHeaders = raw.slice(0, raw.search(/\r?\n\r?\n/));
    return forward(env, {
      sender: message.from,
      recipient: message.to,
      subject: message.headers.get("subject") || headerValue(rawHeaders, "subject"),
      text: extractText(raw),
    });
  },

  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    return forward(env, await request.json());
  },
};