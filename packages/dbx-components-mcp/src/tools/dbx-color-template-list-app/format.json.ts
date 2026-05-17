import type { ColorTemplateListAppReport } from './types.js';

/**
 * Serialises the color-template report as pretty-printed JSON for
 * callers that want machine-readable output. Keeps key ordering
 * deterministic so snapshot tests are stable.
 *
 * @param report - The listing report to serialise.
 * @returns The JSON body.
 */
export function formatReportAsJson(report: ColorTemplateListAppReport): string {
  return JSON.stringify(report, null, 2);
}
