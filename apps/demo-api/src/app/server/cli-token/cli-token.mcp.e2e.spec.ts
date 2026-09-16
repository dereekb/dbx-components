import request from 'supertest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { CLI_TOKEN_OIDC_SCOPE, SERVICE_TOKEN_OIDC_SCOPE, type CreateOidcClientParams } from '@dereekb/firebase';
import { DOWNLOAD_API_ASSET_QUERY_PARAM } from '@dereekb/firebase-server';
import { CLI_TOKEN_CLAIM_INVALID_ERROR_CODE, FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH, MAX_CLI_TOKEN_TTL_SECONDS, OidcClientService, type CliTokenHandoffBundle } from '@dereekb/firebase-server/oidc';
import { CLI_TOKEN_TOOL_NAME, type CliTokenToolOutput } from '@dereekb/firebase-server/mcp';
import { DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY } from '../../api/oidc/oidc.module';
import { DEMO_CLI_NAME, DEMO_CLI_SECURE_ASSET_PATH } from '../mcp/mcp.module';
import { DEMO_SECURE_ASSETS_ROOT } from '../download/download.module';
import { type DemoApiFunctionContextFixture, demoApiFunctionContextFactory, demoAuthorizedUserAdminContext, demoAuthorizedUserContext } from '../../../test/fixture';
import { callMcpTool, listMcpTools } from '../../../test/mcp';
import { binaryParser } from '../../../test/http';

vi.setConfig({ hookTimeout: 40000, testTimeout: 40000 });

/**
 * The scope string a caller of the `cli-token` tool carries. Spelled out rather than derived: the
 * mint grants the caller's OWN scopes minus the deny-list, so this set is also the expected output.
 */
const CALLER_SCOPES = `openid profile email demo offline_access model.read model.query ${CLI_TOKEN_OIDC_SCOPE}`;

/** Stand-in for the real `demo-cli` artifact, written only when a build has not already produced one. */
const CLI_ARTIFACT_CONTENT = '#!/usr/bin/env node\n// demo-cli stand-in for the MCP handoff e2e\n';

/**
 * Coverage for the CLI handoff as an MCP client actually experiences it — through demo-api's
 * `demo-api-mcp` surface rather than through `POST /oidc/cli-token` directly.
 *
 * `cli-token.api.e2e.spec.ts` proves the mint endpoint's own gates and algebra. What only this spec
 * reaches is everything demo-api wires AROUND that endpoint, none of which the HTTP path touches:
 *
 * - `MCP_CLI_TOKEN_MINTER` is provided at all, so the tool is registered on the server (it is not
 *   when an app wires no minter).
 * - The tool's THREE gates compose the way they are meant to — the `token.cli` scope filter and the
 *   `admin` role rule hide it from `tools/list` independently, before the mint's own predicate ever
 *   runs.
 * - `demoMcpCliTokenMinterFactory` decorates the mint with `cliName` and a signed download URL, so
 *   the rendered `handoffCommand` names the real binary.
 * - The whole unattended loop closes: the `downloadUrl` the tool returns really serves the artifact
 *   through `GET /api/download`, and the `claimCode` it returns really redeems at
 *   `POST /oidc/cli-token/claim` — the two halves an agent runs back to back.
 */
