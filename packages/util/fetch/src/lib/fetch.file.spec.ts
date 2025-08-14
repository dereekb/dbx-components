import { parseFetchFileResponse } from './fetch.file';

describe('parseFetchFileResponse', () => {
  it('should parse an image file response', async () => {
    const fetchFileResult = await fetch('https://github.com/dereekb/dbx-components/blob/develop/apps/demo/src/assets/brand/icon.png?raw=true');

    const result = parseFetchFileResponse(fetchFileResult);

    expect(result.response).toBe(fetchFileResult);
    expect(result.mimeType).toBe('image/png');

    const buffer = await result.response.arrayBuffer();
    expect(buffer).toBeDefined();
  });

  it('should parse a text file response', async () => {
    const fetchFileResult = await fetch('https://raw.githubusercontent.com/dereekb/dbx-components/refs/heads/develop/tsconfig.base.json');

    const result = parseFetchFileResponse(fetchFileResult);

    expect(result.response).toBe(fetchFileResult);
    expect(result.mimeType).toBe('text/plain');

    const textResult = await result.response.text();
    expect(textResult).toBeDefined();
    expect(textResult).not.toBe('');
  });
});
