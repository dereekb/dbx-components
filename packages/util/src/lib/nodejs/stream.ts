/**
 * Reads the input stream and encodes the data to a string.
 */
export type ReadableStreamToStringFunction = (stream: NodeJS.ReadableStream) => Promise<string>;

/**
 * Creates a new ReadableStreamToStringFunction
 * @param encoding
 * @returns
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
 * Converts a ReadableStream to a Buffer promise.
 *
 * @param encoding
 * @returns
 */
export function readableStreamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
