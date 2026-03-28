import { AssetLoader, localAsset, remoteAsset } from '@dereekb/rxjs';
import { firstValueFrom } from 'rxjs';
import { resolve } from 'path';
import { appAssetLoaderModuleMetadata } from './asset.nest';

/**
 * Base path pointing to the static test assets checked into the repo.
 */
const TEST_ASSETS_BASE_PATH = resolve(__dirname, '../../tests/assets');

describe('appAssetLoaderModuleMetadata()', () => {
  describe('module metadata structure', () => {
    it('should return metadata with providers and exports', () => {
      const metadata = appAssetLoaderModuleMetadata({
        local: { basePath: TEST_ASSETS_BASE_PATH }
      });

      expect(metadata.providers).toBeDefined();
      expect(metadata.exports).toBeDefined();
      expect(metadata.providers!.length).toBe(1);
      expect(metadata.exports).toContain(AssetLoader);
    });

    it('should provide AssetLoader as the injection token', () => {
      const metadata = appAssetLoaderModuleMetadata({
        local: { basePath: TEST_ASSETS_BASE_PATH }
      });

      const provider = metadata.providers![0] as any;
      expect(provider.provide).toBe(AssetLoader);
      expect(provider.useValue).toBeDefined();
    });
  });

  describe('local asset loading', () => {
    let loader: AssetLoader;

    beforeEach(() => {
      const metadata = appAssetLoaderModuleMetadata({
        local: { basePath: TEST_ASSETS_BASE_PATH }
      });

      loader = (metadata.providers![0] as any).useValue;
    });

    it('should load a local text asset from the filesystem', async () => {
      const ref = localAsset('test.txt');
      const instance = loader.get(ref);
      const buffer = await firstValueFrom(instance.load());
      const text = new TextDecoder().decode(buffer);
      expect(text.trim()).toBe('test');
    });

    it('should load a local JSON asset from the filesystem', async () => {
      const ref = localAsset('test.json');
      const instance = loader.get(ref);
      const buffer = await firstValueFrom(instance.load());
      const parsed = JSON.parse(new TextDecoder().decode(buffer));
      expect(parsed).toEqual({ hello: 'world' });
    });

    it('should return the correct ref from the instance', () => {
      const ref = localAsset('test.txt');
      const instance = loader.get(ref);
      expect(instance.ref()).toBe(ref);
    });

    it('should throw when loading a non-existent local asset', async () => {
      const ref = localAsset('does-not-exist.json');
      const instance = loader.get(ref);
      await expect(firstValueFrom(instance.load())).rejects.toThrow();
    });

    it('should produce a cold observable that loads on each subscription', async () => {
      const ref = localAsset('test.txt');
      const instance = loader.get(ref);

      const buffer1 = await firstValueFrom(instance.load());
      const buffer2 = await firstValueFrom(instance.load());

      expect(new TextDecoder().decode(buffer1).trim()).toBe('test');
      expect(new TextDecoder().decode(buffer2).trim()).toBe('test');
    });
  });

  describe('remote asset loading', () => {
    it('should use a custom fetch function for remote assets', async () => {
      const mockContent = new TextEncoder().encode('mock data');
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockContent.buffer.slice(mockContent.byteOffset, mockContent.byteOffset + mockContent.byteLength))
      });

      const metadata = appAssetLoaderModuleMetadata({
        local: { basePath: TEST_ASSETS_BASE_PATH },
        remote: { fetch: mockFetch as any }
      });

      const loader: AssetLoader = (metadata.providers![0] as any).useValue;
      const ref = remoteAsset('https://cdn.example.com/data.json');
      const instance = loader.get(ref);
      const buffer = await firstValueFrom(instance.load());

      expect(mockFetch).toHaveBeenCalledWith('https://cdn.example.com/data.json');
      expect(new TextDecoder().decode(buffer)).toBe('mock data');
    });

    it('should return the correct ref for remote assets', () => {
      const metadata = appAssetLoaderModuleMetadata({
        local: { basePath: TEST_ASSETS_BASE_PATH }
      });

      const loader: AssetLoader = (metadata.providers![0] as any).useValue;
      const ref = remoteAsset('https://cdn.example.com/data.json');
      const instance = loader.get(ref);
      expect(instance.ref()).toBe(ref);
    });

    it('should throw when the remote fetch fails', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      const metadata = appAssetLoaderModuleMetadata({
        local: { basePath: TEST_ASSETS_BASE_PATH },
        remote: { fetch: mockFetch as any }
      });

      const loader: AssetLoader = (metadata.providers![0] as any).useValue;
      const ref = remoteAsset('https://cdn.example.com/missing.json');
      const instance = loader.get(ref);

      await expect(firstValueFrom(instance.load())).rejects.toThrow('404');
    });
  });

  describe('delegation', () => {
    it('should route local refs to the filesystem loader and remote refs to the fetch loader', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
      });

      const metadata = appAssetLoaderModuleMetadata({
        local: { basePath: TEST_ASSETS_BASE_PATH },
        remote: { fetch: mockFetch as any }
      });

      const loader: AssetLoader = (metadata.providers![0] as any).useValue;

      // Local ref should load from filesystem (not call fetch)
      const localRef = localAsset('test.txt');
      const localBuffer = await firstValueFrom(loader.get(localRef).load());
      expect(new TextDecoder().decode(localBuffer).trim()).toBe('test');
      expect(mockFetch).not.toHaveBeenCalled();

      // Remote ref should call fetch (not filesystem)
      const remoteRef = remoteAsset('https://cdn.example.com/data.json');
      await firstValueFrom(loader.get(remoteRef).load());
      expect(mockFetch).toHaveBeenCalledWith('https://cdn.example.com/data.json');
    });
  });
});
