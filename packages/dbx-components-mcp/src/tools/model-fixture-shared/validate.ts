/**
 * Pure validator for the `dbx_model_fixture_*` cluster.
 *
 * Consumes an {@link AppFixturesExtraction} and an optional model registry,
 * runs every diagnostic rule, and returns the aggregated
 * {@link FixtureValidationResult}. The MCP tool wrapper threads disk I/O,
 * argument parsing, and formatting around this core.
 *
 * Rules are intentionally separate so the validate tool emits a flat
 * diagnostic list with stable codes consumers can grep.
 */

import type { AppFixturesExtraction, FixtureDiagnostic, FixtureEntry, FixtureMethod, FixtureModelRegistry, FixtureValidationResult } from './types.js';

/**
 * Runs every fixture-cluster diagnostic against the supplied extraction.
 *
 * The model registry is optional — when omitted, the parent-field-naming
 * and registry cross-reference rules are skipped (so HelloSubs-style
 * downstream apps with their own model catalogs don't surface false
 * positives just because the dbx-components-mcp registry doesn't know
 * about their models).
 *
 * @param extraction - the parsed fixture file
 * @param options - optional registry hookup
 * @param options.registry - the optional fixture-model registry consulted by
 *   the parent-field-naming and cross-reference rules
 * @returns the aggregated validation result
 */
export function validateAppFixtures(extraction: AppFixturesExtraction, options: { readonly registry?: FixtureModelRegistry } = {}): FixtureValidationResult {
  const diagnostics: FixtureDiagnostic[] = [];
  for (const entry of extraction.entries) {
    pushTripletCompletenessDiagnostics(entry, diagnostics);
    pushForwardingDiagnostics(entry, diagnostics);
    pushGenericAlignmentDiagnostics(entry, diagnostics);
    pushArchetypeConsistencyDiagnostics(entry, diagnostics);
    pushParentFieldNamingDiagnostics(entry, options.registry, diagnostics);
    pushRegistryDiagnostics(entry, options.registry, diagnostics);
  }
  pushOrphanFixtureDiagnostics(extraction, diagnostics);
  pushModelsWithoutFixtureDiagnostics(extraction, options.registry, diagnostics);

  let errorCount = 0;
  let warningCount = 0;
  for (const d of diagnostics) {
    if (d.severity === 'error') errorCount += 1;
    else warningCount += 1;
  }
  return {
    fixturePath: extraction.fixturePath,
    diagnostics,
    errorCount,
    warningCount
  };
}

// MARK: triplet completeness
function pushTripletCompletenessDiagnostics(entry: FixtureEntry, out: FixtureDiagnostic[]): void {
  if (!entry.factoryName) {
    out.push({
      code: 'triplet-incomplete',
      severity: 'error',
      model: entry.model,
      message: `Model \`${entry.model}\` has Fixture/Instance classes but no \`modelTestContextFactory\` registration.`,
      line: entry.fixtureLine
    });
  }
  if (entry.factoryName && !entry.singletonName) {
    out.push({
      code: 'triplet-incomplete',
      severity: 'warning',
      model: entry.model,
      message: `Factory \`${entry.factoryName}\` has no exported singleton (e.g. \`export const ${decapitalize(entry.prefix)}${entry.model}Context = ${entry.factoryName}();\`).`,
      line: entry.factory?.line
    });
  }
  if (!entry.params) {
    out.push({
      code: 'triplet-incomplete',
      severity: 'warning',
      model: entry.model,
      message: `Model \`${entry.model}\` has no \`${entry.prefix}${entry.model}TestContextParams\` interface or alias.`,
      line: entry.fixtureLine
    });
  }
}

// MARK: forwarding
function pushForwardingDiagnostics(entry: FixtureEntry, out: FixtureDiagnostic[]): void {
  const fixtureByName = new Map(entry.fixtureMethods.map((m) => [m.name, m]));
  for (const instanceMethod of entry.instanceMethods) {
    if (instanceMethod.visibility !== 'public') continue;
    const fixtureMethod = fixtureByName.get(instanceMethod.name);
    if (!fixtureMethod) {
      out.push({
        code: 'forwarder-missing',
        severity: 'warning',
        model: entry.model,
        message: `Fixture \`${entry.fixtureClassName}\` is missing a forwarder for instance method \`${instanceMethod.name}\`.`,
        line: instanceMethod.line
      });
      continue;
    }
    if (!signaturesMatch(fixtureMethod, instanceMethod)) {
      out.push({
        code: 'forwarder-divergent',
        severity: 'warning',
        model: entry.model,
        message: `Fixture forwarder \`${fixtureMethod.name}\` signature differs from the instance method.`,
        line: fixtureMethod.line
      });
    }
  }
}

