/**
 * AST extractor for the `dbx_model_fixture_*` tool cluster.
 *
 * Parses an app's `src/test/fixture.ts` into the
 * {@link AppFixturesExtraction} consumed by every tool in the cluster.
 *
 * Strategy:
 * 1. Build a single ts-morph in-memory project containing only the fixture
 *    file. Fixture files are workspace-local and self-contained for our
 *    purposes — no symbol resolution beyond simple identifier lookup.
 * 2. Detect the workspace `<Prefix>` from the base context fixture
 *    (the class extending `FirebaseAdminNestTestContextFixture`).
 * 3. Walk every class declaration, group `<Prefix><Model>TestContextFixture`
 *    + `<Prefix><Model>TestContextInstance` pairs by model name, then
 *    join in the matching `<Prefix><Model>TestContextParams` type and
 *    `<prefix><Model>ContextFactory` / `<prefix><Model>Context` exports.
 * 4. Classify each entry's archetype via {@link classifyFixtureArchetype}.
 *
 * The extractor accepts plain text input so specs can build fixtures
 * directly without touching the filesystem.
 */

import { Node, Project, SyntaxKind, type ArrowFunction, type ClassDeclaration, type FunctionExpression, type InterfaceDeclaration, type MethodDeclaration, type SourceFile, type TypeAliasDeclaration, type VariableDeclaration } from 'ts-morph';
import { classifyFixtureArchetype } from './archetype.js';
import { findFamilyByBaseClass, findFamilyByFactoryName, NON_MODEL_JSDOC_TAG, type FrameworkNonModelFixtureFamily } from './framework-fixtures.js';
import type { AppFixturesExtraction, FactoryCall, FixtureEntry, FixtureKind, FixtureMethod, FixtureParamsField, FixtureParamsType } from './types.js';

const FIXTURE_SUFFIX = 'TestContextFixture';
const INSTANCE_SUFFIX = 'TestContextInstance';
const PARAMS_SUFFIX = 'TestContextParams';
const FIXTURE_FILE_VIRTUAL_PATH = '__fixture__/fixture.ts';
const BASE_CONTEXT_FIXTURE_BASE = 'FirebaseAdminNestTestContextFixture';
const MODEL_FACTORY_NAME = 'modelTestContextFactory';

/**
 * Inputs accepted by {@link extractAppFixturesFromText}.
 */
export interface ExtractAppFixturesInput {
  readonly text: string;
  readonly fixturePath: string;
}

/**
 * Pure entry point used by inspect.ts and tests. Parses the supplied fixture
 * text and returns the structured extraction; never touches disk.
 *
 * @param input - the raw fixture text + caller-relative path metadata
 * @returns the parsed extraction
 */
export function extractAppFixturesFromText(input: ExtractAppFixturesInput): AppFixturesExtraction {
  const { text, fixturePath } = input;
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sourceFile = project.createSourceFile(FIXTURE_FILE_VIRTUAL_PATH, text, { overwrite: true });
  const prefix = detectPrefix(sourceFile);

  const fixtureClasses = new Map<string, ClassDeclaration>();
  const instanceClasses = new Map<string, ClassDeclaration>();
  const unrecognized: string[] = [];
  collectClasses(sourceFile, prefix, { fixtures: fixtureClasses, instances: instanceClasses, unrecognized });

  const paramsTypes = collectParamsTypes(sourceFile, prefix);
  const { factoriesByModel, nonModelFamiliesByModel } = collectFactories(sourceFile, prefix);
  const singletonsByFactory = collectSingletonsByFactory(sourceFile);

  const entries: FixtureEntry[] = [];
  const seenModels = new Set<string>();
  const sortedModels = collectAllModels(fixtureClasses, instanceClasses);
  for (const model of sortedModels) {
    if (seenModels.has(model)) continue;
    seenModels.add(model);
    const fixtureClass = fixtureClasses.get(model);
    const instanceClass = instanceClasses.get(model);
    if (fixtureClass === undefined || instanceClass === undefined) {
      continue;
    }
    const params = paramsTypes.get(model);
    const factory = factoriesByModel.get(model);
    if (factory?.factoryName) {
      const singleton = singletonsByFactory.get(factory.factoryName);
      if (singleton !== undefined) {
        Object.assign(factory as { singletonName?: string }, { singletonName: singleton });
      }
    }
    const archetype = classifyFixtureArchetype({ factory, params });
    const fixtureMethods = readClassMethods(fixtureClass);
    const instanceMethods = readClassMethods(instanceClass);
    const { kind, nonModelFamily } = classifyFixtureKind({ fixtureClass, instanceClass, nonModelFamily: nonModelFamiliesByModel.get(model) });
    const entry: FixtureEntry = {
      model,
      prefix: prefix ?? '',
      archetype,
      kind,
      nonModelFamily,
      fixtureClassName: fixtureClass.getName() ?? '',
      instanceClassName: instanceClass.getName() ?? '',
      paramsTypeName: params?.name ?? `${prefix ?? ''}${model}${PARAMS_SUFFIX}`,
      factoryName: factory?.factoryName,
      singletonName: factory?.singletonName,
      fixtureExtendsGenerics: readExtendsGenerics(fixtureClass),
      instanceExtendsGenerics: readExtendsGenerics(instanceClass),
      fixtureMethods,
      instanceMethods,
      params,
      factory,
      fixtureLine: fixtureClass.getStartLineNumber(),
      fixtureEndLine: fixtureClass.getEndLineNumber(),
      instanceLine: instanceClass.getStartLineNumber(),
      instanceEndLine: instanceClass.getEndLineNumber()
    };
    entries.push(entry);
  }

  const identityImports = collectIdentityImports(sourceFile);
  const result: AppFixturesExtraction = {
    fixturePath,
    prefix,
    entries,
    unrecognizedClassNames: unrecognized,
    identityImports
  };
  return result;
}

