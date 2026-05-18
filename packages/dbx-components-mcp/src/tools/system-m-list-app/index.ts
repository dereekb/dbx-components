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
 * @param componentAbs - Absolute path to the `-firebase` component package.
 * @param options - Workspace-relative paths used to relativise the output.
 * @returns The system-state pairing report.
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
 * @param inspection - Prepared folder inspection (typically from `inspectFolder`)
 * @param options - Workspace directories used to relativise emitted paths.
 * @returns The listing report.
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
  const converterByRoot = indexConvertersByRoot(extracted.converters);
  const mapKeys = collectConverterMapKeys(extracted.converterMap);

  const pairings: SystemStatePairing[] = [];
  for (const typeConstant of extracted.typeConstants) {
    pairings.push(buildSystemStatePairing({ typeConstant, dataInterfaceByRoot, converterByRoot, mapKeys }));
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

type ExtractedConverter = ReturnType<typeof extractSystemFile>['converters'][number];
type ExtractedDataInterface = ReturnType<typeof extractSystemFile>['dataInterfaces'][number];
type ExtractedTypeConstant = ReturnType<typeof extractSystemFile>['typeConstants'][number];
type ExtractedConverterMap = ReturnType<typeof extractSystemFile>['converterMap'];

function indexConvertersByRoot(converters: readonly ExtractedConverter[]): ReadonlyMap<string, ExtractedConverter> {
  const out = new Map<string, ExtractedConverter>();
  for (const converter of converters) {
    const root = converterDataRoot(converter.dataTypeArgument);
    if (root === undefined) continue;
    if (!out.has(root)) {
      out.set(root, converter);
    }
  }
  return out;
}

function converterDataRoot(arg: string | undefined): string | undefined {
  if (arg === undefined) return undefined;
  const stem = arg.endsWith('SystemData') ? arg.slice(0, -'SystemData'.length) : arg;
  const root = stem.toLowerCase().replaceAll('_', '');
  return root.length === 0 ? undefined : root;
}

function collectConverterMapKeys(converterMap: ExtractedConverterMap): ReadonlySet<string> {
  const out = new Set<string>();
  if (converterMap !== undefined) {
    for (const key of converterMap.keys) {
      out.add(key.raw);
    }
  }
  return out;
}

interface BuildSystemStatePairingInput {
  readonly typeConstant: ExtractedTypeConstant;
  readonly dataInterfaceByRoot: ReadonlyMap<string, ExtractedDataInterface>;
  readonly converterByRoot: ReadonlyMap<string, ExtractedConverter>;
  readonly mapKeys: ReadonlySet<string>;
}

function buildSystemStatePairing(input: BuildSystemStatePairingInput): SystemStatePairing {
  const { typeConstant, dataInterfaceByRoot, converterByRoot, mapKeys } = input;
  const dataInterface = dataInterfaceByRoot.get(typeConstant.normalizedRoot);
  const converter = converterByRoot.get(typeConstant.normalizedRoot);
  const inConverterMap = mapKeys.has(typeConstant.name);
  return {
    typeConstant: { name: typeConstant.name, exported: typeConstant.exported, line: typeConstant.line },
    dataInterface: dataInterface === undefined ? undefined : { name: dataInterface.name, exported: dataInterface.exported, line: dataInterface.line },
    converter: converter === undefined ? undefined : { name: converter.name, exported: converter.exported, line: converter.line, dataTypeArgument: converter.dataTypeArgument },
    inConverterMap,
    complete: dataInterface !== undefined && converter !== undefined && inConverterMap
  };
}

export { formatReportAsJson } from './format.json.js';
export { formatReportAsMarkdown } from './format.markdown.js';
export type { SystemMListAppReport, SystemStatePairing } from './types.js';
