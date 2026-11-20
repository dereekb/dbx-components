/**
 * The **call context** — a request-scoped recorder minted per dispatch (or per larger unit of work) that captures
 * phase timings (spans and marks) as they occur, and forwards three side channels — gaps, breadcrumbs and swallows —
 * to the host's callbacks together with the context's attribution.
 *
 * **Recursive by construction.** A context spawns CHILD contexts ({@link LlmCallContext.child}) — request → phase →
 * dispatch → attempt — and each child's {@link LlmCallProfile} nests under its parent's `children`, so a caller reads
 * one nested tree rather than re-basing a flat list. Every span and mark offset is relative to the ROOT start, so a
 * flattened timeline needs no re-basing; every {@link LlmCallContextEvent} carries the label `path` from the root, so
 * the root `onEvent` tap sees WHERE in the tree it fired.
 *
 * **Timing is gated; side channels are not.** A context built with `timing: false` records no spans or marks (its
 * {@link LlmCallContext.enabled} is `false`), yet its {@link LlmCallContext.gap}, {@link LlmCallContext.diag} and
 * {@link LlmCallContext.swallow} still forward to the host's callbacks. The shared {@link noopLlmCallContext} forwards
 * nothing.
 *
 * **Three relationships, not one — link, don't parent.** Beside "is the root" and "is a child of" there is
 * {@link LlmCallContext.detached}: a NEW ROOT for work that is CAUSED by a context but NOT temporally contained by it
 * (a background job a request schedules and then finishes before). A `child()` of such an origin would report offsets
 * against a root that already finished, and would nest under a `children` array nobody reads again once the origin's
 * `profile()` was snapshotted. A detached root instead anchors its OWN start — so "this fire-and-forget write took
 * 4.1s" is readable — and records the origin as an {@link LlmCallLink} rather than a parent edge. A reader joins a
 * detached tree back to its origin through the ids `linkAttributionOf` copies onto the link, never through nesting.
 * It stays reachable from the origin via the SIBLING {@link LlmCallProfile.detachedProfiles} bucket — containment for
 * reachability, never a parent edge for timing.
 *
 * **No ambient state.** A context is minted per call and passed explicitly, so concurrent dispatchers never
 * cross-talk. A detached context is likewise created EXPLICITLY at the scheduling site and handed to the background
 * work — never resolved from ambient context at the point of use.
 *
 * **Host-typed side channels.** Three defaulted type parameters let a host alias its trio once:
 *
 * - `A` — the host's ATTRIBUTION (a request id, a tenant, a capability…): merged parent → child, stamped under every
 *   gap, handed to `onDiag` / `onSwallow`, and readable as {@link LlmCallContext.attribution}.
 * - `B` — the host's GAP BODY; a recorded gap is `A & B`.
 * - `D` — the host's breadcrumb record ({@link LlmCallDiagRecord} plus any columns of its own).
 */

import type { Milliseconds, UnixDateTimeMillisecondsNumber } from '@dereekb/util';
import { llmSwallowCauseText, type LlmSwallowSiteId } from './llm.swallow';

/**
 * The scalar attributes a span or mark may carry (attempt number, char counts, …).
 */
export type LlmCallSpanMeta = Readonly<Record<string, string | number | boolean>>;

/**
 * One timed span in an {@link LlmCallProfile} — a named interval with its start OFFSET (relative to the root context's
 * start) and duration, plus optional scalar meta.
 */
export interface LlmCallSpan {
  /**
   * The span name (e.g. `'render'`, `'assemble'`, `'complete'`).
   */
  readonly name: string;
  /**
   * The span's start, relative to the ROOT context's start (so a flattened timeline needs no re-basing).
   */
  readonly startMs: Milliseconds;
  /**
   * The span's wall-clock duration.
   */
  readonly durationMs: Milliseconds;
  /**
   * Optional scalar attributes.
   */
  readonly meta?: LlmCallSpanMeta;
}

/**
 * One instantaneous mark in an {@link LlmCallProfile} — a named point in time (relative to the root start).
 */
