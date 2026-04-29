/**
 * Pure entry point for `dbx_model_list_component`. Composes the
 * extractor with optional fixture cross-reference and returns the
 * report consumed by the formatter.
 */

import { inspectAppFixtures } from '../model-fixture-shared/index.js';
import { extractComponentModels } from './extract.js';
import type { ComponentModelEntry, ComponentModelReport } from './types.js';

export interface ListComponentModelsOptions {
  /**
   * Caller-supplied relative path to the component package root.
   * Used for emitting human-readable paths in the report.
   */
  readonly componentDir: string;
  /**
   * Caller-supplied relative path to the API app, when fixture
   * cross-reference is requested.
   */
  readonly apiDir?: string;
  /**
   * Absolute path to the API app root, used by `inspectAppFixtures`.
   * Required when {@link apiDir} is set.
   */
  readonly apiAbs?: string;
}

/**
 * Walks `<componentAbs>/src/lib/model/`, optionally cross-references
 * the API app's fixture file, and returns the listing report.
 *
 * @param componentAbs - absolute path to the component root
 * @param options - relative paths + optional API dir for fixture coverage
 * @returns the populated listing report
 */
export async function listComponentModels(componentAbs: string, options: ListComponentModelsOptions): Promise<ComponentModelReport> {
  const extraction = await extractComponentModels(componentAbs);
  if (!options.apiAbs) {
    const result: ComponentModelReport = {
      componentDir: options.componentDir,
      modelRoot: extraction.modelRoot,
      models: extraction.models.map(stripCoverage),
      skipped: extraction.skipped,
      unidentifiedFolders: extraction.unidentifiedFolders,
      fixtureCoverageStatus: 'no-api-dir'
    };
    return result;
  }
  let coveredModels: ReadonlySet<string>;
  let coverageStatus: ComponentModelReport['fixtureCoverageStatus'];
  try {
    const fixtureExtraction = await inspectAppFixtures(options.apiAbs, options.apiDir ?? '');
    coveredModels = new Set(fixtureExtraction.entries.map((e) => e.model));
    coverageStatus = 'ok';
  } catch (err) {
    coveredModels = new Set();
    coverageStatus = { kind: 'error', message: err instanceof Error ? err.message : String(err) };
  }
  const annotated: ComponentModelEntry[] = extraction.models.map((m) => ({
    ...m,
    fixtureCovered: coverageStatus === 'ok' ? coveredModels.has(m.modelName) : undefined
  }));
  const result: ComponentModelReport = {
    componentDir: options.componentDir,
    modelRoot: extraction.modelRoot,
    models: annotated,
    skipped: extraction.skipped,
    unidentifiedFolders: extraction.unidentifiedFolders,
    fixtureCoverageStatus: coverageStatus
  };
  return result;
}

function stripCoverage(model: ComponentModelEntry): ComponentModelEntry {
  return { ...model, fixtureCovered: undefined };
}

export { formatReportAsJson, formatReportAsMarkdown } from './format.js';
export type { ComponentModelEntry, ComponentModelReport, SkippedReservedFolder } from './types.js';
