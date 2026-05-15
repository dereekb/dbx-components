/**
 * Pure listing core for `dbx_system_m_list_app`.
 *
 * Reuses the validator's filesystem inspector + AST extractor so the
 * listing reflects the same view the validator does. Output is a
 * pairing summary per declared `<NAME>_SYSTEM_STATE_TYPE` constant:
 * its matched data interface, its matched converter, and whether the
 * key is referenced by the aggregate converter map.
 */

import { extractSystemFile } from '../system-m-validate-folder/extract.js';
import { inspectFolder } from '../system-m-validate-folder/inspect.js';
import type { SystemFolderInspection } from '../system-m-validate-folder/types.js';
import type { SystemMListAppReport, SystemStatePairing } from './types.js';

export interface ListAppSystemOptions {
  readonly componentDir: string;
}

/**
 * Inspects `<componentAbs>/src/lib/model/system/` and produces a pairing
 * report. When the folder is missing or unreadable, returns a report
 * with a single `status` entry and an empty pairing list — callers can
 * surface the situation without crashing.
 *
 * @param componentAbs - absolute path to the `-firebase` component package
 * @param options - workspace-relative paths used to relativise the output
 * @returns the system-state pairing report
 */
export async function listAppSystem(componentAbs: string, options: ListAppSystemOptions): Promise<SystemMListAppReport> {
  const systemPath = `${componentAbs.replace(/[/\\]+$/, '')}/src/lib/model/system`;
  const inspection = await inspectFolder(systemPath);
  return collectAppSystem(inspection, options);
}

/**
 * Pure listing entry point. Reuses the validator's extractor over a
 * prepared inspection so the listing report stays in sync with the
 * folder validator.
 *
 * @param inspection - prepared folder inspection (typically from `inspectFolder`)
 * @param options - workspace directories used to relativise emitted paths
 * @returns the listing report
 */
export function collectAppSystem(inspection: SystemFolderInspection, options: ListAppSystemOptions): SystemMListAppReport {
  if (inspection.status !== 'ok' || inspection.systemSource === undefined) {
    const report: SystemMListAppReport = {
      componentDir: options.componentDir,
      folderPath: inspection.path,
      status: inspection.status,
      hasSystemSource: false,
      converterMapName: undefined,
      converterMapTypeAnnotation: undefined,
      pairings: []
    };
    return report;
  }

  const extracted = extractSystemFile('system.ts', inspection.systemSource);
  const dataInterfaceByRoot = new Map(extracted.dataInterfaces.map((iface) => [iface.normalizedRoot, iface]));
  const converterByRoot = new Map<string, (typeof extracted.converters)[number]>();
  for (const converter of extracted.converters) {
    const arg = converter.dataTypeArgument;
    if (arg === undefined) continue;
    const stem = arg.endsWith('SystemData') ? arg.slice(0, -'SystemData'.length) : arg;
    const root = stem.toLowerCase().replaceAll('_', '');
    if (root.length === 0) continue;
    if (!converterByRoot.has(root)) {
      converterByRoot.set(root, converter);
    }
  }
  const mapKeys = new Set<string>();
  if (extracted.converterMap !== undefined) {
    for (const key of extracted.converterMap.keys) {
      mapKeys.add(key.raw);
    }
  }

  const pairings: SystemStatePairing[] = [];
  for (const typeConstant of extracted.typeConstants) {
    const dataInterface = dataInterfaceByRoot.get(typeConstant.normalizedRoot);
    const converter = converterByRoot.get(typeConstant.normalizedRoot);
    const pairing: SystemStatePairing = {
      typeConstant: { name: typeConstant.name, exported: typeConstant.exported, line: typeConstant.line },
      dataInterface: dataInterface === undefined ? undefined : { name: dataInterface.name, exported: dataInterface.exported, line: dataInterface.line },
      converter: converter === undefined ? undefined : { name: converter.name, exported: converter.exported, line: converter.line, dataTypeArgument: converter.dataTypeArgument },
      inConverterMap: mapKeys.has(typeConstant.name),
      complete: dataInterface !== undefined && converter !== undefined && mapKeys.has(typeConstant.name)
    };
    pairings.push(pairing);
  }

  const report: SystemMListAppReport = {
    componentDir: options.componentDir,
    folderPath: inspection.path,
    status: inspection.status,
    hasSystemSource: true,
    converterMapName: extracted.converterMap?.name,
    converterMapTypeAnnotation: extracted.converterMap?.typeAnnotation,
    pairings
  };
  return report;
}

export { formatReportAsJson } from './format.json.js';
export { formatReportAsMarkdown } from './format.markdown.js';
export type { SystemMListAppReport, SystemStatePairing } from './types.js';
