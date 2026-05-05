/**
 * Shared types for `dbx_asset_validate_app` and its sibling
 * `dbx_asset_list_app` listing tool.
 *
 * The validator targets a downstream `-firebase` component package's
 * `src/lib/assets.ts` (and its `src/lib/index.ts` barrel) plus the
 * Angular app's `src/root.app.config.ts` and `src/assets/` directory,
 * cross-referencing every declared `AssetPathRef` constant with the
 * Angular wiring it needs to be reachable at runtime.
 */

import type { DbxAssetValidateAppCode } from './codes.js';
import type { RemediationHint } from '../rule-catalog/types.js';
import type { TwoSideResult, TwoSideViolation } from '../validate-format.js';
import type { SideInspection } from '../_validate/inspection.types.js';

export type { ViolationSeverity } from '../validate-format.js';

/**
 * String-literal union derived from {@link DbxAssetValidateAppCode}. Source
 * of truth for code metadata is the enum's per-member JSDoc; the
 * template-literal type widens the enum back to its underlying
 * SCREAMING_SNAKE strings.
 */
export type ViolationCode = `${DbxAssetValidateAppCode}`;

export interface Violation extends TwoSideViolation {
  readonly code: ViolationCode;
  /**
   * Auto-attached remediation hint pulled from the rule catalog at
   * emission time. `undefined` when no catalog entry exists for the
   * code (the formatter renders no nested block in that case).
   */
  readonly remediation?: RemediationHint;
}

export interface ValidationResult extends TwoSideResult {
  readonly violations: readonly Violation[];
}

/**
 * Asset categorisation. Local refs resolve under `<appDir>/src/assets/`;
 * remote refs hold an absolute URL.
 */
export type AssetSourceType = 'local' | 'remote';

/**
 * The four `@dereekb/rxjs` asset builder helpers plus their fluent
 * `.asset` / `.assets` callees.
 */
export type AssetBuilderHelper = 'localAsset' | 'remoteAsset' | 'assetFolder.asset' | 'assetFolder.assets' | 'remoteAssetBaseUrl.asset' | 'remoteAssetBaseUrl.assets';

/**
 * One exported `export const X = <builder>(...)` constant whose
 * resolved value is an `AssetPathRef`. `resolved` is the joined
 * path / url; `resolvedPaths` is non-empty only when the builder is
 * one of the `.assets([...])` plural forms.
 */
export interface ExtractedAssetConstant {
  readonly symbolName: string;
  readonly sourceType: AssetSourceType;
  readonly helper: AssetBuilderHelper;
  readonly resolved: string | undefined;
  readonly resolvedPaths: readonly string[];
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * One exported `export const X: AssetPathRef[] = [A, B, ...]` aggregator.
 */
export interface ExtractedAssetArrayExport {
  readonly symbolName: string;
  readonly memberNames: readonly string[];
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * One non-exported `const X = assetFolder('foo')` builder bind.
 */
export interface ExtractedFolderBuilder {
  readonly bindingName: string;
  readonly basePath: string;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * One non-exported `const X = remoteAssetBaseUrl('https://...')` builder bind.
 */
export interface ExtractedRemoteBaseBuilder {
  readonly bindingName: string;
  readonly baseUrl: string;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * One unrecognised initializer call — the builder callee was not any
 * of the four known asset builders or fluent `.asset` / `.assets`
 * member calls, and the callee is not a trust-listed identifier.
 */
export interface ExtractedUnknownBuilder {
  readonly symbolName: string;
  readonly calleeText: string;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * One literal-string argument supplied to a `remoteAsset(...)` /
 * `remoteAssetBaseUrl(...)` call that is not an absolute http/https URL.
 */
export interface ExtractedInvalidRemoteUrl {
  readonly symbolName: string | undefined;
  readonly value: string;
  readonly helper: 'remoteAsset' | 'remoteAssetBaseUrl';
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * Aggregated cross-file extraction result.
 */
export interface ExtractedAppAssets {
  readonly assetConstants: readonly ExtractedAssetConstant[];
  readonly aggregatorExports: readonly ExtractedAssetArrayExport[];
  readonly folderBuilders: readonly ExtractedFolderBuilder[];
  readonly remoteBaseBuilders: readonly ExtractedRemoteBaseBuilder[];
  readonly unknownBuilders: readonly ExtractedUnknownBuilder[];
  readonly invalidRemoteUrls: readonly ExtractedInvalidRemoteUrl[];
  readonly assetsFileExists: boolean;
  readonly barrelReExportsAssets: boolean;
  readonly trustedExternalIdentifiers: ReadonlySet<string>;
}

/**
 * Inspection of the Angular app's `src/root.app.config.ts` and the
 * pre-collected list of files under `src/assets/`.
 */
export interface AppAssetWiringInspection {
  /**
   * Raw text of `<appDir>/src/root.app.config.ts`, or `undefined` when
   * the file does not exist.
   */
  readonly rootConfigText: string | undefined;
  /**
   * Set of paths (POSIX-relative to `<appDir>/src/assets/`) for every
   * file present beneath the Angular app's assets directory. Empty when
   * the directory is missing.
   */
  readonly assetFiles: ReadonlySet<string>;
}

/**
 * Two-side inspection input shared by the validator, the lister, and
 * the folder validator. The component side carries `src/lib/` files;
 * the api side (named for factory consistency with other validators —
 * here it represents the Angular app) carries the wiring inspection.
 */
export interface AppAssetsInspection {
  readonly component: SideInspection;
  readonly app: AppAssetWiringInspection;
  readonly appRootDir: string;
  readonly appStatus: 'ok' | 'dir-not-found';
}

export type { InspectedFile, SideInspection } from '../_validate/inspection.types.js';
