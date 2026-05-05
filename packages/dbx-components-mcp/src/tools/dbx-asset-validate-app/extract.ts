/**
 * Cross-file AST extraction for `dbx_asset_validate_app`.
 *
 * Walks the component's `src/lib/assets.ts` with ts-morph, recognising
 * the four `@dereekb/rxjs` asset builders plus their fluent
 * `.asset` / `.assets` member calls, and resolves folder/baseUrl
 * binding references back to their string arguments to compute the
 * final asset path or URL.
 */

import { Node, Project, type CallExpression, type SourceFile } from 'ts-morph';
import { collectTrustedExternalIdentifiers, typeAnnotationText, unwrapAsExpressions } from '../_validate/ast.js';
import type { AppAssetsInspection, AssetBuilderHelper, AssetSourceType, ExtractedAppAssets, ExtractedAssetArrayExport, ExtractedAssetConstant, ExtractedFolderBuilder, ExtractedInvalidRemoteUrl, ExtractedRemoteBaseBuilder, ExtractedUnknownBuilder } from './types.js';

const ASSETS_RELPATH = 'src/lib/assets.ts';
const BARREL_RELPATH = 'src/lib/index.ts';

const LOCAL_ASSET_BUILDER = 'localAsset';
const REMOTE_ASSET_BUILDER = 'remoteAsset';
const ASSET_FOLDER_BUILDER = 'assetFolder';
const REMOTE_BASE_BUILDER = 'remoteAssetBaseUrl';
const KNOWN_DIRECT_BUILDERS = new Set([LOCAL_ASSET_BUILDER, REMOTE_ASSET_BUILDER]);
const KNOWN_FLUENT_BUILDERS = new Set([ASSET_FOLDER_BUILDER, REMOTE_BASE_BUILDER]);

const ASSET_PATH_REF_ARRAY_TYPE = 'AssetPathRef[]';

