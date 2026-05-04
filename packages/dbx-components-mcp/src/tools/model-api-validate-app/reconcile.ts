/**
 * Joins declarations with handlers and emits issues for the reconciliation
 * gaps the validator surfaces.
 */

import type { DeclaredEntry, HandlerEntry, ModelSummary, ReconciledEntry, ValidateIssue } from './types.js';
import type { CrudVerb } from '../model-api-shared/types.js';

export interface ReconcileInput {
  readonly declared: readonly DeclaredEntry[];
  readonly handlers: readonly HandlerEntry[];
  readonly modelFilter?: string;
}

export interface ReconcileResult {
  readonly entries: readonly ReconciledEntry[];
  readonly issues: readonly ValidateIssue[];
  readonly summaries: readonly ModelSummary[];
  readonly errorCount: number;
  readonly warningCount: number;
}

interface CellKey {
  readonly model: string;
  readonly verb: CrudVerb;
  readonly specifier: string | undefined;
}

function keyOf(cell: CellKey): string {
  return `${cell.model}|${cell.verb}|${cell.specifier ?? '__none__'}`;
}

export function reconcile(input: ReconcileInput): ReconcileResult {
  const wanted = input.modelFilter ? normalize(input.modelFilter) : undefined;

  const declaredFiltered = wanted ? input.declared.filter((d) => normalize(d.model) === wanted) : input.declared;
  const handlersFiltered = wanted ? input.handlers.filter((h) => normalize(h.model) === wanted) : input.handlers;

  const handlerMap = new Map<string, HandlerEntry>();
  for (const h of handlersFiltered) {
    handlerMap.set(keyOf(h), h);
  }

  const seenKeys = new Set<string>();
  const entries: ReconciledEntry[] = [];
  const issues: ValidateIssue[] = [];

  for (const d of declaredFiltered) {
    const key = keyOf(d);
    seenKeys.add(key);
    const handler = handlerMap.get(key);
    entries.push({ model: d.model, verb: d.verb, specifier: d.specifier, declared: d, handler });
    if (!handler) {
      const specifierSuffix = d.specifier ? `.${d.specifier}` : '';
      issues.push({
        code: 'MISSING_HANDLER',
        model: d.model,
        verb: d.verb,
        specifier: d.specifier,
        message: `Declared in \`${d.sourceFile}:${d.line}\` (params: \`${d.paramsTypeName ?? '?'}\`) but no handler is wired in the app's \`${d.verb}\` map for \`${d.model}\`${specifierSuffix}.`,
        source: `${d.sourceFile}:${d.line}`
      });
    }
  }

  for (const h of handlersFiltered) {
    const key = keyOf(h);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    entries.push({ model: h.model, verb: h.verb, specifier: h.specifier, declared: undefined, handler: h });
    const specifierSuffix = h.specifier ? `.${h.specifier}` : '';
    issues.push({
      code: 'ORPHAN_HANDLER',
      model: h.model,
      verb: h.verb,
      specifier: h.specifier,
      message: `Handler \`${h.handlerName}\` is wired in the app's \`${h.verb}\` map (\`${h.sourceFile}:${h.line}\`) for \`${h.model}\`${specifierSuffix} but no firebase-component \`<model>.api.ts\` declares this CRUD entry.`,
      source: `${h.sourceFile}:${h.line}`
    });
  }

  entries.sort(compareEntries);
  issues.sort((a, b) => a.model.localeCompare(b.model) || (a.verb ?? '').localeCompare(b.verb ?? '') || (a.specifier ?? '').localeCompare(b.specifier ?? ''));

  const summaries = buildSummaries(entries, issues);
  const errorCount = issues.length;
  const warningCount = 0;
  return { entries, issues, summaries, errorCount, warningCount };
}

function buildSummaries(entries: readonly ReconciledEntry[], issues: readonly ValidateIssue[]): readonly ModelSummary[] {
  const byModel = new Map<string, { declaredCount: number; handledCount: number; matchedCount: number; errorCount: number }>();
  for (const e of entries) {
    const summary = byModel.get(e.model) ?? { declaredCount: 0, handledCount: 0, matchedCount: 0, errorCount: 0 };
    if (e.declared) summary.declaredCount += 1;
    if (e.handler) summary.handledCount += 1;
    if (e.declared && e.handler) summary.matchedCount += 1;
    byModel.set(e.model, summary);
  }
  for (const issue of issues) {
    const summary = byModel.get(issue.model);
    if (summary) summary.errorCount += 1;
  }
  return [...byModel.entries()].map(([model, s]) => ({ model, ...s })).sort((a, b) => a.model.localeCompare(b.model));
}

function compareEntries(a: ReconciledEntry, b: ReconciledEntry): number {
  return a.model.localeCompare(b.model) || a.verb.localeCompare(b.verb) || (a.specifier ?? '').localeCompare(b.specifier ?? '');
}

function normalize(value: string): string {
  return value.replace(/Identity$/i, '').toLowerCase();
}
