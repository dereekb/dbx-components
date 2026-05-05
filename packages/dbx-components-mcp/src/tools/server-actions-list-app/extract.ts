/**
 * Extractor for `dbx_server_actions_list_app`. Walks the API app's
 * `src/app/common/model/**\/*.action.server.ts` files, finds every
 * `*ServerActions` abstract class, and cross-references it with the
 * sibling `*.module.ts`, common barrel, and fixture file.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { Node, Project, type ObjectLiteralExpression, type SourceFile } from 'ts-morph';
import { inspectAppFixtures } from '../model-fixture-shared/index.js';
import type { ServerActionEntry, ServerActionFixtureCoverage, ServerActionModuleWiring } from './types.js';

const ACTION_SERVER_SUFFIX = '.action.server.ts';
const COMMON_MODEL_SUBPATH = 'src/app/common/model';
const COMMON_BARREL_REL = 'src/app/common/index.ts';

/**
 * Walks the model directory and extracts every `*ServerActions`
 * abstract class. Performs the I/O up front so the caller can decide
 * how to render or aggregate the result.
 *
 * @param apiAbs - absolute path to the API package root
 * @param apiRel - caller-supplied relative path used for diagnostics
 * @returns the populated entries, model root, and fixture status
 */
export async function extractServerActions(apiAbs: string, apiRel: string): Promise<{ readonly modelRoot: string; readonly entries: readonly ServerActionEntry[]; readonly fixtureStatus: 'ok' | { readonly kind: 'error'; readonly message: string } }> {
  const modelRoot = join(apiAbs, COMMON_MODEL_SUBPATH);
  const actionFiles = await collectActionFiles(modelRoot);
  if (actionFiles.length === 0) {
    return { modelRoot, entries: [], fixtureStatus: 'ok' };
  }

  const project = new Project({ useInMemoryFileSystem: true });
  const commonBarrelExports = await readCommonBarrelExports(apiAbs);

  const fixtureCoverageMap = new Map<string, ServerActionFixtureCoverage>();
  let fixtureStatus: 'ok' | { kind: 'error'; message: string } = 'ok';
  try {
    const fixtureExtraction = await inspectAppFixtures(apiAbs, apiRel);
    const fixtureText = await safeRead(fixtureExtraction.fixturePath);
    if (fixtureText !== undefined) {
      populateFixtureCoverageMap({ fixtureCoverageMap, fixturePath: fixtureExtraction.fixturePath, fixtureText, project });
    }
  } catch (err) {
    fixtureStatus = { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }

  const entries: ServerActionEntry[] = [];

  for (const filePath of actionFiles) {
    const text = await readFile(filePath, 'utf8');
    const sourceFile = project.createSourceFile(filePath, text, { overwrite: true });
    const classes = findServerActionClasses(sourceFile);
    for (const className of classes) {
      const wiring = await inspectSiblingModule(filePath, className);
      const expectedGetterName = camelize(className);
      const fixtureCoverage = fixtureStatus === 'ok' ? (fixtureCoverageMap.get(expectedGetterName) ?? unmatchedFixtureCoverage(expectedGetterName)) : undefined;
      const sourceFileRel = relative(apiAbs, filePath).split(sep).join('/');
      entries.push({
        className,
        sourceFile: sourceFileRel,
        expectedGetterName,
        wiring,
        exportedFromCommonBarrel: commonBarrelExports.has(className),
        fixtureCoverage
      });
    }
  }

  entries.sort((a, b) => a.className.localeCompare(b.className));
  return { modelRoot, entries, fixtureStatus };
}

async function collectActionFiles(root: string): Promise<readonly string[]> {
  const out: string[] = [];
  const stack: string[] = [];
  try {
    const stats = await stat(root);
    if (!stats.isDirectory()) return out;
    stack.push(root);
  } catch {
    return out;
  }
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (entry.name.endsWith(ACTION_SERVER_SUFFIX) && !entry.name.endsWith('.spec.ts')) {
        out.push(full);
      }
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

function findServerActionClasses(sourceFile: SourceFile): readonly string[] {
  const out: string[] = [];
  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName();
    if (!name) continue;
    if (!cls.isAbstract()) continue;
    if (!name.endsWith('ServerActions')) continue;
    if (!cls.isExported()) continue;
    out.push(name);
  }
  return out;
}

async function inspectSiblingModule(actionFilePath: string, className: string): Promise<ServerActionModuleWiring> {
  const moduleCandidates = await findModuleCandidates(actionFilePath);
  if (moduleCandidates.length === 0) {
    return { modulePath: undefined, providedByModule: false, exportedByModule: false };
  }
  for (const candidate of moduleCandidates) {
    const text = await safeRead(candidate);
    if (text === undefined) continue;
    const wiring = inspectModuleText({ text, className });
    if (wiring.providedByModule || wiring.exportedByModule) {
      return { modulePath: candidate, ...wiring };
    }
  }
  // No module wires it — return the first candidate as the inspected one for context.
  return { modulePath: moduleCandidates[0], providedByModule: false, exportedByModule: false };
}

async function findModuleCandidates(actionFilePath: string): Promise<readonly string[]> {
  const dir = dirname(actionFilePath);
  const out: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.endsWith('.module.ts')) continue;
      out.push(join(dir, entry.name));
    }
  } catch {
    // ignore
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

async function safeRead(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return undefined;
  }
}