/**
 * Detects the workspace prefix from the file's base context fixture class.
 *
 * Looks for a class whose name ends in `ContextFixture` (NOT
 * `TestContextFixture`) and that extends `FirebaseAdminNestTestContextFixture`
 * — that's the canonical anchor every fixture file declares once
 * (`DemoApiContextFixture`, `HellosubsApiContextFixture`).
 *
 * @param sourceFile - the parsed fixture file
 * @returns the detected prefix, or `undefined` when no base class is found
 */
function detectPrefix(sourceFile: SourceFile): string | undefined {
  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName();
    if (!name) continue;
    if (!name.endsWith('ContextFixture')) continue;
    if (name.endsWith(FIXTURE_SUFFIX)) continue;
    if (!extendsByName(cls, BASE_CONTEXT_FIXTURE_BASE)) continue;
    return name.slice(0, name.length - 'ContextFixture'.length);
  }
  return undefined;
}

/**
 * Returns `true` when {@link cls}'s `extends` clause references the base
 * class named {@link baseName}.
 *
 * @param cls - the class declaration to inspect
 * @param baseName - the expected base class identifier
 * @returns `true` when the class extends the target name
 */
function extendsByName(cls: ClassDeclaration, baseName: string): boolean {
  const extendsClause = cls.getExtends();
  if (!extendsClause) return false;
  const expr = extendsClause.getExpression();
  if (Node.isIdentifier(expr)) {
    return expr.getText() === baseName;
  }
  return extendsClause.getText().startsWith(baseName);
}

/**
 * Mutable accumulator for {@link collectClasses}.
 */
interface ClassCollectionBuckets {
  readonly fixtures: Map<string, ClassDeclaration>;
  readonly instances: Map<string, ClassDeclaration>;
  readonly unrecognized: string[];
}

/**
 * Walks every class in the file, sorts each into the fixture or instance
 * map by name suffix, and pushes anything that matches the suffix but
 * doesn't fit the prefix into {@link ClassCollectionBuckets.unrecognized}.
 *
 * @param sourceFile - the parsed fixture file
 * @param prefix - the workspace prefix detected by {@link detectPrefix}
 * @param buckets - mutable accumulator
 */
function collectClasses(sourceFile: SourceFile, prefix: string | undefined, buckets: ClassCollectionBuckets): void {
  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName();
    if (!name) continue;
    const fixtureModel = bareModel(name, FIXTURE_SUFFIX, prefix);
    if (fixtureModel !== undefined) {
      buckets.fixtures.set(fixtureModel, cls);
      continue;
    }
    const instanceModel = bareModel(name, INSTANCE_SUFFIX, prefix);
    if (instanceModel !== undefined) {
      buckets.instances.set(instanceModel, cls);
      continue;
    }
    if (name.endsWith(FIXTURE_SUFFIX) || name.endsWith(INSTANCE_SUFFIX)) {
      buckets.unrecognized.push(name);
    }
  }
}