export interface LlmCallMark {
  /**
   * The mark name.
   */
  readonly name: string;
  /**
   * The mark time, relative to the ROOT context's start.
   */
  readonly atMs: Milliseconds;
  /**
   * Optional scalar attributes.
   */
  readonly meta?: LlmCallSpanMeta;
}

/**
 * The severity of a breadcrumb. `warn` only when a human should ACT; `info` for a routed decision; `debug` for a
 * per-call detail. Which levels are written is the host log's choice.
 */
export type LlmCallDiagLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * The structured scalars a breadcrumb carries — FLAT, JSON-primitive only, so a reader can tabulate a family without
 * a per-code decoder. A breadcrumb whose fields want an array or a nested object deserves a real record type instead.
 */
export type LlmCallDiagFields = Readonly<Record<string, string | number | boolean>>;

/**
 * One breadcrumb as the profile and the live tap see it — the "why did it do that" decision trace that does not
 * justify a record type of its own.
 */
export interface LlmCallDiag {
  /**
   * The breadcrumb's severity.
   */
  readonly level: LlmCallDiagLevel;
  /**
   * The breadcrumb family (an open string, e.g. `'retry-lever'`, `'model-route'`).
   */
  readonly code: string;
  /**
   * The structured scalars. Omitted when the breadcrumb carries none (byte-stable absence).
   */
  readonly fields?: LlmCallDiagFields;
  /**
   * The human clause ONLY — lowercase, no trailing period, no embedded `key=<value>` pairs (those live in
   * {@link fields}).
   */
  readonly message: string;
}

/**
 * One breadcrumb to emit — the {@link LlmCallDiag} plus the emit-once key. A host extends it with columns of its own
 * (the context's `D`).
 */
export interface LlmCallDiagRecord extends LlmCallDiag {
  /**
   * When set, the host emits this breadcrumb only ONCE per log for this key — `true` keys on the
   * {@link LlmCallDiag.code}, a string keys on itself (e.g. `` `model-route:${capability}` `` for once PER
   * CAPABILITY): a repeated breadcrumb in a hot path with an invariant cause fires once, not per call.
   */
  readonly once?: boolean | string;
}

/**
 * One deliberate swallow as the profile and the live tap see it — the declared site that fired, plus the caught
 * message when the `catch` bound one.
 */
export interface LlmCallSwallow {
  /**
   * The declared site that fired.
   */
  readonly site: LlmSwallowSiteId;
  /**
   * The caught message ({@link llmSwallowCauseText}), when there was one.
   */
  readonly cause?: string;
}

/**
 * A CAUSAL edge to the context that scheduled this work — the "link, don't parent" relationship. Names the originating
 * context's label `path` plus whatever attribution the root config's `linkAttributionOf` copies onto it (the ids a
 * reader joins on).
 */
export type LlmCallLink<A extends object = object> = {
  /**
   * The originating context's label path from ITS root (e.g. `['request','run']`).
   */
  readonly path: ReadonlyArray<string>;
} & Partial<A>;

/**
 * The nested profile of one {@link LlmCallContext} — RECURSIVE: a context's profile nests its children's profiles
 * under {@link children} (offsets relative to the ROOT start, so a flattened timeline needs no re-basing).
 */
