import type { ColorTemplateListAppReport } from './types.js';

/**
 * Serialises the color-template report as pretty-printed JSON for
 * callers that want machine-readable output. Keeps key ordering
 * deterministic so snapshot tests are stable.
 *
 * @param report - the listing report to serialise
 * @returns the JSON body
 */
export function formatReportAsJson(report: ColorTemplateListAppReport): string {
  return JSON.stringify(report, null, 2);
}
