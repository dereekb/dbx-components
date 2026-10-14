/**
 * Scanner for an API app's callModel handler map (`src/app/function/model/crud.functions.ts`).
 *
 * The convention (see `apps/demo-api/src/app/function/model/crud.functions.ts`):
 *
 * ```ts
 * export const demoCreateModelMap: DemoOnCallCreateModelMap = {
 *   guestbook: createGuestbook,                              // bare handler ref
 *   profile: profileCreate,
 *   storageFile: onCallSpecifierHandler({                    // specifier map
 *     _: storageFileCreate,
 *     fromUpload: storageFileInitializeFromUpload
 *   })
 * };
 * ```
 *
 * For each verb (`Create` / `Read` / `Update` / `Delete` / `Query` / `Invoke`), the scan locates the
 * matching `<group><Verb>ModelMap` / `<APP>_<VERB>_MODEL_MAP` consts and flattens them into
 * `(model, verb, specifier, handlerName, line)` cells. A bare handler ref produces a single cell
 * with no specifier. Constructs the scan cannot read (spreads, computed keys, non-literal maps or
 * specifier configs, wrapped handlers) are reported as {@link CallModelHandlerMapOpaque} records so
 * callers can fail open for the verb / model they cover.
 *
 * Canonical source for both `dbx_model_api_validate_app` (`@dereekb/dbx-cli/validate`) and the
 * `dbx-cli-firebase-api-manifest` build CLI's `--api-dir` filter, so both agree on what "registered"
 * means.
 */

import { Node, Project, type ObjectLiteralExpression, type PropertyAssignment, type SourceFile } from 'ts-morph';
import type { ExtractCrudInput } from './extract-crud';
import type { CrudVerb } from './types';

/**
 * Path of an API app's callModel handler map, relative to the API app root.
 */
export const CALL_MODEL_HANDLER_MAP_PATH = 'src/app/function/model/crud.functions.ts';

/**
 * One (model, verb, specifier) cell a verb map registers.
 */
export interface CallModelHandlerMapCell {
  readonly model: string;
  readonly verb: CrudVerb;
  /**
   * Absent for a bare (non-specifier) handler, which serves only the default `_` specifier.
   */
  readonly specifier?: string;
  readonly handlerName: string;
  readonly line: number;
}

/**
 * Why a handler-map construct could not be read.
 *
 * - `verb_map_not_literal` — `X_UPDATE_MODEL_MAP = buildMap()`; the verb's model set is unknown.
 * - `verb_map_member` — `...OTHER_MAP`, a computed key or a method; the verb's model set is unknown.
 * - `specifier_config_not_literal` — `onCallSpecifierHandler(config)`; the model's specifiers are unknown.
 * - `specifier_config_member` — a spread / computed key inside the specifier literal.
 * - `model_handler_expression` — `profile: inAuthContext(fn)`; read as bare, but specifiers can't be ruled out.
 */
export type CallModelHandlerMapOpaqueReason = 'verb_map_not_literal' | 'verb_map_member' | 'specifier_config_not_literal' | 'specifier_config_member' | 'model_handler_expression';

/**
 * A handler-map construct the scan cannot read. `model` is absent when the whole verb is unreadable.
 */
export interface CallModelHandlerMapOpaque {
  readonly verb: CrudVerb;
  readonly model?: string;
  readonly reason: CallModelHandlerMapOpaqueReason;
  readonly line: number;
}

/**
 * Plain-data output of {@link extractCallModelHandlerMap}.
 */
export interface CallModelHandlerMapExtraction {
  /**
   * Verbs whose map const resolved to an object literal, in declaration order.
   */
  readonly verbsFound: readonly CrudVerb[];
  readonly cells: readonly CallModelHandlerMapCell[];
  readonly opaque: readonly CallModelHandlerMapOpaque[];
}

/**
 * A {@link CallModelHandlerMapCell} plus the AST node its handler is referenced by.
 */
export interface CallModelHandlerMapSourceCell extends CallModelHandlerMapCell {
  /**
   * The unwrapped handler value node, or a shorthand's name node — what validate follows to `withApiDetails`.
   */
  readonly reference: Node;
}

/**
 * AST-level output of {@link extractCallModelHandlerMapFromSourceFile}.
 */
