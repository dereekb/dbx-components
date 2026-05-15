/**
 * Public entry point for `dbx_color_template_list_app`.
 * Re-exports the inspection, extraction, formatters, and shared types so the
 * MCP wrapper and downstream callers (e.g. `dbx_color_smell_check`) can pull
 * everything from a single module.
 */

export { inspectColorTemplates } from './inspect.js';
export type { ColorTemplateInspection, ColorTemplateInspectedFile } from './inspect.js';
export { extractColorTemplates } from './extract.js';
export type { ExtractedColorTemplates } from './extract.js';
export { formatReportAsMarkdown } from './format.markdown.js';
export { formatReportAsJson } from './format.json.js';
export type { ColorTemplateConfig, ColorTemplateEntry, ColorTemplateListAppReport, ColorTemplateProvideLocation, ColorTemplateWarning } from './types.js';

import type { ColorTemplateListAppReport } from './types.js';
import type { ColorTemplateInspection } from './inspect.js';
import { extractColorTemplates } from './extract.js';

/**
 * Pure listing entry point. Reuses the same extraction step that the
 * smell-check cross-reference call uses so the listing and cross-reference
 * stay in sync.
 *
 * @param inspection - the pre-loaded app inspection
 * @returns the listing report
 */
export function listAppColorTemplates(inspection: ColorTemplateInspection): ColorTemplateListAppReport {
  const extracted = extractColorTemplates(inspection);
  const result: ColorTemplateListAppReport = {
    apiDir: inspection.apiDir,
    templates: extracted.templates,
    warnings: extracted.warnings,
    provideCallLocation: extracted.provideCallLocation
  };
  return result;
}
