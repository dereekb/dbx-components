/**
 * AST extraction for the auth catalog.
 *
 * Walks the supplied ts-morph `Project` looking for:
 *
 *   - Type aliases / interfaces tagged with `@dbxAuthClaimsApp <slug>` —
 *     each becomes one {@link ExtractedAuthApp} plus zero-or-more
 *     {@link ExtractedAuthClaim} entries (one per property tagged with
 *     `@dbxAuthClaim`).
 *
 *   - Variable declarations tagged with `@dbxAuthClaimsService <slug>` —
 *     each provides the role-mapping payload for the matching app's
 *     claims by inspecting the call to `authRoleClaimsService({ ... })`.
 *
 * The extractor is intentionally syntactic — no type checker calls — so it
 * runs cheaply on in-memory fixtures and the demo's `claims.ts`. Role
 * constants like `AUTH_ADMIN_ROLE` are resolved through the supplied
 * {@link AuthExtractKnownRoles} map; unresolved identifiers fall through as
 * the identifier text so callers can still see them in registry output.
 */

import { Node, type Expression, type InterfaceDeclaration, type JSDoc, type ObjectLiteralExpression, type PropertyAssignment, type PropertySignature, type Project, type TypeAliasDeclaration } from 'ts-morph';
import type { AuthClaimRoleMappingInfo } from '../registry/auth-runtime.js';

// MARK: Tag names
const AUTH_CLAIMS_APP_TAG = 'dbxAuthClaimsApp';
const AUTH_CLAIMS_SERVICE_TAG = 'dbxAuthClaimsService';
const AUTH_CLAIM_MARKER = 'dbxAuthClaim';
const AUTH_ROLE_TAG_TAG = 'dbxAuthRoleTag';
const AUTH_ROLE_TAG = 'dbxAuthRole';

const AUTH_ROLE_CLAIMS_SERVICE_FN = 'authRoleClaimsService';

// MARK: Public types
/**
 * One claim extracted from an app's `*ApiAuthClaims` interface.
 */
export interface ExtractedAuthClaim {
  readonly key: string;
  readonly type: string;
  readonly description: string;
  readonly app: string;
  readonly interfaceName: string;
  readonly tags: readonly string[];
  readonly mapping: AuthClaimRoleMappingInfo;
  readonly filePath: string;
  readonly line: number;
}

/**
 * One app-level entry extracted from a downstream claims module. Mirrors
 * {@link AuthAppInfo} but uses workspace-relative file paths populated by
 * the loader.
 */
export interface ExtractedAuthApp {
  readonly app: string;
  readonly claimsInterfaceName: string;
  readonly serviceConstName?: string;
  readonly inheritedInterfaceNames: readonly string[];
  readonly ownClaimKeys: readonly string[];
  readonly filePath: string;
  readonly line: number;
}

/**
 * Discriminated union of non-fatal events the extractor emits when a
 * tagged decl can't be assembled into a complete entry. The loader
 * forwards these to the server bootstrap so operators can spot
 * mis-tagged downstream files at startup.
 */
export type AuthExtractWarning =
  | { readonly kind: 'app-missing-slug'; readonly interfaceName: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'service-missing-slug'; readonly constName: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'service-without-app'; readonly constName: string; readonly slug: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'claim-missing-mapping'; readonly app: string; readonly key: string; readonly filePath: string; readonly line: number }
  | { readonly kind: 'unresolved-role-const'; readonly app: string; readonly key: string; readonly constName: string; readonly filePath: string; readonly line: number };

/**
 * Map from role-constant name (e.g. `AUTH_ADMIN_ROLE`) to its resolved
 * role string (`'admin'`). The built-in roles populate this; downstream
 * apps that introduce their own role constants can extend the map at the
 * loader layer once that becomes a workflow.
 */
export type AuthExtractKnownRoles = ReadonlyMap<string, string>;

