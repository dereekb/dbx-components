/**
 * The `oidc` add-on — scaffolds an OAuth2/OIDC provider into an existing project:
 * the shared scope constants, the backend OIDC provider module + CRUD handlers +
 * minimal `server/` module, and the frontend OAuth interaction routes. The
 * wiring into existing base-template files is applied at `@dbx-addon:oidc:*`
 * markers; firebase.json / proxy / .env edits are idempotent JSON/text edits.
 *
 * Ported from the advisorey OIDC port (commits aa8436f + the 3476f2b dev/DCR fix).
 */

import { join } from 'node:path';
import { applyTokens } from '../substitute.js';
import { buildScaffoldPlan, type ScaffoldPlanEntry } from '../scaffold.js';
import { type SetupToken, type SetupTokenTable } from '../tokens.js';
import { applyOidcFirebaseJsonRewrites, applyOidcProxyEdits, buildProxyTarget, editJsonFileStatus } from '../json-edit.js';
import { ensureEnvVar, type EnvVarEditStatus } from '../env-edit.js';
import { dbxAddonMarker, injectAll, type MarkerInjection, type SourceInjectionResult } from '../source-inject.js';
import { manifestHasAddon } from '../manifest.js';
import { type AddonConfigureResult, type AddonContext, type AddonFileEditResult, type SetupAddon } from '../addon.js';

const ADDON_ID = 'oidc';

/**
 * Builds the OIDC-flavored token table: the project's global tokens plus the two
 * placeholders that set `protectedPaths` + `configureMcpResourceServer`. When the
 * `mcp` add-on is already installed (recorded in the manifest), the MCP-enabled
 * values are used so re-running `oidc` does not regress the MCP resource server.
 *
 * @param context - The add-on context.
 * @returns The token table used to render the OIDC templates.
 */
export function buildOidcTokens(context: AddonContext): SetupTokenTable {
  const mcpEnabled = manifestHasAddon(context.manifest, 'mcp');
  const extra: readonly SetupToken[] = [
    { search: 'OIDC_PROTECTED_PATHS', replace: mcpEnabled ? "'/api/model', '/mcp'" : "'/api/model'" },
    { search: 'OIDC_CONFIGURE_MCP_RESOURCE_SERVER', replace: mcpEnabled ? 'true' : 'false' }
  ];
  return { global: [...context.tokens.global, ...extra], perFile: context.tokens.perFile };
}

/**
 * Builds the OIDC scaffold plan: the firebase-component, api, and app subtrees
 * written into their derived project folders.
 *
 * @param context - The add-on context.
 * @returns The scaffold plan entries.
 */
function buildOidcScaffoldPlan(context: AddonContext): readonly ScaffoldPlanEntry[] {
  const { workspaceRoot, archive, naming } = context;
  const tokens = buildOidcTokens(context);
  return [...buildScaffoldPlan({ archive, subtree: 'addons/oidc/components/firebase', destRoot: join(workspaceRoot, naming.firebaseComponentsFolder), tokens }), ...buildScaffoldPlan({ archive, subtree: 'addons/oidc/apps/api', destRoot: join(workspaceRoot, naming.apiAppFolder), tokens }), ...buildScaffoldPlan({ archive, subtree: 'addons/oidc/apps/app', destRoot: join(workspaceRoot, naming.angularAppFolder), tokens })];
}

/**
 * One injection authored with `APP_CODE_PREFIX`-style tokens + a stable site.
 */
interface OidcInjectionInput {
  readonly filePath: string;
  readonly fileTag: string;
  readonly site: string;
  readonly snippet: string;
  readonly placement?: 'after' | 'before';
  readonly multiline?: boolean;
}

/**
 * Builds a {@link MarkerInjection}: resolves the marker, renders the snippet
 * through the global token table, and appends a unique applied-sentinel comment
 * so re-runs are no-ops.
 *
 * @param input - The injection input.
 * @param render - Renders a token snippet against the project naming.
 * @returns The marker injection.
 */
function buildInjection(input: OidcInjectionInput, render: (snippet: string) => string): MarkerInjection {
  const marker = dbxAddonMarker({ addonId: ADDON_ID, fileTag: input.fileTag, site: input.site });
  const sentinel = `@dbx-addon-applied:${ADDON_ID}:${input.fileTag}:${input.site}`;
  return {
    filePath: input.filePath,
    marker,
    snippet: `${render(input.snippet)} // ${sentinel}`,
    sentinel,
    placement: input.placement,
    // single-line snippets inherit the marker indent; multi-line snippets bake their own.
    indentFromMarker: !input.multiline
  };
}

