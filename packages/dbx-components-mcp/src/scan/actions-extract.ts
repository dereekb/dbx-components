/**
 * AST extraction for the `scan-actions` generator.
 *
 * Walks every source file in the supplied ts-morph `Project` looking for
 * three entry shapes:
 *
 *   - Classes with `@Directive()` decorator and `@dbxAction` JSDoc marker → directive entries
 *   - Classes with `@dbxAction` JSDoc marker and `@dbxActionRole store` tag → store entries
 *   - Enum declarations with `@dbxActionStateEnum` JSDoc marker → one state entry per member
 */

import { Node, SyntaxKind, type ClassDeclaration, type Decorator, type EnumDeclaration, type EnumMember, type JSDoc, type ObjectLiteralExpression, type Project, type PropertyDeclaration, type MethodDeclaration } from 'ts-morph';
import type { ActionInputEntry, ActionOutputEntry, ActionStoreMethodEntry, ActionStoreObservableEntry, DbxActionStateValue } from '../manifest/actions-schema.js';

// MARK: Tag names
const ACTION_MARKER = 'dbxAction';
const ACTION_SLUG_TAG = 'dbxActionSlug';
const ACTION_ROLE_TAG = 'dbxActionRole';
const ACTION_STATE_INTERACTION_TAG = 'dbxActionStateInteraction';
const ACTION_PRODUCES_CONTEXT_TAG = 'dbxActionProducesContext';
const ACTION_CONSUMES_CONTEXT_TAG = 'dbxActionConsumesContext';
const ACTION_SKILL_REFS_TAG = 'dbxActionSkillRefs';
const ACTION_DISABLED_KEY_TAG = 'dbxActionDisabledKey';
const ACTION_STATE_ENUM_MARKER = 'dbxActionStateEnum';
const ACTION_STATE_TRANSITIONS_FROM_TAG = 'dbxActionStateTransitionsFrom';
const ACTION_STATE_TRANSITIONS_TO_TAG = 'dbxActionStateTransitionsTo';

// MARK: Public types
/**
 * One action entry extracted from a source file. `module`, `sourcePath`, and
 * `sourceLocation.file` are recomputed by the build phase.
 */
export type ExtractedActionEntry = ExtractedActionDirective | ExtractedActionStore | ExtractedActionState;

export interface ExtractedActionDirective {
  readonly role: 'directive';
  readonly slug: string;
  readonly selector: string;
  readonly className: string;
  readonly description: string;
  readonly inputs: readonly ActionInputEntry[];
  readonly outputs: readonly ActionOutputEntry[];
  readonly producesContext: boolean;
  readonly consumesContext: boolean;
  readonly stateInteraction: readonly DbxActionStateValue[];
  readonly skillRefs: readonly string[];
  readonly example: string;
  readonly filePath: string;
  readonly line: number;
}

export interface ExtractedActionStore {
  readonly role: 'store';
  readonly slug: string;
  readonly className: string;
  readonly description: string;
  readonly methods: readonly ActionStoreMethodEntry[];
  readonly observables: readonly ActionStoreObservableEntry[];
  readonly disabledKeyDefaults: readonly string[];
  readonly skillRefs: readonly string[];
  readonly example: string;
  readonly filePath: string;
  readonly line: number;
}

export interface ExtractedActionState {
  readonly role: 'state';
  readonly slug: string;
  readonly stateValue: DbxActionStateValue;
  readonly literal: string;
  readonly description: string;
  readonly transitionsFrom: readonly DbxActionStateValue[];
  readonly transitionsTo: readonly DbxActionStateValue[];
  readonly skillRefs: readonly string[];
  readonly example: string;
  readonly filePath: string;
  readonly line: number;
}

export type ActionExtractWarning =
  | { readonly kind: 'missing-required-tag'; readonly className: string; readonly tag: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unknown-role'; readonly className: string; readonly role: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unknown-state-value'; readonly className: string; readonly stateValue: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'missing-directive-decorator'; readonly className: string; readonly filePath: string; readonly line: number };

export interface ExtractActionEntriesInput {
  readonly project: Project;
}

export interface ExtractActionEntriesResult {
  readonly entries: readonly ExtractedActionEntry[];
  readonly warnings: readonly ActionExtractWarning[];
}

// MARK: Vocabularies
const VALID_STATES: ReadonlySet<string> = new Set(['IDLE', 'DISABLED', 'TRIGGERED', 'VALUE_READY', 'WORKING', 'RESOLVED', 'REJECTED']);

// MARK: Entry point
/**
 * Walks the supplied project and returns every action entry. Order is stable.
 */
