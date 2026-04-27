/**
 * Forge-fields runtime registry wrapper.
 *
 * Wraps the raw {@link LoadForgeFieldManifestsResult} produced by the loader
 * with domain-friendly accessors so the lookup / search tools and the
 * registry resource don't have to walk Maps directly.
 *
 * The registry is loaded once at server startup and passed into the tool
 * factories. Tests can construct a registry from any manifest entry array
 * via {@link createForgeFieldRegistryFromEntries} to drive the tools without
 * touching disk.
 *
 * Manifest entries (flat, JSON-friendly shape) are converted into the
 * discriminated `FormFieldInfo` union exposed by `registry/index.ts`. The
 * tools and resources continue to consume that legacy shape so this module
 * is the only seam that changed when the hand-written entries were deleted.
 */

import type { LoadForgeFieldManifestsResult } from '../manifest/forge-fields-loader.js';
import type { ForgeFieldEntry, ForgeFieldPropertyEntry } from '../manifest/forge-fields-schema.js';
import type { FormCompositeBuilderInfo, FormFieldDerivativeInfo, FormFieldFactoryInfo, FormFieldInfo, FormFieldTemplateInfo, FormPrimitiveInfo, FormTier, FormArrayOutput } from './form-fields.js';
import type { PropertyInfo } from './index.js';

// MARK: Public types
/**
 * Domain-friendly read API over a merged forge-fields manifest set. All
 * accessors return readonly arrays preserving the order the manifests
 * declared their entries (manifests are walked in source order).
 */
export interface ForgeFieldRegistry {
  readonly all: readonly FormFieldInfo[];
  readonly loadedSources: readonly string[];
  readonly tiers: readonly FormTier[];
  readonly producesCatalog: readonly string[];
  /**
   * Returns the entry whose slug matches `slug` exactly. Slugs are unique
   * across manifests (collisions emit a loader warning and the second-loaded
   * entry wins).
   */
  findBySlug(slug: string): FormFieldInfo | undefined;
  /**
   * Returns the entry whose factory name matches `factoryName`
   * (case-insensitive).
   */
  findByFactoryName(factoryName: string): FormFieldInfo | undefined;
  /**
   * Returns every entry whose `produces` field matches `value` exactly.
   */
  findByProduces(value: string): readonly FormFieldInfo[];
  /**
   * Returns every entry whose `tier` field matches `tier` exactly.
   */
  findByTier(tier: FormTier): readonly FormFieldInfo[];
  /**
   * Returns every entry whose `arrayOutput` field matches `arrayOutput`
   * exactly.
   */
  findByArrayOutput(arrayOutput: FormArrayOutput): readonly FormFieldInfo[];
}

// MARK: Construction
/**
 * Builds a {@link ForgeFieldRegistry} from a loader result.
 *
 * @param loaded - the merged registry returned by `loadForgeFieldManifests`
 * @returns a domain-friendly read API over the merged entries
 */
export function createForgeFieldRegistry(loaded: LoadForgeFieldManifestsResult): ForgeFieldRegistry {
  const entries = Array.from(loaded.entries.values()).map(toFormFieldInfo);
  return createForgeFieldRegistryFromEntries({ entries, loadedSources: loaded.loadedSources });
}

/**
 * Builds a {@link ForgeFieldRegistry} from a raw {@link FormFieldInfo} array.
 * Used by tests that need to drive the tools without going through the loader
 * pipeline, and by snapshot tests comparing the merged registry against the
 * legacy hand-written `FORM_FIELDS` constant.
 *
 * @param input - the entries plus the source labels to advertise
 * @param input.entries - the full entry list
 * @param input.loadedSources - source labels reported via `registry.loadedSources`
 * @returns a domain-friendly read API over the supplied entries
 */
export function createForgeFieldRegistryFromEntries(input: { readonly entries: readonly FormFieldInfo[]; readonly loadedSources: readonly string[] }): ForgeFieldRegistry {
  const all = [...input.entries];

  const bySlug = new Map<string, FormFieldInfo>();
  const byFactoryName = new Map<string, FormFieldInfo>();
  const byTier = new Map<FormTier, FormFieldInfo[]>();
  const byArrayOutput = new Map<FormArrayOutput, FormFieldInfo[]>();
  const byProduces = new Map<string, FormFieldInfo[]>();
  const tierSet = new Set<FormTier>();
  const producesSet = new Set<string>();

  for (const entry of all) {
    if (!bySlug.has(entry.slug)) {
      bySlug.set(entry.slug, entry);
    }
    const factoryKey = entry.factoryName.toLowerCase();
    if (!byFactoryName.has(factoryKey)) {
      byFactoryName.set(factoryKey, entry);
    }
    pushInto(byTier, entry.tier, entry);
    pushInto(byArrayOutput, entry.arrayOutput, entry);
    pushInto(byProduces, entry.produces, entry);
    tierSet.add(entry.tier);
    producesSet.add(entry.produces);
  }

  const tiers = Array.from(tierSet);
  const producesCatalog = Array.from(producesSet).sort((a, b) => a.localeCompare(b));

  const registry: ForgeFieldRegistry = {
    all,
    loadedSources: [...input.loadedSources],
    tiers,
    producesCatalog,
    findBySlug(slug) {
      return bySlug.get(slug);
    },
    findByFactoryName(factoryName) {
      return byFactoryName.get(factoryName.toLowerCase());
    },
    findByProduces(value) {
      return byProduces.get(value) ?? [];
    },
    findByTier(tier) {
      return byTier.get(tier) ?? [];
    },
    findByArrayOutput(arrayOutput) {
      return byArrayOutput.get(arrayOutput) ?? [];
    }
  };
  return registry;
}