/**
 * Builds every OIDC marker injection for the project.
 *
 * @param context - The add-on context.
 * @returns The ordered injections.
 */
function buildOidcInjections(context: AddonContext): readonly MarkerInjection[] {
  const { workspaceRoot, naming } = context;
  const render = (snippet: string): string => applyTokens(snippet, context.tokens.global);

  const fb = join(workspaceRoot, naming.firebaseComponentsFolder, 'src/lib');
  const api = join(workspaceRoot, naming.apiAppFolder, 'src/app');
  const apiEnv = join(workspaceRoot, naming.apiAppFolder, 'src/environments');
  const app = join(workspaceRoot, naming.angularAppFolder, 'src');

  const inputs: readonly OidcInjectionInput[] = [
    // firebase component — auth barrel
    { filePath: join(fb, 'auth/index.ts'), fileTag: 'fb-auth-index', site: 'exports', snippet: `export * from './oidc';` },
    // firebase component — functions
    { filePath: join(fb, 'functions.ts'), fileTag: 'fb-functions', site: 'imports', snippet: `import { oidcModelFunctionMap, OidcModelFunctions, type OidcModelFunctionTypeMap } from '@dereekb/firebase';` },
    { filePath: join(fb, 'functions.ts'), fileTag: 'fb-functions', site: 'typemap', snippet: `readonly oidcModelFunctions: OidcModelFunctionTypeMap;` },
    { filePath: join(fb, 'functions.ts'), fileTag: 'fb-functions', site: 'configmap', snippet: `oidcModelFunctions: [OidcModelFunctions, oidcModelFunctionMap],` },
    { filePath: join(fb, 'functions.ts'), fileTag: 'fb-functions', site: 'getter', snippet: `abstract readonly oidcModelFunctions: FirebaseFunctionGetter<OidcModelFunctions>;` },
    // firebase component — model service
    { filePath: join(fb, 'model/service.ts'), fileTag: 'fb-service', site: 'imports', multiline: true, snippet: `import { type OidcModelFirestoreCollections, type OidcEntryFirestoreCollection, oidcEntryFirestoreCollection, type OidcModelTypes, type OidcEntry, type OidcEntryDocument, type OidcEntryRoles, firestoreModelKey } from '@dereekb/firebase';\nimport { profileIdentity } from './profile';` },
    { filePath: join(fb, 'model/service.ts'), fileTag: 'fb-service', site: 'implements', snippet: `, OidcModelFirestoreCollections` },
    { filePath: join(fb, 'model/service.ts'), fileTag: 'fb-service', site: 'abstract', snippet: `abstract readonly oidcEntryCollection: OidcEntryFirestoreCollection;` },
    { filePath: join(fb, 'model/service.ts'), fileTag: 'fb-service', site: 'factory', snippet: `oidcEntryCollection: oidcEntryFirestoreCollection({ firestoreContext }),` },
    {
      filePath: join(fb, 'model/service.ts'),
      fileTag: 'fb-service',
      site: 'model-service-factory',
      multiline: true,
      snippet: `// MARK: OidcEntry\nexport const oidcEntryFirebaseModelServiceFactory = firebaseModelServiceFactory<APP_CODE_PREFIXFirebaseContext, OidcEntry, OidcEntryDocument, OidcEntryRoles>({\n  roleMapForModel: function (output, context, _model) {\n    return grantModelRolesIfAdmin(context, fullAccessRoleMap(), async () => {\n      const data = output.data;\n      const ownerKey = context.auth ? firestoreModelKey(profileIdentity, context.auth.uid) : undefined;\n      const isOwner = ownerKey != null && data?.o === ownerKey;\n      return isOwner ? fullAccessRoleMap() : noAccessRoleMap();\n    });\n  },\n  getFirestoreCollection: (c) => c.app.oidcEntryCollection\n});`
    },
    { filePath: join(fb, 'model/service.ts'), fileTag: 'fb-service', site: 'types-union', snippet: `| OidcModelTypes` },
    { filePath: join(fb, 'model/service.ts'), fileTag: 'fb-service', site: 'factories-map', snippet: `oidcEntry: oidcEntryFirebaseModelServiceFactory,` },
    // api — crud functions
    { filePath: join(api, 'function/model/crud.functions.ts'), fileTag: 'api-crud', site: 'imports', multiline: true, snippet: `import { oidcEntryCreateClient } from '../oidc/oidcclient.create';\nimport { oidcEntryUpdateClient, oidcEntryUpdateRotateClientSecret } from '../oidc/oidcclient.update';\nimport { oidcEntryDeleteClient } from '../oidc/oidcclient.delete';\nimport { oidcEntryDeleteToken } from '../oidc/oidcentry.delete';` },
    { filePath: join(api, 'function/model/crud.functions.ts'), fileTag: 'api-crud', site: 'create', snippet: `oidcEntry: onCallSpecifierHandler({ client: oidcEntryCreateClient }),` },
    { filePath: join(api, 'function/model/crud.functions.ts'), fileTag: 'api-crud', site: 'update', snippet: `oidcEntry: onCallSpecifierHandler({ client: oidcEntryUpdateClient, rotateClientSecret: oidcEntryUpdateRotateClientSecret }),` },
    { filePath: join(api, 'function/model/crud.functions.ts'), fileTag: 'api-crud', site: 'delete', snippet: `oidcEntry: onCallSpecifierHandler({ client: oidcEntryDeleteClient, token: oidcEntryDeleteToken }),` },
    // api — function context getter
    { filePath: join(api, 'function/function.ts'), fileTag: 'api-function', site: 'imports', snippet: `import { OidcModelServerActions } from '@dereekb/firebase-server/oidc';` },
    { filePath: join(api, 'function/function.ts'), fileTag: 'api-function', site: 'getters', multiline: true, snippet: `  get oidcModelServerActions(): OidcModelServerActions {\n    return this.nest.get(OidcModelServerActions);\n  }` },
    // api — model module
    { filePath: join(api, 'common/model/model.module.ts'), fileTag: 'api-model-module', site: 'imports', snippet: `import { OidcModelModule } from './oidc/oidc.module';` },
    { filePath: join(api, 'common/model/model.module.ts'), fileTag: 'api-model-module', site: 'modules', snippet: `OidcModelModule,` },
    { filePath: join(api, 'common/model/model.module.ts'), fileTag: 'api-model-module', site: 'module-exports', snippet: `OidcModelModule,` },
    // api — app.ts (server config)
    { filePath: join(api, 'app.ts'), fileTag: 'api-app', site: 'imports', snippet: `import { applyOidcAuthMiddleware, applyOidcCorsMiddleware, FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE } from '@dereekb/firebase-server/oidc';` },
    { filePath: join(api, 'app.ts'), fileTag: 'api-app', site: 'route-exclude', snippet: `...FIREBASE_SERVER_OIDC_ROUTES_FOR_GLOBAL_ROUTE_EXCLUDE,` },
    { filePath: join(api, 'app.ts'), fileTag: 'api-app', site: 'config', multiline: true, snippet: `  configureNestServerInstance: (nestApp) => {\n    applyOidcCorsMiddleware(nestApp);\n    applyOidcAuthMiddleware(nestApp);\n  },` },
    // api — app.module.ts (server module import)
    { filePath: join(api, 'app.module.ts'), fileTag: 'api-app-module', site: 'imports', snippet: `import { APP_CODE_PREFIXApiServerModule } from './server/server.module';` },
    { filePath: join(api, 'app.module.ts'), fileTag: 'api-app-module', site: 'app-imports', snippet: `APP_CODE_PREFIXApiServerModule,` },
    // api — environments
    { filePath: join(apiEnv, 'environment.ts'), fileTag: 'api-env', site: 'fields', snippet: `appApiUrl: 'http://localhost:${naming.angularAppPort}/api',` },
    { filePath: join(apiEnv, 'environment.prod.ts'), fileTag: 'api-env', site: 'fields', snippet: `appApiUrl: 'https://example.com/api',` },
    // frontend — root app config
    { filePath: join(app, 'root.app.config.ts'), fileTag: 'root-config', site: 'imports', snippet: `import { provideDbxFirebaseOidc } from '@dereekb/dbx-firebase/oidc';\nimport { APP_CODE_PREFIX_CAPS_APP_OAUTH_INTERACTION_PATH, APP_CODE_PREFIX_CAPS_OIDC_AVAILABLE_SCOPES, APP_CODE_PREFIX_CAPS_OIDC_TOKEN_ENDPOINT_AUTH_METHODS } from 'FIREBASE_COMPONENTS_NAME';`, multiline: true },
    {
      filePath: join(app, 'root.app.config.ts'),
      fileTag: 'root-config',
      site: 'providers',
      multiline: true,
      snippet: `    provideDbxFirebaseOidc({\n      appCollectionClass: APP_CODE_PREFIXFirestoreCollections,\n      oidcConfig: {\n        availableScopes: APP_CODE_PREFIX_CAPS_OIDC_AVAILABLE_SCOPES,\n        tokenEndpointAuthMethods: APP_CODE_PREFIX_CAPS_OIDC_TOKEN_ENDPOINT_AUTH_METHODS,\n        oauthInteractionRoute: APP_CODE_PREFIX_CAPS_APP_OAUTH_INTERACTION_PATH\n      }\n    }),`
    },
    // frontend — app router
    { filePath: join(app, 'app/app.router.ts'), fileTag: 'app-router', site: 'declarations', multiline: true, snippet: `export const appOAuthFutureState: Ng2StateDeclaration = {\n  parent: 'root',\n  name: 'oauth.**',\n  url: '/oauth',\n  loadChildren: () => import('./modules/oauth/oauth.module').then((m) => m.APP_CODE_PREFIXOAuthModule)\n};` },
    { filePath: join(app, 'app/app.router.ts'), fileTag: 'app-router', site: 'states', snippet: `appOAuthFutureState,` }
  ];

  return inputs.map((input) => buildInjection(input, render));
}