/**
 * Input to {@link extractAuthEntries}. The caller is responsible for adding
 * source files to `project` (either from disk, in-memory fixtures, or
 * a tsconfig). `knownRoles` is consulted when resolving identifier-style
 * role references like `AUTH_ADMIN_ROLE`.
 */
export interface ExtractAuthEntriesInput {
  readonly project: Project;
  readonly knownRoles: AuthExtractKnownRoles;
}

/**
 * Aggregated outcome of {@link extractAuthEntries}.
 */
export interface ExtractAuthEntriesResult {
  readonly apps: readonly ExtractedAuthApp[];
  readonly claims: readonly ExtractedAuthClaim[];
  readonly warnings: readonly AuthExtractWarning[];
}

// MARK: Entry point
/**
 * Walks the supplied project and returns every app/claim entry tagged with
 * the auth JSDoc markers. Order is stable: source files in the order
 * ts-morph reports them, declarations within a file in source order.
 *
 * @param input - the ts-morph project plus the known-roles resolution map
 * @returns the extracted apps, claims, and any non-fatal warnings
 */
export function extractAuthEntries(input: ExtractAuthEntriesInput): ExtractAuthEntriesResult {
  const { project, knownRoles } = input;
  const warnings: AuthExtractWarning[] = [];

  const taggedAppDecls = collectTaggedAppDecls(project, warnings);
  const serviceMappings = collectServiceMappings(project, warnings, taggedAppDecls);

  const apps: ExtractedAuthApp[] = [];
  const claims: ExtractedAuthClaim[] = [];

  for (const tagged of taggedAppDecls) {
    const serviceForApp = serviceMappings.get(tagged.slug.toLowerCase());
    const inheritedInterfaceNames = collectInheritedInterfaceNames(tagged.decl);

    const ownClaims = collectClaimsFromDecl({
      decl: tagged.decl,
      app: tagged.slug,
      interfaceName: tagged.interfaceName,
      filePath: tagged.filePath,
      service: serviceForApp,
      knownRoles,
      warnings
    });

    for (const claim of ownClaims) claims.push(claim);

    apps.push({
      app: tagged.slug,
      claimsInterfaceName: tagged.interfaceName,
      serviceConstName: serviceForApp?.constName,
      inheritedInterfaceNames,
      ownClaimKeys: ownClaims.map((c) => c.key),
      filePath: tagged.filePath,
      line: tagged.line
    });
  }

  return { apps, claims, warnings };
}

// MARK: App candidate collection
interface TaggedAppDecl {
  readonly slug: string;
  readonly interfaceName: string;
  readonly decl: InterfaceDeclaration | TypeAliasDeclaration;
  readonly filePath: string;
  readonly line: number;
}

function collectTaggedAppDecls(project: Project, warnings: AuthExtractWarning[]): readonly TaggedAppDecl[] {
  const out: TaggedAppDecl[] = [];
  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    for (const decl of sourceFile.getInterfaces()) {
      const tagged = readAppTag({ decl, filePath, warnings, interfaceName: decl.getName() });
      if (tagged !== undefined) out.push(tagged);
    }
    for (const decl of sourceFile.getTypeAliases()) {
      const tagged = readAppTag({ decl, filePath, warnings, interfaceName: decl.getName() });
      if (tagged !== undefined) out.push(tagged);
    }
  }
  return out;
}

interface ReadAppTagInput {
  readonly decl: InterfaceDeclaration | TypeAliasDeclaration;
  readonly interfaceName: string;
  readonly filePath: string;
  readonly warnings: AuthExtractWarning[];
}

function readAppTag(input: ReadAppTagInput): TaggedAppDecl | undefined {
  const { decl, interfaceName, filePath, warnings } = input;
  const slug = readJsDocFirstTagValue(decl.getJsDocs(), AUTH_CLAIMS_APP_TAG);
  let result: TaggedAppDecl | undefined;
  if (slug === 'has-marker-empty') {
    warnings.push({ kind: 'app-missing-slug', interfaceName, filePath, line: decl.getStartLineNumber() });
  } else if (typeof slug === 'string') {
    result = {
      slug,
      interfaceName,
      decl,
      filePath,
      line: decl.getStartLineNumber()
    };
  }
  return result;
}

