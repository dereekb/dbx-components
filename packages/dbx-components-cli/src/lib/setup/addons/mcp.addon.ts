/**
 * The `mcp` add-on — layers MCP server infrastructure on top of the `oidc`
 * add-on: the `server/model` + `server/mcp` modules, the @Global MCP analytics
 * module, the `/mcp` route exclusions + hosting/proxy rewrites, and the
 * `appMcpUrl` env field. It also re-renders the OIDC module with
 * `configureMcpResourceServer: true` + `/mcp` in `protectedPaths` so the OIDC
 * provider advertises the MCP resource server.
 *
 * Depends on `oidc` (enforced by the command layer). Ported from advisorey aa8436f.
 */

import { join } from 'node:path';
import { applyTokens } from '../substitute.js';
import { archiveScaffoldEntry, buildScaffoldPlan, type ScaffoldPlanEntry } from '../scaffold.js';
import { type SetupToken } from '../tokens.js';
import { applyMcpFirebaseJsonRewrites, applyMcpProxyEdits, buildProxyTarget, editJsonFileStatus, ensureMcpServerEntry, type JsonObject } from '../json-edit.js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dbxAddonMarker, injectAll, type MarkerInjection, type SourceInjectionResult } from '../source-inject.js';
import { type AddonConfigureResult, type AddonContext, type AddonFileEditResult, type SetupAddon } from '../addon.js';

const ADDON_ID = 'mcp';

/**
 * The MCP-flavored OIDC-module token overrides: flip `protectedPaths` +
 * `configureMcpResourceServer` to the MCP-enabled values when re-rendering the
 * OIDC module the `oidc` add-on first wrote.
 *
 * @param context - The add-on context.
 * @returns The token list (global + MCP overrides) for the oidc.module re-render.
 */
function buildMcpOidcModuleTokens(context: AddonContext): readonly SetupToken[] {
  return [...context.tokens.global, { search: 'OIDC_PROTECTED_PATHS', replace: "'/api/model', '/mcp'" }, { search: 'OIDC_CONFIGURE_MCP_RESOURCE_SERVER', replace: 'true' }];
}

/**
 * Builds the MCP scaffold plan: the `server/model` + `server/mcp` modules, plus a
 * re-render of the OIDC module with MCP-enabled config.
 *
 * @param context - The add-on context.
 * @returns The scaffold plan entries.
 */
function buildMcpScaffoldPlan(context: AddonContext): readonly ScaffoldPlanEntry[] {
  const { workspaceRoot, archive, naming, tokens } = context;
  const apiRoot = join(workspaceRoot, naming.apiAppFolder);
  return [
    ...buildScaffoldPlan({ archive, subtree: 'addons/mcp/apps/api', destRoot: apiRoot, tokens }),
    archiveScaffoldEntry({
      archivePath: 'addons/oidc/apps/api/src/app/api/oidc/oidc.module.ts',
      destPath: join(apiRoot, 'src/app/api/oidc/oidc.module.ts'),
      tokens,
      tokensOverride: buildMcpOidcModuleTokens(context)
    })
  ];
}

/**
 * One injection authored with `APP_CODE_PREFIX`-style tokens + a stable site.
 */
interface McpInjectionInput {
  readonly filePath: string;
  readonly fileTag: string;
  readonly site: string;
  readonly snippet: string;
  readonly multiline?: boolean;
}

/**
 * Builds a {@link MarkerInjection} with a rendered snippet + unique applied-sentinel.
 *
 * @param input - The injection input.
 * @param render - Renders a token snippet against the project naming.
 * @returns The marker injection.
 */
function buildInjection(input: McpInjectionInput, render: (snippet: string) => string): MarkerInjection {
  const marker = dbxAddonMarker({ addonId: ADDON_ID, fileTag: input.fileTag, site: input.site });
  const sentinel = `@dbx-addon-applied:${ADDON_ID}:${input.fileTag}:${input.site}`;
  return { filePath: input.filePath, marker, snippet: `${render(input.snippet)} // ${sentinel}`, sentinel, indentFromMarker: !input.multiline };
}

/**
 * The dev MCP endpoint URL (functions-emulator origin) for this project.
 *
 * @param context - The add-on context.
 * @returns The MCP endpoint URL.
 */
function buildMcpDevUrl(context: AddonContext): string {
  return `${buildProxyTarget({ functionsPort: context.naming.emulatorFunctionsPort, projectId: context.naming.stagingProjectId })}/mcp`;
}

/**
 * Builds every MCP marker injection for the project.
 *
 * @param context - The add-on context.
 * @returns The ordered injections.
 */
