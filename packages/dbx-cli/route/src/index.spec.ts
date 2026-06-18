import { describe, expect, it } from 'vitest';
import { buildRouteManifest, parseRouteModelTag, ROUTE_MANIFEST_VERSION, type ParsedRouteModel, type RouteManifest, type RouteManifestWarning } from '@dereekb/dbx-cli/route';

/**
 * Guards the focused `@dereekb/dbx-cli/route` namespace — the lighter surface a
 * downstream imports to unit-test its `@dbxRouteModel*` tags without the full CLI
 * barrel. Mirrors the root `public-entry.spec.ts` round-trip, but resolves through
 * the new subpath.
 */
describe('@dereekb/dbx-cli/route focused entry', () => {
  it('re-exports the builder, the parser, and the version', () => {
    expect(typeof buildRouteManifest).toBe('function');
    expect(typeof parseRouteModelTag).toBe('function');
    expect(ROUTE_MANIFEST_VERSION).toBe(2);
  });

  it('round-trips a tag + an empty manifest', () => {
    const parsed = parseRouteModelTag({ name: 'dbxRouteModel', text: 'profile :uid' });
    expect(parsed.ok).toBe(true);
    const model: ParsedRouteModel | undefined = parsed.ok ? parsed.model : undefined;
    expect(model?.kind).toBe('id');

    const { manifest, warnings }: { manifest: RouteManifest; warnings: readonly RouteManifestWarning[] } = buildRouteManifest({ app: { name: 'demo' }, sources: [] }, new Date('2026-01-01T00:00:00.000Z'));
    expect(manifest.version).toBe(ROUTE_MANIFEST_VERSION);
    expect(manifest.states).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