const BARREL_RE_EXPORT_RE = /export\s*\*\s*from\s*['"]\.\/assets['"]/;

/**
 * Builds an in-memory ts-morph project from the component's collected
 * `assets.ts` (and the `index.ts` barrel for the trust-list / barrel
 * check) and extracts every fact the rules consume — asset constants,
 * builder bindings, the aggregator export, and trust-listed external
 * identifiers — in a single pass.
 *
 * @param inspection - the prepared component + app inspection
 * @returns the structured extraction used by the rules layer
 */
export function extractAppAssets(inspection: AppAssetsInspection): ExtractedAppAssets {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sources: SourceFile[] = [];
  let assetsFileExists = false;
  let barrelText: string | undefined;
  for (const file of inspection.component.files) {
    sources.push(project.createSourceFile(file.relPath, file.text, { overwrite: true }));
    if (file.relPath === ASSETS_RELPATH) assetsFileExists = true;
    if (file.relPath === BARREL_RELPATH) barrelText = file.text;
  }

  const trustedExternalIdentifiers = collectTrustedExternalIdentifiers(sources);
  const assetsSource = sources.find((sf) => sf.getFilePath().endsWith(ASSETS_RELPATH));

  const ctx: ExtractContext = {
    sf: assetsSource,
    trustedExternalIdentifiers,
    folderBuilders: [],
    remoteBaseBuilders: [],
    assetConstants: [],
    aggregatorExports: [],
    unknownBuilders: [],
    invalidRemoteUrls: [],
    folderBuildersByName: new Map(),
    remoteBaseBuildersByName: new Map()
  };

  if (assetsSource) {
    extractFromAssetsSource(ctx, assetsSource);
  }

  const result: ExtractedAppAssets = {
    assetConstants: ctx.assetConstants,
    aggregatorExports: ctx.aggregatorExports,
    folderBuilders: ctx.folderBuilders,
    remoteBaseBuilders: ctx.remoteBaseBuilders,
    unknownBuilders: ctx.unknownBuilders,
    invalidRemoteUrls: ctx.invalidRemoteUrls,
    assetsFileExists,
    barrelReExportsAssets: barrelReExportsAssets(barrelText),
    trustedExternalIdentifiers
  };
  return result;
}

interface ExtractContext {
  readonly sf: SourceFile | undefined;
  readonly trustedExternalIdentifiers: ReadonlySet<string>;
  readonly folderBuilders: ExtractedFolderBuilder[];
  readonly remoteBaseBuilders: ExtractedRemoteBaseBuilder[];
  readonly assetConstants: ExtractedAssetConstant[];
  readonly aggregatorExports: ExtractedAssetArrayExport[];
  readonly unknownBuilders: ExtractedUnknownBuilder[];
  readonly invalidRemoteUrls: ExtractedInvalidRemoteUrl[];
  readonly folderBuildersByName: Map<string, ExtractedFolderBuilder>;
  readonly remoteBaseBuildersByName: Map<string, ExtractedRemoteBaseBuilder>;
}

interface DeclSite {
  readonly isExported: boolean;
  readonly symbolName: string;
  readonly line: number;
  readonly rel: string;
}

function extractFromAssetsSource(ctx: ExtractContext, sf: SourceFile): void {
  const rel = relPathOf(sf);
  for (const stmt of sf.getVariableStatements()) {
    const isExported = stmt.isExported();
    for (const decl of stmt.getDeclarations()) {
      const initializer = unwrapAsExpressions(decl.getInitializer());
      if (!initializer) continue;
      const site: DeclSite = { isExported, symbolName: decl.getName(), line: decl.getStartLineNumber(), rel };
      if (Node.isCallExpression(initializer)) {
        handleCallInitializer(ctx, site, initializer);
        continue;
      }
      if (isExported && Node.isArrayLiteralExpression(initializer) && typeAnnotationText(decl) === ASSET_PATH_REF_ARRAY_TYPE) {
        ctx.aggregatorExports.push({ symbolName: site.symbolName, memberNames: collectArrayIdentifiers(initializer.getElements()), sourceFile: rel, line: site.line });
      }
    }
  }
}

function collectArrayIdentifiers(elements: readonly Node[]): readonly string[] {
  const out: string[] = [];
  for (const el of elements) {
    const inner = unwrapAsExpressions(el);
    if (inner && Node.isIdentifier(inner)) {
      out.push(inner.getText());
    }
  }
  return out;
}

function handleCallInitializer(ctx: ExtractContext, site: DeclSite, callExpr: CallExpression): void {
  const callee = callExpr.getExpression();
  if (Node.isIdentifier(callee)) {
    handleIdentifierCallee({ ctx, site, callExpr, calleeName: callee.getText() });
    return;
  }
  if (Node.isPropertyAccessExpression(callee)) {
    handleFluentMemberCall(ctx, site, callExpr);
  }
}

interface HandleIdentifierCalleeInput {
  readonly ctx: ExtractContext;
  readonly site: DeclSite;
  readonly callExpr: CallExpression;
  readonly calleeName: string;
}

function handleIdentifierCallee(input: HandleIdentifierCalleeInput): void {
  const { ctx, site, callExpr, calleeName } = input;
  if (calleeName === LOCAL_ASSET_BUILDER) {
    handleLocalAsset(ctx, site, readStringArg(callExpr));
    return;
  }
  if (calleeName === REMOTE_ASSET_BUILDER) {
    handleRemoteAsset(ctx, site, readStringArg(callExpr));
    return;
  }
  if (calleeName === ASSET_FOLDER_BUILDER) {
    handleAssetFolderBuilder(ctx, site, readStringArg(callExpr));
    return;
  }
  if (calleeName === REMOTE_BASE_BUILDER) {
    handleRemoteBaseBuilder(ctx, site, readStringArg(callExpr));
    return;
  }
  if (site.isExported && !KNOWN_DIRECT_BUILDERS.has(calleeName) && !KNOWN_FLUENT_BUILDERS.has(calleeName) && !ctx.trustedExternalIdentifiers.has(calleeName)) {
    ctx.unknownBuilders.push({ symbolName: site.symbolName, calleeText: calleeName, sourceFile: site.rel, line: site.line });
  }
}

function handleLocalAsset(ctx: ExtractContext, site: DeclSite, arg: string | undefined): void {
  if (!site.isExported) return;
  ctx.assetConstants.push(buildAssetConstant({ site, sourceType: 'local', helper: 'localAsset', resolved: arg }));
}

function handleRemoteAsset(ctx: ExtractContext, site: DeclSite, arg: string | undefined): void {
  if (arg !== undefined && !isAbsoluteHttpUrl(arg)) {
    ctx.invalidRemoteUrls.push({ symbolName: site.isExported ? site.symbolName : undefined, value: arg, helper: 'remoteAsset', sourceFile: site.rel, line: site.line });
  }
  if (!site.isExported) return;
  ctx.assetConstants.push(buildAssetConstant({ site, sourceType: 'remote', helper: 'remoteAsset', resolved: arg }));
}

function handleAssetFolderBuilder(ctx: ExtractContext, site: DeclSite, arg: string | undefined): void {
  const builder: ExtractedFolderBuilder = { bindingName: site.symbolName, basePath: arg ?? '', sourceFile: site.rel, line: site.line };
  ctx.folderBuildersByName.set(site.symbolName, builder);
  ctx.folderBuilders.push(builder);
  if (site.isExported) {
    ctx.unknownBuilders.push({ symbolName: site.symbolName, calleeText: ASSET_FOLDER_BUILDER, sourceFile: site.rel, line: site.line });
  }
}

function handleRemoteBaseBuilder(ctx: ExtractContext, site: DeclSite, arg: string | undefined): void {
  if (arg !== undefined && !isAbsoluteHttpUrl(arg)) {
    ctx.invalidRemoteUrls.push({ symbolName: site.isExported ? site.symbolName : undefined, value: arg, helper: 'remoteAssetBaseUrl', sourceFile: site.rel, line: site.line });
  }
  const builder: ExtractedRemoteBaseBuilder = { bindingName: site.symbolName, baseUrl: arg ?? '', sourceFile: site.rel, line: site.line };
  ctx.remoteBaseBuildersByName.set(site.symbolName, builder);
  ctx.remoteBaseBuilders.push(builder);
  if (site.isExported) {
    ctx.unknownBuilders.push({ symbolName: site.symbolName, calleeText: REMOTE_BASE_BUILDER, sourceFile: site.rel, line: site.line });
  }
}

function handleFluentMemberCall(ctx: ExtractContext, site: DeclSite, callExpr: CallExpression): void {
  const callee = callExpr.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) return;
  const identNode = callee.getExpression();
  if (!Node.isIdentifier(identNode)) return;
  const memberName = callee.getName();
  if (memberName !== 'asset' && memberName !== 'assets') return;

  const builderName = identNode.getText();
  const folder = ctx.folderBuildersByName.get(builderName);
  const remoteBase = ctx.remoteBaseBuildersByName.get(builderName);
  if (!folder && !remoteBase) return;

  const sourceType: AssetSourceType = folder ? 'local' : 'remote';
  const helper: AssetBuilderHelper = folder ? (memberName === 'asset' ? 'assetFolder.asset' : 'assetFolder.assets') : memberName === 'asset' ? 'remoteAssetBaseUrl.asset' : 'remoteAssetBaseUrl.assets';

  const args = callExpr.getArguments();
  if (args.length === 0) return;

  if (memberName === 'asset') {
    const argText = readStringArgFromNode(args[0]);
    const resolved = joinFluent({ sourceType, folder, remoteBase, child: argText });
    if (site.isExported) {
      ctx.assetConstants.push({ symbolName: site.symbolName, sourceType, helper, resolved, resolvedPaths: [], sourceFile: site.rel, line: site.line });
    }
    return;
  }

  const arrayInner = unwrapAsExpressions(args[0]);
  if (!arrayInner || !Node.isArrayLiteralExpression(arrayInner)) return;
  const resolvedPaths = collectFluentArrayPaths({ elements: arrayInner.getElements(), sourceType, folder, remoteBase });
  if (site.isExported) {
    ctx.assetConstants.push({ symbolName: site.symbolName, sourceType, helper, resolved: undefined, resolvedPaths, sourceFile: site.rel, line: site.line });
  }
}

