import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
} from "node:crypto";

const encryptionSource =
  process.env.FPEDS_ENCRYPTION_KEY ?? process.env.SESSION_SECRET;

if (!encryptionSource) {
  throw new Error("FPEDS_ENCRYPTION_KEY or SESSION_SECRET must be set");
}

const encryptionKey = scryptSync(encryptionSource, "fpeds-at-rest-v1", 32);

export function newId(): string {
  return randomUUID();
}

export function hashAccessKey(accessKey: string): string {
  return createHash("sha256").update(accessKey.trim()).digest("hex");
}

export function encryptValue(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptValue(value: string): string {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) {
    throw new Error("Invalid encrypted value");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
