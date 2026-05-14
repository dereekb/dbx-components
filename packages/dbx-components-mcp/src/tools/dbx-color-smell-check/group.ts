/**
 * Grouping and cross-reference layer for `dbx_color_smell_check`.
 *
 * Takes the raw extracted literals, drops dynamic ones, normalises the
 * surviving entries, groups by signature, and (when the caller supplied
 * an `apiDir`) cross-references the group signature against the
 * templates returned by `dbx_color_template_list_app`.
 */

import type { ColorTemplateEntry } from '../dbx-color-template-list-app/index.js';
import type { ExtractedLiteral } from './extract.js';
import { normalizeColorConfig, signatureFor, type ColorSmellEquivalenceMode } from './normalize.js';
import type { ColorSmellCheckResult, ColorSmellFinding, ColorSmellLiteralLocation, ColorSmellSuggestion, NormalizedColorConfig } from './types.js';

/**
 * Input to {@link groupColorSmells}.
 */
export interface GroupColorSmellsInput {
  readonly literals: readonly ExtractedLiteral[];
  readonly equivalenceMode: ColorSmellEquivalenceMode;
  readonly minDuplicates: number;
  readonly filesScanned: number;
  readonly templates?: readonly ColorTemplateEntry[];
}

/**
 * Reduces the extractor output into the final {@link ColorSmellCheckResult}.
 * Equivalent literals collapse into a single finding; each finding picks
 * the best template recommendation from the supplied list (or a
 * placeholder when no template matches).
 *
 * @param input - the literals, equivalence config, and cross-reference templates
 * @returns the final report (findings + summary)
 */
export function groupColorSmells(input: GroupColorSmellsInput): ColorSmellCheckResult {
  const groups = new Map<string, ColorSmellLiteralLocation[]>();
  let dynamicSkipped = 0;
  let literalsFound = 0;
  for (const literal of input.literals) {
    if (literal.dynamic) {
      dynamicSkipped += 1;
      continue;
    }
    literalsFound += 1;
    const normalized = normalizeColorConfig(literal.raw, input.equivalenceMode);
    const signature = signatureFor(normalized);
    const location: ColorSmellLiteralLocation = {
      file: literal.file,
      line: literal.line,
      column: literal.column,
      source: literal.source,
      snippet: literal.snippet,
      normalized
    };
    const existing = groups.get(signature);
    if (existing === undefined) {
      groups.set(signature, [location]);
    } else {
      existing.push(location);
    }
  }

  const findings: ColorSmellFinding[] = [];
  const templateBySignature = buildTemplateIndex(input.templates ?? [], input.equivalenceMode);
  for (const [signature, locations] of groups) {
    if (locations.length < input.minDuplicates) continue;
    const suggestion = buildSuggestion({ signature, locations, templateBySignature });
    findings.push({ signature, equivalent: locations, suggestion });
  }

  const result: ColorSmellCheckResult = {
    findings,
    summary: {
      filesScanned: input.filesScanned,
      literalsFound,
      duplicateGroups: findings.length,
      dynamicLiteralsSkipped: dynamicSkipped
    }
  };
  return result;
}

function buildTemplateIndex(templates: readonly ColorTemplateEntry[], mode: ColorSmellEquivalenceMode): Map<string, ColorTemplateEntry> {
  const out = new Map<string, ColorTemplateEntry>();
  for (const template of templates) {
    const normalized = normalizeColorConfig(template.config, mode);
    const signature = signatureFor(normalized);
    if (!out.has(signature)) out.set(signature, template);
  }
  return out;
}

interface BuildSuggestionInput {
  readonly signature: string;
  readonly locations: readonly ColorSmellLiteralLocation[];
  readonly templateBySignature: Map<string, ColorTemplateEntry>;
}

function buildSuggestion(input: BuildSuggestionInput): ColorSmellSuggestion {
  const existing = input.templateBySignature.get(input.signature);
  let result: ColorSmellSuggestion;
  if (existing !== undefined) {
    result = {
      existingTemplateKey: existing.key,
      rationale: `Existing template \`${existing.key}\` (registered at \`${existing.sourceFile}:${existing.sourceLine}\`) already matches this signature.`
    };
  } else {
    const proposed = proposeTemplateKey(input.locations[0].normalized);
    result = {
      proposedTemplateKey: proposed,
      rationale: `No existing template matches this signature. Register one (e.g. \`{ key: '${proposed}', config: {...} }\`) in \`provideDbxStyleService({ dbxColorServiceConfig: { templates: [...] } })\`.`
    };
  }
  return result;
}

function proposeTemplateKey(normalized: NormalizedColorConfig): string {
  let result = 'brand-color';
  if (normalized.color !== undefined) {
    const hex = /^#([0-9a-f]{6})$/i.exec(normalized.color);
    if (hex !== null) {
      result = `brand-${hex[1].toLowerCase()}`;
    } else {
      const sanitized = normalized.color
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      if (sanitized.length > 0) result = `brand-${sanitized}`.slice(0, 40);
    }
  }
  return result;
}
