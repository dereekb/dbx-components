/**
 * The call context — spans / marks / gaps captured against an injected clock, recursive child contexts that nest in
 * the parent profile and bubble events to the root tap, the DETACHED "link, don't parent" root for causally-related
 * but not temporally-contained work, the attribution merge, the host callbacks for gaps / breadcrumbs / swallows, and
 * the timing-off and no-op paths.
 */

import { describe, it, expect, vi } from 'vitest';
import { makeLlmCallContext, noopLlmCallContext, type LlmCallContext, type LlmCallContextConfig, type LlmCallContextEvent, type LlmCallDiagRecord } from './llm.call.context';

/**
 * The spec host's attribution.
 */
interface TestAttribution {
  readonly source: string;
  readonly capability?: string;
  readonly sessionId?: string;
  readonly requestId?: string;
  readonly region?: string;
}

/**
 * The spec host's gap body.
 */
interface TestGapBody {
  readonly kind: 'missing';
  readonly requested: string;
}

/**
 * The spec host's breadcrumb record — one host column beside the library's.
 */
type TestDiagRecord = LlmCallDiagRecord & { readonly region?: string };

type TestGap = TestAttribution & TestGapBody;
type TestEvent = LlmCallContextEvent<TestAttribution, TestGapBody>;

/**
 * Build a gap body naming a missing thing.
 *
 * @param requested - What was asked for.
 * @returns The gap body.
 */
function missing(requested: string): TestGapBody {
  return { kind: 'missing', requested };
}

/**
 * Keep the join ids on a link, as a host would.
 *
 * @param attribution - The context's attribution.
 * @returns The ids a link carries.
 */
function linkIds(attribution: TestAttribution): Partial<TestAttribution> {
  return { ...(attribution.sessionId == null ? {} : { sessionId: attribution.sessionId }), ...(attribution.requestId == null ? {} : { requestId: attribution.requestId }) };
}

/**
 * A monotonic fake clock — each read advances by `step` ms (default 1), so span durations are the count of `now()`
 * reads between begin and end.
 *
 * @param step - The per-read increment.
 * @returns The `now` reader.
 */
function fakeClock(step = 1): () => number {
  let t = 0;
  return () => {
    const at = t;
    t += step;
    return at;
  };
}

/**
 * Build a timing-on test context.
 *
 * @param config - The extra config.
 * @returns The context.
 */
function testContext(config: Partial<LlmCallContextConfig<TestAttribution, TestGapBody, TestDiagRecord>> = {}): LlmCallContext<TestAttribution, TestGapBody, TestDiagRecord> {
  return makeLlmCallContext<TestAttribution, TestGapBody, TestDiagRecord>({ label: 'request', now: fakeClock(), ...config });
}

describe('makeLlmCallContext', () => {
  it('records spans, marks, and gaps with root-relative offsets', () => {
    const ctx = testContext({ attribution: { source: 'auto' } });
    ctx.mark('start');
    ctx.time('render', () => 42);
    ctx.gap(missing('RAIN'));

    const profile = ctx.profile();
    expect(profile.label).toBe('request');
    expect(profile.startedAt).toBe(0);
    expect(profile.marks).toEqual([{ name: 'start', atMs: 1 }]);
    expect(profile.spans).toHaveLength(1);
    expect(profile.spans[0].name).toBe('render');
    expect(profile.spans[0].durationMs).toBeGreaterThan(0);
    expect(profile.gaps).toHaveLength(1);
    expect(profile.gaps[0].kind).toBe('missing');
  });

  it('time returns the run value and records the span even on throw', () => {
    const ctx = testContext();
    expect(ctx.time('ok', () => 'value')).toBe('value');
    expect(() =>
      ctx.time('boom', () => {
        throw new Error('nope');
      })
    ).toThrow('nope');

    const spans = ctx.profile().spans;
    expect(spans.map((span) => span.name)).toEqual(['ok', 'boom']);
  });

  it('timeAsync closes the span on both resolve and reject', async () => {
    const ctx = testContext();
    await expect(ctx.timeAsync('good', async () => 7)).resolves.toBe(7);
    await expect(
      ctx.timeAsync('bad', async () => {
        throw new Error('rejected');
      })
    ).rejects.toThrow('rejected');

    expect(ctx.profile().spans.map((span) => span.name)).toEqual(['good', 'bad']);
  });

  it('fires the root onEvent tap in occurrence order, path-prefixed', () => {
    const events: TestEvent[] = [];
    const ctx = testContext({ attribution: { source: 'auto' }, onEvent: (event) => events.push(event) });
    ctx.mark('m');
    const build = ctx.child('build');
    build.time('complete', () => undefined);
    ctx.gap(missing('FOG'));

    expect(events.map((event) => [event.kind, event.path.join('/')])).toEqual([
      ['mark', 'request'],
      ['span', 'request/build'],
      ['gap', 'request']
    ]);
  });

  it('nests child profiles under the parent children, root-relative', () => {
    const ctx = testContext();
    ctx.time('spawn', () => undefined);
    const build = ctx.child('build');
    build.time('summarize', () => undefined);

    const profile = ctx.profile();
    expect(profile.children).toHaveLength(1);
    expect(profile.children[0].label).toBe('build');
    expect(profile.children[0].startedAt).toBeGreaterThan(0);
    expect(profile.children[0].spans.map((span) => span.name)).toEqual(['summarize']);
  });

  it('forwards a child gap to the root onGap with merged attribution', () => {
    const gaps: TestGap[] = [];
    const ctx = testContext({ attribution: { source: 'auto', capability: 'summarize' }, onGap: (gap) => gaps.push(gap) });
    const build = ctx.child('build', { attribution: { capability: 'classify', region: 'eu' } });
    build.gap(missing('RAIN'));

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ kind: 'missing', requested: 'RAIN', capability: 'classify', region: 'eu' });
  });

  it('beginSpan is idempotent; a second close is a no-op', () => {
    const ctx = testContext();
    const close = ctx.beginSpan('manual');
    close();
    close();
    expect(ctx.profile().spans).toHaveLength(1);
  });
});