// MARK: Service candidate collection
interface ServiceMapping {
  readonly constName: string;
  readonly perKey: ReadonlyMap<string, ParsedRoleMapping>;
  readonly filePath: string;
  readonly line: number;
}

interface ParsedRoleMapping {
  readonly mapping: AuthClaimRoleMappingInfo;
  readonly unresolvedRoleConsts: readonly string[];
}

function collectServiceMappings(project: Project, warnings: AuthExtractWarning[], appDecls: readonly TaggedAppDecl[]): ReadonlyMap<string, ServiceMapping> {
  const knownAppSlugs = new Set(appDecls.map((a) => a.slug.toLowerCase()));
  const out = new Map<string, ServiceMapping>();

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    for (const stmt of sourceFile.getVariableStatements()) {
      if (!stmt.isExported()) continue;
      const slug = readJsDocFirstTagValue(stmt.getJsDocs(), AUTH_CLAIMS_SERVICE_TAG);
      if (slug === undefined) continue;
      const decls = stmt.getDeclarations();
      if (slug === 'has-marker-empty') {
        for (const decl of decls) {
          warnings.push({ kind: 'service-missing-slug', constName: decl.getName(), filePath, line: decl.getStartLineNumber() });
        }
        continue;
      }
      const slugLower = slug.toLowerCase();
      if (!knownAppSlugs.has(slugLower)) {
        for (const decl of decls) {
          warnings.push({ kind: 'service-without-app', constName: decl.getName(), slug, filePath, line: decl.getStartLineNumber() });
        }
        continue;
      }
      for (const decl of decls) {
        const constName = decl.getName();
        const perKey = parseServiceInitializer(decl.getInitializer());
        out.set(slugLower, {
          constName,
          perKey,
          filePath,
          line: decl.getStartLineNumber()
        });
      }
    }
  }
  return out;
}

function parseServiceInitializer(initializer: Expression | undefined): ReadonlyMap<string, ParsedRoleMapping> {
  const out = new Map<string, ParsedRoleMapping>();
  const configArg = initializer === undefined ? undefined : resolveServiceConfigArg(initializer);
  if (configArg !== undefined) {
    for (const property of configArg.getProperties()) {
      if (!Node.isPropertyAssignment(property)) continue;
      const key = readPropertyAssignmentKey(property);
      if (key === undefined) continue;
      const parsed = parseRoleMappingValue(property);
      out.set(key, parsed);
    }
  }
  return out;
}

function resolveServiceConfigArg(initializer: Expression): ObjectLiteralExpression | undefined {
  let configArg: ObjectLiteralExpression | undefined;
  if (Node.isCallExpression(initializer)) {
    const callee = initializer.getExpression();
    const calleeText = callee.getText();
    if (calleeText.endsWith(AUTH_ROLE_CLAIMS_SERVICE_FN)) {
      const args = initializer.getArguments();
      if (args.length > 0 && Node.isObjectLiteralExpression(args[0])) {
        configArg = args[0];
      }
    }
  } else if (Node.isObjectLiteralExpression(initializer)) {
    configArg = initializer;
  }
  return configArg;
}

function readPropertyAssignmentKey(property: PropertyAssignment): string | undefined {
  const nameNode = property.getNameNode();
  let result: string | undefined;
  if (Node.isIdentifier(nameNode) || Node.isStringLiteral(nameNode) || Node.isNoSubstitutionTemplateLiteral(nameNode)) {
    result = Node.isIdentifier(nameNode) ? nameNode.getText() : nameNode.getLiteralText();
  }
  return result;
}