export interface LlmCallProfile<A extends object = object, B extends object = object> {
  /**
   * The context label.
   */
  readonly label: string;
  /**
   * The context's own start, relative to the ROOT start (0 for the root).
   */
  readonly startedAt: Milliseconds;
  /**
   * The context's total wall clock (measured when {@link LlmCallContext.profile} is called).
   */
  readonly totalMs: Milliseconds;
  /**
   * The timed spans recorded directly on this context.
   */
  readonly spans: ReadonlyArray<LlmCallSpan>;
  /**
   * The marks recorded directly on this context.
   */
  readonly marks: ReadonlyArray<LlmCallMark>;
  /**
   * The gaps recorded directly on this context (via {@link LlmCallContext.gap}).
   */
  readonly gaps: ReadonlyArray<A & B>;
  /**
   * The breadcrumbs recorded directly on this context (via {@link LlmCallContext.diag}) — the in-process read-back of
   * what a dispatch decided, beside {@link gaps}. OMITTED when none were recorded, so a run that emitted no breadcrumb
   * keeps a byte-identical profile. Recorded whatever level the host log writes.
   */
  readonly diags?: ReadonlyArray<LlmCallDiag>;
  /**
   * The DELIBERATE SWALLOWS recorded directly on this context (via {@link LlmCallContext.swallow}) — which declared
   * fail-open `catch` fired inside this work, and why. OMITTED when none fired, so a run that swallowed nothing keeps
   * a byte-identical profile.
   */
  readonly swallows?: ReadonlyArray<LlmCallSwallow>;
  /**
   * The nested profiles of this context's children, in creation order.
   */
  readonly children: ReadonlyArray<LlmCallProfile<A, B>>;
  /**
   * The CAUSAL links to the context(s) that scheduled this work — present only on a {@link LlmCallContext.detached}
   * root. OMITTED when empty, so a profile that detached nothing stays byte-identical.
   */
  readonly links?: ReadonlyArray<LlmCallLink<A>>;
  /**
   * The profiles of the DETACHED roots this context scheduled — a SIBLING bucket, never {@link children}: each is
   * SELF-ROOTED (its own `startedAt: 0` / `totalMs`), so the off-request work is REACHABLE from here without being
   * falsely nested under this node's timeline. OMITTED when empty, so a profile that detached nothing stays
   * byte-identical.
   */
  readonly detachedProfiles?: ReadonlyArray<LlmCallProfile<A, B>>;
}

/**
 * One live event fired on the ROOT `onEvent` tap as it occurs anywhere in the tree, carrying the label `path` from the
 * root (e.g. `['request','build','summarize','attempt-2']`) so the tap sees WHERE in the tree it fired.
 *
 * The `detached` arm fires ONCE, at {@link LlmCallContext.detached} creation, carrying the DETACHED root's own path
 * plus the {@link LlmCallLink}s naming its origin — so a live tap reconstructs the link graph as it happens instead of
 * watching an orphan root appear.
 */
export type LlmCallContextEvent<A extends object = object, B extends object = object> = (
  | { readonly kind: 'mark'; readonly mark: LlmCallMark }
  | { readonly kind: 'span'; readonly span: LlmCallSpan }
  | { readonly kind: 'gap'; readonly gap: A & B }
  | { readonly kind: 'diag'; readonly diag: LlmCallDiag }
  | { readonly kind: 'swallow'; readonly swallow: LlmCallSwallow }
  | { readonly kind: 'detached'; readonly links: ReadonlyArray<LlmCallLink<A>> }
) & { readonly path: ReadonlyArray<string> };

/**
 * Config for {@link LlmCallContext.child}.
 */
export interface LlmCallContextChildConfig<A extends object = object> {
  /**
   * The attribution override, merged OVER the parent's.
   */
  readonly attribution?: Partial<A>;
}

/**
 * Config for {@link LlmCallContext.detached} — the child config plus the causal origin(s) to record.
 */
export interface LlmCallContextDetachedConfig<A extends object = object> extends LlmCallContextChildConfig<A> {
  /**
   * The causal origin(s) to record as this detached root's {@link LlmCallProfile.links}. Omitted ⇒ a single link
   * naming the context {@link LlmCallContext.detached} was called on (the common case: the scheduling site detaches
   * off its own scope). Supplied ⇒ REPLACES that implicit link.
   */
  readonly linkTo?: LlmCallLink<A> | ReadonlyArray<LlmCallLink<A>>;
}

/**
 * Config for {@link makeLlmCallContext}. The callbacks are ROOT callbacks: every child and detached root forwards to
 * them.
 */
