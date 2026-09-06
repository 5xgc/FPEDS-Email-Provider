import { ReplitConnectors } from "@replit/connectors-sdk";

const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
}
const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
const connectors = new ReplitConnectors();
const response = await connectors.proxy("brevo", "/smtp/email", {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
  },
  body: JSON.stringify(payload),
});
const responseText = await response.text();
let providerBody = {};
try {
  providerBody = JSON.parse(responseText);
} catch {
  providerBody = {};
}
process.stdout.write(
  JSON.stringify({
    ok: response.ok,
    status: response.status,
    message: providerBody.message ?? providerBody.code ?? null,
  }),
);