function parseRoleMappingValue(property: PropertyAssignment): ParsedRoleMapping {
  const initializer = property.getInitializer();
  let result: ParsedRoleMapping;
  if (initializer === undefined) {
    result = { mapping: { roles: [], inverse: false, customEncodeDecode: false }, unresolvedRoleConsts: [] };
  } else if (Node.isObjectLiteralExpression(initializer)) {
    result = parseRoleMappingObject(initializer);
  } else {
    // Identifier or other expression — treated as a custom claim
    // configuration (function/factory reference). The role list is
    // approximate; downstream code must inspect the source itself.
    result = { mapping: { roles: [], inverse: false, customEncodeDecode: true }, unresolvedRoleConsts: [] };
  }
  return result;
}

function parseRoleMappingObject(obj: ObjectLiteralExpression): ParsedRoleMapping {
  const rolesProperty = obj.getProperty('roles');
  const inverseRolesProperty = obj.getProperty('inverseRoles');
  const claimValueProperty = obj.getProperty('claimValue');
  const inverseModeProperty = obj.getProperty('inverseMode');

  let inverse = false;
  let rawRoles: ReadonlyArray<{ readonly text: string; readonly resolvable: boolean }> = [];
  if (rolesProperty !== undefined && Node.isPropertyAssignment(rolesProperty)) {
    rawRoles = readRoleListInitializer(rolesProperty.getInitializer());
  } else if (inverseRolesProperty !== undefined && Node.isPropertyAssignment(inverseRolesProperty)) {
    inverse = true;
    rawRoles = readRoleListInitializer(inverseRolesProperty.getInitializer());
  }

  const claimValue = claimValueProperty !== undefined && Node.isPropertyAssignment(claimValueProperty) ? readClaimValueInitializer(claimValueProperty.getInitializer()) : undefined;
  const inverseMode = inverseModeProperty !== undefined && Node.isPropertyAssignment(inverseModeProperty) ? readInverseModeInitializer(inverseModeProperty.getInitializer()) : undefined;

  const unresolvedRoleConsts: string[] = [];
  const roleTexts: string[] = [];
  for (const raw of rawRoles) {
    if (!raw.resolvable) {
      unresolvedRoleConsts.push(raw.text);
    }
    roleTexts.push(raw.text);
  }

  const mapping: AuthClaimRoleMappingInfo = {
    roles: roleTexts,
    inverse,
    ...(inverseMode === undefined ? {} : { inverseMode }),
    ...(claimValue === undefined ? {} : { claimValue }),
    customEncodeDecode: false
  };
  return { mapping, unresolvedRoleConsts };
}

function readRoleListInitializer(initializer: Expression | undefined): ReadonlyArray<{ readonly text: string; readonly resolvable: boolean }> {
  const out: { readonly text: string; readonly resolvable: boolean }[] = [];
  if (initializer !== undefined) {
    if (Node.isArrayLiteralExpression(initializer)) {
      for (const element of initializer.getElements()) {
        const parsed = readRoleAtom(element);
        if (parsed !== undefined) out.push(parsed);
      }
    } else {
      const parsed = readRoleAtom(initializer);
      if (parsed !== undefined) out.push(parsed);
    }
  }
  return out;
}

function readRoleAtom(node: Node): { readonly text: string; readonly resolvable: boolean } | undefined {
  let result: { readonly text: string; readonly resolvable: boolean } | undefined;
  if (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node)) {
    result = { text: node.getLiteralText(), resolvable: true };
  } else if (Node.isIdentifier(node)) {
    result = { text: node.getText(), resolvable: false };
  }
  return result;
}

function readClaimValueInitializer(initializer: Expression | undefined): string | number | boolean | undefined {
  let result: string | number | boolean | undefined;
  if (initializer === undefined) {
    result = undefined;
  } else if (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer)) {
    result = initializer.getLiteralText();
  } else if (Node.isNumericLiteral(initializer)) {
    result = Number(initializer.getText());
  } else if (Node.isTrueLiteral(initializer)) {
    result = true;
  } else if (Node.isFalseLiteral(initializer)) {
    result = false;
  }
  return result;
}

