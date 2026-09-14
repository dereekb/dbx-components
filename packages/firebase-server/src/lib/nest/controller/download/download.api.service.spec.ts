import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { DOWNLOAD_TOKEN_AUDIENCE, DOWNLOAD_TOKEN_PATH_CLAIM, DOWNLOAD_TOKEN_TYP, type DownloadApiModuleConfig, type DownloadTokenSignInput, type DownloadTokenSigner, type DownloadTokenVerifyInput } from './download.api.config';
import { DOWNLOAD_ASSET_NOT_FOUND_ERROR_CODE, DOWNLOAD_ASSET_NOT_MINTABLE_ERROR_CODE, DOWNLOAD_INVALID_TOKEN_ERROR_CODE, DownloadApiService } from './download.api.service';

const API_BASE_URL = 'https://api.example.com/api';

/**
 * A stand-in signer that round-trips claims through a JSON envelope while enforcing the SAME
 * `typ` + `aud` discrimination the real (JWKS-backed) signer does — so these tests exercise the
 * service's containment and error mapping without needing a key pair.
 */
function fakeSigner(): DownloadTokenSigner {
  return {
    async signToken(input: DownloadTokenSignInput) {
      const expiresAt = new Date(Date.now() + input.expiresIn * 1000);
      return { token: Buffer.from(JSON.stringify({ ...input.claims, aud: input.audience, typ: input.typ, exp: expiresAt.getTime(), jti: 'test-jti' })).toString('base64url'), expiresAt };
    },
    async verifyToken(input: DownloadTokenVerifyInput): Promise<Maybe<Record<string, unknown>>> {
      let result: Maybe<Record<string, unknown>>;

      try {
        const decoded = JSON.parse(Buffer.from(input.token, 'base64url').toString('utf8')) as Record<string, unknown>;

        if (decoded['aud'] === input.audience && decoded['typ'] === input.typ && (decoded['exp'] as number) > Date.now()) {
          result = decoded;
        }
      } catch {
        result = undefined;
      }

      return result;
    }
  };
}

function buildFixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'dbx-download-svc-'));
  const secureRoot = path.join(root, 'secure');
  const outside = path.join(root, 'outside');

  mkdirSync(secureRoot, { recursive: true });
  mkdirSync(outside, { recursive: true });
  writeFileSync(path.join(secureRoot, 'demo-cli'), 'the-binary-bytes');
  writeFileSync(path.join(outside, 'secret.txt'), 'secret');
  symlinkSync(path.join(outside, 'secret.txt'), path.join(secureRoot, 'escape'));

  return { secureRoot, outside };
}

function buildService(config: Partial<DownloadApiModuleConfig>, signer?: DownloadTokenSigner): DownloadApiService {
  return new DownloadApiService({ apiBaseUrl: API_BASE_URL, ...config } as DownloadApiModuleConfig, signer);
}

/**
 * Signs a token for `assetPath` without going through the mint's containment check, so the
 * DOWNLOAD side's independent re-check can be exercised on its own. That is the whole reason the
 * check runs twice: a bug on the minting side must not become an arbitrary-file-read primitive.
 */
async function forgeTokenFor(signer: DownloadTokenSigner, assetPath: string): Promise<string> {
  const signed = await signer.signToken({ claims: { [DOWNLOAD_TOKEN_PATH_CLAIM]: assetPath }, audience: DOWNLOAD_TOKEN_AUDIENCE, subject: 'dbx:asset', typ: DOWNLOAD_TOKEN_TYP, expiresIn: 600 });
  return signed.token;
}