describe('LlmCallContext.detached', () => {
  it('starts a NEW root: its own startedAt 0 and span offsets from ITS start, not the origin’s elapsed time', () => {
    const root = testContext();
    // Burn clock ticks on the origin so a `child()` here would report a large offset.
    root.time('a', () => undefined);
    root.time('b', () => undefined);
    root.time('c', () => undefined);
    const nested = root.child('inline');
    const detached = root.detached('bg');

    // The nested child re-bases on the request root, so it starts well after 0…
    expect(nested.profile().startedAt).toBeGreaterThan(0);
    // …while the detached root anchors its OWN timeline.
    expect(detached.profile().startedAt).toBe(0);

    detached.time('author', () => undefined);
    const span = detached.profile().spans[0];
    expect(span.name).toBe('author');
    // The span offset is relative to the DETACHED start (a couple of clock reads), never the origin's elapsed.
    expect(span.startMs).toBeLessThan(nested.profile().startedAt);
  });

  it('is NOT nested under children: it lands in the sibling detachedProfiles bucket', () => {
    const root = testContext();
    root.child('build');
    root.detached('bg');

    const profile = root.profile();
    expect(profile.children.map((child) => child.label)).toEqual(['build']);
    expect(profile.detachedProfiles?.map((detached) => detached.label)).toEqual(['bg']);
  });

  it('records a LINK naming the origin’s path + the ids linkAttributionOf keeps (never a parent edge)', () => {
    const root = testContext({ attribution: { source: 'auto', sessionId: 't1' }, linkAttributionOf: linkIds });
    const run = root.child('run');

    expect(run.detached('bg').profile().links).toEqual([{ path: ['request', 'run'], sessionId: 't1' }]);
  });

  it('lets an explicit linkTo REPLACE the implicit self-link (the cross-context origin)', () => {
    const root = testContext({ attribution: { source: 'auto', sessionId: 't1' }, linkAttributionOf: linkIds });
    const a = root.child('a', { attribution: { requestId: 'c1' } });
    const b = root.child('b', { attribution: { requestId: 'c2' } });

    expect(a.detached('bg', { linkTo: b.link() }).profile().links).toEqual([{ path: ['request', 'b'], sessionId: 't1', requestId: 'c2' }]);
    // An array of origins is accepted verbatim (fan-in causality).
    expect(a.detached('bg2', { linkTo: [a.link(), b.link()] }).profile().links).toHaveLength(2);
  });

  it('inherits the origin attribution, and an override adds its own without disturbing the origin', () => {
    const root = testContext({ attribution: { source: 'auto', sessionId: 't1' } });
    const detached = root.detached('bg');
    expect(detached.attribution).toEqual({ source: 'auto', sessionId: 't1' });

    const stamped = root.detached('bg2', { attribution: { requestId: 'c9' } });
    expect(stamped.attribution).toEqual({ source: 'auto', sessionId: 't1', requestId: 'c9' });
    expect(root.attribution).toEqual({ source: 'auto', sessionId: 't1' });
  });

  it('still forwards gaps to the ROOT sink with merged attribution, on the timing-on and the timing-off arm alike', () => {
    const onGap = vi.fn();
    const root = testContext({ attribution: { source: 'auto', sessionId: 't1' }, onGap });
    root.detached('bg', { attribution: { capability: 'summarize', region: 'eu' } }).gap(missing('RAIN'));

    expect(onGap).toHaveBeenCalledTimes(1);
    expect(onGap.mock.calls[0][0]).toMatchObject({ requested: 'RAIN', sessionId: 't1', capability: 'summarize', region: 'eu' });

    // Gap forwarding is NOT timing-gated: a timing-off origin yields a timing-off detached root that still forwards.
    const gapOnlyOnGap = vi.fn();
    const gapOnly = makeLlmCallContext<TestAttribution, TestGapBody>({ label: 'summarize', timing: false, attribution: { source: 'auto', sessionId: 't2' }, onGap: gapOnlyOnGap });
    const gapOnlyDetached = gapOnly.detached('bg');
    expect(gapOnlyDetached.enabled).toBe(false);
    gapOnlyDetached.gap(missing('FOG'));
    expect(gapOnlyOnGap).toHaveBeenCalledTimes(1);
    expect(gapOnlyOnGap.mock.calls[0][0]).toMatchObject({ requested: 'FOG', sessionId: 't2' });
  });

  it('fires a `detached` arm on the live tap at creation, then paths subsequent events from the detached root', () => {
    const events: TestEvent[] = [];
    const root = testContext({ onEvent: (event) => events.push(event) });
    const detached = root.detached('bg/index-docs');
    detached.child('classify').time('complete', () => undefined);

    expect(events.map((event) => [event.kind, event.path.join('|')])).toEqual([
      ['detached', 'bg/index-docs'],
      ['span', 'bg/index-docs|classify']
    ]);
  });

  it('omits BOTH new profile keys when nothing was linked or detached (byte-stable absence)', () => {
    const profile = testContext().profile();
    expect('links' in profile).toBe(false);
    expect('detachedProfiles' in profile).toBe(false);
    expect('links' in noopLlmCallContext().profile()).toBe(false);
    expect('detachedProfiles' in noopLlmCallContext().profile()).toBe(false);
  });

  it('a link carries only its path when no linkAttributionOf is configured', () => {
    const root = testContext({ attribution: { source: 'auto', sessionId: 't1', requestId: 'c1' } });

    expect(root.link()).toEqual({ path: ['request'] });
    expect(root.child('run').detached('bg').profile().links).toEqual([{ path: ['request', 'run'] }]);
  });
});