export interface CallModelHandlerMapSourceExtraction extends Omit<CallModelHandlerMapExtraction, 'cells'> {
  readonly cells: readonly CallModelHandlerMapSourceCell[];
}

const VERB_TOKENS: ReadonlyArray<{ readonly token: string; readonly verb: CrudVerb }> = [
  { token: 'Create', verb: 'create' },
  { token: 'Read', verb: 'read' },
  { token: 'Update', verb: 'update' },
  { token: 'Delete', verb: 'delete' },
  { token: 'Query', verb: 'query' },
  { token: 'Invoke', verb: 'invoke' }
];

/**
 * Text the callee of a specifier-map call ends with. Matched by suffix so namespace calls
 * (`fs.onCallSpecifierHandler(...)`) still count.
 */
const SPECIFIER_HANDLER_CALLEE = 'onCallSpecifierHandler';

/**
 * Handler name recorded for a specifier whose value is not a readable identifier.
 */
const UNRESOLVED_HANDLER_NAME = '(unresolved)';

/**
 * Walks every `<group><Verb>ModelMap` / `<APP>_<VERB>_MODEL_MAP` const in an already-parsed handler
 * map and flattens it into cells, keeping each cell's AST reference.
 *
 * @param sourceFile - The parsed `crud.functions.ts` source.
 * @returns The registered cells, the verbs whose maps were found, and the constructs the scan could not read.
 */
export function extractCallModelHandlerMapFromSourceFile(sourceFile: SourceFile): CallModelHandlerMapSourceExtraction {
  const verbsFound: CrudVerb[] = [];
  const cells: CallModelHandlerMapSourceCell[] = [];
  const opaque: CallModelHandlerMapOpaque[] = [];

  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const verb = matchVerbFromConstName(decl.getName());
      const initializer = verb ? decl.getInitializer() : undefined;

      if (verb && initializer) {
        const mapLiteral = unwrapOuterExpressions(initializer);

        if (Node.isObjectLiteralExpression(mapLiteral)) {
          verbsFound.push(verb);
          collectVerbMap({ verb, mapLiteral, cells, opaque });
        } else {
          opaque.push({ verb, reason: 'verb_map_not_literal', line: decl.getStartLineNumber() });
        }
      }
    }
  }

  return { verbsFound, cells, opaque };
}

/**
 * Parses a handler-map source and returns its registered cells as plain data.
 *
 * @param source - In-memory source name + text pair to scan.
 * @returns The registered cells, the verbs whose maps were found, and the constructs the scan could not read.
 */
export function extractCallModelHandlerMap(source: ExtractCrudInput): CallModelHandlerMapExtraction {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(source.name, source.text, { overwrite: true });
  const { verbsFound, cells, opaque } = extractCallModelHandlerMapFromSourceFile(sourceFile);
  return { verbsFound, cells: cells.map(toPlainCell), opaque };
}

function toPlainCell(cell: CallModelHandlerMapSourceCell): CallModelHandlerMapCell {
  const { model, verb, specifier, handlerName, line } = cell;
  return specifier === undefined ? { model, verb, handlerName, line } : { model, verb, specifier, handlerName, line };
}

function matchVerbFromConstName(name: string): CrudVerb | undefined {
  let result: CrudVerb | undefined;

  for (const { token, verb } of VERB_TOKENS) {
    if (name.endsWith(`${token}ModelMap`) || name.endsWith(`_${token.toUpperCase()}_MODEL_MAP`)) {
      result = verb;
      break;
    }
  }

  return result;
}

interface CollectVerbMapInput {
  readonly verb: CrudVerb;
  readonly mapLiteral: ObjectLiteralExpression;
  readonly cells: CallModelHandlerMapSourceCell[];
  readonly opaque: CallModelHandlerMapOpaque[];
}

function collectVerbMap(input: CollectVerbMapInput): void {
  const { verb, mapLiteral, cells, opaque } = input;

  for (const prop of mapLiteral.getProperties()) {
    const line = prop.getStartLineNumber();
    const model = Node.isPropertyAssignment(prop) ? readPropertyKey(prop) : undefined;
    const value = Node.isPropertyAssignment(prop) ? prop.getInitializer() : undefined;

    if (Node.isShorthandPropertyAssignment(prop)) {
      const name = prop.getName();
      cells.push({ model: name, verb, handlerName: name, line, reference: prop.getNameNode() });
    } else if (model !== undefined && value !== undefined) {
      collectModelHandler({ verb, model, value, line, cells, opaque });
    } else {
      opaque.push({ verb, reason: 'verb_map_member', line });
    }
  }
}