interface CollectFluentArrayPathsInput {
  readonly elements: readonly Node[];
  readonly sourceType: AssetSourceType;
  readonly folder: ExtractedFolderBuilder | undefined;
  readonly remoteBase: ExtractedRemoteBaseBuilder | undefined;
}

function collectFluentArrayPaths(input: CollectFluentArrayPathsInput): readonly string[] {
  const out: string[] = [];
  for (const el of input.elements) {
    const inner = unwrapAsExpressions(el);
    if (inner && Node.isStringLiteral(inner)) {
      const joined = joinFluent({ sourceType: input.sourceType, folder: input.folder, remoteBase: input.remoteBase, child: inner.getLiteralText() });
      if (joined !== undefined) out.push(joined);
    }
  }
  return out;
}

interface BuildAssetConstantInput {
  readonly site: DeclSite;
  readonly sourceType: AssetSourceType;
  readonly helper: 'localAsset' | 'remoteAsset';
  readonly resolved: string | undefined;
}

function buildAssetConstant(input: BuildAssetConstantInput): ExtractedAssetConstant {
  return { symbolName: input.site.symbolName, sourceType: input.sourceType, helper: input.helper, resolved: input.resolved, resolvedPaths: [], sourceFile: input.site.rel, line: input.site.line };
}

interface JoinFluentInput {
  readonly sourceType: AssetSourceType;
  readonly folder: ExtractedFolderBuilder | undefined;
  readonly remoteBase: ExtractedRemoteBaseBuilder | undefined;
  readonly child: string | undefined;
}

function joinFluent(input: JoinFluentInput): string | undefined {
  if (input.child === undefined) return undefined;
  if (input.sourceType === 'local' && input.folder) {
    const base = input.folder.basePath.endsWith('/') ? input.folder.basePath : `${input.folder.basePath}/`;
    return `${base}${input.child}`;
  }
  if (input.sourceType === 'remote' && input.remoteBase) {
    const base = input.remoteBase.baseUrl.endsWith('/') ? input.remoteBase.baseUrl : `${input.remoteBase.baseUrl}/`;
    try {
      return new URL(input.child, base).href;
    } catch {
      return `${base}${input.child}`;
    }
  }
  return undefined;
}

function readStringArg(call: CallExpression): string | undefined {
  const args = call.getArguments();
  if (args.length === 0) return undefined;
  return readStringArgFromNode(args[0]);
}

function readStringArgFromNode(node: Node): string | undefined {
  const inner = unwrapAsExpressions(node);
  if (inner && Node.isStringLiteral(inner)) {
    return inner.getLiteralText();
  }
  return undefined;
}

function isAbsoluteHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function relPathOf(sf: SourceFile): string {
  return sf.getFilePath().replace(/^\//, '');
}

function barrelReExportsAssets(barrelText: string | undefined): boolean {
  if (!barrelText) return false;
  return BARREL_RE_EXPORT_RE.test(barrelText);
}