export function extractActionEntries(input: ExtractActionEntriesInput): ExtractActionEntriesResult {
  const { project } = input;
  const entries: ExtractedActionEntry[] = [];
  const warnings: ActionExtractWarning[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    for (const decl of sourceFile.getClasses()) {
      if (!decl.isExported()) {
        continue;
      }
      const tags = readClassTags(decl.getJsDocs());
      if (!tags.hasMarker) {
        continue;
      }
      const built = buildClassEntry({ decl, tags, filePath });
      if (built.kind === 'ok') {
        entries.push(built.entry);
      }
      for (const w of built.warnings) {
        warnings.push(w);
      }
    }
    for (const enumDecl of sourceFile.getEnums()) {
      if (!enumDecl.isExported()) {
        continue;
      }
      const enumTags = readJsDocs(enumDecl.getJsDocs());
      if (!enumTags.markers.has(ACTION_STATE_ENUM_MARKER)) {
        continue;
      }
      const stateBuilt = buildStateEntries({ decl: enumDecl, filePath });
      for (const e of stateBuilt.entries) {
        entries.push(e);
      }
      for (const w of stateBuilt.warnings) {
        warnings.push(w);
      }
    }
  }

  return { entries, warnings };
}

// MARK: JSDoc parsing
interface RawJsDocs {
  readonly summary: string;
  readonly markers: ReadonlySet<string>;
  readonly tagText: ReadonlyMap<string, readonly string[]>;
  readonly examples: readonly string[];
}

function readJsDocs(jsDocs: readonly JSDoc[]): RawJsDocs {
  const summaries: string[] = [];
  const markers = new Set<string>();
  const tagText = new Map<string, string[]>();
  const examples: string[] = [];
  for (const jsDoc of jsDocs) {
    const desc = jsDoc.getDescription().trim();
    if (desc.length > 0) {
      summaries.push(desc);
    }
    for (const tag of jsDoc.getTags()) {
      const name = tag.getTagName();
      const text = tag.getCommentText()?.trim() ?? '';
      if (text.length === 0) {
        markers.add(name);
        continue;
      }
      if (name === 'example') {
        examples.push(unwrapFenced(text));
        continue;
      }
      const list = tagText.get(name);
      if (list === undefined) {
        tagText.set(name, [text]);
      } else {
        list.push(text);
      }
    }
  }
  return { summary: summaries.join('\n\n'), markers, tagText, examples };
}

interface ClassTags {
  readonly hasMarker: boolean;
  readonly summary: string;
  readonly slug?: string;
  readonly role?: string;
  readonly stateInteraction: readonly string[];
  readonly producesContext: boolean;
  readonly consumesContext: boolean;
  readonly skillRefs: readonly string[];
  readonly disabledKeyDefaults: readonly string[];
  readonly examples: readonly string[];
}

function readClassTags(jsDocs: readonly JSDoc[]): ClassTags {
  const raw = readJsDocs(jsDocs);
  return {
    hasMarker: raw.markers.has(ACTION_MARKER),
    summary: raw.summary,
    slug: raw.tagText.get(ACTION_SLUG_TAG)?.[0],
    role: raw.tagText.get(ACTION_ROLE_TAG)?.[0],
    stateInteraction: flattenList(raw.tagText.get(ACTION_STATE_INTERACTION_TAG) ?? []),
    producesContext: raw.markers.has(ACTION_PRODUCES_CONTEXT_TAG),
    consumesContext: raw.markers.has(ACTION_CONSUMES_CONTEXT_TAG),
    skillRefs: flattenList(raw.tagText.get(ACTION_SKILL_REFS_TAG) ?? []),
    disabledKeyDefaults: flattenList(raw.tagText.get(ACTION_DISABLED_KEY_TAG) ?? []),
    examples: raw.examples
  };
}

function flattenList(values: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (const value of values) {
    for (const piece of value.split(/[\s,]+/)) {
      const trimmed = piece.trim();
      if (trimmed.length > 0) {
        out.push(trimmed);
      }
    }
  }
  return out;
}

function unwrapFenced(text: string): string {
  const trimmed = text.trim();
  const match = /^```[a-zA-Z]*\n([\s\S]*?)\n```\s*$/.exec(trimmed);
  return match ? match[1] : trimmed;
}

// MARK: Class entry construction
type BuildResult<T> = { readonly kind: 'ok'; readonly entry: T; readonly warnings: readonly ActionExtractWarning[] } | { readonly kind: 'skipped'; readonly warnings: readonly ActionExtractWarning[] };

