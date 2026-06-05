import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractModelsFromSource, type ModelExtractionConverter } from '@dereekb/dbx-cli/manifest-extract';
import { type ModelSizeProfile } from './model-size.profile';
import { type SnapshotToConverter } from './model-size.measure';

/**
 * Thrown when a profile's converter target cannot be resolved or imported.
 */
export class ModelSizeResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelSizeResolveError';
  }
}

/**
 * Input for {@link resolveConverter}.
 */
export interface ResolveConverterInput {
  /**
   * The normalized profile naming the converter `source` (+ optional `export`).
   */
  readonly profile: ModelSizeProfile;
  /**
   * Absolute path of the profile file, used to resolve a relative `source`.
   * When omitted, `source` resolves against the working directory only.
   */
  readonly profilePath?: string;
}

/**
 * A resolved converter: its static field tree (for generation), the
 * converter-const registry (for nested resolution), and the live runtime
 * converter (for measurement).
 */
export interface ResolvedConverter {
  readonly sourceFile: string;
  readonly exportName: string;
  readonly converterTree: ModelExtractionConverter;
  readonly registry: ReadonlyMap<string, ModelExtractionConverter>;
  readonly converter: SnapshotToConverter;
}

/**
 * Resolves a profile's `source` to an existing absolute file path, trying the
 * profile's directory before the working directory.
 *
 * @param source - The `source` value from the profile.
 * @param profilePath - Absolute path of the profile file, when known.
 * @returns The resolved absolute source path.
 * @throws {ModelSizeResolveError} When no candidate path exists.
 */
export function resolveSourcePath(source: string, profilePath?: string): string {
  const candidates: string[] = [];

  if (isAbsolute(source)) {
    candidates.push(source);
  } else {
    if (profilePath) {
      candidates.push(resolve(dirname(profilePath), source));
    }

    candidates.push(resolve(process.cwd(), source));
  }

  const found = candidates.find((candidate) => existsSync(candidate));

  if (!found) {
    throw new ModelSizeResolveError(`Could not find source file '${source}'. Tried: ${candidates.join(', ')}.`);
  }

  return found;
}

function buildConverterRegistry(converters: readonly ModelExtractionConverter[]): ReadonlyMap<string, ModelExtractionConverter> {
  const registry = new Map<string, ModelExtractionConverter>();

  for (const converter of converters) {
    if (converter.converterConst !== undefined) {
      registry.set(converter.converterConst, converter);
    }
  }

  return registry;
}

function selectConverterTree(converters: readonly ModelExtractionConverter[], exportName: string | undefined, sourceFile: string): ModelExtractionConverter {
  const named = converters.filter((converter) => converter.converterConst !== undefined);
  let result: ModelExtractionConverter | undefined;

  if (exportName !== undefined) {
    result = named.find((converter) => converter.converterConst === exportName);

    if (!result) {
      throw new ModelSizeResolveError(`No exported converter named '${exportName}' found in ${sourceFile}. Available: ${named.map((c) => c.converterConst).join(', ') || '(none)'}.`);
    }
  } else if (named.length === 1) {
    result = named[0];
  } else if (named.length === 0) {
    throw new ModelSizeResolveError(`No exported snapshot converter found in ${sourceFile}.`);
  } else {
    throw new ModelSizeResolveError(`${sourceFile} exports multiple converters (${named.map((c) => c.converterConst).join(', ')}). Set 'export' in the profile to choose one.`);
  }

  return result;
}

/**
 * Resolves and imports the converter targeted by a profile.
 *
 * Reads the source file text and extracts its converter tree (for generation),
 * picks the target converter (by `export`, or the sole converter), builds the
 * cross-reference registry, and dynamically imports the live converter for
 * measurement.
 *
 * @param input - The profile and (optional) profile-file path.
 * @returns The resolved converter bundle.
 * @throws {ModelSizeResolveError} When the source/export cannot be resolved or
 *   the imported export is not a converter.
 *
 * @example
 * ```ts
 * const resolved = await resolveConverter({ profile, profilePath });
 * ```
 */
export async function resolveConverter(input: ResolveConverterInput): Promise<ResolvedConverter> {
  const { profile, profilePath } = input;
  const sourceFile = resolveSourcePath(profile.source, profilePath);
  const text = readFileSync(sourceFile, 'utf8');
  const extraction = extractModelsFromSource({ name: sourceFile, text });
  const converterTree = selectConverterTree(extraction.converters, profile.export, sourceFile);
  const exportName = converterTree.converterConst as string;
  const registry = buildConverterRegistry(extraction.converters);

  const moduleExports = (await import(pathToFileURL(sourceFile).href)) as Record<string, unknown>;
  const candidate = moduleExports[exportName];

  if (candidate === null || typeof candidate !== 'object' || typeof (candidate as { to?: unknown }).to !== 'function') {
    throw new ModelSizeResolveError(`Export '${exportName}' from ${sourceFile} is not a snapshot converter (missing a 'to' function).`);
  }

  return { sourceFile, exportName, converterTree, registry, converter: candidate as SnapshotToConverter };
}