describe('noopLlmCallContext', () => {
  it('is disabled, runs work, records nothing, and forwards no gap', () => {
    const ctx = noopLlmCallContext<TestAttribution, TestGapBody>();
    expect(ctx.enabled).toBe(false);
    expect(ctx.time('x', () => 3)).toBe(3);
    ctx.mark('m');
    ctx.gap(missing('RAIN'));
    const child = ctx.child('build');
    expect(child).toBe(ctx);
    expect(ctx.profile().spans).toEqual([]);
    expect(ctx.profile().gaps).toEqual([]);
  });

  it('detaches to ITSELF and links to its own `(noop)` path', () => {
    const ctx = noopLlmCallContext();
    expect(ctx.detached('bg')).toBe(ctx);
    expect(ctx.link()).toEqual({ path: ['(noop)'] });
  });

  it('returns the SAME instance on every call, whatever type parameters it is asked for', () => {
    expect(noopLlmCallContext()).toBe(noopLlmCallContext<TestAttribution, TestGapBody, TestDiagRecord>());
  });
});

describe('LlmCallContext attribution', () => {
  it('exposes the root attribution and inherits it into a child that adds its own', () => {
    const root = testContext({ attribution: { source: 'auto', sessionId: 't1' } });
    expect(root.attribution).toEqual({ source: 'auto', sessionId: 't1' });

    const dispatch = root.child('summarize', { attribution: { requestId: 'c1' } });
    expect(dispatch.attribution).toEqual({ source: 'auto', sessionId: 't1', requestId: 'c1' });
    // The dispatch's own children (the per-attempt contexts) inherit BOTH.
    expect(dispatch.child('attempt-1').attribution).toEqual({ source: 'auto', sessionId: 't1', requestId: 'c1' });
  });

  it('stamps the attribution onto every gap the context records', () => {
    const onGap = vi.fn();
    const root = testContext({ attribution: { source: 'auto', sessionId: 't1' }, onGap });
    const dispatch = root.child('summarize', { attribution: { requestId: 'c1' } });
    dispatch.gap(missing('RAIN'));

    expect(onGap).toHaveBeenCalledTimes(1);
    expect(onGap.mock.calls[0][0]).toMatchObject({ requested: 'RAIN', sessionId: 't1', requestId: 'c1' });
    expect(dispatch.profile().gaps[0]).toMatchObject({ sessionId: 't1', requestId: 'c1' });
  });

  it('keeps two sibling dispatches separable (their overrides never leak)', () => {
    const root = testContext({ attribution: { source: 'auto', sessionId: 't1' } });
    const a = root.child('summarize', { attribution: { requestId: 'c1' } });
    const b = root.child('classify', { attribution: { requestId: 'c2' } });

    expect(a.attribution).toEqual({ source: 'auto', sessionId: 't1', requestId: 'c1' });
    expect(b.attribution).toEqual({ source: 'auto', sessionId: 't1', requestId: 'c2' });
    // The shared parent is untouched by either child's override.
    expect(root.attribution).toEqual({ source: 'auto', sessionId: 't1' });
  });

  it('is an empty object when none was ever set', () => {
    expect(makeLlmCallContext({ label: 'request', now: fakeClock() }).attribution).toEqual({});
    expect(makeLlmCallContext({ label: 'summarize', timing: false }).attribution).toEqual({});
    expect(noopLlmCallContext().attribution).toEqual({});
  });
});

