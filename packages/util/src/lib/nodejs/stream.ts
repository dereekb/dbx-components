/**
 * Reads the input stream and encodes the data to a string.
 */
export type ReadableStreamToStringFunction = (stream: NodeJS.ReadableStream) => Promise<string>;

/**
 * Creates a function that reads a Node.js ReadableStream and converts its contents to a string using the specified encoding.
 *
 * @param encoding - The buffer encoding to use (e.g., 'utf-8', 'base64')
 * @returns A function that consumes a ReadableStream and resolves to its string content
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
 * @param stream - The readable stream to consume
 * @returns Promise resolving to a Buffer containing all stream data
 * @throws Rejects if the stream emits an error event
 */
export function readableStreamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
