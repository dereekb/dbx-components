/**
 * Walks the API app's `<apiDir>/src/app/common/model/**\/*.action.server.ts`
 * files and builds a lookup map keyed by params-type name. The lookup is
 * used by `dbx_model_api_lookup` to attach action/factory JSDoc to each
 * CRUD entry.
 *
 * Two parallel sources of resolution per params type:
 * 1. Methods on `*ServerActions` abstract classes — keyed by the first
 *    parameter's type name.
 * 2. Top-level factory functions matching `<X>Factory(context)` whose body
 *    calls `firebaseServerActionTransformFunctionFactory(<validator>, ...)`.
 *    The validator name (e.g. `createGuestbookParamsType`) maps back to the
 *    params type by stripping the `Type` suffix.
 */

import { readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { Project, SyntaxKind, type SourceFile } from 'ts-morph';
import { collectFilesWithSuffix } from '../_core/collect-files.js';
import type { ActionResolution, FactoryResolution } from './types.js';

const ACTION_SERVER_SUFFIX = '.action.server.ts';
const COMMON_MODEL_SUBPATH = 'src/app/common/model';

export interface ActionLookupResult {
  readonly methodsByParams: ReadonlyMap<string, ActionResolution>;
  readonly factoriesByParams: ReadonlyMap<string, FactoryResolution>;
  readonly filesScanned: number;
}

/**
 * Walks the API app's action.server.ts files and builds a lookup map keyed
 * by params-type name.
 *
 * @param apiAbs - Absolute path to the API package root.
 * @returns The populated lookup maps and file count.
 */
export async function buildActionLookup(apiAbs: string): Promise<ActionLookupResult> {
  const modelRoot = join(apiAbs, COMMON_MODEL_SUBPATH);
  const files = await collectFilesWithSuffix(modelRoot, ACTION_SERVER_SUFFIX);
  const methodsByParams = new Map<string, ActionResolution>();
  const factoriesByParams = new Map<string, FactoryResolution>();
  if (files.length === 0) {
    return { methodsByParams, factoriesByParams, filesScanned: 0 };
  }
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  for (const filePath of files) {
    const text = await readFile(filePath, 'utf8');
    const sourceFile = project.createSourceFile(filePath, text, { overwrite: true });
    const sourceFileRel = relative(apiAbs, filePath).split(sep).join('/');
    collectAbstractMethods({ sourceFile, sourceFileRel, methodsByParams });
    collectFactoryFunctions({ sourceFile, sourceFileRel, factoriesByParams });
  }
  return { methodsByParams, factoriesByParams, filesScanned: files.length };
}

interface CollectMethodsInput {
  readonly sourceFile: SourceFile;
  readonly sourceFileRel: string;
  readonly methodsByParams: Map<string, ActionResolution>;
}

function collectAbstractMethods(input: CollectMethodsInput): void {
  const { sourceFile, sourceFileRel, methodsByParams } = input;
  for (const cls of sourceFile.getClasses()) {
    const className = cls.getName();
    if (!isServerActionsClass(cls, className)) continue;
    for (const method of cls.getMethods()) {
      addMethodEntryIfAbsent({ className: className as string, method, sourceFileRel, methodsByParams });
    }
  }
}

function isServerActionsClass(cls: ReturnType<SourceFile['getClasses']>[number], className: string | undefined): boolean {
  if (!className) return false;
  if (!cls.isAbstract()) return false;
  return className.endsWith('ServerActions');
}

interface AddMethodEntryInput {
  readonly className: string;
  readonly method: ReturnType<ReturnType<SourceFile['getClasses']>[number]['getMethods']>[number];
  readonly sourceFileRel: string;
  readonly methodsByParams: Map<string, ActionResolution>;
}

function addMethodEntryIfAbsent(input: AddMethodEntryInput): void {
  const { className, method, sourceFileRel, methodsByParams } = input;
  const params = method.getParameters();
  if (params.length === 0) return;
  const paramTypeNode = params[0].getTypeNode();
  if (!paramTypeNode) return;
  const paramsTypeName = paramTypeNode.getText();
  if (methodsByParams.has(paramsTypeName)) return;
  methodsByParams.set(paramsTypeName, {
    className,
    methodName: method.getName(),
    sourceFile: sourceFileRel,
    line: method.getStartLineNumber(),
    jsDoc: readJsDoc(method.getJsDocs())
  });
}

interface CollectFactoriesInput {
  readonly sourceFile: SourceFile;
  readonly sourceFileRel: string;
  readonly factoriesByParams: Map<string, FactoryResolution>;
}

function collectFactoryFunctions(input: CollectFactoriesInput): void {
  const { sourceFile, sourceFileRel, factoriesByParams } = input;
  for (const fn of sourceFile.getFunctions()) {
    const fnName = fn.getName();
    if (!fnName?.endsWith('Factory')) continue;
    const validatorName = findValidatorArgInBody(fn);
    if (!validatorName) continue;
    const paramsTypeName = stripParamsTypeSuffix(validatorName);
    if (!paramsTypeName) continue;
    const jsDoc = readJsDoc(fn.getJsDocs());
    if (!factoriesByParams.has(paramsTypeName)) {
      factoriesByParams.set(paramsTypeName, {
        factoryName: fnName,
        sourceFile: sourceFileRel,
        line: fn.getStartLineNumber(),
        jsDoc
      });
    }
  }
}

function findValidatorArgInBody(fn: ReturnType<SourceFile['getFunctions']>[number]): string | undefined {
  for (const call of fn.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    const exprText = expr.getText();
    if (!exprText.endsWith('firebaseServerActionTransformFunctionFactory')) continue;
    const args = call.getArguments();
    if (args.length === 0) continue;
    const firstArg = args[0];
    const text = firstArg.getText();
    if (text.endsWith('ParamsType')) {
      return text;
    }
  }
  return undefined;
}

function stripParamsTypeSuffix(validatorName: string): string | undefined {
  if (!validatorName.endsWith('ParamsType')) {
    return undefined;
  }
  const stem = validatorName.slice(0, -'Type'.length);
  if (!stem.endsWith('Params')) {
    return undefined;
  }
  return stem.charAt(0).toUpperCase() + stem.slice(1);
}

function readJsDoc(jsDocs: ReturnType<ReturnType<SourceFile['getFunctions']>[number]['getJsDocs']>): string | undefined {
  const last = jsDocs.at(-1);
  if (!last) {
    return undefined;
  }
  const description = last.getDescription().trim();
  return description.length > 0 ? description : undefined;
}
