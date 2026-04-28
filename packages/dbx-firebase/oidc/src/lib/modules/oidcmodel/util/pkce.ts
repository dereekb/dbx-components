/**
 * Generates a random PKCE code verifier string (43 characters, base64url-encoded).
 *
 * @returns A cryptographically random base64url string suitable for use as a PKCE code_verifier.
 */
export function generatePkceCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

/**
 * Generates a PKCE code challenge from a code verifier using SHA-256.
 *
 * @param verifier - The code verifier string to hash
 * @returns A base64url-encoded SHA-256 hash of the verifier
 */
export async function generatePkceCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binString).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}
