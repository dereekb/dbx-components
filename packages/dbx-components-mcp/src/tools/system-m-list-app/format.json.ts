/**
 * JSON renderer for `dbx_system_m_list_app`. Produces a pretty-printed
 * report so callers can pipe the output into a structured pipeline.
 */

import type { SystemMListAppReport } from './types.js';

/**
 * @param report - The listing report to render.
 * @returns The report serialized as pretty-printed JSON.
 */
export function formatReportAsJson(report: SystemMListAppReport): string {
  return JSON.stringify(report, null, 2);
}