interface ParsedModuleWiring {
  readonly providedByModule: boolean;
  readonly exportedByModule: boolean;
}

/**
 * Inspects the raw text of a NestJS module file for evidence that
 * `className` is bound and exported. Uses a syntactic check against
 * the `@Module({...})` decorator argument so neither `imports` nor
 * `controllers` can leak into the answer.
 *
 * @param input - Module text plus the class name to look for.
 * @param input.text - Raw NestJS module file contents.
 * @param input.className - The action class name being searched for.
 * @returns The parsed wiring result indicating whether the class is provided/exported.
 */
function inspectModuleText(input: { readonly text: string; readonly className: string }): ParsedModuleWiring {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile('module.ts', input.text, { overwrite: true });
  let providedByModule = false;
  let exportedByModule = false;
  for (const cls of sourceFile.getClasses()) {
    for (const decorator of cls.getDecorators()) {
      if (decorator.getName() !== 'Module') continue;
      const args = decorator.getArguments();
      if (args.length === 0 || !Node.isObjectLiteralExpression(args[0])) continue;
      const obj = args[0];
      providedByModule ||= moduleArrayContains(obj, 'providers', input.className);
      exportedByModule ||= moduleArrayContains(obj, 'exports', input.className);
    }
  }
  return { providedByModule, exportedByModule };
}

function moduleArrayContains(decoratorArg: ObjectLiteralExpression, propertyName: string, className: string): boolean {
  const property = decoratorArg.getProperty(propertyName);
  if (!property || !Node.isPropertyAssignment(property)) return false;
  const initializer = property.getInitializer();
  if (!initializer || !Node.isArrayLiteralExpression(initializer)) return false;
  for (const element of initializer.getElements()) {
    if (Node.isIdentifier(element) && element.getText() === className) return true;
    if (Node.isObjectLiteralExpression(element)) {
      // `{ provide: ClassName, useFactory: ..., ... }` style
      const provideProp = element.getProperty('provide');
      if (provideProp && Node.isPropertyAssignment(provideProp)) {
        const provideInit = provideProp.getInitializer();
        if (provideInit && Node.isIdentifier(provideInit) && provideInit.getText() === className) return true;
      }
    }
  }
  return false;
}

