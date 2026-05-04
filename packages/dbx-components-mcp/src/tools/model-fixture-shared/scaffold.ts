/**
 * Scaffold renderer for `dbx_model_fixture_scaffold`.
 *
 * Pure text generation — given a parsed extraction and an archetype-aware
 * scaffold spec, produces the snippet that the tool wrapper appends to
 * `fixture.ts`. Direct disk mutation lives in the tool wrapper; this module
 * stays testable without touching the filesystem.
 *
 * Each archetype owns a templated factory call; the Params interface,
 * Instance class, and Fixture class are shared shapes.
 */

import type { AppFixturesExtraction, FixtureArchetype } from './types.js';

/**
 * One fixture dependency declared on the new Params interface.
 *
 * `field` is the param field name (e.g. `'sg'`); `fixtureModel` is the
 * bare model name of the parent fixture (e.g. `'SchoolGroup'`). `optional`
 * and `array` toggle the field's modality.
 */
export interface ScaffoldParamsDependency {
  readonly field: string;
  readonly fixtureModel: string;
  readonly optional?: boolean;
  readonly array?: boolean;
}

/**
 * Inputs accepted by {@link renderFixtureScaffold}.
 */
export interface RenderFixtureScaffoldInput {
  readonly model: string;
  readonly prefix: string;
  readonly archetype: FixtureArchetype;
  readonly parentFixture?: string;
  readonly parentFixtureField?: string;
  readonly paramsDependsOn?: readonly ScaffoldParamsDependency[];
  readonly withInitDocument?: boolean;
  readonly collectionGenericArg?: string;
  readonly modelDocumentTypeName?: string;
  readonly factoryNamePrefix?: string;
}

/**
 * Output of {@link renderFixtureScaffold}.
 */
export interface RenderedFixtureScaffold {
  readonly snippet: string;
  readonly todos: readonly string[];
  readonly inserted: readonly RenderedInsertion[];
  readonly paramsTypeName: string;
  readonly fixtureClassName: string;
  readonly instanceClassName: string;
  readonly factoryName: string;
  readonly singletonName: string;
}

/**
 * One emitted code block reported back to the caller for follow-up edits.
 */
export interface RenderedInsertion {
  readonly kind: 'params' | 'instance' | 'fixture' | 'factory' | 'singleton';
  readonly name: string;
}

/**
 * Builds the scaffold snippet for a new fixture triplet.
 *
 * The snippet is appended to `fixture.ts` as one block (with a leading
 * `// MARK:` divider) so all five entities — Params, Instance, Fixture,
 * Factory, Singleton — land in one logical section. The disk-mutation tool
 * wrapper inserts this string at the end of the file.
 *
 * @param extraction - the current parse of `fixture.ts` (used only to
 *   detect import collisions and pick context fixture/instance names)
 * @param input - scaffold spec
 * @returns the rendered snippet plus a TODO checklist
 */
export function renderFixtureScaffold(extraction: AppFixturesExtraction, input: RenderFixtureScaffoldInput): RenderedFixtureScaffold {
  const prefix = input.prefix;
  const factoryPrefix = input.factoryNamePrefix ?? defaultFactoryPrefix(prefix);
  const paramsTypeName = `${prefix}${input.model}TestContextParams`;
  const fixtureClassName = `${prefix}${input.model}TestContextFixture`;
  const instanceClassName = `${prefix}${input.model}TestContextInstance`;
  const factoryName = `${factoryPrefix}${input.model}ContextFactory`;
  const singletonName = `${factoryPrefix}${input.model}Context`;
  const modelDocumentTypeName = input.modelDocumentTypeName ?? `${input.model}Document`;
  const collectionGenericArg = input.collectionGenericArg;
  const todos: string[] = [];

  const paramsLines = renderParamsBlock(input, paramsTypeName, todos);
  const instanceBlock = renderInstanceBlock({ prefix, instanceClassName, modelDocumentTypeName, model: input.model, todos });
  const fixtureBlock = renderFixtureBlock({ prefix, fixtureClassName, instanceClassName, modelDocumentTypeName, model: input.model, todos });
  const factoryBlock = renderFactoryBlock({
    prefix,
    factoryName,
    fixtureClassName,
    instanceClassName,
    paramsTypeName,
    archetype: input.archetype,
    model: input.model,
    modelDocumentTypeName,
    collectionGenericArg,
    parentFixture: input.parentFixture,
    parentFixtureField: input.parentFixtureField,
    withInitDocument: input.withInitDocument === true,
    todos
  });
  const singletonBlock = `export const ${singletonName} = ${factoryName}();`;

  const snippet = [`// MARK: ${input.model}`, paramsLines.join('\n'), '', instanceBlock, '', fixtureBlock, '', factoryBlock, '', singletonBlock, ''].join('\n');

  const inserted: RenderedInsertion[] = [
    { kind: 'params', name: paramsTypeName },
    { kind: 'instance', name: instanceClassName },
    { kind: 'fixture', name: fixtureClassName },
    { kind: 'factory', name: factoryName },
    { kind: 'singleton', name: singletonName }
  ];

  // Hint at imports that may need to be added — purely informational.
  if (!extraction.fixturePath) {
    todos.push('Confirm fixture path was parsed.');
  }
  todos.push(`Add named imports for \`${input.model}\` and \`${modelDocumentTypeName}\` if not already present.`);
  if (collectionGenericArg) {
    todos.push(`Add named import for \`${collectionGenericArg}\`.`);
  }
  if (input.archetype === 'sub-collection' || input.archetype === 'sub-collection-traversal') {
    todos.push('Wire `getCollection` to the correct collection factory accessor on `<prefix>FirestoreCollections`.');
  }
  todos.push('Replace TODOs in `makeRef` and instance methods with real logic.');

  return {
    snippet,
    todos,
    inserted,
    paramsTypeName,
    fixtureClassName,
    instanceClassName,
    factoryName,
    singletonName
  };
}