/**
 * Strips a `<Prefix>` and `<Suffix>` from a class name and returns the bare
 * model name when both ends match. Falls back to suffix-only matching when
 * the workspace prefix is unknown.
 *
 * @param className - the class name to parse
 * @param suffix - the expected name suffix
 * @param prefix - the optional workspace prefix
 * @returns the bare model name, or `undefined` when the class doesn't match
 */
function bareModel(className: string, suffix: string, prefix: string | undefined): string | undefined {
  if (!className.endsWith(suffix)) return undefined;
  const trimmed = className.slice(0, className.length - suffix.length);
  if (prefix === undefined || prefix === '') {
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (!trimmed.startsWith(prefix)) return undefined;
  const model = trimmed.slice(prefix.length);
  return model.length > 0 ? model : undefined;
}

/**
 * Reads every `<Prefix><Model>TestContextParams` interface and type alias
 * into a map keyed by bare model name.
 *
 * Each entry captures whether the type extends `Partial<Model>`, whether
 * it's a `type Foo = Partial<Bar>` alias (the simple shape), and the field
 * list with each field's resolved fixture-model dependency (when the field
 * type is a sibling fixture class).
 *
 * @param sourceFile - the parsed fixture file
 * @param prefix - the workspace prefix
 * @returns map of bare model name → params type metadata
 */
function collectParamsTypes(sourceFile: SourceFile, prefix: string | undefined): Map<string, FixtureParamsType> {
  const out = new Map<string, FixtureParamsType>();
  for (const i of sourceFile.getInterfaces()) {
    const name = i.getName();
    const model = bareModel(name, PARAMS_SUFFIX, prefix);
    if (model === undefined) continue;
    out.set(model, readParamsInterface(i, model, prefix));
  }
  for (const a of sourceFile.getTypeAliases()) {
    const name = a.getName();
    const model = bareModel(name, PARAMS_SUFFIX, prefix);
    if (model === undefined) continue;
    out.set(model, readParamsAlias(a, model));
  }
  return out;
}

/**
 * Parses one `<Prefix><Model>TestContextParams` interface into the structured
 * {@link FixtureParamsType}.
 *
 * @param i - the interface declaration
 * @param _model - the bare model name extracted from the interface name (reserved for future cross-checks)
 * @param prefix - the workspace prefix used to resolve fixture-typed fields
 * @returns the parsed metadata
 */
function readParamsInterface(i: InterfaceDeclaration, _model: string, prefix: string | undefined): FixtureParamsType {
  const extendsClauses = i.getExtends().map((e) => e.getText());
  const partialExtends = extendsClauses.find((t) => t.startsWith('Partial<'));
  const extendsPartial = partialExtends !== undefined;
  const modelName = partialExtends ? partialExtends.slice('Partial<'.length, -1).trim() : undefined;
  const fields: FixtureParamsField[] = [];
  for (const prop of i.getProperties()) {
    const propName = prop.getName();
    const typeNode = prop.getTypeNode();
    const typeText = typeNode ? typeNode.getText() : '';
    const optional = prop.hasQuestionToken();
    const fixtureModel = resolveFixtureFieldModel(typeText, prefix);
    const isArray = /\bArrayOrValue\b|\[\]\s*$|\bArray</.test(typeText);
    const field: FixtureParamsField = {
      name: propName,
      typeText,
      optional,
      fixtureModel,
      array: isArray
    };
    fields.push(field);
  }
  const result: FixtureParamsType = {
    name: i.getName(),
    kind: 'interface',
    extendsPartial,
    aliasOfPartial: false,
    modelName,
    fields,
    line: i.getStartLineNumber()
  };
  return result;
}

/**
 * Parses one `<Prefix><Model>TestContextParams` type alias into the structured
 * {@link FixtureParamsType}. Only `type Foo = Partial<Bar>` and similar
 * alias-only shapes are supported — alias types don't carry a field list.
 *
 * @param a - the type alias declaration
 * @param _model - the bare model name extracted from the alias name (reserved for future cross-checks)
 * @returns the parsed metadata
 */
function readParamsAlias(a: TypeAliasDeclaration, _model: string): FixtureParamsType {
  const typeText = a.getTypeNode()?.getText() ?? '';
  const aliasOfPartial = typeText.startsWith('Partial<');
  const modelName = aliasOfPartial ? typeText.slice('Partial<'.length, -1).trim() : undefined;
  const result: FixtureParamsType = {
    name: a.getName(),
    kind: 'alias',
    extendsPartial: false,
    aliasOfPartial,
    modelName,
    fields: [],
    line: a.getStartLineNumber()
  };
  return result;
}

/**
 * Resolves a field's type text to a sibling fixture model name when it
 * references a `<Prefix><X>TestContextFixture` class.
 *
 * Handles bare references, `Maybe<...>`, `ArrayOrValue<...>`, generic
 * arguments (e.g. `<F>`), and basic type compositions by looking for the
 * fixture-suffix substring inside the text.
 *
 * @param typeText - the raw type annotation text
 * @param prefix - the workspace prefix
 * @returns the bare model name, or `undefined` when the field doesn't
 *   reference a fixture class
 */
function resolveFixtureFieldModel(typeText: string, prefix: string | undefined): string | undefined {
  const match = /([A-Z]\w*)TestContextFixture/.exec(typeText);
  if (!match) return undefined;
  const before = match[1];
  if (prefix === undefined || prefix === '') return before;
  if (!before.startsWith(prefix)) return undefined;
  const model = before.slice(prefix.length);
  return model.length > 0 ? model : undefined;
}

/**
 * Walks every variable statement that initializes via a
 * `() => modelTestContextFactory<...>(...)` arrow (or a recognized
 * framework non-model factory like `authorizedUserContextFactory`) and
 * returns:
 *
 * - `factoriesByModel` — parsed {@link FactoryCall} metadata keyed by bare
 *   model name (derived from the factory variable name
 *   `<prefix><Model>ContextFactory`).
 * - `nonModelFamiliesByModel` — for entries whose body called a known
 *   framework non-model factory, the matched family entry. Used downstream
 *   to set `FixtureEntry.kind`.
 *
 * @param sourceFile - the parsed fixture file
 * @param prefix - the workspace prefix
 */
function collectFactories(sourceFile: SourceFile, prefix: string | undefined): { factoriesByModel: Map<string, FactoryCall>; nonModelFamiliesByModel: Map<string, FrameworkNonModelFixtureFamily> } {
  const factoriesByModel = new Map<string, FactoryCall>();
  const nonModelFamiliesByModel = new Map<string, FrameworkNonModelFixtureFamily>();
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const parsed = readContextFactory(decl);
      if (!parsed) continue;
      const model = factoryNameToModel(parsed.factory.factoryName, prefix);
      if (model === undefined) continue;
      factoriesByModel.set(model, parsed.factory);
      if (parsed.family !== undefined) {
        nonModelFamiliesByModel.set(model, parsed.family);
      }
    }
  }
  return { factoriesByModel, nonModelFamiliesByModel };
}