interface CollectModelHandlerInput {
  readonly verb: CrudVerb;
  readonly model: string;
  readonly value: Node;
  readonly line: number;
  readonly cells: CallModelHandlerMapSourceCell[];
  readonly opaque: CallModelHandlerMapOpaque[];
}

function collectModelHandler(input: CollectModelHandlerInput): void {
  const { verb, model, value, line, cells, opaque } = input;
  const handler = unwrapOuterExpressions(value);

  if (Node.isCallExpression(handler) && handler.getExpression().getText().endsWith(SPECIFIER_HANDLER_CALLEE)) {
    const firstArg = handler.getArguments().at(0);
    const config = firstArg ? unwrapOuterExpressions(firstArg) : undefined;

    if (config && Node.isObjectLiteralExpression(config)) {
      collectSpecifierMap({ verb, model, config, line, cells, opaque });
    } else {
      opaque.push({ verb, model, reason: 'specifier_config_not_literal', line });
    }
  } else {
    const handlerName = readBareHandlerName(handler);

    if (handlerName) {
      cells.push({ model, verb, handlerName, line, reference: handler });
    }

    if (!Node.isIdentifier(handler)) {
      opaque.push({ verb, model, reason: 'model_handler_expression', line });
    }
  }
}

interface CollectSpecifierMapInput {
  readonly verb: CrudVerb;
  readonly model: string;
  readonly config: ObjectLiteralExpression;
  /**
   * Line of the model's property in the verb map; every specifier cell cites it.
   */
  readonly line: number;
  readonly cells: CallModelHandlerMapSourceCell[];
  readonly opaque: CallModelHandlerMapOpaque[];
}

function collectSpecifierMap(input: CollectSpecifierMapInput): void {
  const { verb, model, config, line, cells, opaque } = input;

  for (const prop of config.getProperties()) {
    const specifier = Node.isPropertyAssignment(prop) ? readPropertyKey(prop) : undefined;
    const value = Node.isPropertyAssignment(prop) ? prop.getInitializer() : undefined;

    if (Node.isShorthandPropertyAssignment(prop)) {
      const name = prop.getName();
      cells.push({ model, verb, specifier: name, handlerName: name, line, reference: prop.getNameNode() });
    } else if (specifier !== undefined && value !== undefined) {
      const handler = unwrapOuterExpressions(value);
      cells.push({ model, verb, specifier, handlerName: readBareHandlerName(handler) ?? UNRESOLVED_HANDLER_NAME, line, reference: handler });
    } else {
      opaque.push({ verb, model, reason: 'specifier_config_member', line: prop.getStartLineNumber() });
    }
  }
}

/**
 * Reads a property's key: identifiers and numbers as written, string literals without their quotes.
 *
 * @param prop - The property assignment.
 * @returns The key, or `undefined` for a computed key.
 */
function readPropertyKey(prop: PropertyAssignment): string | undefined {
  const nameNode = prop.getNameNode();
  let result: string | undefined;

  if (Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode)) {
    result = nameNode.getLiteralValue();
  } else if (!Node.isComputedPropertyName(nameNode)) {
    result = nameNode.getText();
  }

  return result;
}

function readBareHandlerName(node: Node): string | undefined {
  let result: string | undefined;

  if (Node.isIdentifier(node)) {
    result = node.getText();
  } else {
    // Best-effort fallback for inline expressions.
    const text = node.getText().split(/\s|\(/)[0];

    if (/^[A-Za-z_]\w*$/.test(text)) {
      result = text;
    }
  }

  return result;
}

/**
 * Strips `as` / `satisfies` / `<T>` casts, parentheses and `!` around an expression.
 *
 * Local copy of validate's helper of the same name; manifest-extract cannot import validate.
 *
 * @param node - The node to unwrap.
 * @returns The innermost wrapped expression.
 */
function unwrapOuterExpressions(node: Node): Node {
  let current = node;

  while (Node.isAsExpression(current) || Node.isSatisfiesExpression(current) || Node.isTypeAssertion(current) || Node.isParenthesizedExpression(current) || Node.isNonNullExpression(current)) {
    current = current.getExpression();
  }

  return current;
}