describe('makeLlmCallContext with timing: false', () => {
  it('is disabled and records no timing but still forwards gaps to onGap', () => {
    const onGap = vi.fn();
    const ctx = makeLlmCallContext<TestAttribution, TestGapBody>({ label: 'summarize', timing: false, attribution: { source: 'auto', capability: 'summarize' }, onGap });
    expect(ctx.enabled).toBe(false);
    ctx.time('complete', () => undefined);
    expect(ctx.profile().spans).toEqual([]);

    ctx.gap(missing('RAIN'));
    expect(onGap).toHaveBeenCalledTimes(1);
    expect(onGap.mock.calls[0][0]).toMatchObject({ requested: 'RAIN', capability: 'summarize' });
  });

  it('yields a timing-off child whose gap still forwards', () => {
    const onGap = vi.fn();
    const ctx = makeLlmCallContext<TestAttribution, TestGapBody>({ label: 'summarize', timing: false, attribution: { source: 'auto' }, onGap });
    const child = ctx.child('attempt-1');
    expect(child.enabled).toBe(false);
    child.gap(missing('FOG'));
    expect(onGap).toHaveBeenCalledTimes(1);
  });
});

describe('LlmCallContext.diag', () => {
  it('records the payload into the profile and forwards the record untouched with the context attribution', () => {
    const onDiag = vi.fn();
    const attribution: TestAttribution = { source: 'auto', capability: 'summarize', region: 'eu', sessionId: 't1', requestId: 'c1' };
    const ctx = testContext({ label: 'summarize', attribution, onDiag });
    const record: TestDiagRecord = { level: 'debug', code: 'model-route', fields: { model: 'x' }, message: 'routed' };

    ctx.diag(record);

    // The PROFILE carries the four-key payload only.
    expect(ctx.profile().diags).toEqual([{ level: 'debug', code: 'model-route', fields: { model: 'x' }, message: 'routed' }]);
    // The SINK gets the record as given plus the context's attribution, so the host stamps its own columns.
    expect(onDiag).toHaveBeenCalledTimes(1);
    expect(onDiag.mock.calls[0][0]).toBe(record);
    expect(onDiag.mock.calls[0][1]).toEqual(attribution);
  });

  it('hands the host its own override keys and the once key intact, and keeps them off the profile', () => {
    const onDiag = vi.fn();
    const ctx = testContext({ attribution: { source: 'auto', region: 'eu' }, onDiag });
    ctx.diag({ level: 'warn', code: 'budget-trim', message: 'trimmed', region: 'us', once: true });
    expect(onDiag.mock.calls[0][0]).toMatchObject({ region: 'us', once: true });
    expect(onDiag.mock.calls[0][1]).toEqual({ source: 'auto', region: 'eu' });
    expect(ctx.profile().diags).toEqual([{ level: 'warn', code: 'budget-trim', message: 'trimmed' }]);
  });

  it('omits `diags` from the profile when none were recorded (byte-stable absence)', () => {
    const ctx = testContext();
    expect(Object.keys(ctx.profile())).not.toContain('diags');
    expect(Object.keys(noopLlmCallContext().profile())).not.toContain('diags');
  });

  it('bubbles a `diag` arm to the ROOT onEvent tap with its path', () => {
    const events: TestEvent[] = [];
    const root = testContext({ onEvent: (event) => events.push(event) });
    root.child('build').child('attempt-1').diag({ level: 'info', code: 'decode-escalate', message: 'escalating' });

    const diagEvents = events.filter((event) => event.kind === 'diag');
    expect(diagEvents).toHaveLength(1);
    expect(diagEvents[0].path).toEqual(['request', 'build', 'attempt-1']);
  });

  it('is NOT timing-gated: a timing-off / noop context still forwards (or safely no-ops)', () => {
    const onDiag = vi.fn();
    const ctx = makeLlmCallContext<TestAttribution, TestGapBody, TestDiagRecord>({ label: 'summarize', timing: false, attribution: { source: 'auto' }, onDiag });
    expect(ctx.enabled).toBe(false);
    ctx.diag({ level: 'warn', code: 'decode-escalate-unset', message: 'no tier' });
    ctx.child('attempt-1').diag({ level: 'warn', code: 'decode-escalate-unset', message: 'no tier' });
    expect(onDiag).toHaveBeenCalledTimes(2);

    // The shared no-op forwards nothing and never throws.
    expect(() => noopLlmCallContext().diag({ level: 'warn', code: 'decode-escalate-unset', message: 'no tier' })).not.toThrow();
  });
});

