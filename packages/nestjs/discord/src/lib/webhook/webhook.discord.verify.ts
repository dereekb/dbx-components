import { type Request } from 'express';
import { verify, createPublicKey } from 'crypto';
import { type DiscordPublicKey } from '../discord.type';

export interface DiscordWebhookEventVerificationConfig {
  /**
   * The Ed25519 public key from the Discord Developer Portal.
   */
  readonly publicKey: DiscordPublicKey;
}

export type DiscordWebhookEventVerificationResult = DiscordWebhookEventVerificationSuccessResult | DiscordWebhookEventVerificationErrorResult;

export interface DiscordWebhookEventVerificationSuccessResult {
  readonly valid: true;
  /**
   * The parsed JSON body of the verified interaction.
   */
  readonly body: unknown;
}

export interface DiscordWebhookEventVerificationErrorResult {
  readonly valid: false;
}

/**
 * Function that verifies a Discord interaction webhook request using Ed25519 signatures.
 */
export type DiscordWebhookEventVerifier = (req: Request, rawBody: Buffer) => Promise<DiscordWebhookEventVerificationResult>;

/**
 * Creates a verifier for Discord interaction webhook requests.
 *
 * Discord signs interaction webhook requests with Ed25519. The signed message is
 * the concatenation of the x-signature-timestamp header and the raw request body.
 * The signature is provided in the x-signature-ed25519 header as a hex string.
 *
 * Uses Node.js built-in crypto with JWK key import — no external dependencies required.
 *
 * @param config - verification config containing the application's public key
 *
 * @example
 * ```ts
 * const verifier = discordWebhookEventVerifier({ publicKey: 'your-hex-public-key' });
 * const result = await verifier(req, rawBody);
 *
 * if (result.valid) {
 *   // result.body contains the parsed interaction
 * }
 * ```
 */
export function discordWebhookEventVerifier(config: DiscordWebhookEventVerificationConfig): DiscordWebhookEventVerifier {
  const { publicKey: publicKeyHex } = config;

  // Import the raw 32-byte Ed25519 public key via JWK format.
  const publicKey = createPublicKey({
    key: {
      kty: 'OKP',
      crv: 'Ed25519',
      x: Buffer.from(publicKeyHex, 'hex').toString('base64url')
    },
    format: 'jwk'
  });

  return async (request: Request, rawBody: Buffer): Promise<DiscordWebhookEventVerificationResult> => {
    const signature = request.headers['x-signature-ed25519'] as string | undefined;
    const timestamp = request.headers['x-signature-timestamp'] as string | undefined;

    let result: DiscordWebhookEventVerificationResult;

    if (!signature || !timestamp) {
      result = { valid: false };
    } else {
      const message = Buffer.concat([Buffer.from(timestamp), rawBody]);
      const signatureBuffer = Buffer.from(signature, 'hex');

      let valid = false;

      try {
        valid = verify(null, message, publicKey, signatureBuffer);
      } catch {
        valid = false;
      }

      if (valid) {
        const body = JSON.parse(rawBody.toString('utf-8'));
        result = { valid: true, body };
      } else {
        result = { valid: false };
      }
    }

    return result;
  };
}
