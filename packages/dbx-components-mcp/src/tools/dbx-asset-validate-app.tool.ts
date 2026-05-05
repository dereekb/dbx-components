/**
 * `dbx_asset_validate_app` tool.
 *
 * Cross-file verifier for downstream `AssetPathRef` wiring. Reads the
 * component's `src/lib/assets.ts` (and `src/lib/index.ts` barrel) and
 * the Angular app's `src/root.app.config.ts` plus `src/assets/`
 * directory, then asserts every declared `AssetPathRef` is built with
 * a known `@dereekb/rxjs` builder, that all local refs have files on
 * disk under `<appDir>/src/assets/`, that all remote refs use absolute
 * http/https URLs, and that `provideDbxAssetLoader()` (from
 * `@dereekb/dbx-core`) is registered in the root config.
 *
 * Accepts two required inputs:
 *   - `componentDir`: relative path to the `-firebase` component package.
 *   - `apiDir`: relative path to the Angular app (asset-cluster name kept
 *     for factory consistency — pass the Angular app dir, e.g. `apps/demo`).
 *
 * Paths escaping the cwd are rejected.
 */

import { type Tool } from '@modelcontextprotocol/sdk/types.js';
import { type DbxTool } from './types.js';
import { createTwoSideValidateTool } from './validate-tool.js';
import { formatResult, inspectAppAssets, validateAppAssets } from './dbx-asset-validate-app/index.js';

const DBX_ASSET_VALIDATE_APP_TOOL: Tool = {
  name: 'dbx_asset_validate_app',
  description: [
    'Validate every `AssetPathRef` constant declared in a downstream `-firebase` component is wired through the Angular app: built with one of the four `@dereekb/rxjs` asset builders (`localAsset`, `remoteAsset`, `assetFolder(...).asset(...)`, `remoteAssetBaseUrl(...).asset(...)`); local refs have files on disk under `<appDir>/src/assets/<path>`; remote refs use absolute `http://` / `https://` URLs; and `provideDbxAssetLoader()` (from `@dereekb/dbx-core`) is registered in `<appDir>/src/root.app.config.ts`.',
    '',
    'Also checks the component barrel re-exports `./assets` and that the optional `AssetPathRef[]` aggregator (e.g. `<PROJECT>_ASSETS`) does not reference unknown identifiers.',
    '',
    'Provide:',
    '- `componentDir`: relative path to the `-firebase` component package (e.g. `components/demo-firebase`).',
    '- `apiDir`: relative path to the Angular app (e.g. `apps/demo`). The asset cluster targets the Angular front-end, not the API app — the parameter name matches the other validators for consistency.',
    '',
    'Paths escaping the server cwd are rejected.'
  ].join('\n'),
  inputSchema: {
    type: 'object',
    properties: {
      componentDir: {
        type: 'string',
        description: 'Relative path to the `-firebase` component package (e.g. `components/demo-firebase`).'
      },
      apiDir: {
        type: 'string',
        description: 'Relative path to the Angular app (e.g. `apps/demo`).'
      }
    },
    required: ['componentDir', 'apiDir']
  }
};

export const dbxAssetValidateAppTool: DbxTool = createTwoSideValidateTool({
  definition: DBX_ASSET_VALIDATE_APP_TOOL,
  inspectAndValidate: async ({ componentAbs, componentRel, apiAbs, apiRel }) => {
    const inspection = await inspectAppAssets(componentAbs, apiAbs);
    return validateAppAssets(inspection, { componentDir: componentRel, apiDir: apiRel });
  },
  format: formatResult
});
