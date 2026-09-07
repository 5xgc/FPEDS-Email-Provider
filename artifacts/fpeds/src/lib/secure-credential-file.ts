const encoder = new TextEncoder();
const decoder = new TextDecoder();

type CredentialEnvelope = {
  format: 'fpeds-encrypted-key';
  version: 1;
  username: string;
  salt: string;
  iv: string;
  ciphertext: string;
  createdAt: string;
};

function toBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function deriveKey(passphrase: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: 250_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function createCredentialFile(username: string, accessKey: string, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, encoder.encode(accessKey));
  const payload: CredentialEnvelope = {
    format: 'fpeds-encrypted-key',
    version: 1,
    username,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
    createdAt: new Date().toISOString(),
  };
  return JSON.stringify(payload, null, 2);
}

export async function readCredentialFile(file: File, passphrase: string) {
  if (file.size > 100_000) throw new Error('That credential file is too large.');
  const payload = JSON.parse(await file.text()) as Partial<CredentialEnvelope>;
  if (
    payload.format !== 'fpeds-encrypted-key' ||
    payload.version !== 1 ||
    !payload.salt ||
    !payload.iv ||
    !payload.ciphertext
  ) {
    throw new Error('That is not a valid FPEDS credential file.');
  }
  const key = await deriveKey(passphrase, fromBase64(payload.salt));
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(fromBase64(payload.iv)) },
      key,
      toArrayBuffer(fromBase64(payload.ciphertext)),
    );
    const accessKey = decoder.decode(decrypted);
    if (!/^\d{50}$/.test(accessKey)) throw new Error('The decrypted access key is invalid.');
    return { accessKey, username: payload.username ?? '' };
  } catch {
    throw new Error('The file passphrase was incorrect or the file is damaged.');
  }
}

export function downloadCredentialFile(filename: string, contents: string) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}