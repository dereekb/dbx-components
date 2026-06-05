/**
 * Pure extractor for `dbx_color_template_list_app`.
 *
 * Walks each inspected file with ts-morph, locates the first
 * `provideDbxStyleService(...)` call, and reads the
 * `dbxColorServiceConfig.templates` entry. Inline array literals and
 * same-file identifier references are resolved; cross-file references
 * surface as warnings (the caller can re-run the tool against the
 * referenced file).
 */

import { Node, Project, SyntaxKind, type ArrayLiteralExpression, type CallExpression, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import { getPropertyInitializer, unwrapAsExpressions } from '../_core/_validate/ast.js';
import type { ColorTemplateConfig, ColorTemplateEntry, ColorTemplateProvideLocation, ColorTemplateWarning } from './types.js';
import type { ColorTemplateInspection } from './inspect.js';

const PROVIDE_FN_NAME = 'provideDbxStyleService';
const COLOR_SERVICE_CONFIG_PROP = 'dbxColorServiceConfig';
const TEMPLATES_PROP = 'templates';
const KEY_PROP = 'key';
const CONFIG_PROP = 'config';

const KNOWN_CONFIG_PROPS = new Set(['template', 'color', 'contrast', 'tone', 'tonal']);

/**
 * Extracted facts for `dbx_color_template_list_app`.
 */
export interface ExtractedColorTemplates {
  readonly templates: readonly ColorTemplateEntry[];
  readonly warnings: readonly ColorTemplateWarning[];
  readonly provideCallLocation?: ColorTemplateProvideLocation;
}

interface ExtractContext {
  readonly warnings: ColorTemplateWarning[];
  readonly templates: ColorTemplateEntry[];
  provideCallLocation: ColorTemplateProvideLocation | undefined;
}

/**
 * Pure extraction over a pre-loaded inspection. Builds an in-memory
 * ts-morph project, finds the first `provideDbxStyleService(...)` call,
 * and reduces the `dbxColorServiceConfig.templates` reference into a
 * flat list of {@link ColorTemplateEntry} records.
 *
 * @param inspection - The pre-loaded inspection (every file already read)
 * @returns The extracted templates, warnings, and provide-call location.
 */
export function extractColorTemplates(inspection: ColorTemplateInspection): ExtractedColorTemplates {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const ctx: ExtractContext = { warnings: [], templates: [], provideCallLocation: undefined };

  const sources: SourceFile[] = [];
  for (const file of inspection.files) {
    sources.push(project.createSourceFile(file.relPath, file.text, { overwrite: true }));
  }

  for (const sf of sources) {
    const call = findProvideCall(sf);
    if (call === undefined) continue;
    ctx.provideCallLocation = { file: sf.getFilePath().replace(/^\//, ''), line: call.getStartLineNumber() };
    handleProvideCall(ctx, sf, call);
    break;
  }

  const result: ExtractedColorTemplates = { templates: ctx.templates, warnings: ctx.warnings, provideCallLocation: ctx.provideCallLocation };
  return result;
}

function findProvideCall(sf: SourceFile): CallExpression | undefined {
  let result: CallExpression | undefined;
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = call.getExpression();
    if (Node.isIdentifier(callee) && callee.getText() === PROVIDE_FN_NAME) {
      result = call;
      break;
    }
  }
  return result;
}

function handleProvideCall(ctx: ExtractContext, sf: SourceFile, call: CallExpression): void {
  const args = call.getArguments();
  if (args.length === 0) return;
  const config = unwrapAsExpressions(args[0]);
  if (!config || !Node.isObjectLiteralExpression(config)) {
    ctx.warnings.push(buildWarning(sf, call, '`provideDbxStyleService` received a non-literal config argument; cannot statically read templates.'));
    return;
  }
  const colorBlock = getPropertyInitializer(config, COLOR_SERVICE_CONFIG_PROP);
  if (colorBlock === undefined) return;
  const colorBlockNode = unwrapAsExpressions(colorBlock);
  if (!colorBlockNode || !Node.isObjectLiteralExpression(colorBlockNode)) {
    ctx.warnings.push(buildWarning(sf, colorBlock, '`dbxColorServiceConfig` is not an inline object literal; templates cannot be enumerated.'));
    return;
  }
  const templatesNode = getPropertyInitializer(colorBlockNode, TEMPLATES_PROP);
  if (templatesNode === undefined) return;
  readTemplates(ctx, sf, templatesNode);
}

function readTemplates(ctx: ExtractContext, sf: SourceFile, node: Node): void {
  const inner = unwrapAsExpressions(node);
  if (!inner) return;
  if (Node.isArrayLiteralExpression(inner)) {
    readTemplatesArray(ctx, sf, inner);
    return;
  }
  if (Node.isIdentifier(inner)) {
    readTemplatesIdentifier(ctx, sf, inner);
    return;
  }
  ctx.warnings.push(buildWarning(sf, inner, '`templates` is not an array literal or named identifier; templates cannot be enumerated.'));
}

function readTemplatesArray(ctx: ExtractContext, sf: SourceFile, array: ArrayLiteralExpression): void {
  for (const element of array.getElements()) {
    const inner = unwrapAsExpressions(element);
    if (!inner) continue;
    if (!Node.isObjectLiteralExpression(inner)) {
      ctx.warnings.push(buildWarning(sf, inner, 'Template entry is not an object literal; skipped.'));
      continue;
    }
    const entry = parseTemplateEntry(ctx, sf, inner);
    if (entry !== undefined) ctx.templates.push(entry);
  }
}

function readTemplatesIdentifier(ctx: ExtractContext, sf: SourceFile, ident: Node): void {
  const name = ident.getText();
  const local = findLocalArrayDeclaration(sf, name);
  if (local !== undefined) {
    readTemplatesArray(ctx, sf, local);
    return;
  }
  ctx.warnings.push(buildWarning(sf, ident, `Identifier \`${name}\` references templates declared outside this file; inline the array (or move the constant into the root config) for static enumeration.`));
}

function parseTemplateEntry(ctx: ExtractContext, sf: SourceFile, obj: ObjectLiteralExpression): ColorTemplateEntry | undefined {
  let key: string | undefined;
  const keyInit = unwrapAsExpressions(getPropertyInitializer(obj, KEY_PROP));
  if (keyInit && Node.isStringLiteral(keyInit)) {
    key = keyInit.getLiteralText();
  }
  const configInit = unwrapAsExpressions(getPropertyInitializer(obj, CONFIG_PROP));
  let configEntry: ColorTemplateConfig | undefined;
  if (configInit && Node.isObjectLiteralExpression(configInit)) {
    configEntry = parseConfig(ctx, sf, configInit);
  }
  let entry: ColorTemplateEntry | undefined;
  if (key === undefined) {
    ctx.warnings.push(buildWarning(sf, obj, 'Template entry is missing a string-literal `key`; skipped.'));
  } else if (configEntry === undefined) {
    ctx.warnings.push(buildWarning(sf, obj, `Template \`${key}\` has no inline \`config\` object literal; skipped.`));
  } else {
    entry = { key, config: configEntry, sourceFile: sf.getFilePath().replace(/^\//, ''), sourceLine: obj.getStartLineNumber() };
  }
  return entry;
}

function parseConfig(ctx: ExtractContext, sf: SourceFile, obj: ObjectLiteralExpression): ColorTemplateConfig {
  const result: { -readonly [K in keyof ColorTemplateConfig]: ColorTemplateConfig[K] } = {};
  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const name = prop.getName();
    if (!KNOWN_CONFIG_PROPS.has(name)) continue;
    const value = unwrapAsExpressions(prop.getInitializer());
    if (value === undefined) continue;
    assignConfigField({ ctx, sf, result, name, value });
  }
  return result;
}

interface AssignConfigFieldInput {
  readonly ctx: ExtractContext;
  readonly sf: SourceFile;
  readonly result: { -readonly [K in keyof ColorTemplateConfig]: ColorTemplateConfig[K] };
  readonly name: string;
  readonly value: Node;
}

function assignConfigField(input: AssignConfigFieldInput): void {
  const { ctx, sf, result, name, value } = input;
  if (name === 'tonal') {
    if (value.getKind() === SyntaxKind.TrueKeyword) {
      result.tonal = true;
    } else if (value.getKind() === SyntaxKind.FalseKeyword) {
      result.tonal = false;
    } else {
      ctx.warnings.push(buildWarning(sf, value, `Template config field \`tonal\` is not a boolean literal; ignored.`));
    }
    return;
  }
  if (name === 'tone') {
    if (Node.isNumericLiteral(value)) {
      result.tone = Number(value.getText());
    } else {
      ctx.warnings.push(buildWarning(sf, value, `Template config field \`tone\` is not a numeric literal; ignored.`));
    }
    return;
  }
  if (Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value)) {
    const text = value.getLiteralText();
    if (name === 'template') result.template = text;
    else if (name === 'color') result.color = text;
    else if (name === 'contrast') result.contrast = text;
    return;
  }
  ctx.warnings.push(buildWarning(sf, value, `Template config field \`${name}\` is not a string literal; ignored.`));
}

function findLocalArrayDeclaration(sf: SourceFile, name: string): ArrayLiteralExpression | undefined {
  let result: ArrayLiteralExpression | undefined;
  for (const stmt of sf.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      if (decl.getName() !== name) continue;
      const init = unwrapAsExpressions(decl.getInitializer());
      if (init && Node.isArrayLiteralExpression(init)) {
        result = init;
      }
    }
  }
  return result;
}

function buildWarning(sf: SourceFile, node: Node, message: string): ColorTemplateWarning {
  const file = sf.getFilePath().replace(/^\//, '');
  const line = node.getStartLineNumber();
  return { file, line, message };
}