function buildClassEntry(input: { readonly decl: ClassDeclaration; readonly tags: ClassTags; readonly filePath: string }): BuildResult<ExtractedActionDirective | ExtractedActionStore> {
  const { decl, tags, filePath } = input;
  const className = decl.getName() ?? '<anonymous>';
  const line = decl.getStartLineNumber();
  const warnings: ActionExtractWarning[] = [];

  if (tags.slug === undefined || tags.slug.length === 0) {
    warnings.push({ kind: 'missing-required-tag', className, tag: ACTION_SLUG_TAG, filePath, line });
    return { kind: 'skipped', warnings };
  }
  const role = tags.role ?? 'directive';
  if (role !== 'directive' && role !== 'store') {
    warnings.push({ kind: 'unknown-role', className, role, filePath, line });
    return { kind: 'skipped', warnings };
  }

  const example = tags.examples.length > 0 ? tags.examples[0] : '';
  const skillRefs = tags.skillRefs.length > 0 ? tags.skillRefs : ['dbx__ref__dbx-component-patterns'];

  if (role === 'directive') {
    const directiveInfo = readDirectiveDecorator(decl);
    if (directiveInfo === undefined) {
      warnings.push({ kind: 'missing-directive-decorator', className, filePath, line });
      return { kind: 'skipped', warnings };
    }
    const stateInteraction: DbxActionStateValue[] = [];
    for (const value of tags.stateInteraction) {
      if (VALID_STATES.has(value)) {
        stateInteraction.push(value as DbxActionStateValue);
      } else {
        warnings.push({ kind: 'unknown-state-value', className, stateValue: value, filePath, line });
      }
    }
    const entry: ExtractedActionDirective = {
      role: 'directive',
      slug: tags.slug,
      selector: directiveInfo.selector,
      className,
      description: tags.summary,
      inputs: extractInputs(decl),
      outputs: extractOutputs(decl),
      producesContext: tags.producesContext,
      consumesContext: tags.consumesContext,
      stateInteraction,
      skillRefs,
      example,
      filePath,
      line
    };
    return { kind: 'ok', entry, warnings };
  }

  // store
  const entry: ExtractedActionStore = {
    role: 'store',
    slug: tags.slug,
    className,
    description: tags.summary,
    methods: extractStoreMethods(decl),
    observables: extractStoreObservables(decl),
    disabledKeyDefaults: tags.disabledKeyDefaults,
    skillRefs,
    example,
    filePath,
    line
  };
  return { kind: 'ok', entry, warnings };
}

// MARK: State enum entries
function buildStateEntries(input: { readonly decl: EnumDeclaration; readonly filePath: string }): { readonly entries: readonly ExtractedActionState[]; readonly warnings: readonly ActionExtractWarning[] } {
  const { decl, filePath } = input;
  const enumName = decl.getName();
  const entries: ExtractedActionState[] = [];
  const warnings: ActionExtractWarning[] = [];

  for (const member of decl.getMembers()) {
    const stateValueRaw = member.getName();
    if (!VALID_STATES.has(stateValueRaw)) {
      warnings.push({ kind: 'unknown-state-value', className: enumName, stateValue: stateValueRaw, filePath, line: member.getStartLineNumber() });
      continue;
    }
    const stateValue = stateValueRaw as DbxActionStateValue;
    const memberJsDocs = (member as EnumMember).getJsDocs();
    const memberRaw = readJsDocs(memberJsDocs);
    const transitionsFrom = filterStates(flattenList(memberRaw.tagText.get(ACTION_STATE_TRANSITIONS_FROM_TAG) ?? []));
    const transitionsTo = filterStates(flattenList(memberRaw.tagText.get(ACTION_STATE_TRANSITIONS_TO_TAG) ?? []));
    const literal = readEnumMemberLiteral(member);
    const slug = `state-${stateValue.toLowerCase().replace(/_/g, '-')}`;

    entries.push({
      role: 'state',
      slug,
      stateValue,
      literal,
      description: memberRaw.summary,
      transitionsFrom,
      transitionsTo,
      skillRefs: ['dbx__ref__dbx-component-patterns'],
      example: `DbxActionState.${stateValue}`,
      filePath,
      line: member.getStartLineNumber()
    });
  }

  return { entries, warnings };
}

function filterStates(values: readonly string[]): readonly DbxActionStateValue[] {
  const out: DbxActionStateValue[] = [];
  for (const value of values) {
    if (VALID_STATES.has(value)) {
      out.push(value as DbxActionStateValue);
    }
  }
  return out;
}

function readEnumMemberLiteral(member: EnumMember): string {
  const initializer = member.getInitializer();
  if (initializer !== undefined && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))) {
    return initializer.getLiteralText();
  }
  return member.getName();
}