/**
 * Reads a single variable declaration whose initializer ultimately returns a
 * call to either `modelTestContextFactory<...>(...)` or one of the known
 * framework non-model factories (see `framework-fixtures.ts`). Returns
 * `undefined` when the declaration doesn't match a recognized factory.
 *
 * @param decl - the variable declaration to inspect
 * @returns the parsed factory metadata plus the matched framework family
 *   (when the call resolved to a non-model factory), or `undefined`
 */
function readContextFactory(decl: VariableDeclaration): { factory: FactoryCall; family: FrameworkNonModelFixtureFamily | undefined } | undefined {
  const initializer = decl.getInitializer();
  if (!initializer) return undefined;
  let bodyExpr: Node | undefined;
  if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
    bodyExpr = readSingleReturnExpression(initializer);
  } else {
    bodyExpr = initializer;
  }
  if (!bodyExpr || !Node.isCallExpression(bodyExpr)) return undefined;
  const callee = bodyExpr.getExpression();
  if (!Node.isIdentifier(callee)) return undefined;
  const calleeName = callee.getText();
  let family: FrameworkNonModelFixtureFamily | undefined;
  if (calleeName !== MODEL_FACTORY_NAME) {
    family = findFamilyByFactoryName(calleeName);
    if (family === undefined) return undefined;
  }
  const generics = bodyExpr.getTypeArguments().map((t) => t.getText());
  const args = bodyExpr.getArguments();
  let hasParamsGetCollection = false;
  let hasCollectionForDocument = false;
  let hasInitDocument = false;
  let parentFixtureFieldFromGetCollection: string | undefined;
  if (args.length > 0) {
    const first = args[0];
    if (Node.isObjectLiteralExpression(first)) {
      const getCollection = first.getProperty('getCollection');
      if (getCollection && Node.isPropertyAssignment(getCollection)) {
        const fnInit = getCollection.getInitializer();
        const arity = readArrowParameterCount(fnInit);
        if (arity >= 2) {
          hasParamsGetCollection = true;
          parentFixtureFieldFromGetCollection = readParamsAccessFieldName(fnInit);
        }
      }
      if (first.getProperty('collectionForDocument') !== undefined) {
        hasCollectionForDocument = true;
      }
      if (first.getProperty('initDocument') !== undefined) {
        hasInitDocument = true;
      }
    }
  }
  const factory: FactoryCall = {
    factoryName: decl.getName(),
    genericArgs: generics,
    hasParamsGetCollection,
    hasCollectionForDocument,
    hasInitDocument,
    parentFixtureFieldFromGetCollection,
    line: decl.getStartLineNumber()
  };
  return { factory, family };
}