export interface LlmCallContextConfig<A extends object = object, B extends object = object, D extends LlmCallDiagRecord = LlmCallDiagRecord> {
  /**
   * The root context's label (e.g. `'request'`, or the capability for a per-call context).
   */
  readonly label: string;
  /**
   * Whether spans and marks are recorded. Defaults to `true`; `false` builds a context whose side channels still
   * forward while timing records nothing (its {@link LlmCallContext.enabled} is `false`).
   */
  readonly timing?: boolean;
  /**
   * An injectable clock for specs; defaults to `() => Date.now()`.
   */
  readonly now?: () => UnixDateTimeMillisecondsNumber;
  /**
   * The root attribution; defaults to `{}`. Children and detached roots merge their own override over it.
   */
  readonly attribution?: A;
  /**
   * A live tap on the ROOT — fires as each event occurs anywhere in the tree (path-prefixed).
   */
  readonly onEvent?: (event: LlmCallContextEvent<A, B>) => void;
  /**
   * The root gap sink — receives every recorded gap (attribution merged under the body).
   */
  readonly onGap?: (gap: A & B) => void;
  /**
   * The root breadcrumb sink — receives the record untouched plus the context's attribution, so the host stamps its
   * own columns (and applies its own level gate). Absent ⇒ breadcrumbs are recorded into the profile and the
   * `onEvent` tap but never written.
   */
  readonly onDiag?: (record: D, attribution: A) => void;
  /**
   * The root swallow sink — receives the site, the RAW caught value and the context's attribution, so the host builds
   * its own record (e.g. from its own site registry). A sink that throws is contained (site
   * `llm/call-context.swallow-sink`). Absent ⇒ swallows are recorded into the profile and the `onEvent` tap but never
   * tallied.
   */
  readonly onSwallow?: (site: LlmSwallowSiteId, cause: unknown, attribution: A) => void;
  /**
   * What a link copies from a context's attribution (the ids a reader joins a detached tree back on). Absent ⇒ a link
   * carries only its `path`.
   */
  readonly linkAttributionOf?: (attribution: A) => Partial<A>;
}

/**
 * A request-scoped call context — captures spans / marks / gaps / breadcrumbs / swallows and spawns recursive child
 * contexts (see the module doc).
 *
 * The members are METHODS, so a host's narrower context stays assignable to the defaulted `LlmCallContext` that
 * library code is typed against.
 */
