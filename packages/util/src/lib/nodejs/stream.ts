/**
 * Reads the input stream and encodes the data to a string.
 */
export type ReadableStreamToStringFunction = (stream: NodeJS.ReadableStream) => Promise<string>;

/**
 * Creates a function that reads a Node.js ReadableStream and converts its contents to a string using the specified encoding.
 *
 * @param encoding - The buffer encoding to use (e.g., 'utf-8', 'base64')
 * @returns Reusable consumer that drains a stream and resolves with its decoded contents.
 *
 * @dbxUtil
 * @dbxUtilCategory nodejs
 * @dbxUtilKind factory
 * @dbxUtilTags nodejs, stream, readable, string, factory, encoding
 * @dbxUtilRelated readable-stream-to-buffer, readable-stream-to-base64
 *
 * @__NO_SIDE_EFFECTS__
 */
export function readableStreamToStringFunction(encoding: BufferEncoding): ReadableStreamToStringFunction {
  return (stream: NodeJS.ReadableStream) => {
    return readableStreamToBuffer(stream).then((x) => x.toString(encoding));
  };
}

/**
 * ReadableStreamToStringFunction for Base64
 */
export const readableStreamToBase64 = readableStreamToStringFunction('base64');

/**
 * Reads all data from a Node.js ReadableStream and concatenates it into a single Buffer.
 *
 * @param stream - The readable stream to consume.
 * @returns Promise resolving to a Buffer containing all stream data.
 * @throws {Error} If the stream emits an error event; the returned promise rejects with that error.
 */
export function readableStreamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