/**
 * Decides the {@link FixtureKind} for a Fixture/Instance pair. Precedence:
 *
 * 1. `@dbxFixtureNotModel` JSDoc tag on either class → `non-model`.
 * 2. Inheritance from a known framework non-model base class → that
 *    family's kind.
 * 3. Factory body called a known framework non-model factory → that
 *    family's kind.
 * 4. Default → `firestore-model`.
 *
 * @param input - the parsed Fixture and Instance class declarations and
 *   the matched framework family detected during factory collection
 * @returns the resolved kind plus a `nonModelFamily` indicator surfaced in
 *   lookup/list output
 */
function classifyFixtureKind(input: { fixtureClass: ClassDeclaration; instanceClass: ClassDeclaration; nonModelFamily: FrameworkNonModelFixtureFamily | undefined }): { kind: FixtureKind; nonModelFamily?: 'authorized-user' | 'jsdoc-tag' } {
  if (hasNonModelJsDoc(input.fixtureClass) || hasNonModelJsDoc(input.instanceClass)) {
    return { kind: 'non-model', nonModelFamily: 'jsdoc-tag' };
  }
  const familyFromInheritance = familyFromExtends(input.fixtureClass) ?? familyFromExtends(input.instanceClass);
  const family = familyFromInheritance ?? input.nonModelFamily;
  if (family !== undefined) {
    return { kind: family.kind, nonModelFamily: family.kind };
  }
  return { kind: 'firestore-model' };
}

/**
 * Returns `true` when {@link cls} has a JSDoc block carrying the
 * `@dbxFixtureNotModel` tag.
 *
 * @param cls - the class declaration to inspect
 */
function hasNonModelJsDoc(cls: ClassDeclaration): boolean {
  for (const doc of cls.getJsDocs()) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() === NON_MODEL_JSDOC_TAG) return true;
    }
  }
  return false;
}

/**
 * Looks up the framework family matching the Fixture/Instance class's
 * `extends` clause base name.
 *
 * @param cls - the class declaration to inspect
 */
function familyFromExtends(cls: ClassDeclaration): FrameworkNonModelFixtureFamily | undefined {
  const ext = cls.getExtends();
  if (!ext) return undefined;
  const expr = ext.getExpression();
  let baseName: string | undefined;
  if (Node.isIdentifier(expr)) {
    baseName = expr.getText();
  } else {
    const text = ext.getText();
    const match = /^([A-Za-z_$][\w$]*)/.exec(text);
    baseName = match ? match[1] : undefined;
  }
  if (baseName === undefined) return undefined;
  return findFamilyByBaseClass(baseName);
}

/**
 * Returns the `return` expression of a function/arrow body, falling through
 * to the body itself for concise arrows.
 *
 * @param fn - the arrow or function expression to walk
 * @returns the inner return expression, or `undefined` when not present
 */
function readSingleReturnExpression(fn: ArrowFunction | FunctionExpression): Node | undefined {
  const body = fn.getBody();
  if (!body) return undefined;
  if (Node.isBlock(body)) {
    for (const stmt of body.getStatements()) {
      if (Node.isReturnStatement(stmt)) {
        return stmt.getExpression();
      }
    }
    return undefined;
  }
  return body;
}