/**
 * Empty registry suitable as a default when the server has no forge-fields
 * manifest sources to load. Tools wired against this registry behave like a
 * registry that loaded successfully with zero entries.
 */
export const EMPTY_FORGE_FIELD_REGISTRY: ForgeFieldRegistry = createForgeFieldRegistryFromEntries({ entries: [], loadedSources: [] });

// MARK: Manifest → runtime conversion
/**
 * Converts a manifest entry into the discriminated {@link FormFieldInfo}
 * union the existing tools consume. The properties array is rolled back into
 * the `Record<string, PropertyInfo>` shape callers expect on `config`.
 *
 * Tier-specific fields are read off the manifest entry; the schema is
 * permissive (all tier-specific fields are optional) so this function asserts
 * the right combination is present per tier and falls back to safe defaults
 * when a generator emits a partially-populated entry.
 *
 * @param entry - the manifest entry to convert
 * @returns the matching FormFieldInfo
 */
export function toFormFieldInfo(entry: ForgeFieldEntry): FormFieldInfo {
  const config = toConfigRecord(entry.properties);
  let result: FormFieldInfo;
  switch (entry.tier) {
    case 'field-factory': {
      const factory: FormFieldFactoryInfo = {
        slug: entry.slug,
        factoryName: entry.factoryName,
        tier: 'field-factory',
        wrapperPattern: entry.wrapperPattern ?? 'unwrapped',
        ngFormType: entry.ngFormType ?? '',
        produces: entry.produces,
        arrayOutput: entry.arrayOutput,
        configInterface: entry.configInterface ?? '',
        ...(entry.generic === undefined ? {} : { generic: entry.generic }),
        description: entry.description,
        sourcePath: entry.sourcePath,
        config,
        example: entry.example,
        minimalExample: entry.example
      };
      result = factory;
      break;
    }
    case 'field-derivative': {
      const derivative: FormFieldDerivativeInfo = {
        slug: entry.slug,
        factoryName: entry.factoryName,
        tier: 'field-derivative',
        produces: entry.produces,
        arrayOutput: entry.arrayOutput,
        configInterface: entry.configInterface ?? '',
        ...(entry.generic === undefined ? {} : { generic: entry.generic }),
        derivedFromSlug: entry.composesFromSlugs?.[0] ?? '',
        description: entry.description,
        sourcePath: entry.sourcePath,
        config,
        example: entry.example,
        minimalExample: entry.example
      };
      result = derivative;
      break;
    }
    case 'composite-builder': {
      const composite: FormCompositeBuilderInfo = {
        slug: entry.slug,
        factoryName: entry.factoryName,
        tier: 'composite-builder',
        suffix: entry.suffix ?? 'Field',
        produces: entry.produces,
        arrayOutput: entry.arrayOutput,
        configInterface: entry.configInterface ?? '',
        composesFromSlugs: entry.composesFromSlugs ?? [],
        description: entry.description,
        sourcePath: entry.sourcePath,
        config,
        example: entry.example,
        minimalExample: entry.example
      };
      result = composite;
      break;
    }
    case 'template-builder': {
      const template: FormFieldTemplateInfo = {
        slug: entry.slug,
        factoryName: entry.factoryName,
        tier: 'template-builder',
        produces: entry.produces,
        arrayOutput: entry.arrayOutput,
        configInterface: entry.configInterface ?? '',
        returnsSlugs: entry.composesFromSlugs ?? [],
        description: entry.description,
        sourcePath: entry.sourcePath,
        config,
        example: entry.example,
        minimalExample: entry.example
      };
      result = template;
      break;
    }
    case 'primitive': {
      const primitive: FormPrimitiveInfo = {
        slug: entry.slug,
        factoryName: entry.factoryName,
        tier: 'primitive',
        produces: entry.produces,
        arrayOutput: entry.arrayOutput,
        returns: entry.returns ?? entry.produces,
        ...(entry.configInterface === undefined ? {} : { configInterface: entry.configInterface }),
        description: entry.description,
        sourcePath: entry.sourcePath,
        config,
        example: entry.example,
        minimalExample: entry.example
      };
      result = primitive;
      break;
    }
  }
  return result;
}

// MARK: Internals
function pushInto<K>(map: Map<K, FormFieldInfo[]>, key: K, entry: FormFieldInfo): void {
  const existing = map.get(key);
  if (existing === undefined) {
    map.set(key, [entry]);
  } else {
    existing.push(entry);
  }
}

function toConfigRecord(properties: readonly ForgeFieldPropertyEntry[]): Record<string, PropertyInfo> {
  const out: Record<string, PropertyInfo> = {};
  for (const property of properties) {
    out[property.name] = {
      name: property.name,
      type: property.type,
      description: property.description,
      required: property.required,
      ...(property.default === undefined ? {} : { default: property.default })
    };
  }
  return out;
}