export interface LlmCallContext<A extends object = object, B extends object = object, D extends LlmCallDiagRecord = LlmCallDiagRecord> {
  /**
   * This context's label (the last segment of its event `path`).
   */
  readonly label: string;
  /**
   * `false` on the shared no-op and on a `timing: false` context — callers gate payload emission on it, never by
   * branching call sites.
   */
  readonly enabled: boolean;
  /**
   * The resolved attribution of this context — the root's, with every child / detached override merged over it.
   * `{}` when none was ever set.
   */
  readonly attribution: A;
  /**
   * Record an instantaneous mark (no-op when timing is off).
   *
   * @param name - The mark name.
   * @param meta - Optional scalar attributes.
   */
  mark(name: string, meta?: LlmCallSpanMeta): void;
  /**
   * Time a synchronous `run`, recording a span around it (the value is returned unchanged; the span is still recorded
   * on throw). When timing is off, `run` is executed with no recording.
   *
   * @param name - The span name.
   * @param run - The synchronous work.
   * @param meta - Optional scalar attributes.
   * @returns The value `run` returned.
   */
  time<T>(name: string, run: () => T, meta?: LlmCallSpanMeta): T;
  /**
   * Time an async `run`, recording a span around it (the span closes on both resolve AND reject). When timing is off,
   * `run` is awaited with no recording.
   *
   * @param name - The span name.
   * @param run - The async work.
   * @param meta - Optional scalar attributes.
   * @returns The value `run` resolved to.
   */
  timeAsync<T>(name: string, run: () => Promise<T>, meta?: LlmCallSpanMeta): Promise<T>;
  /**
   * Begin a span manually — returns a `close` thunk that records it (idempotent; a second call is a no-op). When
   * timing is off, returns a no-op thunk.
   *
   * @param name - The span name.
   * @param meta - Optional scalar attributes.
   * @returns The close thunk.
   */
  beginSpan(name: string, meta?: LlmCallSpanMeta): () => void;
  /**
   * RECURSIVELY create a child context whose profile nests under this one's {@link LlmCallProfile.children}, whose
   * events bubble to the ROOT `onEvent` tap (path-prefixed), and whose side channels forward to the ROOT callbacks.
   * Inherits the clock, the timing flag and the attribution (the child's override is merged OVER the parent's). A
   * no-op parent yields a no-op child.
   *
   * @param label - The child label.
   * @param config - The optional attribution override.
   * @returns The child context.
   */
  child(label: string, config?: LlmCallContextChildConfig<A>): LlmCallContext<A, B, D>;
  /**
   * Project THIS context as an {@link LlmCallLink} — its label path plus what `linkAttributionOf` copies from its
   * attribution. The PRODUCER side of "link, don't parent": hand it to another context's {@link detached} `linkTo`
   * when the causal origin is not the context creating the detached root.
   *
   * @returns The link naming this context.
   */
  link(): LlmCallLink<A>;
  /**
   * Create a DETACHED context — a NEW ROOT for work that is CAUSED by this context but NOT temporally contained by it.
   *
   * Unlike {@link child}: it anchors its OWN start (so offsets are meaningful for work that begins after the scheduling
   * work ended) and it is NOT nested under {@link LlmCallProfile.children}. Like {@link child}: it inherits the clock,
   * the timing flag, the ROOT callbacks and the merged attribution — so the detached work's gaps are never lost and its
   * ids still join the origin on read.
   *
   * Reachable from here via the sibling {@link LlmCallProfile.detachedProfiles} bucket, AND returned so a scheduling
   * site that outlives this context's snapshot can profile it independently. A no-op parent yields the no-op.
   *
   * @param label - The detached root label (e.g. `'bg:index-docs'`).
   * @param config - The attribution override and the optional explicit link target(s) — defaults to a single link
   *   naming THIS context.
   * @returns The detached root context.
   */
  detached(label: string, config?: LlmCallContextDetachedConfig<A>): LlmCallContext<A, B, D>;
  /**
   * THE gap call — record something the work came up short on. Stamps the context's attribution UNDER the partial
   * `attribution` override and the body (`{ ...attribution, ...override, ...body }`), records it into the profile,
   * and forwards it to the root `onGap`. ALWAYS forwards, even when {@link enabled} is `false`.
   *
   * @param body - The gap body.
   * @param attribution - The partial attribution override (merged OVER the context's).
   */
  gap(body: B, attribution?: Partial<A>): void;
  /**
   * THE breadcrumb call — record one leveled breadcrumb. Records its {@link LlmCallDiag} payload into the profile and
   * the live tap, then forwards the record UNTOUCHED to the root `onDiag` with the context's attribution, so a host
   * joins the breadcrumb to the work that dropped it. ALWAYS forwards, even when {@link enabled} is `false`.
   *
   * @param record - The breadcrumb (level + code + fields + message, plus any host columns or `once` key).
   */
  diag(record: D): void;
  /**
   * THE swallow call — record that a DECLARED fail-open `catch` fired. Records it into the profile and the live tap,
   * then forwards the site, the RAW cause and the context's attribution to the root `onSwallow`.
   *
   * ALWAYS forwards, even when {@link enabled} is `false`. NEVER throws — a throwing host sink is contained — and NEVER
   * changes control flow, since it is called from inside `catch` blocks whose contract is "never throws". It has the
   * {@link import('./llm.swallow').LlmSwallowSink} shape.
   *
   * @param site - The declared site that fired.
   * @param cause - The caught value, when the `catch` bound one.
   */
  swallow(site: LlmSwallowSiteId, cause?: unknown): void;
  /**
   * Snapshot this context's nested {@link LlmCallProfile} (recursively including every child's profile).
   *
   * @returns The nested profile.
   */
  profile(): LlmCallProfile<A, B>;
}

/**
 * The internal build inputs — the public config resolved into the recursive-tree vocabulary (clock, root start, path,
 * timing flag) child contexts thread down.
 */