/**
 * Counts the parameter arity of an arrow / function expression initializer.
 *
 * @param fn - the initializer node (or `undefined`)
 * @returns the parameter count, or `0` when the node isn't a function-like
 */
function readArrowParameterCount(fn: Node | undefined): number {
  if (!fn) return 0;
  if (Node.isArrowFunction(fn) || Node.isFunctionExpression(fn) || Node.isFunctionDeclaration(fn) || Node.isMethodDeclaration(fn)) {
    return fn.getParameters().length;
  }
  return 0;
}

/**
 * Returns the name of the first `params.<field>` property accessed inside a
 * `getCollection` arrow body. Used to surface the parent fixture field name
 * that drives sub-collection wiring.
 *
 * @param fn - the `getCollection` initializer node
 * @returns the parent field name, or `undefined` when none is found
 */
function readParamsAccessFieldName(fn: Node | undefined): string | undefined {
  if (!fn) return undefined;
  if (!Node.isArrowFunction(fn) && !Node.isFunctionExpression(fn)) return undefined;
  const body = fn.getBody();
  if (!body) return undefined;
  for (const access of body.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression)) {
    const expr = access.getExpression();
    if (Node.isIdentifier(expr) && expr.getText() === 'params') {
      return access.getName();
    }
  }
  return undefined;
}

/**
 * Maps a factory variable name (e.g. `demoStorageFileContextFactory`) back
 * to the bare model name (`StorageFile`) by stripping the `<prefix>` /
 * `Context` / `Factory` decorations.
 *
 * The prefix the factories use is the lowerCamel form of the workspace
 * prefix (`DemoApi` → `demoApi`, `HellosubsApi` → `hellosubsApi`). When the
 * workspace prefix isn't known, falls back to suffix-only matching.
 *
 * @param factoryName - the variable name of the factory
 * @param prefix - the upper-camel workspace prefix
 * @returns the bare model name, or `undefined` when the name doesn't match
 */
function factoryNameToModel(factoryName: string, prefix: string | undefined): string | undefined {
  const suffix = 'ContextFactory';
  if (!factoryName.endsWith(suffix)) return undefined;
  const head = factoryName.slice(0, factoryName.length - suffix.length);
  if (prefix === undefined || prefix === '') {
    if (head.length === 0) return undefined;
    return head.charAt(0).toUpperCase() + head.slice(1);
  }
  const factoryPrefixCandidates = factoryPrefixesFromWorkspacePrefix(prefix);
  for (const factoryPrefix of factoryPrefixCandidates) {
    if (head.startsWith(factoryPrefix)) {
      const remainder = head.slice(factoryPrefix.length);
      if (remainder.length === 0) continue;
      return remainder.charAt(0).toUpperCase() + remainder.slice(1);
    }
  }
  return undefined;
}

/**
 * Generates the candidate factory-prefix variants for a workspace prefix.
 *
 * The workspace prefix lives in PascalCase (`DemoApi`); factory variables
 * are written as either `demoApi<Model>` or the shortened `demo<Model>`
 * (used by `apps/demo-api`). We try both forms.
 *
 * @param prefix - the PascalCase workspace prefix
 * @returns the candidate factory prefixes, in match priority order
 */
function factoryPrefixesFromWorkspacePrefix(prefix: string): readonly string[] {
  const lower = prefix.charAt(0).toLowerCase() + prefix.slice(1);
  const apiSuffix = 'Api';
  if (prefix.endsWith(apiSuffix)) {
    const trimmed = prefix.slice(0, prefix.length - apiSuffix.length);
    if (trimmed.length > 0) {
      const lowerTrimmed = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
      return [lower, lowerTrimmed];
    }
  }
  return [lower];
}

/**
 * Walks every singleton export variable (e.g. `export const demoFooContext =
 * demoFooContextFactory();`) and maps the factory name to the singleton
 * variable name.
 *
 * @param sourceFile - the parsed fixture file
 * @returns map of factory variable name → singleton variable name
 */