async function readCommonBarrelExports(apiAbs: string): Promise<ReadonlySet<string>> {
  const path = join(apiAbs, COMMON_BARREL_REL);
  const text = await safeRead(path);
  if (text === undefined) return new Set();
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(path, text, { overwrite: true });
  const exported = new Set<string>();
  for (const decl of sourceFile.getExportDeclarations()) {
    // `export * from './x';` re-exports — we conservatively assume "yes"
    // for any wildcard re-export. Named re-exports are also tracked.
    if (decl.getNamedExports().length === 0) {
      // wildcard — accept
      // we can't know names without resolving, but the common case is
      // every action class IS re-exported via `export * from './model'`.
      // Mark a sentinel so the caller treats wildcard as "covers".
      exported.add('__WILDCARD__');
      continue;
    }
    for (const spec of decl.getNamedExports()) {
      exported.add(spec.getName());
    }
  }
  return exported;
}

/**
 * Populates the fixture-coverage map by reading the API context
 * interface (the one named `<Prefix>Context`) and each fixture/instance
 * class for getter declarations whose name matches a discovered
 * `*ServerActions`. The logic is intentionally name-based — fixture
 * classes follow the dbx-components convention of one getter per
 * server-action class.
 *
 * @param input - The working map plus the fixture file path/text/shared ts-morph project.
 * @param input.fixtureCoverageMap - The mutable coverage map to populate, keyed by server-action class name.
 * @param input.fixturePath - Path of the fixture source file (used as the in-memory project key).
 * @param input.fixtureText - Raw fixture source.
 * @param input.project - Shared ts-morph project used for in-memory parsing.
 */
function populateFixtureCoverageMap(input: { readonly fixtureCoverageMap: Map<string, ServerActionFixtureCoverage>; readonly fixturePath: string; readonly fixtureText: string; readonly project: Project }): void {
  const { fixtureCoverageMap, fixturePath, fixtureText, project } = input;
  const sourceFile = project.createSourceFile(fixturePath, fixtureText, { overwrite: true });
  const interfaceGetters = collectInterfaceGetters(sourceFile);
  const classGetters = collectClassGetters(sourceFile);

  // For every `*ServerActions` getter found, record the coverage view.
  const allActionLikeGetters = new Set<string>();
  for (const name of interfaceGetters.keys()) if (name.endsWith('ServerActions')) allActionLikeGetters.add(name);
  for (const className of classGetters.keys()) {
    for (const getter of classGetters.get(className) ?? []) {
      if (getter.endsWith('ServerActions')) allActionLikeGetters.add(getter);
    }
  }
  for (const getter of allActionLikeGetters) {
    const interfaceContains = interfaceGetters.has(getter);
    const missing: string[] = [];
    for (const className of classGetters.keys()) {
      const set = classGetters.get(className) ?? new Set();
      if (!set.has(getter)) missing.push(className);
    }
    fixtureCoverageMap.set(getter, {
      contextInterfaceDeclaresGetter: interfaceContains,
      classesMissingGetter: missing,
      expectedGetterName: getter
    });
  }
}

function collectInterfaceGetters(sourceFile: SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  for (const iface of sourceFile.getInterfaces()) {
    for (const member of iface.getMembers()) {
      if (Node.isGetAccessorDeclaration(member)) {
        out.set(member.getName(), iface.getName());
        continue;
      }
      // `get foo(): X` is rare on interfaces — usually they declare
      // `foo: X` as a property signature. Treat both as a getter
      // by-name for coverage purposes.
      if (Node.isPropertySignature(member)) {
        out.set(member.getName(), iface.getName());
      }
    }
  }
  return out;
}

function collectClassGetters(sourceFile: SourceFile): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const cls of sourceFile.getClasses()) {
    const set = new Set<string>();
    for (const member of cls.getMembers()) {
      if (Node.isGetAccessorDeclaration(member)) set.add(member.getName());
    }
    if (set.size > 0) out.set(cls.getName() ?? '<anon>', set);
  }
  return out;
}

function unmatchedFixtureCoverage(getterName: string): ServerActionFixtureCoverage {
  return {
    contextInterfaceDeclaresGetter: false,
    classesMissingGetter: [],
    expectedGetterName: getterName
  };
}

function camelize(className: string): string {
  if (className.length === 0) return className;
  return className.charAt(0).toLowerCase() + className.slice(1);
}
