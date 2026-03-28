import { localAsset, remoteAsset, assetFolder, remoteAssetBaseUrl } from './asset.builder';

describe('localAsset()', () => {
  it('should create a local ref with the given path', () => {
    const ref = localAsset('data/school-districts.json');
    expect(ref.sourceType).toBe('local');
    expect(ref.path).toBe('data/school-districts.json');
  });

  it('should preserve the path as-is without modification', () => {
    const ref = localAsset('nested/deep/folder/file.txt');
    expect(ref.path).toBe('nested/deep/folder/file.txt');
  });
});

describe('remoteAsset()', () => {
  it('should create a remote ref for a valid https:// URL', () => {
    const ref = remoteAsset('https://cdn.example.com/geo.json');
    expect(ref.sourceType).toBe('remote');
    expect(ref.url).toBe('https://cdn.example.com/geo.json');
  });

  it('should create a remote ref for a valid http:// URL', () => {
    const ref = remoteAsset('http://cdn.example.com/geo.json');
    expect(ref.sourceType).toBe('remote');
    expect(ref.url).toBe('http://cdn.example.com/geo.json');
  });

  it('should preserve query parameters in the URL', () => {
    const url = 'https://cdn.example.com/data.json?token=abc&v=2';
    const ref = remoteAsset(url);
    expect(ref.url).toBe(url);
  });

  it('should preserve multiple query parameters', () => {
    const url = 'https://cdn.example.com/data.json?key=val1&key2=val2&flag=true';
    const ref = remoteAsset(url);
    expect(ref.url).toBe(url);
  });

  it('should preserve URL with a port number', () => {
    const url = 'https://cdn.example.com:8080/data.json';
    const ref = remoteAsset(url);
    expect(ref.url).toBe(url);
  });

  it('should preserve URL with a port number and query parameters', () => {
    const url = 'https://cdn.example.com:8080/data.json?token=abc';
    const ref = remoteAsset(url);
    expect(ref.url).toBe(url);
  });

  it('should preserve URL with a fragment', () => {
    const url = 'https://cdn.example.com/data.json#section';
    const ref = remoteAsset(url);
    expect(ref.url).toBe(url);
  });

  it('should throw for a relative path without a prefix', () => {
    expect(() => remoteAsset('data/geo.json' as any)).toThrow();
  });

  it('should throw for a domain without an http/https prefix', () => {
    expect(() => remoteAsset('cdn.example.com/data.json' as any)).toThrow();
  });

  it('should throw for an empty string', () => {
    expect(() => remoteAsset('' as any)).toThrow();
  });
});

describe('assetFolder()', () => {
  it('should prepend the folder to the filename via .asset()', () => {
    const builder = assetFolder('data');
    const ref = builder.asset('school-districts.json');
    expect(ref.sourceType).toBe('local');
    expect(ref.path).toBe('data/school-districts.json');
  });

  it('should work with nested child paths via .asset()', () => {
    const builder = assetFolder('assets');
    const ref = builder.asset('nested/deep/file.txt');
    expect(ref.path).toBe('assets/nested/deep/file.txt');
  });

  it('should create refs for all files via .assets()', () => {
    const builder = assetFolder('data');
    const refs = builder.assets(['a.txt', 'b.txt', 'c.json']);
    expect(refs).toHaveLength(3);
    expect(refs[0].path).toBe('data/a.txt');
    expect(refs[1].path).toBe('data/b.txt');
    expect(refs[2].path).toBe('data/c.json');
  });

  it('should normalize a folder without a trailing slash', () => {
    const builder = assetFolder('data');
    const ref = builder.asset('file.txt');
    expect(ref.path).toBe('data/file.txt');
  });

  it('should not double-slash a folder already ending with /', () => {
    const builder = assetFolder('data/');
    const ref = builder.asset('file.txt');
    expect(ref.path).toBe('data/file.txt');
  });

  it('should work with nested folder paths', () => {
    const builder = assetFolder('assets/data/v2');
    const ref = builder.asset('districts.json');
    expect(ref.path).toBe('assets/data/v2/districts.json');
  });

  it('should work with a relative "assets/" folder path', () => {
    const builder = assetFolder('assets/');
    const ref = builder.asset('data.json');
    expect(ref.path).toBe('assets/data.json');
  });

  it('should work with an absolute "/assets/" folder path', () => {
    const builder = assetFolder('/assets/');
    const ref = builder.asset('data.json');
    expect(ref.path).toBe('/assets/data.json');
  });

  it('should normalize an absolute "/assets" path without trailing slash', () => {
    const builder = assetFolder('/assets');
    const ref = builder.asset('data.json');
    expect(ref.path).toBe('/assets/data.json');
  });

  it('should generate correct paths for .assets() with an absolute folder', () => {
    const builder = assetFolder('/assets/');
    const refs = builder.assets(['a.json', 'b.json']);
    expect(refs[0].path).toBe('/assets/a.json');
    expect(refs[1].path).toBe('/assets/b.json');
  });
});