interface LlmCallContextInternal<A extends object, B extends object, D extends LlmCallDiagRecord> {
  /**
   * Whether timing is captured (spans / marks recorded).
   */
  readonly enabled: boolean;
  /**
   * This context's label.
   */
  readonly label: string;
  /**
   * The label path from the root to this context (inclusive).
   */
  readonly path: ReadonlyArray<string>;
  /**
   * The shared clock.
   */
  readonly now: () => UnixDateTimeMillisecondsNumber;
  /**
   * The ROOT context's start (absolute) — omitted on a root itself (it uses its own start).
   */
  readonly rootStartMs?: UnixDateTimeMillisecondsNumber;
  /**
   * The shared root event tap.
   */
  readonly onEvent?: (event: LlmCallContextEvent<A, B>) => void;
  /**
   * The shared root gap sink.
   */
  readonly onGap?: (gap: A & B) => void;
  /**
   * The shared root breadcrumb sink.
   */
  readonly onDiag?: (record: D, attribution: A) => void;
  /**
   * The shared root swallow sink.
   */
  readonly onSwallow?: (site: LlmSwallowSiteId, cause: unknown, attribution: A) => void;
  /**
   * The shared link projection.
   */
  readonly linkAttributionOf?: (attribution: A) => Partial<A>;
  /**
   * The resolved attribution of this context.
   */
  readonly attribution: A;
  /**
   * The CAUSAL links recorded on this node — non-empty only on a detached root.
   */
  readonly links?: ReadonlyArray<LlmCallLink<A>>;
}

/**
 * Build one context node of the recursive tree. A ROOT (no `rootStartMs`) anchors the relative timeline at its own
 * start; a child inherits the root's start so its offsets stay root-relative. A detached root re-enters here WITHOUT
 * a `rootStartMs` for exactly that reason — the root rule is what gives off-request work its own meaningful timeline.
 *
 * @param internal - The resolved build inputs.
 * @returns The context node.
 */