function readInverseModeInitializer(initializer: Expression | undefined): 'any' | 'all' | undefined {
  let result: 'any' | 'all' | undefined;
  if (initializer !== undefined && (Node.isStringLiteral(initializer) || Node.isNoSubstitutionTemplateLiteral(initializer))) {
    const text = initializer.getLiteralText();
    if (text === 'any' || text === 'all') {
      result = text;
    }
  }
  return result;
}

// MARK: Claim collection
interface CollectClaimsFromDeclInput {
  readonly decl: InterfaceDeclaration | TypeAliasDeclaration;
  readonly app: string;
  readonly interfaceName: string;
  readonly filePath: string;
  readonly service: ServiceMapping | undefined;
  readonly knownRoles: AuthExtractKnownRoles;
  readonly warnings: AuthExtractWarning[];
}

function collectClaimsFromDecl(input: CollectClaimsFromDeclInput): readonly ExtractedAuthClaim[] {
  const { decl } = input;
  const properties: PropertySignature[] = [];
  if (Node.isInterfaceDeclaration(decl)) {
    for (const prop of decl.getProperties()) properties.push(prop);
  } else {
    const typeNode = decl.getTypeNode();
    if (typeNode !== undefined) collectPropertySignaturesFromTypeNode(typeNode, properties);
  }

  const out: ExtractedAuthClaim[] = [];
  for (const property of properties) {
    const claim = buildClaimFromProperty({ ...input, property });
    if (claim !== undefined) out.push(claim);
  }
  return out;
}

function collectPropertySignaturesFromTypeNode(typeNode: Node, sink: PropertySignature[]): void {
  if (Node.isTypeLiteral(typeNode)) {
    for (const prop of typeNode.getProperties()) sink.push(prop);
  } else if (Node.isIntersectionTypeNode(typeNode)) {
    for (const member of typeNode.getTypeNodes()) collectPropertySignaturesFromTypeNode(member, sink);
  } else if (Node.isParenthesizedTypeNode(typeNode)) {
    const inner = typeNode.getTypeNode();
    if (inner !== undefined) collectPropertySignaturesFromTypeNode(inner, sink);
  }
}

interface BuildClaimFromPropertyInput extends CollectClaimsFromDeclInput {
  readonly property: PropertySignature;
}

function buildClaimFromProperty(input: BuildClaimFromPropertyInput): ExtractedAuthClaim | undefined {
  const { property, app, interfaceName, filePath, service, knownRoles, warnings } = input;
  const tagState = readPropertyTagState(property.getJsDocs());

  let result: ExtractedAuthClaim | undefined;
  if (tagState.hasMarker) {
    const key = property.getName();
    const typeText = property.getTypeNode()?.getText() ?? 'unknown';
    const description = tagState.summaries.join('\n\n');
    const line = property.getStartLineNumber();

    const parsed = service?.perKey.get(key);
    if (parsed === undefined) {
      warnings.push({ kind: 'claim-missing-mapping', app, key, filePath, line });
    }

    const mapping: AuthClaimRoleMappingInfo = parsed === undefined ? { roles: [], inverse: false, customEncodeDecode: false } : resolveMappingRoles({ mapping: parsed.mapping, unresolvedRoleConsts: parsed.unresolvedRoleConsts, knownRoles, app, key, filePath, line, warnings });

    result = {
      key,
      type: typeText,
      description,
      app,
      interfaceName,
      tags: tagState.tags,
      mapping,
      filePath,
      line
    };
  }
  return result;
}

interface ResolveMappingRolesInput {
  readonly mapping: AuthClaimRoleMappingInfo;
  readonly unresolvedRoleConsts: readonly string[];
  readonly knownRoles: AuthExtractKnownRoles;
  readonly app: string;
  readonly key: string;
  readonly filePath: string;
  readonly line: number;
  readonly warnings: AuthExtractWarning[];
}