function buildMcpInjections(context: AddonContext): readonly MarkerInjection[] {
  const { workspaceRoot, naming } = context;
  const render = (snippet: string): string => applyTokens(snippet, context.tokens.global);

  const api = join(workspaceRoot, naming.apiAppFolder, 'src/app');
  const apiEnv = join(workspaceRoot, naming.apiAppFolder, 'src/environments');
  const mcpDevUrl = buildMcpDevUrl(context);

  const inputs: readonly McpInjectionInput[] = [
    // server.module.ts (scaffolded by the oidc add-on)
    { filePath: join(api, 'server/server.module.ts'), fileTag: 'server-module', site: 'imports', multiline: true, snippet: `import { APP_CODE_PREFIXModelApiModule } from './model/model.module';\nimport { APP_CODE_PREFIXMcpModule } from './mcp/mcp.module';` },
    { filePath: join(api, 'server/server.module.ts'), fileTag: 'server-module', site: 'modules', multiline: true, snippet: `    APP_CODE_PREFIXModelApiModule,\n    APP_CODE_PREFIXMcpModule,` },
    // server/index.ts
    { filePath: join(api, 'server/index.ts'), fileTag: 'server-index', site: 'exports', multiline: true, snippet: `export * from './model/model.module';\nexport * from './mcp/mcp.module';` },
    // app.ts route exclude
    { filePath: join(api, 'app.ts'), fileTag: 'api-app', site: 'imports', snippet: `import { FIREBASE_SERVER_MCP_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE } from '@dereekb/firebase-server/mcp';` },
    { filePath: join(api, 'app.ts'), fileTag: 'api-app', site: 'route-exclude', snippet: `...FIREBASE_SERVER_MCP_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE,` },
    // app.module.ts global analytics module
    { filePath: join(api, 'app.module.ts'), fileTag: 'api-app-module', site: 'imports', multiline: true, snippet: `import { Global } from '@nestjs/common';\nimport { appMcpAnalyticsModuleMetadata } from '@dereekb/firebase-server/mcp';` },
    { filePath: join(api, 'app.module.ts'), fileTag: 'api-app-module', site: 'global-class', multiline: true, snippet: `@Global()\n@Module(appMcpAnalyticsModuleMetadata({ mcpAnalyticsConfig: { eventName: 'Mcp Tool Call' } }))\nexport class APP_CODE_PREFIXApiAppMcpAnalyticsModule {}` },
    { filePath: join(api, 'app.module.ts'), fileTag: 'api-app-module', site: 'global-imports', snippet: `APP_CODE_PREFIXApiAppMcpAnalyticsModule,` },
    { filePath: join(api, 'app.module.ts'), fileTag: 'api-app-module', site: 'global-exports', snippet: `APP_CODE_PREFIXApiAppMcpAnalyticsModule,` },
    // environments
    { filePath: join(apiEnv, 'environment.ts'), fileTag: 'api-env', site: 'fields', snippet: `appMcpUrl: '${mcpDevUrl}',` },
    { filePath: join(apiEnv, 'environment.prod.ts'), fileTag: 'api-env', site: 'fields', snippet: `appMcpUrl: 'https://example.com/mcp',` }
  ];

  return inputs.map((input) => buildInjection(input, render));
}

/**
 * Applies the MCP firebase.json / proxy / .mcp.json edits. Idempotent.
 *
 * @param context - The add-on context.
 * @returns One file-edit result per edited file.
 */
function applyMcpFileEdits(context: AddonContext): readonly AddonFileEditResult[] {
  const { workspaceRoot, naming, dryRun } = context;
  const results: AddonFileEditResult[] = [];

  const firebaseJsonPath = join(workspaceRoot, 'firebase.json');
  results.push({ path: firebaseJsonPath, status: editJsonFileStatus(firebaseJsonPath, applyMcpFirebaseJsonRewrites, { dryRun }).status });

  const proxyPath = join(workspaceRoot, naming.angularAppFolder, 'proxy.conf.dev.json');
  const target = buildProxyTarget({ functionsPort: naming.emulatorFunctionsPort, projectId: naming.stagingProjectId });
  results.push({ path: proxyPath, status: editJsonFileStatus(proxyPath, (proxyJson) => applyMcpProxyEdits(proxyJson, target), { dryRun }).status });

  // .mcp.json is create-or-merge (it may not exist yet).
  const mcpJsonPath = join(workspaceRoot, '.mcp.json');
  const current: JsonObject = existsSync(mcpJsonPath) ? (JSON.parse(readFileSync(mcpJsonPath, 'utf8')) as JsonObject) : {};
  const next = ensureMcpServerEntry(current, { name: `${naming.projectName}-mcp-dev`, url: buildMcpDevUrl(context) });
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  let mcpStatus: AddonFileEditResult['status'] = 'unchanged';
  if (!existsSync(mcpJsonPath)) {
    mcpStatus = 'created';
  } else if (serialized !== readFileSync(mcpJsonPath, 'utf8')) {
    mcpStatus = 'edited';
  }
  if (!dryRun && mcpStatus !== 'unchanged') {
    // editJsonFileStatus can't create files; write directly for the create-or-merge case.
    writeFileSync(mcpJsonPath, serialized);
  }
  results.push({ path: mcpJsonPath, status: mcpStatus });

  return results;
}

/**
 * Runs the MCP configure phase: marker injections + JSON edits.
 *
 * @param context - The add-on context.
 * @returns The aggregate configure result.
 */
function configureMcp(context: AddonContext): AddonConfigureResult {
  const injections: readonly SourceInjectionResult[] = injectAll(buildMcpInjections(context), { dryRun: context.dryRun });
  const fileEdits = applyMcpFileEdits(context);
  return { injections, fileEdits };
}

/**
 * The `mcp` add-on definition.
 */
export const MCP_ADDON: SetupAddon = {
  id: 'mcp',
  title: 'MCP server infrastructure',
  requiredManifestFields: ['projectName', 'appCodePrefix', 'firebase.projectId', 'firebase.stagingProjectId', 'apps.api', 'apps.angular', 'components.firebase', 'components.angular', 'ports.firebaseEmulatorBase', 'ports.angularApp'],
  dependsOn: ['oidc'],
  buildScaffoldPlan: buildMcpScaffoldPlan,
  configure: configureMcp
};