// MARK: Directive decorator + inputs/outputs
function readDirectiveDecorator(decl: ClassDeclaration): { readonly selector: string } | undefined {
  for (const decorator of decl.getDecorators()) {
    const name = decorator.getName();
    if (name !== 'Directive' && name !== 'Component') {
      continue;
    }
    const selector = readSelector(decorator);
    if (selector !== undefined) {
      return { selector };
    }
  }
  return undefined;
}

function readSelector(decorator: Decorator): string | undefined {
  const callExpr = decorator.getCallExpression();
  if (callExpr === undefined) {
    return undefined;
  }
  const args = callExpr.getArguments();
  if (args.length === 0) {
    return undefined;
  }
  const firstArg = args[0];
  if (!Node.isObjectLiteralExpression(firstArg)) {
    return undefined;
  }
  return readStringProperty(firstArg, 'selector');
}

function readStringProperty(obj: ObjectLiteralExpression, propName: string): string | undefined {
  const prop = obj.getProperty(propName);
  if (prop === undefined || !Node.isPropertyAssignment(prop)) {
    return undefined;
  }
  const initializer = prop.getInitializer();
  if (initializer === undefined) {
    return undefined;
  }
  if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    return initializer.getLiteralText();
  }
  return undefined;
}

function extractInputs(decl: ClassDeclaration): readonly ActionInputEntry[] {
  const out: ActionInputEntry[] = [];
  const seen = new Set<string>();
  for (const property of decl.getProperties()) {
    if (!isVisible(property)) continue;
    const built = readDecoratorInput(property) ?? readSignalInput(property);
    if (built !== undefined && !seen.has(built.alias)) {
      seen.add(built.alias);
      out.push(built);
    }
  }
  return out;
}

function readDecoratorInput(property: PropertyDeclaration): ActionInputEntry | undefined {
  const decorator = property.getDecorator('Input');
  if (decorator === undefined) {
    return undefined;
  }
  const propertyName = property.getName();
  const decoratorArg = decorator.getCallExpression()?.getArguments()[0];
  let alias: string | undefined;
  let required = false;
  if (decoratorArg !== undefined) {
    if (Node.isStringLiteral(decoratorArg) || Node.isNoSubstitutionTemplateLiteral(decoratorArg)) {
      alias = decoratorArg.getLiteralText();
    } else if (Node.isObjectLiteralExpression(decoratorArg)) {
      alias = readStringProperty(decoratorArg, 'alias');
      const requiredProp = decoratorArg.getProperty('required');
      if (requiredProp !== undefined && Node.isPropertyAssignment(requiredProp)) {
        const init = requiredProp.getInitializer();
        if (init !== undefined && init.getText() === 'true') {
          required = true;
        }
      }
    }
  }
  if (!required) {
    required = !property.hasQuestionToken();
  }
  const explicitType = property.getTypeNode()?.getText() ?? 'unknown';
  const initializer = property.getInitializer();
  const description = readPropertyDescription(property);
  return {
    alias: alias ?? propertyName,
    propertyName,
    type: explicitType,
    required,
    description,
    ...(initializer !== undefined ? { defaultValue: initializer.getText() } : {})
  };
}

function readSignalInput(property: PropertyDeclaration): ActionInputEntry | undefined {
  const initializer = property.getInitializer();
  if (initializer === undefined || !Node.isCallExpression(initializer)) {
    return undefined;
  }
  const expression = initializer.getExpression();
  let kind: 'plain' | 'required' | undefined;
  if (Node.isIdentifier(expression) && expression.getText() === 'input') {
    kind = 'plain';
  } else if (Node.isPropertyAccessExpression(expression)) {
    const baseExpr = expression.getExpression();
    if (Node.isIdentifier(baseExpr) && baseExpr.getText() === 'input' && expression.getName() === 'required') {
      kind = 'required';
    }
  }
  if (kind === undefined) return undefined;

  const propertyName = property.getName();
  const typeArgs = initializer.getTypeArguments();
  const inferredType = typeArgs.length > 0 ? typeArgs[0].getText() : 'unknown';
  const args = initializer.getArguments();
  let alias: string | undefined;
  let defaultValue: string | undefined;
  if (kind === 'plain') {
    if (args.length > 0) defaultValue = args[0].getText();
    if (args.length > 1 && Node.isObjectLiteralExpression(args[1])) {
      alias = readStringProperty(args[1], 'alias');
    }
  } else if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
    alias = readStringProperty(args[0], 'alias');
  }
  return {
    alias: alias ?? propertyName,
    propertyName,
    type: inferredType,
    required: kind === 'required',
    description: readPropertyDescription(property),
    ...(defaultValue !== undefined ? { defaultValue } : {})
  };
}

