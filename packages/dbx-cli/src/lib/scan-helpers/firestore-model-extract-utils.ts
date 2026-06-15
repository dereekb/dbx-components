/**
 * Pure ts-morph helpers shared by the two Firestore-model extractors that
 * mirror `scripts/extract-firebase-models.mjs`: the rich `mcp-scan` walker in
 * this package (`mcp-scan/scan/extract-models/*`) and the lightweight
 * per-file walker in the `@dereekb/dbx-cli/manifest-extract` sub-lib. Both
 * reimplemented the identical `firestoreModelIdentity(...)` argument parsing
 * and `extends` passthrough-wrapper peeling; centralizing them here keeps the
 * two extractors in lock-step without duplicating the logic.
 */

import { Node, type ExpressionWithTypeArguments, type TypeNode } from 'ts-morph';

/**
 * TS utility/structural wrappers that don't change the field surface for
 * inheritance walks — `Partial<T>`, `Required<T>`, `Readonly<T>`,
 * `NonNullable<T>` preserve every property, and `Pick<T, K>` / `Omit<T, K>`
 * leave the original `T` reachable for long-name resolution. `MaybeMap<T>` is
 * the workspace's own pass-through that decorates each prop with `Maybe<…>`
 * without renaming. `extends` walks need to see through these to find the
 * concrete ancestor interface — `getExpression()` alone returns just the
 * leftmost identifier (`Partial`, `Pick`, …) and silently drops the inner
 * model, leaving every inherited `@dbxModelVariable` tag unreachable.
 */
const PASSTHROUGH_TYPE_WRAPPERS: ReadonlySet<string> = new Set(['Partial', 'Required', 'Readonly', 'NonNullable', 'MaybeMap', 'Pick', 'Omit']);

/**
 * The model-type, collection-prefix, and parent-identity const parsed out of a
 * `firestoreModelIdentity(...)` call by {@link parseFirestoreModelIdentityArgs}.
 */
export interface ParsedModelIdentityArgs {
  readonly modelType: string;
  readonly collectionPrefix: string | undefined;
  readonly parentIdentityConst: string | undefined;
}

/**
 * Parses the arguments of a `firestoreModelIdentity(...)` call into its
 * model-type / prefix / parent-identity parts, handling the 1/2/3-arg shapes:.
 *
 *   • `firestoreModelIdentity('user')` → `modelType: 'user'`
 *   • `firestoreModelIdentity('storageFile', 'sf')` → `modelType: 'storageFile'`, `prefix: 'sf'`
 *   • `firestoreModelIdentity(notificationBoxIdentity, 'notification')` → `parent: 'notificationBoxIdentity'`, `modelType: 'notification'`
 *   • `firestoreModelIdentity(guestbookIdentity, 'guestbookEntry', 'gbe')` → all three
 *
 * @param args - The call's argument nodes (e.g. `call.getArguments()`).
 * @returns The parsed parts, or `undefined` when the shape is unrecognisable.
 */
export function parseFirestoreModelIdentityArgs(args: readonly Node[]): ParsedModelIdentityArgs | undefined {
  let result: ParsedModelIdentityArgs | undefined;
  if (args.length === 1) {
    const modelType = stringLiteralValue(args[0]);
    if (modelType !== undefined) {
      result = { modelType, collectionPrefix: undefined, parentIdentityConst: undefined };
    }
  } else if (args.length === 2) {
    const first = stringLiteralValue(args[0]);
    if (first === undefined) {
      const modelType = stringLiteralValue(args[1]);
      if (modelType !== undefined) {
        result = { modelType, collectionPrefix: undefined, parentIdentityConst: identifierName(args[0]) };
      }
    } else {
      result = { modelType: first, collectionPrefix: stringLiteralValue(args[1]), parentIdentityConst: undefined };
    }
  } else if (args.length >= 3) {
    const modelType = stringLiteralValue(args[1]);
    if (modelType !== undefined) {
      result = { modelType, collectionPrefix: stringLiteralValue(args[2]), parentIdentityConst: identifierName(args[0]) };
    }
  }
  return result;
}

/**
 * Resolves an `extends` clause to the concrete ancestor interface name,
 * peeling any leading {@link PASSTHROUGH_TYPE_WRAPPERS}. Returns the leftmost
 * identifier of the unwrapped expression so the inheritance walker can chain
 * through utility-wrapped declarations like
 * `extends Partial<MaybeMap<Omit<Base, '…'>>>`.
 *
 * @param expr - The `ExpressionWithTypeArguments` produced by `getExtends()`
 * @returns The resolved interface name, or the original leftmost identifier when no inner reference is reachable.
 */
export function resolveExtendsName(expr: ExpressionWithTypeArguments): string {
  const head = expr.getExpression().getText();
  let result = head;
  if (PASSTHROUGH_TYPE_WRAPPERS.has(head)) {
    const typeArgs = expr.getTypeArguments();
    if (typeArgs.length > 0) {
      const peeled = peelTypeNode(typeArgs[0]);
      if (peeled !== undefined) {
        result = peeled;
      }
    }
  }
  return result;
}

function peelTypeNode(node: TypeNode): string | undefined {
  let current: TypeNode = node;
  while (Node.isParenthesizedTypeNode(current)) {
    current = current.getTypeNode();
  }
  let result: string | undefined;
  if (Node.isTypeReference(current)) {
    const name = current.getTypeName().getText();
    if (PASSTHROUGH_TYPE_WRAPPERS.has(name)) {
      const inner = current.getTypeArguments();
      if (inner.length > 0) {
        result = peelTypeNode(inner[0]);
      }
    } else {
      result = name;
    }
  }
  return result;
}

function stringLiteralValue(node: Node): string | undefined {
  let result: string | undefined;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    result = node.getLiteralText();
  }
  return result;
}

function identifierName(node: Node): string | undefined {
  let result: string | undefined;
  if (Node.isIdentifier(node)) {
    result = node.getText();
  }
  return result;
}