function defaultFactoryPrefix(prefix: string): string {
  if (prefix.length === 0) return 'app';
  const apiSuffix = 'Api';
  if (prefix.endsWith(apiSuffix)) {
    const trimmed = prefix.slice(0, prefix.length - apiSuffix.length);
    if (trimmed.length === 0) return 'app';
    return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  }
  return prefix.charAt(0).toLowerCase() + prefix.slice(1);
}

function renderParamsBlock(input: RenderFixtureScaffoldInput, paramsTypeName: string, todos: string[]): string[] {
  const lines: string[] = [];
  const isSimplePartial = input.archetype === 'top-level-simple' && (!input.paramsDependsOn || input.paramsDependsOn.length === 0);
  if (isSimplePartial) {
    lines.push(`export type ${paramsTypeName} = Partial<${input.model}>;`);
    return lines;
  }
  const extendsClause = input.archetype === 'top-level-simple' || input.archetype === 'top-level-with-deps' ? ` extends Partial<${input.model}>` : '';
  lines.push(`export interface ${paramsTypeName}${extendsClause} {`);
  if (input.archetype === 'sub-collection' || input.archetype === 'sub-collection-traversal') {
    if (input.parentFixture) {
      const field = input.parentFixtureField ?? defaultParentFieldName(input.parentFixture);
      lines.push(`  readonly ${field}: ${input.prefix}${input.parentFixture}TestContextFixture;`);
    } else {
      todos.push('Add the required parent fixture field on the Params interface.');
    }
  }
  for (const dep of input.paramsDependsOn ?? []) {
    const optional = dep.optional ? '?' : '';
    const baseType = `${input.prefix}${dep.fixtureModel}TestContextFixture`;
    const typeText = dep.array ? `Maybe<ArrayOrValue<${baseType}>>` : baseType;
    lines.push(`  readonly ${dep.field}${optional}: ${typeText};`);
  }
  lines.push('}');
  return lines;
}

interface RenderInstanceBlockInput {
  readonly prefix: string;
  readonly instanceClassName: string;
  readonly modelDocumentTypeName: string;
  readonly model: string;
  readonly todos: string[];
}

/**
 * Renders the Instance class skeleton.
 *
 * @param input - render config
 * @returns the class declaration text
 */
function renderInstanceBlock(input: RenderInstanceBlockInput): string {
  input.todos.push(`Add instance methods to \`${input.instanceClassName}\`.`);
  return [`export class ${input.instanceClassName}<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextInstance<${input.model}, ${input.modelDocumentTypeName}, ${input.prefix}FunctionContextFixtureInstance<F>> {`, '  // TODO: implement instance-side methods (these own the real logic).', '}'].join('\n');
}

interface RenderFixtureBlockInput {
  readonly prefix: string;
  readonly fixtureClassName: string;
  readonly instanceClassName: string;
  readonly modelDocumentTypeName: string;
  readonly model: string;
  readonly todos: string[];
}

/**
 * Renders the Fixture class skeleton.
 *
 * @param input - render config
 * @returns the class declaration text
 */
function renderFixtureBlock(input: RenderFixtureBlockInput): string {
  input.todos.push(`Add forwarder methods to \`${input.fixtureClassName}\` after defining instance methods.`);
  return [`export class ${input.fixtureClassName}<F extends FirebaseAdminFunctionTestContextInstance = FirebaseAdminFunctionTestContextInstance> extends ModelTestContextFixture<${input.model}, ${input.modelDocumentTypeName}, ${input.prefix}FunctionContextFixtureInstance<F>, ${input.prefix}FunctionContextFixture<F>, ${input.instanceClassName}<F>> {`, '  // TODO: forward instance methods. Run `dbx_model_fixture_forward` after adding instance methods.', '}'].join('\n');
}