function buildLlmCallContext<A extends object, B extends object, D extends LlmCallDiagRecord>(internal: LlmCallContextInternal<A, B, D>): LlmCallContext<A, B, D> {
  const { enabled, label, path, now, onEvent, onGap, onDiag, onSwallow, linkAttributionOf, attribution, links } = internal;
  const startMs = now();
  const rootStartMs = internal.rootStartMs ?? startMs;
  const spans: LlmCallSpan[] = [];
  const marks: LlmCallMark[] = [];
  const gaps: (A & B)[] = [];
  const diags: LlmCallDiag[] = [];
  const swallows: LlmCallSwallow[] = [];
  const children: LlmCallContext<A, B, D>[] = [];
  // The DETACHED roots this node scheduled — held apart from `children` so they stay reachable from here without
  // being nested into anyone's timeline (see the module doc's third relationship).
  const detachedRoots: LlmCallContext<A, B, D>[] = [];

  const closeSpan = (name: string, start: UnixDateTimeMillisecondsNumber, meta?: LlmCallSpanMeta): void => {
    const span: LlmCallSpan = { name, startMs: start - rootStartMs, durationMs: now() - start, ...(meta == null ? {} : { meta }) };
    spans.push(span);
    onEvent?.({ kind: 'span', span, path });
  };

  const linkOf = (): LlmCallLink<A> => ({ path, ...linkAttributionOf?.(attribution) }) as LlmCallLink<A>;

  // The shared callbacks every child and detached root inherits from the root.
  const sinks = {
    now,
    ...(onEvent == null ? {} : { onEvent }),
    ...(onGap == null ? {} : { onGap }),
    ...(onDiag == null ? {} : { onDiag }),
    ...(onSwallow == null ? {} : { onSwallow }),
    ...(linkAttributionOf == null ? {} : { linkAttributionOf })
  };

  return {
    label,
    enabled,
    attribution,
    mark(name, meta) {
      if (enabled) {
        const mark: LlmCallMark = { name, atMs: now() - rootStartMs, ...(meta == null ? {} : { meta }) };
        marks.push(mark);
        onEvent?.({ kind: 'mark', mark, path });
      }
    },
    time(name, run, meta) {
      let result: ReturnType<typeof run>;

      if (enabled) {
        const start = now();

        try {
          result = run();
        } finally {
          closeSpan(name, start, meta);
        }
      } else {
        result = run();
      }

      return result;
    },
    async timeAsync(name, run, meta) {
      let result: Awaited<ReturnType<typeof run>>;

      if (enabled) {
        const start = now();

        try {
          result = await run();
        } finally {
          closeSpan(name, start, meta);
        }
      } else {
        result = await run();
      }

      return result;
    },
    beginSpan(name, meta) {
      let close: () => void;

      if (enabled) {
        const start = now();
        let closed = false;
        close = () => {
          if (!closed) {
            closed = true;
            closeSpan(name, start, meta);
          }
        };
      } else {
        close = () => undefined;
      }

      return close;
    },
    child(childLabel, config) {
      const child = buildLlmCallContext<A, B, D>({
        enabled,
        label: childLabel,
        path: [...path, childLabel],
        rootStartMs,
        ...sinks,
        attribution: { ...attribution, ...config?.attribution }
      });
      children.push(child);
      return child;
    },
    link() {
      return linkOf();
    },
    detached(detachedLabel, config) {
      const linkTo = config?.linkTo;
      // Omitted ⇒ the implicit link naming THIS context; supplied ⇒ it REPLACES the implicit one.
      let detachedLinks: ReadonlyArray<LlmCallLink<A>>;

      if (linkTo == null) {
        detachedLinks = [linkOf()];
      } else if (Array.isArray(linkTo)) {
        detachedLinks = [...(linkTo as ReadonlyArray<LlmCallLink<A>>)];
      } else {
        detachedLinks = [linkTo as LlmCallLink<A>];
      }

      const detachedPath = [detachedLabel];
      const detachedRoot = buildLlmCallContext<A, B, D>({
        enabled,
        label: detachedLabel,
        path: detachedPath,
        // NO `rootStartMs` — the detached root anchors its OWN timeline through the root rule above, so its offsets
        // read from when the off-request work actually began.
        ...sinks,
        attribution: { ...attribution, ...config?.attribution },
        links: detachedLinks
      });
      detachedRoots.push(detachedRoot);
      onEvent?.({ kind: 'detached', links: detachedLinks, path: detachedPath });
      return detachedRoot;
    },
    gap(body, override) {
      const gap = { ...attribution, ...override, ...body } as A & B;
      gaps.push(gap);
      onEvent?.({ kind: 'gap', gap, path });
      onGap?.(gap);
    },
    diag(record) {
      // The PAYLOAD half (what the profile + the live tap read) is projected apart from the record, so the in-process
      // read-back carries exactly the four documented keys and `fields` stays omit-when-absent.
      const diag: LlmCallDiag = { level: record.level, code: record.code, ...(record.fields == null ? {} : { fields: record.fields }), message: record.message };
      diags.push(diag);
      onEvent?.({ kind: 'diag', diag, path });
      // The record goes to the host untouched; the host stamps its own columns from the attribution, and an explicit
      // override on the record still wins when it spreads the record last.
      onDiag?.(record, attribution);
    },
    swallow(site, cause) {
      const causeText = llmSwallowCauseText(cause);
      const swallow: LlmCallSwallow = { site, ...(causeText == null ? {} : { cause: causeText }) };
      swallows.push(swallow);
      onEvent?.({ kind: 'swallow', swallow, path });

      try {
        onSwallow?.(site, cause, attribution);
      } catch {
        // TERMINAL: llm/call-context.swallow-sink — `swallow` is called from inside never-throw catch blocks, so a
        // host sink that throws must not escape; its own failure cannot be reported as a swallow.
      }
    },
    profile() {
      return {
        label,
        startedAt: startMs - rootStartMs,
        totalMs: now() - startMs,
        // copies: spans and marks are pushed closed, so a shallow copy is a true snapshot
        spans: [...spans],
        marks: [...marks],
        gaps: [...gaps],
        ...(diags.length === 0 ? {} : { diags: [...diags] }),
        ...(swallows.length === 0 ? {} : { swallows: [...swallows] }),
        children: children.map((child) => child.profile()),
        ...(links == null || links.length === 0 ? {} : { links: [...links] }),
        ...(detachedRoots.length === 0 ? {} : { detachedProfiles: detachedRoots.map((detachedRoot) => detachedRoot.profile()) })
      };
    }
  };
}

