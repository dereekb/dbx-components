import { Readable } from 'stream';
import { readableStreamToStringFunction, readableStreamToBase64, readableStreamToBuffer } from './stream';

function makeReadableStream(content: string): NodeJS.ReadableStream {
  return Readable.from([Buffer.from(content)]);
}

describe('readableStreamToStringFunction()', () => {
  it('should create a function', () => {
    const fn = readableStreamToStringFunction('utf-8');
    expect(fn).toBeDefined();
  });

  describe('function', () => {
    it('should read a stream and return the content as a utf-8 string', async () => {
      const fn = readableStreamToStringFunction('utf-8');
      const result = await fn(makeReadableStream('hello'));
      expect(result).toBe('hello');
    });
  });
});

describe('readableStreamToBase64', () => {
  it('should read a stream and return the content as base64', async () => {
    const content = 'hello world';
    const result = await readableStreamToBase64(makeReadableStream(content));
    expect(result).toBe(Buffer.from(content).toString('base64'));
  });
});

describe('readableStreamToBuffer()', () => {
  it('should read a stream into a buffer', async () => {
    const content = 'test data';
    const result = await readableStreamToBuffer(makeReadableStream(content));
    expect(result).toBeInstanceOf(Buffer);
    expect(result.toString('utf-8')).toBe(content);
  });

  it('should handle an empty stream', async () => {
    const result = await readableStreamToBuffer(Readable.from([]));
    expect(result.length).toBe(0);
  });
});
