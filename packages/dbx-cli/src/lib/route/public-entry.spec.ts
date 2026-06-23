import { describe, expect, it } from 'vitest';
import { buildRouteManifest, parseRouteModelTag, ROUTE_MANIFEST_VERSION, type ParsedRouteModel, type RouteManifest, type RouteManifestWarning } from '../../index.js';

/**
 * Guards that the route-manifest builder, the tag parser, and the diagnostic /
 * model types are reachable from the PUBLIC `@dereekb/dbx-cli` package barrel —
 * the surface a downstream app imports to unit-test its `@dbxRouteModel*` tags
 * without spawning the CLI. The root entry is `type: module` (ESM), so these
 * named imports are statically analyzable and work under a downstream vitest.
 */
describe('@dereekb/dbx-cli public route entry', () => {
  it('re-exports the builder, the parser, and the version from the package barrel', () => {
    expect(typeof buildRouteManifest).toBe('function');
    expect(typeof parseRouteModelTag).toBe('function');
    expect(ROUTE_MANIFEST_VERSION).toBe(2);
  });

  it('round-trips a tag + an empty manifest, exercising the diagnostic / model types', () => {
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