function resolveMappingRoles(input: ResolveMappingRolesInput): AuthClaimRoleMappingInfo {
  const { mapping, knownRoles, app, key, filePath, line, warnings } = input;
  const resolved: string[] = [];
  for (const role of mapping.roles) {
    if (knownRoles.has(role)) {
      resolved.push(knownRoles.get(role) as string);
    } else if (input.unresolvedRoleConsts.includes(role)) {
      warnings.push({ kind: 'unresolved-role-const', app, key, constName: role, filePath, line });
      resolved.push(role);
    } else {
      resolved.push(role);
    }
  }
  return { ...mapping, roles: resolved };
}

interface PropertyTagState {
  readonly hasMarker: boolean;
  readonly summaries: readonly string[];
  readonly tags: readonly string[];
}

function readPropertyTagState(jsDocs: readonly JSDoc[]): PropertyTagState {
  const summaries: string[] = [];
  const tags: string[] = [];
  let hasMarker = false;
  for (const jsDoc of jsDocs) {
    const description = jsDoc.getDescription().trim();
    if (description.length > 0) summaries.push(description);
    for (const tag of jsDoc.getTags()) {
      const name = tag.getTagName();
      const text = tag.getCommentText()?.trim() ?? '';
      if (name === AUTH_CLAIM_MARKER) {
        hasMarker = true;
      } else if ((name === AUTH_ROLE_TAG_TAG || name === AUTH_ROLE_TAG) && text.length > 0) {
        for (const piece of splitListTagText(text)) {
          if (!tags.includes(piece)) tags.push(piece);
        }
      }
    }
  }
  return { hasMarker, summaries, tags };
}

function splitListTagText(text: string): readonly string[] {
  const out: string[] = [];
  for (const piece of text.split(/[\s,]+/)) {
    const trimmed = piece.trim();
    if (trimmed.length > 0) out.push(trimmed);
  }
  return out;
}

// MARK: Inheritance
function collectInheritedInterfaceNames(decl: InterfaceDeclaration | TypeAliasDeclaration): readonly string[] {
  const out: string[] = [];
  if (Node.isInterfaceDeclaration(decl)) {
    for (const ext of decl.getExtends()) {
      const name = ext.getExpression().getText();
      if (name.length > 0 && !out.includes(name)) out.push(name);
    }
  } else {
    const typeNode = decl.getTypeNode();
    if (typeNode !== undefined) collectInheritedInterfaceNamesFromTypeNode(typeNode, out);
  }
  return out;
}

function collectInheritedInterfaceNamesFromTypeNode(typeNode: Node, sink: string[]): void {
  if (Node.isIntersectionTypeNode(typeNode)) {
    for (const member of typeNode.getTypeNodes()) collectInheritedInterfaceNamesFromTypeNode(member, sink);
  } else if (Node.isTypeReference(typeNode)) {
    const text = typeNode.getTypeName().getText();
    if (text.length > 0 && !sink.includes(text)) sink.push(text);
  } else if (Node.isParenthesizedTypeNode(typeNode)) {
    const inner = typeNode.getTypeNode();
    if (inner !== undefined) collectInheritedInterfaceNamesFromTypeNode(inner, sink);
  }
}

// MARK: JSDoc helpers
type JsDocFirstTagValue = string | 'has-marker-empty' | undefined;

/**
 * Reads the first occurrence of `@<tagName>` from the supplied JSDoc blocks.
 *
 * @param jsDocs - the JSDoc blocks attached to the declaration
 * @param tagName - the tag name to look for, without the leading `@`
 * @returns the trimmed comment text when the tag carries a value;
 *   `'has-marker-empty'` when the tag is present but empty (callers treat
 *   that as a warning condition); `undefined` when the tag is not present
 *   at all.
 */
function readJsDocFirstTagValue(jsDocs: readonly JSDoc[], tagName: string): JsDocFirstTagValue {
  let result: JsDocFirstTagValue;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      if (tag.getTagName() === tagName) {
        const text = tag.getCommentText()?.trim() ?? '';
        result = text.length > 0 ? text : 'has-marker-empty';
        break;
      }
    }
    if (result !== undefined) break;
  }
  return result;
}