function extractOutputs(decl: ClassDeclaration): readonly ActionOutputEntry[] {
  const out: ActionOutputEntry[] = [];
  const seen = new Set<string>();
  for (const property of decl.getProperties()) {
    if (!isVisible(property)) continue;
    const built = readDecoratorOutput(property) ?? readSignalOutput(property);
    if (built !== undefined && !seen.has(built.name)) {
      seen.add(built.name);
      out.push(built);
    }
  }
  return out;
}

function readDecoratorOutput(property: PropertyDeclaration): ActionOutputEntry | undefined {
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
    if (typeArgs.length > 0) type = typeArgs[0].getText();
  } else {
    const explicit = property.getTypeNode()?.getText();
    if (explicit !== undefined) type = explicit;
  }
  return {
    name: alias ?? propertyName,
    type,
    description: readPropertyDescription(property)
  };
}

function readSignalOutput(property: PropertyDeclaration): ActionOutputEntry | undefined {
  const initializer = property.getInitializer();
  if (initializer === undefined || !Node.isCallExpression(initializer)) return undefined;
  const expression = initializer.getExpression();
  if (!Node.isIdentifier(expression) || expression.getText() !== 'output') return undefined;
  const typeArgs = initializer.getTypeArguments();
  const type = typeArgs.length > 0 ? typeArgs[0].getText() : 'void';
  const args = initializer.getArguments();
  let alias: string | undefined;
  if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
    alias = readStringProperty(args[0], 'alias');
  }
  return {
    name: alias ?? property.getName(),
    type,
    description: readPropertyDescription(property)
  };
}

// MARK: Store members
function extractStoreMethods(decl: ClassDeclaration): readonly ActionStoreMethodEntry[] {
  const out: ActionStoreMethodEntry[] = [];
  const seen = new Set<string>();
  for (const method of decl.getMethods()) {
    if (!isVisibleMethod(method)) continue;
    const name = method.getName();
    if (seen.has(name)) continue;
    seen.add(name);
    const signature = buildMethodSignature(method);
    out.push({
      name,
      signature,
      description: readMethodDescription(method)
    });
  }
  return out;
}

function buildMethodSignature(method: MethodDeclaration): string {
  const name = method.getName();
  const params = method.getParameters().map((p) => {
    const optional = p.hasQuestionToken() || p.hasInitializer() ? '?' : '';
    const typeText = p.getTypeNode()?.getText() ?? p.getType().getText() ?? 'unknown';
    return `${p.getName()}${optional}: ${typeText}`;
  });
  const returnType = method.getReturnTypeNode()?.getText() ?? 'void';
  return `${name}(${params.join(', ')}): ${returnType}`;
}

function extractStoreObservables(decl: ClassDeclaration): readonly ActionStoreObservableEntry[] {
  const out: ActionStoreObservableEntry[] = [];
  for (const property of decl.getProperties()) {
    if (!isVisible(property)) continue;
    const typeText = property.getTypeNode()?.getText();
    if (typeText === undefined) continue;
    if (!/^Observable<.+>$/.test(typeText) && !typeText.endsWith('$')) continue;
    if (!property.getName().endsWith('$')) continue;
    out.push({
      name: property.getName(),
      type: typeText,
      description: readPropertyDescription(property)
    });
  }
  return out;
}

// MARK: Member helpers
function isVisible(property: PropertyDeclaration): boolean {
  if (property.hasModifier(SyntaxKind.PrivateKeyword) || property.hasModifier(SyntaxKind.ProtectedKeyword)) {
    return false;
  }
  return true;
}

function isVisibleMethod(method: MethodDeclaration): boolean {
  if (method.hasModifier(SyntaxKind.PrivateKeyword) || method.hasModifier(SyntaxKind.ProtectedKeyword)) {
    return false;
  }
  const name = method.getName();
  if (name.startsWith('ng') && /^ng[A-Z]/.test(name)) {
    return false;
  }
  return true;
}

function readPropertyDescription(property: PropertyDeclaration): string {
  const summaries: string[] = [];
  for (const jsDoc of property.getJsDocs()) {
    const desc = jsDoc.getDescription().trim();
    if (desc.length > 0) summaries.push(desc);
  }
  return summaries.join('\n\n');
}

function readMethodDescription(method: MethodDeclaration): string {
  const summaries: string[] = [];
  for (const jsDoc of method.getJsDocs()) {
    const desc = jsDoc.getDescription().trim();
    if (desc.length > 0) summaries.push(desc);
  }
  return summaries.join('\n\n');
}
