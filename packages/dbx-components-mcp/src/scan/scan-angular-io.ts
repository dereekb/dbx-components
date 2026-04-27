/**
 * Generic Angular `@Input`/`input()`/`@Output`/`output()` AST parsing.
 *
 * The five `*-extract.ts` modules each need to walk Angular class members and
 * normalise inputs/outputs into a domain-specific entry shape. The mechanics
 * of that walk (decorator vs. signal call detection, alias extraction, type
 * fallback rules) are identical; only the resulting record shape and dedupe
 * key differ. This module exposes that walk as a generic helper that takes a
 * per-domain entry-builder callback.
 */

import { Node, type CallExpression, type ClassDeclaration, type PropertyDeclaration } from 'ts-morph';
import { isVisibleProperty, readPropertyDescription, readStringProperty } from './scan-extract-utils.js';

// MARK: Public types
/**
 * Normalised view of a single `@Input`-decorated property or signal `input()`
 * call. Each `*-extract.ts` module maps this into its own domain entry shape
 * via the {@link ExtractAngularInputsOptions.buildEntry} callback.
 */
export interface ParsedAngularInput {
  readonly propertyName: string;
  readonly alias: string;
  readonly type: string;
  readonly required: boolean;
  readonly defaultValue?: string;
  readonly description: string;
}

/**
 * Normalised view of a single `@Output`-decorated property or signal
 * `output()` call. Each `*-extract.ts` module maps this into its own domain
 * entry shape via the {@link ExtractAngularOutputsOptions.buildEntry}
 * callback.
 */
export interface ParsedAngularOutput {
  readonly propertyName: string;
  readonly name: string;
  readonly type: string;
  readonly description: string;
}

/**
 * Options for {@link extractAngularInputs}. The caller supplies a
 * per-domain entry builder and dedupe key extractor; everything else is
 * defaulted.
 */
export interface ExtractAngularInputsOptions<TEntry> {
  readonly buildEntry: (parsed: ParsedAngularInput, property: PropertyDeclaration) => TEntry;
  readonly dedupeBy: (entry: TEntry) => string;
  readonly propertySource?: (decl: ClassDeclaration) => Iterable<PropertyDeclaration>;
  readonly skipProperty?: (property: PropertyDeclaration) => boolean;
}

/**
 * Options for {@link extractAngularOutputs}. Mirrors
 * {@link ExtractAngularInputsOptions} for the output side.
 */
export interface ExtractAngularOutputsOptions<TEntry> {
  readonly buildEntry: (parsed: ParsedAngularOutput, property: PropertyDeclaration) => TEntry;
  readonly dedupeBy: (entry: TEntry) => string;
  readonly propertySource?: (decl: ClassDeclaration) => Iterable<PropertyDeclaration>;
  readonly skipProperty?: (property: PropertyDeclaration) => boolean;
}

// MARK: Inputs
/**
 * Walks the supplied class's properties looking for Angular inputs (either
 * `@Input()` decorated or initialised with a signal `input()` call) and
 * builds a per-domain entry for each visible match. Returns entries in
 * source order with duplicates (per `dedupeBy`) dropped.
 */
export function extractAngularInputs<TEntry>(decl: ClassDeclaration, options: ExtractAngularInputsOptions<TEntry>): readonly TEntry[] {
  const { buildEntry, dedupeBy } = options;
  const propertySource = options.propertySource ?? defaultPropertySource;
  const skipProperty = options.skipProperty ?? defaultSkipProperty;

  const out: TEntry[] = [];
  const seen = new Set<string>();
  for (const property of propertySource(decl)) {
    if (skipProperty(property)) {
      continue;
    }
    const parsed = parseDecoratorInput(property) ?? parseSignalInput(property);
    if (parsed === undefined) {
      continue;
    }
    const entry = buildEntry(parsed, property);
    const key = dedupeBy(entry);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(entry);
    }
  }
  return out;
}

// MARK: Outputs
/**
 * Walks the supplied class's properties looking for Angular outputs (either
 * `@Output()` decorated or initialised with a signal `output()` call) and
 * builds a per-domain entry for each visible match. Returns entries in
 * source order with duplicates (per `dedupeBy`) dropped.
 */
export function extractAngularOutputs<TEntry>(decl: ClassDeclaration, options: ExtractAngularOutputsOptions<TEntry>): readonly TEntry[] {
  const { buildEntry, dedupeBy } = options;
  const propertySource = options.propertySource ?? defaultPropertySource;
  const skipProperty = options.skipProperty ?? defaultSkipProperty;

  const out: TEntry[] = [];
  const seen = new Set<string>();
  for (const property of propertySource(decl)) {
    if (skipProperty(property)) {
      continue;
    }
    const parsed = parseDecoratorOutput(property) ?? parseSignalOutput(property);
    if (parsed === undefined) {
      continue;
    }
    const entry = buildEntry(parsed, property);
    const key = dedupeBy(entry);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(entry);
    }
  }
  return out;
}

// MARK: Helper to walk inheritance chain
/**
 * Walks `decl` and every reachable base class, returning their direct
 * `getProperties()` in superclass-first ... err, subclass-first order, with
 * cycle protection. Useful for {@link ExtractAngularInputsOptions.propertySource}
 * when a domain wants to inherit decorated properties from base classes.
 */
export function collectClassPropertiesWithInheritance(decl: ClassDeclaration): readonly PropertyDeclaration[] {
  const out: PropertyDeclaration[] = [];
  let current: ClassDeclaration | undefined = decl;
  const visited = new Set<ClassDeclaration>();
  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    for (const property of current.getProperties()) {
      out.push(property);
    }
    current = current.getBaseClass();
  }
  return out;
}