/**
 * Maps an env-edit status onto the add-on file-edit status vocabulary.
 *
 * @param status - The env-edit status.
 * @returns The corresponding file-edit status.
 */
function mapEnvEditStatus(status: EnvVarEditStatus): AddonFileEditResult['status'] {
  const map: Record<EnvVarEditStatus, AddonFileEditResult['status']> = { added: 'edited', present: 'unchanged', created: 'created', 'file-missing': 'file-missing' };
  return map[status];
}

/**
 * Applies the OIDC firebase.json / proxy / .env edits. Idempotent.
 *
 * @param context - The add-on context.
 * @returns One file-edit result per edited file.
 */
function applyOidcFileEdits(context: AddonContext): readonly AddonFileEditResult[] {
  const { workspaceRoot, naming, dryRun } = context;
  const results: AddonFileEditResult[] = [];

  const firebaseJsonPath = join(workspaceRoot, 'firebase.json');
  results.push({ path: firebaseJsonPath, status: editJsonFileStatus(firebaseJsonPath, applyOidcFirebaseJsonRewrites, { dryRun }).status });

  const proxyPath = join(workspaceRoot, naming.angularAppFolder, 'proxy.conf.dev.json');
  const target = buildProxyTarget({ functionsPort: naming.emulatorFunctionsPort, projectId: naming.stagingProjectId });
  results.push({ path: proxyPath, status: editJsonFileStatus(proxyPath, (proxyJson) => applyOidcProxyEdits(proxyJson, target), { dryRun }).status });

  const envPath = join(workspaceRoot, '.env');
  const envStatus = ensureEnvVar(envPath, { key: 'OIDC_JWKS_ENCRYPTION_SECRET', value: 'placeholder' }, { dryRun });
  results.push({ path: envPath, status: mapEnvEditStatus(envStatus.status) });

  return results;
}

/**
 * Runs the OIDC configure phase: marker injections + JSON/text edits.
 *
 * @param context - The add-on context.
 * @returns The aggregate configure result.
 */
function configureOidc(context: AddonContext): AddonConfigureResult {
  const injections: readonly SourceInjectionResult[] = injectAll(buildOidcInjections(context), { dryRun: context.dryRun });
  const fileEdits = applyOidcFileEdits(context);
  return { injections, fileEdits };
}

/**
 * The `oidc` add-on definition.
 */
export const OIDC_ADDON: SetupAddon = {
  id: 'oidc',
  title: 'OIDC / OAuth2 provider',
  requiredManifestFields: ['projectName', 'appCodePrefix', 'firebase.projectId', 'firebase.stagingProjectId', 'apps.api', 'apps.angular', 'components.firebase', 'components.angular', 'ports.firebaseEmulatorBase', 'ports.angularApp'],
  buildScaffoldPlan: buildOidcScaffoldPlan,
  configure: configureOidc
};
