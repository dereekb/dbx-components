/**
 * Forwarder generator for `dbx_model_fixture_forward`.
 *
 * Pure text generation — given a parsed entry, returns the source of every
 * forwarder method that should be inserted into the Fixture class. Disk
 * mutation is handled by the tool wrapper.
 */

import type { FixtureEntry, FixtureMethod } from './types.js';

/**
 * One forwarder method to insert into the Fixture class.
 */
export interface RenderedForwarder {
  readonly method: string;
  readonly source: string;
}

/**
 * Inputs accepted by {@link renderForwarders}.
 */
export interface RenderForwardersInput {
  readonly entry: FixtureEntry;
  readonly methods?: readonly string[];
}

/**
 * Result of {@link renderForwarders}.
 */
export interface RenderedForwarders {
  readonly added: readonly RenderedForwarder[];
  readonly skippedAlreadyForwarded: readonly string[];
  readonly missingFromInstance: readonly string[];
}

/**
 * Returns the forwarder source for every public Instance method that
 * doesn't yet have a Fixture counterpart.
 *
 * The forwarder body is a thin wrapper:
 * ```
 * async <name>(<paramText>): <returnType> {
 *   return this.instance.<name>(<args>);
 * }
 * ```
 *
 * Existing Fixture methods with the same name are left alone; they're
 * reported in `skippedAlreadyForwarded`.
 *
 * @param input - the entry to forward + optional whitelist of method names
 * @returns the rendered forwarders + skip metadata
 */
export function renderForwarders(input: RenderForwardersInput): RenderedForwarders {
  const { entry, methods } = input;
  const fixtureNames = new Set(entry.fixtureMethods.map((m) => m.name));
  const wanted = methods ? new Set(methods) : undefined;
  const added: RenderedForwarder[] = [];
  const skipped: string[] = [];
  const missing: string[] = [];
  const instanceByName = new Map(entry.instanceMethods.map((m) => [m.name, m]));

  if (wanted) {
    for (const name of wanted) {
      if (!instanceByName.has(name)) {
        missing.push(name);
      }
    }
  }

  for (const m of entry.instanceMethods) {
    if (m.visibility !== 'public') continue;
    if (wanted && !wanted.has(m.name)) continue;
    if (fixtureNames.has(m.name)) {
      skipped.push(m.name);
      continue;
    }
    added.push(renderOne(m));
  }
  return {
    added,
    skippedAlreadyForwarded: skipped,
    missingFromInstance: missing
  };
}

function renderOne(m: FixtureMethod): RenderedForwarder {
  const asyncKw = m.isAsync ? 'async ' : '';
  const returnType = m.returnTypeText ? `: ${m.returnTypeText}` : '';
  const args = parameterCallText(m.parameterText);
  const body = `return this.instance.${m.name}(${args});`;
  const source = `  ${asyncKw}${m.name}(${m.parameterText})${returnType} {\n    ${body}\n  }`;
  return { method: m.name, source };
}

/**
 * Converts a parameter list (parameter declarations) into a call-site
 * argument list. Strips optional/default/rest markers, types, and
 * destructured patterns down to the parameter names. Spread parameters
 * are forwarded as `...name`.
 *
 * @param parameterText - the raw parameter text from ts-morph
 * @returns the comma-joined argument list to use at the call site
 */
function parameterCallText(parameterText: string): string {
  if (parameterText.trim().length === 0) return '';
  const params = splitParameters(parameterText);
  const out: string[] = [];
  for (const raw of params) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const isRest = trimmed.startsWith('...');
    const stripped = isRest ? trimmed.slice(3) : trimmed;
    const equalsIdx = stripped.indexOf('=');
    const beforeEq = equalsIdx === -1 ? stripped : stripped.slice(0, equalsIdx);
    const colonIdx = topLevelColonIndex(beforeEq);
    const head = colonIdx === -1 ? beforeEq : beforeEq.slice(0, colonIdx);
    const cleaned = head.replace(/\?$/, '').trim();
    const name = cleaned.replace(/^public\s+|^private\s+|^protected\s+|^readonly\s+/, '').trim();
    if (name.length === 0) continue;
    out.push(isRest ? `...${name}` : name);
  }
  return out.join(', ');
}

function splitParameters(text: string): readonly string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '<' || ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ',' && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}

function topLevelColonIndex(text: string): number {
  let depth = 0;
  let index = 0;
  for (const ch of text) {
    if (ch === '<' || ch === '(' || ch === '[' || ch === '{') depth += 1;
    else if (ch === '>' || ch === ')' || ch === ']' || ch === '}') depth -= 1;
    else if (ch === ':' && depth === 0) return index;
    index += 1;
  }
  return -1;
}