describe('remoteAssetBaseUrl()', () => {
  it('should produce a correct absolute URL from a relative path via .asset()', () => {
    const builder = remoteAssetBaseUrl('https://cdn.example.com/assets');
    const ref = builder.asset('data/geo.json');
    expect(ref.sourceType).toBe('remote');
    expect(ref.url).toBe('https://cdn.example.com/assets/data/geo.json');
  });

  it('should preserve query parameters on the child path', () => {
    const builder = remoteAssetBaseUrl('https://cdn.example.com/assets');
    const ref = builder.asset('data.json?token=abc&v=2');
    expect(ref.url).toContain('token=abc');
    expect(ref.url).toContain('v=2');
  });

  it('should produce correct URLs when base URL has a trailing slash', () => {
    const builder = remoteAssetBaseUrl('https://cdn.example.com/assets/');
    const ref = builder.asset('data/geo.json');
    expect(ref.sourceType).toBe('remote');
    expect(ref.url).toBe('https://cdn.example.com/assets/data/geo.json');
  });

  it('should not double-slash when base URL already ends with /', () => {
    const builder = remoteAssetBaseUrl('https://cdn.example.com/assets/');
    const ref = builder.asset('file.json');
    expect(ref.url).toBe('https://cdn.example.com/assets/file.json');
    expect(ref.url).not.toContain('//file');
  });

  it('should normalize base URL without trailing slash', () => {
    const builder = remoteAssetBaseUrl('https://cdn.example.com/assets');
    const ref = builder.asset('file.json');
    expect(ref.url).toBe('https://cdn.example.com/assets/file.json');
  });

  it('should create refs for all paths via .assets()', () => {
    const builder = remoteAssetBaseUrl('https://cdn.example.com/assets/');
    const refs = builder.assets(['a.json', 'b.json']);
    expect(refs).toHaveLength(2);
    expect(refs[0].url).toBe('https://cdn.example.com/assets/a.json');
    expect(refs[1].url).toBe('https://cdn.example.com/assets/b.json');
  });

  it('should work with base URL that has a port number', () => {
    const builder = remoteAssetBaseUrl('https://cdn.example.com:8080/assets/');
    const ref = builder.asset('data.json');
    expect(ref.url).toBe('https://cdn.example.com:8080/assets/data.json');
  });

  it('should preserve query parameters on child paths with port numbers', () => {
    const builder = remoteAssetBaseUrl('https://cdn.example.com:8080/assets/');
    const ref = builder.asset('data.json?key=value');
    expect(ref.url).toContain('data.json?key=value');
  });

  it('should throw for a base URL without an http/https prefix', () => {
    expect(() => remoteAssetBaseUrl('cdn.example.com/assets' as any)).toThrow();
  });

  it('should throw for a relative path as base URL', () => {
    expect(() => remoteAssetBaseUrl('assets/data' as any)).toThrow();
  });
});