/**
 * Build a call context. With timing on (the default) it records spans and marks into a nested profile; with
 * `timing: false` its {@link LlmCallContext.enabled} is `false` and timing records nothing, while its gaps,
 * breadcrumbs and swallows still forward to the host's callbacks. Children and detached roots inherit the clock, the
 * timing flag and the callbacks.
 *
 * @param config - The label, timing flag, clock, root attribution, root event tap and the host's callbacks.
 * @returns The root context.
 *
 * @example
 * ```ts
 * const context = makeLlmCallContext<RequestAttribution>({
 *   label: 'request',
 *   attribution: { requestId: 'r1' },
 *   onDiag: (record, attribution) => logger.debug({ ...attribution, ...record })
 * });
 *
 * await context.child('attempt-1').timeAsync('complete', () => strategy.complete(request));
 * const profile = context.profile();
 * ```
 * @__NO_SIDE_EFFECTS__
 */
export function makeLlmCallContext<A extends object = object, B extends object = object, D extends LlmCallDiagRecord = LlmCallDiagRecord>(config: LlmCallContextConfig<A, B, D>): LlmCallContext<A, B, D> {
  return buildLlmCallContext<A, B, D>({
    enabled: config.timing ?? true,
    label: config.label,
    path: [config.label],
    now: config.now ?? (() => Date.now()),
    ...(config.onEvent == null ? {} : { onEvent: config.onEvent }),
    ...(config.onGap == null ? {} : { onGap: config.onGap }),
    ...(config.onDiag == null ? {} : { onDiag: config.onDiag }),
    ...(config.onSwallow == null ? {} : { onSwallow: config.onSwallow }),
    ...(config.linkAttributionOf == null ? {} : { linkAttributionOf: config.linkAttributionOf }),
    attribution: config.attribution ?? ({} as A)
  });
}

/**
 * The one shared no-op context behind {@link noopLlmCallContext}.
 */
const NOOP_LLM_CALL_CONTEXT: LlmCallContext = {
  label: '(noop)',
  enabled: false,
  attribution: {},
  mark() {
    // no-op
  },
  time(_name, run) {
    return run();
  },
  async timeAsync(_name, run) {
    return run();
  },
  beginSpan() {
    return () => undefined;
  },
  child() {
    return NOOP_LLM_CALL_CONTEXT;
  },
  link() {
    return { path: ['(noop)'] };
  },
  detached() {
    return NOOP_LLM_CALL_CONTEXT;
  },
  gap() {
    // no-op — the no-op context has no gap sink
  },
  diag() {
    // no-op — the no-op context has no breadcrumb sink
  },
  swallow() {
    // no-op — the no-op context has no swallow sink
  },
  profile() {
    return { label: '(noop)', startedAt: 0, totalMs: 0, spans: [], marks: [], gaps: [], children: [] };
  }
};

/**
 * The shared no-op context — {@link LlmCallContext.enabled} is `false`, timing is a no-op,
 * {@link LlmCallContext.child} AND {@link LlmCallContext.detached} return itself, and every side channel forwards
 * NOTHING. The fallback when no context was threaded.
 *
 * Returns the SAME instance on every call, whatever type parameters it is asked for. Its
 * {@link LlmCallContext.attribution} is always `{}`, whatever `A` claims.
 *
 * @returns The shared no-op context.
 */
export function noopLlmCallContext<A extends object = object, B extends object = object, D extends LlmCallDiagRecord = LlmCallDiagRecord>(): LlmCallContext<A, B, D> {
  return NOOP_LLM_CALL_CONTEXT as unknown as LlmCallContext<A, B, D>;
}