describe('LlmCallContext.swallow', () => {
  it('records the swallow into the profile with its cause text, and omits `swallows` when none fired', () => {
    const ctx = testContext();
    expect(Object.keys(ctx.profile())).not.toContain('swallows');

    ctx.swallow('llm/example.with-cause', new Error('boom'));
    ctx.swallow('llm/example.bare');

    expect(ctx.profile().swallows).toEqual([{ site: 'llm/example.with-cause', cause: 'boom' }, { site: 'llm/example.bare' }]);
  });

  it('bubbles a `swallow` arm to the ROOT onEvent tap with its path', () => {
    const events: TestEvent[] = [];
    const root = testContext({ onEvent: (event) => events.push(event) });
    root.child('build').swallow('llm/example.site', 'why');

    expect(events).toEqual([{ kind: 'swallow', swallow: { site: 'llm/example.site', cause: 'why' }, path: ['request', 'build'] }]);
  });

  it('forwards the site, the RAW cause and the attribution to onSwallow', () => {
    const onSwallow = vi.fn();
    const error = new Error('boom');
    const ctx = testContext({ attribution: { source: 'auto', sessionId: 't1' }, onSwallow });
    ctx.child('dispatch', { attribution: { requestId: 'c1' } }).swallow('llm/example.site', error);

    expect(onSwallow).toHaveBeenCalledTimes(1);
    expect(onSwallow.mock.calls[0][0]).toBe('llm/example.site');
    expect(onSwallow.mock.calls[0][1]).toBe(error);
    expect(onSwallow.mock.calls[0][2]).toEqual({ source: 'auto', sessionId: 't1', requestId: 'c1' });
  });

  it('forwards with timing off', () => {
    const onSwallow = vi.fn();
    const ctx = makeLlmCallContext<TestAttribution>({ label: 'summarize', timing: false, attribution: { source: 'auto' }, onSwallow });
    ctx.child('attempt-1').swallow('llm/example.site');

    expect(onSwallow).toHaveBeenCalledTimes(1);
  });

  it('never throws, even when the host sink does', () => {
    const ctx = testContext({
      onSwallow: () => {
        throw new Error('sink failed');
      }
    });

    expect(() => ctx.swallow('llm/example.site', 'cause')).not.toThrow();
    expect(ctx.profile().swallows).toEqual([{ site: 'llm/example.site', cause: 'cause' }]);
  });

  it('the no-op swallows nothing', () => {
    const ctx = noopLlmCallContext();
    expect(() => ctx.swallow('llm/example.site', new Error('x'))).not.toThrow();
    expect(Object.keys(ctx.profile())).not.toContain('swallows');
  });
});

describe('LlmCallContext typing', () => {
  it('a host-typed context is assignable to the defaulted LlmCallContext library code is typed against', () => {
    const hostContext: LlmCallContext<TestAttribution, TestGapBody, TestDiagRecord> = testContext({ attribution: { source: 'auto' } });
    const libraryView: LlmCallContext = hostContext;

    expect(libraryView.child('attempt-1').enabled).toBe(true);
  });
});
