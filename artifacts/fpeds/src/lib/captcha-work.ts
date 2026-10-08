const encoder = new TextEncoder();

export async function solveCaptchaWork(token: string, workBits: number): Promise<number> {
  if (!crypto.subtle || !Number.isInteger(workBits) || workBits < 1 || workBits > 20) {
    throw new Error('This browser cannot complete the security check.');
  }

  const maximumAttempts = 2_000_000;
  for (let nonce = 0; nonce < maximumAttempts; nonce += 1) {
    const digest = new Uint8Array(
      await crypto.subtle.digest('SHA-256', encoder.encode(`${token}:${nonce}`)),
    );
    let leadingZeroBits = 0;
    for (const byte of digest) {
      if (byte === 0) {
        leadingZeroBits += 8;
        continue;
      }
      leadingZeroBits += Math.clz32(byte) - 24;
      break;
    }
    if (leadingZeroBits >= workBits) return nonce;

    if (nonce > 0 && nonce % 256 === 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }
  }

  throw new Error('The security check expired. Refresh it and try again.');
}