// MARK: Defaults
function defaultPropertySource(decl: ClassDeclaration): readonly PropertyDeclaration[] {
  return decl.getProperties();
}

function defaultSkipProperty(property: PropertyDeclaration): boolean {
  return !isVisibleProperty(property);
}

// MARK: @Input / input()
function parseDecoratorInput(property: PropertyDeclaration): ParsedAngularInput | undefined {
  const decorator = property.getDecorator('Input');
  if (decorator === undefined) {
    return undefined;
  }
  const propertyName = property.getName();
  const decoratorArg = decorator.getCallExpression()?.getArguments()[0];
  let alias: string | undefined;
  let requiredFromDecorator: boolean | undefined;
  if (decoratorArg !== undefined) {
    if (Node.isStringLiteral(decoratorArg) || Node.isNoSubstitutionTemplateLiteral(decoratorArg)) {
      alias = decoratorArg.getLiteralText();
    } else if (Node.isObjectLiteralExpression(decoratorArg)) {
      alias = readStringProperty(decoratorArg, 'alias');
      const requiredProp = decoratorArg.getProperty('required');
      if (requiredProp !== undefined && Node.isPropertyAssignment(requiredProp)) {
        const init = requiredProp.getInitializer();
        if (init !== undefined) {
          const text = init.getText();
          if (text === 'true') {
            requiredFromDecorator = true;
          } else if (text === 'false') {
            requiredFromDecorator = false;
          }
        }
      }
    }
  }
  const required = requiredFromDecorator ?? !property.hasQuestionToken();
  const type = property.getTypeNode()?.getText() ?? 'unknown';
  const initializer = property.getInitializer();
  const defaultValue = initializer === undefined ? undefined : initializer.getText();
  return {
    propertyName,
    alias: alias ?? propertyName,
    type,
    required,
    description: readPropertyDescription(property),
    ...(defaultValue === undefined ? {} : { defaultValue })
  };
}

function parseSignalInput(property: PropertyDeclaration): ParsedAngularInput | undefined {
  const initializer = property.getInitializer();
  if (initializer === undefined || !Node.isCallExpression(initializer)) {
    return undefined;
  }
  const callKind = classifySignalInputCall(initializer);
  if (callKind === undefined) {
    return undefined;
  }
  const propertyName = property.getName();
  const typeArgs = initializer.getTypeArguments();
  const inferredType = typeArgs.length > 0 ? typeArgs[0].getText() : 'unknown';
  const args = initializer.getArguments();
  let alias: string | undefined;
  let defaultValue: string | undefined;
  if (callKind === 'plain') {
    if (args.length > 0) {
      defaultValue = args[0].getText();
    }
    if (args.length > 1 && Node.isObjectLiteralExpression(args[1])) {
      alias = readStringProperty(args[1], 'alias');
    }
  } else if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
    alias = readStringProperty(args[0], 'alias');
  }
  return {
    propertyName,
    alias: alias ?? propertyName,
    type: inferredType,
    required: callKind === 'required',
    description: readPropertyDescription(property),
    ...(defaultValue === undefined ? {} : { defaultValue })
  };
}

type SignalInputCallKind = 'plain' | 'required';

function classifySignalInputCall(call: CallExpression): SignalInputCallKind | undefined {
  const expression = call.getExpression();
  let result: SignalInputCallKind | undefined;
  if (Node.isIdentifier(expression) && expression.getText() === 'input') {
    result = 'plain';
  } else if (Node.isPropertyAccessExpression(expression)) {
    const baseExpr = expression.getExpression();
    const propertyName = expression.getName();
    if (Node.isIdentifier(baseExpr) && baseExpr.getText() === 'input' && propertyName === 'required') {
      result = 'required';
    }
  }
  return result;
}

// MARK: @Output / output()
function parseDecoratorOutput(property: PropertyDeclaration): ParsedAngularOutput | undefined {
  const decorator = property.getDecorator('Output');
  if (decorator === undefined) {
    return undefined;
  }
  const propertyName = property.getName();
  const decoratorArg = decorator.getCallExpression()?.getArguments()[0];
  let alias: string | undefined;
  if (decoratorArg !== undefined && (Node.isStringLiteral(decoratorArg) || Node.isNoSubstitutionTemplateLiteral(decoratorArg))) {
    alias = decoratorArg.getLiteralText();
  }
  const initializer = property.getInitializer();
  let type = 'unknown';
  if (initializer !== undefined && Node.isNewExpression(initializer)) {
    const typeArgs = initializer.getTypeArguments();
    if (typeArgs.length > 0) {
      type = typeArgs[0].getText();
    }
  } else {
    const explicit = property.getTypeNode()?.getText();
    if (explicit !== undefined) {
      type = explicit;
    }
  }
  return {
    propertyName,
    name: alias ?? propertyName,
    type,
    description: readPropertyDescription(property)
  };
}

function parseSignalOutput(property: PropertyDeclaration): ParsedAngularOutput | undefined {
  const initializer = property.getInitializer();
  if (initializer === undefined || !Node.isCallExpression(initializer)) {
    return undefined;
  }
  const expression = initializer.getExpression();
  if (!Node.isIdentifier(expression) || expression.getText() !== 'output') {
    return undefined;
  }
  const propertyName = property.getName();
  const typeArgs = initializer.getTypeArguments();
  const type = typeArgs.length > 0 ? typeArgs[0].getText() : 'void';
  const args = initializer.getArguments();
  let alias: string | undefined;
  if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
    alias = readStringProperty(args[0], 'alias');
  }
  return {
    propertyName,
    name: alias ?? propertyName,
    type,
    description: readPropertyDescription(property)
  };
}
