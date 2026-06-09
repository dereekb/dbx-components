/**
 * Type surface for the generator helpers exported for unit tests
 * (see `generate-css-tokens.mjs` — the CLI itself only runs when the
 * script is executed directly).
 */

export interface ParsedSassdoc {
  readonly description?: string;
  readonly intents: string[];
  readonly role?: string;
  readonly antiUseNotes?: string;
  readonly utilityClasses: string[];
  readonly seeAlso: string[];
  readonly recommendedPrimitive?: string;
  readonly light?: string;
  readonly dark?: string;
}

export interface ComponentTokenDeclaration {
  readonly value: string;
  readonly doc?: ParsedSassdoc;
}

export interface ComponentTokenConsumption {
  readonly fallback?: string;
}

export interface ParsedComponentTokens {
  readonly declarations: Map<string, ComponentTokenDeclaration>;
  readonly consumptions: Map<string, ComponentTokenConsumption>;
}

export interface DbxVarUse {
  readonly cssVar: string;
  readonly fallback?: string;
}

export interface ComponentTokenEntry {
  readonly cssVariable: string;
  readonly source: string;
  readonly role: string;
  readonly intents: string[];
  readonly description: string;
  readonly defaults: { readonly light?: string };
  readonly componentScope: string;
  readonly antiUseNotes?: string;
  readonly utilityClasses?: string[];
  readonly recommendedPrimitive?: string;
  readonly seeAlso?: string[];
}

export interface ExtractComponentTokensInput {
  readonly rootDir: string;
  readonly excludePaths?: string[];
  readonly knownCssVars: Set<string>;
  readonly source: string;
}

export function parseSassdocLines(lines: string[]): ParsedSassdoc;
export function parseVarDecls(scss: string, cssToScss: Map<string, string>, scssToCss: Map<string, string>): void;
export function parseSassdocBlocks(scss: string, cssToScss: Map<string, string>): Map<string, ParsedSassdoc>;
export function parseRootDefaults(rootScss: string, scssToCss: Map<string, string>): Map<string, string>;
export function inferRole(cssVar: string): string;
export function inferIntents(cssVar: string, role: string): string[];
export function parseComponentTokensInScss(scss: string): ParsedComponentTokens;
export function findDbxVarUses(scss: string): DbxVarUse[];
export function componentScopeForFile(filePath: string): string;
export function extractComponentTokens(input: ExtractComponentTokensInput): ComponentTokenEntry[];
