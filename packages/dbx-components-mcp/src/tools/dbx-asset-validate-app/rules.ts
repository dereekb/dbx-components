/**
 * Validation rules for `dbx_asset_validate_app`. Rules accumulate
 * {@link Violation}s into a mutable buffer; the public entry point is
 * {@link validateAppAssets} in `./index.ts`.
 *
 * Rule families:
 *   - I/O — component dir / app dir existence, `assets.ts` presence,
 *     barrel re-export.
 *   - Structure — aggregator presence, aggregator member resolution,
 *     unknown builder callees.
 *   - Local refs — every resolved local path exists under
 *     `<appDir>/src/assets/`.
 *   - Remote refs — string-literal URLs start with `http://` or
 *     `https://`.
 *   - Provider wiring — the Angular `root.app.config.ts` calls
 *     `provideDbxAssetLoader(` and imports it from `@dereekb/dbx-core`.
 *   - Duplicates — two refs resolving to the same path/url.
 */

import { attachRemediation } from '../rule-catalog/index.js';
import type { AppAssetsInspection, ExtractedAppAssets, ExtractedAssetConstant, Violation, ViolationCode, ViolationSeverity } from './types.js';

const PROVIDE_FN = 'provideDbxAssetLoader';
const PROVIDER_IMPORT_MODULE = '@dereekb/dbx-core';
const PROVIDE_CALL_RE = /provideDbxAssetLoader\s*\(/;
const PROVIDER_IMPORT_RE = /from\s*['"]@dereekb\/dbx-core['"]/;

/**
 * Applies every rule against the prepared inspection + extraction and
 * returns the aggregated diagnostics. I/O-level rules short-circuit the
 * structure / wiring rules so the report stays focused on the root
 * cause.
 *
 * @param inspection - the on-disk snapshot used for I/O rules
 * @param extracted - the pre-extracted facts the structure / wiring rules consume
 * @returns the violations the rules emit for the snapshot
 */
export function runRules(inspection: AppAssetsInspection, extracted: ExtractedAppAssets): readonly Violation[] {
  const violations: Violation[] = [];

  let proceed = true;
  if (inspection.component.status === 'dir-not-found') {
    pushViolation(violations, {
      code: 'DBX_ASSET_COMPONENT_DIR_NOT_FOUND',
      message: `Component directory \`${inspection.component.rootDir}\` does not exist.`,
      side: 'component',
      file: undefined
    });
    proceed = false;
  }
  if (inspection.appStatus === 'dir-not-found') {
    pushViolation(violations, {
      code: 'DBX_ASSET_APP_DIR_NOT_FOUND',
      message: `App directory \`${inspection.appRootDir}\` does not exist.`,
      side: 'api',
      file: undefined
    });
    proceed = false;
  }
  if (!proceed) return violations;

  if (!extracted.assetsFileExists) {
    pushViolation(violations, {
      code: 'DBX_ASSET_FILE_MISSING',
      message: `Component is missing \`src/lib/assets.ts\`. Add the file and export \`AssetPathRef\` constants.`,
      side: 'component',
      file: undefined
    });
    return violations;
  }

  if (!extracted.barrelReExportsAssets) {
    pushViolation(violations, {
      code: 'DBX_ASSET_BARREL_MISSING',
      severity: 'warning',
      message: `Component barrel \`src/lib/index.ts\` does not re-export \`./assets\`. Add \`export * from './assets';\` so downstream consumers see the refs.`,
      side: 'component',
      file: 'src/lib/index.ts'
    });
  }

  if (extracted.aggregatorExports.length === 0) {
    pushViolation(violations, {
      code: 'DBX_ASSET_NO_AGGREGATOR',
      severity: 'warning',
      message: `\`assets.ts\` declares no exported \`AssetPathRef[]\` aggregator. Add e.g. \`export const PROJECT_ASSETS: AssetPathRef[] = [...];\` listing every ref.`,
      side: 'component',
      file: 'src/lib/assets.ts'
    });
  }

  checkAggregatorMembers(extracted, violations);
  checkUnknownBuilders(extracted, violations);
  checkInvalidRemoteUrls(extracted, violations);
  checkLocalFileExistence(inspection, extracted, violations);
  checkDuplicates(extracted, violations);
  checkProviderWiring(inspection, violations);

  return violations;
}

function checkAggregatorMembers(extracted: ExtractedAppAssets, violations: Violation[]): void {
  const known = new Set<string>();
  for (const c of extracted.assetConstants) known.add(c.symbolName);
  for (const agg of extracted.aggregatorExports) {
    for (const member of agg.memberNames) {
      if (known.has(member)) continue;
      if (extracted.trustedExternalIdentifiers.has(member)) continue;
      pushViolation(violations, {
        code: 'DBX_ASSET_AGGREGATOR_MISSING_MEMBER',
        message: `Aggregator \`${agg.symbolName}\` references \`${member}\` but no exported \`AssetPathRef\` constant with that name is declared in \`assets.ts\`.`,
        side: 'component',
        file: agg.sourceFile
      });
    }
  }
}

function checkUnknownBuilders(extracted: ExtractedAppAssets, violations: Violation[]): void {
  for (const u of extracted.unknownBuilders) {
    pushViolation(violations, {
      code: 'DBX_ASSET_BUILDER_UNKNOWN',
      message: `Export \`${u.symbolName}\` is initialized via \`${u.calleeText}(...)\`, which is not a known asset builder. Use \`localAsset\`, \`remoteAsset\`, or a \`.asset(...)\` / \`.assets([...])\` call against an \`assetFolder\` / \`remoteAssetBaseUrl\` binding.`,
      side: 'component',
      file: u.sourceFile
    });
  }
}

function checkInvalidRemoteUrls(extracted: ExtractedAppAssets, violations: Violation[]): void {
  for (const u of extracted.invalidRemoteUrls) {
    const target = u.symbolName ? `\`${u.symbolName}\`` : `the ${u.helper} call`;
    pushViolation(violations, {
      code: 'DBX_ASSET_REMOTE_INVALID_URL',
      message: `${target} passes \`'${u.value}'\` to \`${u.helper}(...)\`, but remote refs require an absolute http:// or https:// URL.`,
      side: 'component',
      file: u.sourceFile
    });
  }
}

function checkLocalFileExistence(inspection: AppAssetsInspection, extracted: ExtractedAppAssets, violations: Violation[]): void {
  if (inspection.appStatus !== 'ok') return;
  for (const c of extracted.assetConstants) {
    if (c.sourceType !== 'local') continue;
    const paths = c.resolved !== undefined ? [c.resolved] : c.resolvedPaths;
    for (const path of paths) {
      const normalized = normalizeLocalPath(path);
      if (normalized === undefined) continue;
      if (inspection.app.assetFiles.has(normalized)) continue;
      pushViolation(violations, {
        code: 'DBX_ASSET_LOCAL_FILE_MISSING',
        message: `Local asset \`${c.symbolName}\` resolves to \`${normalized}\`, but no file exists at \`${inspection.appRootDir}/src/assets/${normalized}\`.`,
        side: 'api',
        file: c.sourceFile
      });
    }
  }
}

function normalizeLocalPath(path: string): string | undefined {
  if (!path) return undefined;
  let p = path;
  while (p.startsWith('/')) p = p.slice(1);
  if (p.startsWith('assets/')) p = p.slice('assets/'.length);
  return p.length > 0 ? p : undefined;
}

function checkDuplicates(extracted: ExtractedAppAssets, violations: Violation[]): void {
  const seen = new Map<string, ExtractedAssetConstant>();
  for (const c of extracted.assetConstants) {
    const values = c.resolved !== undefined ? [c.resolved] : c.resolvedPaths;
    for (const value of values) {
      const previous = seen.get(value);
      if (previous) {
        pushViolation(violations, {
          code: 'DBX_ASSET_DUPLICATE_PATH',
          severity: 'warning',
          message: `\`${previous.symbolName}\` and \`${c.symbolName}\` both resolve to \`${value}\`. Choose distinct paths or fold into one export.`,
          side: 'component',
          file: c.sourceFile
        });
      } else {
        seen.set(value, c);
      }
    }
  }
}

function checkProviderWiring(inspection: AppAssetsInspection, violations: Violation[]): void {
  const text = inspection.app.rootConfigText;
  if (text === undefined) {
    pushViolation(violations, {
      code: 'DBX_ASSET_PROVIDER_MISSING',
      message: `App root config \`src/root.app.config.ts\` not found under \`${inspection.appRootDir}\`. Add the file and call \`${PROVIDE_FN}()\` from its providers array.`,
      side: 'api',
      file: undefined
    });
    return;
  }
  if (!PROVIDE_CALL_RE.test(text)) {
    pushViolation(violations, {
      code: 'DBX_ASSET_PROVIDER_MISSING',
      message: `App root config does not call \`${PROVIDE_FN}()\`. Add it to the providers array (alongside other \`provideDbx*()\` calls).`,
      side: 'api',
      file: 'src/root.app.config.ts'
    });
    return;
  }
  if (!PROVIDER_IMPORT_RE.test(text) || !text.includes(PROVIDE_FN)) {
    pushViolation(violations, {
      code: 'DBX_ASSET_PROVIDER_IMPORT_MISSING',
      severity: 'warning',
      message: `App root config calls \`${PROVIDE_FN}\` but does not import it from \`${PROVIDER_IMPORT_MODULE}\`. Re-imports through workspace-local barrels defeat tree-shaking.`,
      side: 'api',
      file: 'src/root.app.config.ts'
    });
  }
}

function pushViolation(buffer: Violation[], violation: Omit<Violation, 'severity' | 'remediation'> & { readonly severity?: ViolationSeverity }): void {
  const severity: ViolationSeverity = violation.severity ?? 'error';
  const filled: Violation = {
    code: violation.code,
    severity,
    message: violation.message,
    side: violation.side,
    file: violation.file,
    remediation: attachRemediation(violation.code)
  };
  buffer.push(filled);
}

export type { ViolationCode };