function collectSingletonsByFactory(sourceFile: SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  for (const stmt of sourceFile.getVariableStatements()) {
    for (const decl of stmt.getDeclarations()) {
      const init = decl.getInitializer();
      if (!init || !Node.isCallExpression(init)) continue;
      const callee = init.getExpression();
      if (!Node.isIdentifier(callee)) continue;
      out.set(callee.getText(), decl.getName());
    }
  }
  return out;
}

/**
 * Walks every fixture / instance class collected and returns the union of
 * their model keys, sorted by appearance line in the file.
 *
 * @param fixtures - fixture-class map
 * @param instances - instance-class map
 * @returns the deduplicated, line-sorted list of model names
 */
function collectAllModels(fixtures: Map<string, ClassDeclaration>, instances: Map<string, ClassDeclaration>): readonly string[] {
  const all = new Set<string>();
  for (const k of fixtures.keys()) all.add(k);
  for (const k of instances.keys()) all.add(k);
  const list = [...all];
  list.sort((a, b) => {
    const aLine = (fixtures.get(a) ?? instances.get(a))?.getStartLineNumber() ?? 0;
    const bLine = (fixtures.get(b) ?? instances.get(b))?.getStartLineNumber() ?? 0;
    return aLine - bLine;
  });
  return list;
}

/**
 * Reads every method declared directly on a class into the structured
 * {@link FixtureMethod} list.
 *
 * Constructors and accessors are skipped — they're not part of the
 * forwarder surface.
 *
 * @param cls - the class declaration to walk
 * @returns the parsed method list (declaration order)
 */
function readClassMethods(cls: ClassDeclaration): readonly FixtureMethod[] {
  const out: FixtureMethod[] = [];
  for (const m of cls.getMethods()) {
    out.push(readMethod(m));
  }
  return out;
}

/**
 * Parses a single class method into the structured {@link FixtureMethod}.
 *
 * The parameter list is captured verbatim (leading paren stripped) so the
 * forward tool can reproduce the exact signature without re-rendering each
 * type node.
 *
 * @param m - the method declaration
 * @returns the parsed metadata
 */
function readMethod(m: MethodDeclaration): FixtureMethod {
  const visibility = readVisibility(m);
  const isAsync = m.isAsync();
  const isStatic = m.isStatic();
  const params = m
    .getParameters()
    .map((p) => p.getText())
    .join(', ');
  const returnTypeNode = m.getReturnTypeNode();
  const returnTypeText = returnTypeNode ? returnTypeNode.getText() : undefined;
  const result: FixtureMethod = {
    name: m.getName(),
    isStatic,
    isAsync,
    visibility,
    parameterText: params,
    returnTypeText,
    line: m.getStartLineNumber(),
    endLine: m.getEndLineNumber()
  };
  return result;
}

/**
 * Returns the declared visibility of a class method, defaulting to
 * `public` when no modifier is present.
 *
 * @param m - the method declaration
 * @returns the resolved visibility enum
 */
function readVisibility(m: MethodDeclaration): 'public' | 'private' | 'protected' {
  if (m.hasModifier(SyntaxKind.PrivateKeyword)) return 'private';
  if (m.hasModifier(SyntaxKind.ProtectedKeyword)) return 'protected';
  return 'public';
}

/**
 * Reads the generic args of a class's `extends` clause, e.g.
 * `extends ModelTestContextFixture<A, B, C>` → `['A', 'B', 'C']`.
 *
 * @param cls - the class declaration
 * @returns the generic args (empty when no `extends` clause exists or it
 *   carries no type arguments)
 */
function readExtendsGenerics(cls: ClassDeclaration): readonly string[] {
  const ext = cls.getExtends();
  if (!ext) return [];
  return ext.getTypeArguments().map((t) => t.getText());
}

/**
 * Walks every named import in the file and returns the names of any
 * imports ending in `Identity` — the `firestoreModelIdentity(...)` aliases
 * the validator can use to cross-reference parent-fixture field names.
 *
 * @param sourceFile - the parsed fixture file
 * @returns the deduplicated, sorted identity import names
 */
function collectIdentityImports(sourceFile: SourceFile): readonly string[] {
  const out = new Set<string>();
  for (const imp of sourceFile.getImportDeclarations()) {
    for (const named of imp.getNamedImports()) {
      const name = named.getNameNode().getText();
      if (name.endsWith('Identity')) {
        out.add(name);
      }
    }
  }
  const list = [...out];
  list.sort((a, b) => a.localeCompare(b));
  return list;
}