// MARK: generics
function pushGenericAlignmentDiagnostics(entry: FixtureEntry, out: FixtureDiagnostic[]): void {
  const fixGenerics = entry.fixtureExtendsGenerics;
  const instGenerics = entry.instanceExtendsGenerics;
  const factoryGenerics = entry.factory?.genericArgs ?? [];
  const fixModel = fixGenerics[0];
  const fixDoc = fixGenerics[1];
  const instModel = instGenerics[0];
  const instDoc = instGenerics[1];
  const factoryModel = factoryGenerics[0];
  const factoryDoc = factoryGenerics[1];
  if (fixModel !== undefined && instModel !== undefined && fixModel !== instModel) {
    out.push({
      code: 'generics-misaligned',
      severity: 'error',
      model: entry.model,
      message: `Model generic differs between Fixture (\`${fixModel}\`) and Instance (\`${instModel}\`).`,
      line: entry.fixtureLine
    });
  }
  if (fixDoc !== undefined && instDoc !== undefined && fixDoc !== instDoc) {
    out.push({
      code: 'generics-misaligned',
      severity: 'error',
      model: entry.model,
      message: `Document generic differs between Fixture (\`${fixDoc}\`) and Instance (\`${instDoc}\`).`,
      line: entry.fixtureLine
    });
  }
  if (factoryModel !== undefined && fixModel !== undefined && factoryModel !== fixModel) {
    out.push({
      code: 'generics-misaligned',
      severity: 'error',
      model: entry.model,
      message: `Model generic differs between factory (\`${factoryModel}\`) and Fixture (\`${fixModel}\`).`,
      line: entry.factory?.line
    });
  }
  if (factoryDoc !== undefined && fixDoc !== undefined && factoryDoc !== fixDoc) {
    out.push({
      code: 'generics-misaligned',
      severity: 'error',
      model: entry.model,
      message: `Document generic differs between factory (\`${factoryDoc}\`) and Fixture (\`${fixDoc}\`).`,
      line: entry.factory?.line
    });
  }
}

// MARK: archetype consistency
function pushArchetypeConsistencyDiagnostics(entry: FixtureEntry, out: FixtureDiagnostic[]): void {
  if (!entry.factory) return;
  const archetype = entry.archetype;
  if (archetype === 'sub-collection' || archetype === 'sub-collection-traversal') {
    const accessedField = entry.factory.parentFixtureFieldFromGetCollection;
    if (accessedField !== undefined) {
      const present = entry.params?.fields.some((f) => f.name === accessedField && f.fixtureModel !== undefined);
      if (!present) {
        out.push({
          code: 'archetype-inconsistent',
          severity: 'error',
          model: entry.model,
          message: `\`getCollection\` reads \`params.${accessedField}\` but the Params interface has no fixture-typed \`${accessedField}\` field.`,
          line: entry.factory.line
        });
      }
    }
  }
}

// MARK: parent field naming
function pushParentFieldNamingDiagnostics(entry: FixtureEntry, registry: FixtureModelRegistry | undefined, out: FixtureDiagnostic[]): void {
  if (!registry) return;
  if (!entry.params) return;
  for (const field of entry.params.fields) {
    if (field.fixtureModel === undefined) continue;
    const expected = lookupCollectionPrefix(registry, field.fixtureModel);
    if (expected === undefined) continue;
    if (field.name !== expected) {
      out.push({
        code: 'params-field-naming',
        severity: 'warning',
        model: entry.model,
        message: `Params field \`${field.name}: ${field.typeText}\` should be named \`${expected}\` to match \`${field.fixtureModel}\`'s firestoreModelIdentity short alias.`,
        line: entry.params.line
      });
    }
  }
}

// MARK: registry cross-reference
function pushRegistryDiagnostics(entry: FixtureEntry, registry: FixtureModelRegistry | undefined, out: FixtureDiagnostic[]): void {
  if (!registry) return;
  const known = registry.entries.find((m) => m.name === entry.model);
  if (!known) {
    out.push({
      code: 'model-not-in-registry',
      severity: 'warning',
      model: entry.model,
      message: `Model \`${entry.model}\` has a fixture but isn't in the supplied model registry.`,
      line: entry.fixtureLine
    });
  }
}

// MARK: orphans
function pushOrphanFixtureDiagnostics(extraction: AppFixturesExtraction, out: FixtureDiagnostic[]): void {
  for (const name of extraction.unrecognizedClassNames) {
    out.push({
      code: 'triplet-incomplete',
      severity: 'warning',
      message: `Class \`${name}\` ends in TestContextFixture/Instance but doesn't fit the \`<Prefix><Model><Suffix>\` convention.`
    });
  }
}

// MARK: registry has model but fixture file doesn't
function pushModelsWithoutFixtureDiagnostics(extraction: AppFixturesExtraction, registry: FixtureModelRegistry | undefined, out: FixtureDiagnostic[]): void {
  if (!registry) return;
  const have = new Set(extraction.entries.map((e) => e.model));
  for (const m of registry.entries) {
    if (have.has(m.name)) continue;
    out.push({
      code: 'model-without-fixture',
      severity: 'warning',
      model: m.name,
      message: `Model \`${m.name}\` is in the registry but \`${extraction.fixturePath}\` doesn't declare a fixture for it.`
    });
  }
}

// MARK: helpers
function signaturesMatch(a: FixtureMethod, b: FixtureMethod): boolean {
  if (a.parameterText.replace(/\s+/g, '') !== b.parameterText.replace(/\s+/g, '')) return false;
  if (a.isAsync !== b.isAsync) return false;
  return true;
}

function decapitalize(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function lookupCollectionPrefix(registry: FixtureModelRegistry, modelName: string): string | undefined {
  const entry = registry.entries.find((m) => m.name === modelName);
  return entry?.collectionPrefix;
}
