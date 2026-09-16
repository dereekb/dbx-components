import type { Maybe } from '@dereekb/util';
import { type Response } from 'supertest';

/**
 * Collects the raw response body so the served BYTES can be compared, rather than letting
 * superagent's content-type-driven parsing reinterpret them.
 *
 * Pass it to supertest's `.parse()`. Superagent hands a parser the live response stream, which its
 * own `Response` type does not model — hence the stream cast.
 *
 * @param res - The in-flight superagent response, read here as a stream.
 * @param callback - Node-style callback handed the collected body.
 */
export function binaryParser(res: Response, callback: (error: Maybe<Error>, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  const stream = res as unknown as NodeJS.ReadableStream;

  stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
  stream.on('error', (error: Error) => callback(error, Buffer.alloc(0)));
}