demoApiFunctionContextFactory((f: DemoApiFunctionContextFixture) => {
  describe('cli-token MCP tool', () => {
    const cliArtifactPath = path.join(DEMO_SECURE_ASSETS_ROOT, DEMO_CLI_SECURE_ASSET_PATH);
    let wroteCliArtifact = false;

    // Written BEFORE the fixture builds its instance: `DemoDownloadApiModule`'s config factory only
    // supplies `secureAssetsRoot` when the directory exists, and that factory runs while the Nest
    // graph is built in the fixture's own beforeEach. A real `copy-cli-artifact` output is left
    // alone — this only stands in for it when the dist has none.
    beforeAll(() => {
      mkdirSync(DEMO_SECURE_ASSETS_ROOT, { recursive: true });

      if (!existsSync(cliArtifactPath)) {
        writeFileSync(cliArtifactPath, CLI_ARTIFACT_CONTENT);
        wroteCliArtifact = true;
      }
    });

    afterAll(() => {
      if (wroteCliArtifact) {
        rmSync(cliArtifactPath, { force: true });
      }
    });

    describe('admin caller holding the token.cli scope', () => {
      demoAuthorizedUserAdminContext({ f }, (u) => {
        let previousClientId: string | undefined;

        // PER TEST, not beforeAll: the fixture builds its Nest application (and the emulator's
        // Firestore state) in its own beforeEach, so there is no provider to register a client
        // against until after that has run — and the client would not survive into the next test.
        beforeEach(async () => {
          const app = await f.loadInitializedNestApplication();
          const created = await app.get(OidcClientService).createClient({
            client_name: 'demo-cli (mcp e2e)',
            redirect_uris: ['http://127.0.0.1:0/callback'],
            token_endpoint_auth_method: 'none'
          } as CreateOidcClientParams);

          previousClientId = process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY];
          process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY] = created.client_id;
        });

        afterEach(() => {
          if (previousClientId == null) {
            delete process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY];
          } else {
            process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY] = previousClientId;
          }
        });

        async function mintThroughMcp(args: Record<string, unknown> = {}): Promise<CliTokenToolOutput> {
          const result = await callMcpTool({ f, u, name: CLI_TOKEN_TOOL_NAME, args, scopes: CALLER_SCOPES });
          expect(result.isError).toBeUndefined();
          return result.structuredContent as unknown as CliTokenToolOutput;
        }

        describe('tools/list', () => {
          it('advertises cli-token as a WRITE tool carrying the injected reason parameter', async () => {
            const tool = (await listMcpTools(f, u, CALLER_SCOPES)).find((t) => t.name === CLI_TOKEN_TOOL_NAME);

            expect(tool).toBeDefined();
            // minting a credential is not a read — the annotation is what stops a read-only client offering it
            expect(tool!.annotations?.readOnlyHint).not.toBe(true);

            const inputSchema = tool!.inputSchema as { readonly properties?: Record<string, unknown>; readonly required?: readonly string[] };
            expect(inputSchema.properties).toHaveProperty('scopes');
            // the per-tool reason parameter is injected into the wire schema of STATIC tools too
            expect(inputSchema.required).toContain('reason');
          });

          it('HIDES cli-token from the same admin when the session never carried token.cli', async () => {
            const scopes = CALLER_SCOPES.replace(` ${CLI_TOKEN_OIDC_SCOPE}`, '');
            const names = (await listMcpTools(f, u, scopes)).map((t) => t.name);

            // the scope filter, not the role rule — this caller IS an admin
            expect(names).not.toContain(CLI_TOKEN_TOOL_NAME);
            expect(names.length).toBeGreaterThan(0);
          });
        });

        describe('tools/call', () => {
          it('returns a claim code and a runnable handoff command, never the refresh token', async () => {
            const output = await mintThroughMcp();

            expect(typeof output.claimCode).toBe('string');
            expect(output.claimCode.length).toBeGreaterThan(20);
            expect(output.cliName).toBe(DEMO_CLI_NAME);
            expect(output.handoffCommand).toBe(`${DEMO_CLI_NAME} auth handoff ${output.claimCode}`);
            expect(new Date(output.claimExpiresAt).getTime()).toBeGreaterThan(Date.now());
            // the tool's output reaches an MCP transcript — a refresh token must not
            expect(JSON.stringify(output)).not.toContain('refreshToken');
          });

          it('grants the caller’s own scopes minus the deny-list, capped at one hour', async () => {
            const output = await mintThroughMcp({ ttlSeconds: 60 * 60 * 24 * 30 });
            const granted = new Set(output.scope.split(' '));
            const lifetimeSeconds = (new Date(output.expiresAt).getTime() - Date.now()) / 1000;

            expect(granted.has('model.read')).toBe(true);
            expect(granted.has('offline_access')).toBe(true);
            // no chaining, no escalation
            expect(granted.has(CLI_TOKEN_OIDC_SCOPE)).toBe(false);
            expect(granted.has(SERVICE_TOKEN_OIDC_SCOPE)).toBe(false);
            expect(lifetimeSeconds).toBeLessThanOrEqual(MAX_CLI_TOKEN_TTL_SECONDS + 5);
          });

          it('narrows to a requested subset passed as tool arguments', async () => {
            const granted = new Set((await mintThroughMcp({ scopes: ['model.read', 'model.delete'] })).scope.split(' '));

            expect(granted.has('model.read')).toBe(true);
            // requested through the tool, but the calling session never held it
            expect(granted.has('model.delete')).toBe(false);
            expect(granted.has('model.query')).toBe(false);
          });

          it('omits the download URL when the agent opts out with includeDownloadUrl:false', async () => {
            const output = await mintThroughMcp({ includeDownloadUrl: false });

            expect(output.downloadUrl).toBeUndefined();
            expect(output.downloadSha256).toBeUndefined();
            // the credential half still works — the download is the optional half
            expect(output.claimCode.length).toBeGreaterThan(20);
          });

          it('closes the whole unattended loop: download the CLI, then redeem the code', async () => {
            const app = await f.loadInitializedNestApplication();
            const output = await mintThroughMcp();

            // ---- step 1: the tool's downloadUrl really serves the artifact, with no credential ----
            expect(output.downloadUrl).toBeDefined();
            expect(output.downloadSha256).toMatch(/^[0-9a-f]{64}$/);

            const downloadUrl = new URL(output.downloadUrl!);
            expect(downloadUrl.pathname).toBe('/api/download');
            expect(downloadUrl.searchParams.get(DOWNLOAD_API_ASSET_QUERY_PARAM)).toBeTruthy();

            // No Authorization header anywhere — the signed `asset` param IS the credential, which is
            // the point: the machine fetching this has none yet.
            const downloaded = await request(app.getHttpServer()).get(`${downloadUrl.pathname}${downloadUrl.search}`).buffer(true).parse(binaryParser).expect(200);

            expect(downloaded.headers['content-disposition']).toBe(`attachment; filename="${DEMO_CLI_NAME}"`);
            expect((downloaded.body as Buffer).length).toBeGreaterThan(0);

            // ---- step 2: the claim code the SAME tool call returned redeems, exactly once ----
            const claimed = await request(app.getHttpServer()).post(FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH).send({ code: output.claimCode }).expect(201);
            const bundle = claimed.body as CliTokenHandoffBundle;

            expect(bundle.uid).toBe(u.uid);
            expect(bundle.clientId).toBe(process.env[DEMO_CLI_OIDC_CLIENT_ID_ENV_KEY]);
            expect(bundle.scope).toBe(output.scope);
            expect(bundle.refreshToken.length).toBeGreaterThan(0);

            const replayed = await request(app.getHttpServer()).post(FIREBASE_SERVER_CLI_TOKEN_CLAIM_PATH).send({ code: output.claimCode }).expect(404);
            expect(replayed.body.code).toBe(CLI_TOKEN_CLAIM_INVALID_ERROR_CODE);
          });
        });
      });
    });

    describe('non-admin caller', () => {
      demoAuthorizedUserContext({ f }, (u) => {
        it('never sees cli-token, even holding the token.cli scope', async () => {
          // The role rule is a SECOND, independent gate: this caller's scopes would satisfy the
          // filter, so a regression that dropped `requiredRoles` would surface here and nowhere else.
          const names = (await listMcpTools(f, u, CALLER_SCOPES)).map((t) => t.name);
          expect(names).not.toContain(CLI_TOKEN_TOOL_NAME);
        });

        it('cannot call cli-token by name — it is not in this caller’s dispatch map at all', async () => {
          const result = await callMcpTool({ f, u, name: CLI_TOKEN_TOOL_NAME, args: {}, scopes: CALLER_SCOPES });

          // the filter builds the per-request dispatch map, so a hidden tool is genuinely UNKNOWN
          // here rather than reaching the minter and being refused by its admin predicate
          expect(result.isError).toBe(true);
          expect(JSON.stringify(result.content)).toContain('Unknown tool');
        });
      });
    });
  });
});