describe('DownloadApiService', () => {
  const { secureRoot, outside } = buildFixture();

  describe('downloadUrlForAsset()', () => {
    it('mints an absolute URL plus the artifact’s sha256 and size', async () => {
      const service = buildService({ secureAssetsRoot: secureRoot }, fakeSigner());
      const result = await service.downloadUrlForAsset({ path: 'demo-cli' });

      expect(result.url.startsWith(`${API_BASE_URL}/download?asset=`)).toBe(true);
      expect(result.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.size).toBe('the-binary-bytes'.length);
      expect(new Date(result.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('REFUSES TO SIGN for anything outside the secure root', async () => {
      // a leaked minting call must not become a leak of the filesystem
      const service = buildService({ secureAssetsRoot: secureRoot }, fakeSigner());

      await expect(service.downloadUrlForAsset({ path: '../outside/secret.txt' })).rejects.toMatchObject({ details: { code: DOWNLOAD_ASSET_NOT_MINTABLE_ERROR_CODE } });
      await expect(service.downloadUrlForAsset({ path: path.join(outside, 'secret.txt') })).rejects.toMatchObject({ details: { code: DOWNLOAD_ASSET_NOT_MINTABLE_ERROR_CODE } });
      await expect(service.downloadUrlForAsset({ path: 'escape' })).rejects.toMatchObject({ details: { code: DOWNLOAD_ASSET_NOT_MINTABLE_ERROR_CODE } });
    });

    it('is disabled without a signer or without a secure root', async () => {
      await expect(buildService({ secureAssetsRoot: secureRoot }).downloadUrlForAsset({ path: 'demo-cli' })).rejects.toMatchObject({ details: { code: DOWNLOAD_ASSET_NOT_MINTABLE_ERROR_CODE } });
      await expect(buildService({}, fakeSigner()).downloadUrlForAsset({ path: 'demo-cli' })).rejects.toMatchObject({ details: { code: DOWNLOAD_ASSET_NOT_MINTABLE_ERROR_CODE } });
      expect(buildService({ secureAssetsRoot: secureRoot }).enabled).toBe(false);
      expect(buildService({ secureAssetsRoot: secureRoot }, fakeSigner()).enabled).toBe(true);
    });
  });

  describe('resolveDownloadRequest()', () => {
    it('serves a contained asset', async () => {
      const service = buildService({ secureAssetsRoot: secureRoot }, fakeSigner());
      const { url } = await service.downloadUrlForAsset({ path: 'demo-cli' });
      const token = decodeURIComponent(new URL(url).searchParams.get('asset') as string);

      const resolved = await service.resolveDownloadRequest(token);

      expect(resolved.fileName).toBe('demo-cli');
      expect(resolved.size).toBe('the-binary-bytes'.length);
      expect(readFileSync(resolved.absolutePath, 'utf8')).toBe('the-binary-bytes');
    });

    it('RE-RUNS containment on a validly-signed token naming an outside path', async () => {
      const signer = fakeSigner();
      const service = buildService({ secureAssetsRoot: secureRoot }, signer);

      for (const assetPath of ['../outside/secret.txt', path.join(outside, 'secret.txt'), 'escape', 'demo\0cli', '']) {
        const token = await forgeTokenFor(signer, assetPath);
        await expect(service.resolveDownloadRequest(token)).rejects.toMatchObject({ details: { code: DOWNLOAD_ASSET_NOT_FOUND_ERROR_CODE } });
      }
    });

    it('rejects a missing, malformed, or tampered token as unauthenticated', async () => {
      const service = buildService({ secureAssetsRoot: secureRoot }, fakeSigner());

      await expect(service.resolveDownloadRequest(undefined)).rejects.toMatchObject({ details: { code: DOWNLOAD_INVALID_TOKEN_ERROR_CODE } });
      await expect(service.resolveDownloadRequest('')).rejects.toMatchObject({ details: { code: DOWNLOAD_INVALID_TOKEN_ERROR_CODE } });
      await expect(service.resolveDownloadRequest('not-a-token')).rejects.toMatchObject({ details: { code: DOWNLOAD_INVALID_TOKEN_ERROR_CODE } });
    });

    it('rejects a token carrying the wrong typ or audience', async () => {
      const signer = fakeSigner();
      const service = buildService({ secureAssetsRoot: secureRoot }, signer);

      const wrongTyp = await signer.signToken({ claims: { [DOWNLOAD_TOKEN_PATH_CLAIM]: 'demo-cli' }, audience: DOWNLOAD_TOKEN_AUDIENCE, subject: 'dbx:asset', typ: 'at+jwt', expiresIn: 600 });
      const wrongAud = await signer.signToken({ claims: { [DOWNLOAD_TOKEN_PATH_CLAIM]: 'demo-cli' }, audience: 'https://api.example.com/mcp', subject: 'dbx:asset', typ: DOWNLOAD_TOKEN_TYP, expiresIn: 600 });

      await expect(service.resolveDownloadRequest(wrongTyp.token)).rejects.toMatchObject({ details: { code: DOWNLOAD_INVALID_TOKEN_ERROR_CODE } });
      await expect(service.resolveDownloadRequest(wrongAud.token)).rejects.toMatchObject({ details: { code: DOWNLOAD_INVALID_TOKEN_ERROR_CODE } });
    });

    it('rejects an expired token', async () => {
      const signer = fakeSigner();
      const service = buildService({ secureAssetsRoot: secureRoot }, signer);
      const expired = await signer.signToken({ claims: { [DOWNLOAD_TOKEN_PATH_CLAIM]: 'demo-cli' }, audience: DOWNLOAD_TOKEN_AUDIENCE, subject: 'dbx:asset', typ: DOWNLOAD_TOKEN_TYP, expiresIn: -60 });

      await expect(service.resolveDownloadRequest(expired.token)).rejects.toMatchObject({ details: { code: DOWNLOAD_INVALID_TOKEN_ERROR_CODE } });
    });

    it('fails CLOSED when unconfigured — an absent root or signer serves nothing', async () => {
      const signer = fakeSigner();
      const token = await forgeTokenFor(signer, 'demo-cli');

      await expect(buildService({}, signer).resolveDownloadRequest(token)).rejects.toMatchObject({ details: { code: DOWNLOAD_ASSET_NOT_FOUND_ERROR_CODE } });
      await expect(buildService({ secureAssetsRoot: secureRoot }).resolveDownloadRequest(token)).rejects.toMatchObject({ details: { code: DOWNLOAD_ASSET_NOT_FOUND_ERROR_CODE } });
      await expect(buildService({ secureAssetsRoot: path.join(secureRoot, 'nope') }, signer).resolveDownloadRequest(token)).rejects.toMatchObject({ details: { code: DOWNLOAD_ASSET_NOT_FOUND_ERROR_CODE } });
    });
  });
});