interface RenderFactoryBlockInput {
  readonly prefix: string;
  readonly factoryName: string;
  readonly fixtureClassName: string;
  readonly instanceClassName: string;
  readonly paramsTypeName: string;
  readonly archetype: FixtureArchetype;
  readonly model: string;
  readonly modelDocumentTypeName: string;
  readonly collectionGenericArg?: string;
  readonly parentFixture?: string;
  readonly parentFixtureField?: string;
  readonly withInitDocument: boolean;
  readonly todos: string[];
}

function renderFactoryBlock(input: RenderFactoryBlockInput): string {
  const generics = renderFactoryGenerics(input);
  const callbacks = renderFactoryCallbacks(input);
  const lines: string[] = [];
  lines.push(`export const ${input.factoryName} = () =>`, `  modelTestContextFactory<`);
  for (let i = 0; i < generics.length; i += 1) {
    const isLast = i === generics.length - 1;
    lines.push(`    ${generics[i]}${isLast ? '' : ','}`);
  }
  lines.push('  >({');
  for (let i = 0; i < callbacks.length; i += 1) {
    const isLast = i === callbacks.length - 1;
    lines.push(`    ${callbacks[i]}${isLast ? '' : ','}`);
  }
  lines.push('  });');
  return lines.join('\n');
}

function renderFactoryGenerics(input: RenderFactoryBlockInput): readonly string[] {
  const baseGenerics = [input.model, input.modelDocumentTypeName, input.paramsTypeName, `${input.prefix}FunctionContextFixtureInstance<FirebaseAdminFunctionTestContextInstance>`, `${input.prefix}FunctionContextFixture<FirebaseAdminFunctionTestContextInstance>`, `${input.instanceClassName}<FirebaseAdminFunctionTestContextInstance>`, `${input.fixtureClassName}<FirebaseAdminFunctionTestContextInstance>`];
  if (input.collectionGenericArg) {
    return [...baseGenerics, input.collectionGenericArg];
  }
  if (input.archetype === 'sub-collection' || input.archetype === 'sub-collection-traversal') {
    return [...baseGenerics, `${input.model}FirestoreCollection`];
  }
  return baseGenerics;
}

function renderFactoryCallbacks(input: RenderFactoryBlockInput): readonly string[] {
  const callbacks: string[] = [];
  callbacks.push(`makeFixture: (f) => new ${input.fixtureClassName}(f)`);
  if (input.archetype === 'sub-collection' || input.archetype === 'sub-collection-traversal') {
    const field = input.parentFixtureField ?? (input.parentFixture ? defaultParentFieldName(input.parentFixture) : 'parent');
    callbacks.push(`getCollection: (fi, params) => fi.${defaultCollectionsAccessor(input.prefix)}.${camelInitial(input.model)}CollectionFactory(params.${field}.document)`);
    if (input.archetype === 'sub-collection-traversal') {
      callbacks.push(`collectionForDocument: (fi, doc) => fi.${defaultCollectionsAccessor(input.prefix)}.${camelInitial(input.model)}Collection`);
      input.todos.push('Verify `collectionForDocument` resolves to the correct collection accessor.');
    }
  } else {
    callbacks.push(`getCollection: (fi) => fi.${defaultCollectionsAccessor(input.prefix)}.${camelInitial(input.model)}Collection`);
  }
  callbacks.push(`makeInstance: (delegate, ref, testInstance) => new ${input.instanceClassName}(delegate, ref, testInstance)`, `makeRef: async (collection, params, _p) => {\n      // TODO: choose the correct ref strategy (auto id vs deterministic id).\n      return collection.documentAccessor().newDocument().documentRef;\n    }`);
  if (input.withInitDocument) {
    callbacks.push(`initDocument: async (instance, params) => {\n      // TODO: seed the new document with sensible defaults from \`params\`.\n    }`);
  }
  return callbacks;
}

function defaultCollectionsAccessor(prefix: string): string {
  const base = prefix.length > 0 ? prefix.charAt(0).toLowerCase() + prefix.slice(1) : 'app';
  if (base.endsWith('Api')) {
    return `${base.slice(0, -3)}FirestoreCollections`;
  }
  return `${base}FirestoreCollections`;
}

function camelInitial(name: string): string {
  if (name.length === 0) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function defaultParentFieldName(parentModel: string): string {
  const acronym = parentModel.match(/[A-Z]/g);
  if (!acronym || acronym.length === 0) return parentModel.toLowerCase();
  return acronym.join('').toLowerCase();
}
