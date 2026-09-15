import request from 'supertest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { DEFAULT_DOWNLOAD_CONTENT_TYPE, DOWNLOAD_API_ASSET_QUERY_PARAM, DOWNLOAD_INVALID_TOKEN_ERROR_CODE, DOWNLOAD_TOKEN_PATH_CLAIM, DownloadApiService } from '@dereekb/firebase-server';
import { DEMO_SECURE_ASSETS_ROOT } from './download.module';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory } from '../../../test/fixture';
import { binaryParser } from '../../../test/http';

vi.setConfig({ hookTimeout: 40000, testTimeout: 40000 });

// Extensionless on purpose: that is the shape of the artifact this path actually ships (`demo-cli`),
// so the fixture exercises the octet-stream default rather than a mapped text type.
const FIXTURE_ASSET_NAME = 'download-e2e-fixture';
const FIXTURE_ASSET_CONTENT = 'demo-api signed asset download e2e fixture\n';
const FIXTURE_ASSET_SHA256 = createHash('sha256').update(FIXTURE_ASSET_CONTENT).digest('hex');

/**
 * Coverage for the signed asset-download path as wired into demo-api: `GET /api/download?asset=<token>`.
 *
 * This is the half the unit specs structurally cannot reach. `download.api.service.spec.ts` proves
 * containment and token discrimination against the service directly; what only an e2e run proves is
 * the WIRING — that the route is reachable at the global `/api` prefix, that it is NOT swallowed by
 * the OIDC bearer middleware (it is deliberately absent from `protectedPaths`, and a regression there
 * would 401 exactly the bare machine the feature exists for), and that the bytes and
 * `Content-Disposition` survive the stream.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('signed asset download', () => {
    const fixtureAssetPath = path.join(DEMO_SECURE_ASSETS_ROOT, FIXTURE_ASSET_NAME);

    // Written BEFORE the context fixture builds its instance: `DemoDownloadApiModule`'s config
    // factory only supplies `secureAssetsRoot` when the directory exists, and that factory runs
    // while the Nest graph is built in the fixture's own beforeEach.
    beforeAll(() => {
      mkdirSync(DEMO_SECURE_ASSETS_ROOT, { recursive: true });
      writeFileSync(fixtureAssetPath, FIXTURE_ASSET_CONTENT);
    });

    afterAll(() => {
      rmSync(fixtureAssetPath, { force: true });
    });

    /**
     * Mints a download URL through the service the MCP tool uses, and reduces it to the
     * path + query supertest drives (the minted URL is absolute, rooted at the app's API base URL).
     */
    async function mintAssetRequestPath(assetPath: string): Promise<{ readonly requestPath: string; readonly sha256: string; readonly size: number }> {
      const app = await f.loadInitializedNestApplication();
      const minted = await app.get(DownloadApiService).downloadUrlForAsset({ path: assetPath });
      const url = new URL(minted.url);

      return { requestPath: `${url.pathname}${url.search}`, sha256: minted.sha256, size: minted.size };
    }

    it('serves the asset unauthenticated, with its bytes, size and Content-Disposition intact', async () => {
      const app = await f.loadInitializedNestApplication();
      const { requestPath, sha256, size } = await mintAssetRequestPath(FIXTURE_ASSET_NAME);

      // No Authorization header anywhere in this request — the signed `asset` param IS the credential.
      const res = await request(app.getHttpServer()).get(requestPath).buffer(true).parse(binaryParser).expect(200);

      expect(sha256).toBe(FIXTURE_ASSET_SHA256);
      expect(size).toBe(Buffer.byteLength(FIXTURE_ASSET_CONTENT));
      expect(res.headers['content-type']).toBe(DEFAULT_DOWNLOAD_CONTENT_TYPE);
      expect(res.headers['content-length']).toBe(String(Buffer.byteLength(FIXTURE_ASSET_CONTENT)));
      expect(res.headers['content-disposition']).toBe(`attachment; filename="${FIXTURE_ASSET_NAME}"`);
      // a capability URL's response is nobody's to cache
      expect(res.headers['cache-control']).toBe('private, no-store');
      expect((res.body as Buffer).toString('utf-8')).toBe(FIXTURE_ASSET_CONTENT);
    });

    it('rejects a token whose PATH CLAIM was rewritten but signature kept', async () => {
      const app = await f.loadInitializedNestApplication();
      const { requestPath } = await mintAssetRequestPath(FIXTURE_ASSET_NAME);
      const url = new URL(requestPath, 'http://localhost');
      const token = url.searchParams.get(DOWNLOAD_API_ASSET_QUERY_PARAM)!;

      // The attack this endpoint exists to survive: re-point a legitimately minted capability at
      // another file while reusing its signature. Rewriting the CLAIM (rather than flipping a
      // character of the signature, where base64url's unused trailing bits can decode unchanged)
      // is what makes this an unambiguous forgery.
      const [header, payload, signature] = token.split('.');
      const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
      const forgedPayload = Buffer.from(JSON.stringify({ ...claims, [DOWNLOAD_TOKEN_PATH_CLAIM]: '../../../etc/passwd' })).toString('base64url');
      const tampered = `${header}.${forgedPayload}.${signature}`;

      const res = await request(app.getHttpServer())
        .get(`${url.pathname}?${DOWNLOAD_API_ASSET_QUERY_PARAM}=${encodeURIComponent(tampered)}`)
        .expect(401);

      expect(res.body.code).toBe(DOWNLOAD_INVALID_TOKEN_ERROR_CODE);
      // the token is never echoed back — an error body carrying it would put a live capability in logs
      expect(JSON.stringify(res.body)).not.toContain(tampered);
    });

    it('rejects a MISSING token rather than serving anything', async () => {
      const app = await f.loadInitializedNestApplication();
      const { requestPath } = await mintAssetRequestPath(FIXTURE_ASSET_NAME);
      const { pathname } = new URL(requestPath, 'http://localhost');

      const res = await request(app.getHttpServer()).get(pathname).expect(401);
      expect(res.body.code).toBe(DOWNLOAD_INVALID_TOKEN_ERROR_CODE);
    });

    it('REFUSES TO SIGN for a path outside the secure root', async () => {
      const app = await f.loadInitializedNestApplication();
      const service = app.get(DownloadApiService);

      await expect(service.downloadUrlForAsset({ path: '../../../etc/passwd' })).rejects.toBeDefined();
      await expect(service.downloadUrlForAsset({ path: '/etc/passwd' })).rejects.toBeDefined();
    });
  });
});
