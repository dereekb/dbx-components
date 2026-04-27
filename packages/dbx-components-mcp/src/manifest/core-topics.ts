/**
 * Closed core topic vocabulary for the semantic-types registry.
 *
 * "Topics" are how the registry indexes a semantic type for cross-package
 * search ("give me everything tagged `date`"). The vocabulary is intentionally
 * small and centrally controlled: bare topics on a manifest entry must be
 * present in this list. Manifests can also declare *namespaced* topics of the
 * form `${manifest.topicNamespace}:<rest>` for source-specific concepts —
 * those bypass this list but are scoped to the declaring manifest.
 *
 * Adding a new core topic is a deliberate code change so the vocab stays
 * consistent across `@dereekb/*` and downstream apps. The set is small on
 * purpose; reach for namespaced topics for app-local concepts.
 */

/**
 * The complete list of bare topics any manifest entry may declare.
 *
 * Categories are intentionally broad — narrower buckets belong in namespaced
 * topics (e.g. `dereekb-util:duration`). Order is informational only; lookup
 * code treats this as a Set.
 */
export const CORE_TOPICS = ['identifier', 'time', 'duration', 'date', 'timezone', 'numeric', 'string', 'contact', 'geo', 'url', 'phone', 'email', 'currency', 'measurement', 'percent', 'enum', 'reference'] as const;

/**
 * Union of every bare topic accepted by manifest entries.
 */
export type CoreTopic = (typeof CORE_TOPICS)[number];

/**
 * Eagerly-computed Set of {@link CORE_TOPICS} for O(1) membership checks.
 * Exposed as `readonly` so callers can't mutate the shared instance.
 */
export const CORE_TOPICS_SET: ReadonlySet<string> = new Set<string>(CORE_TOPICS);

/**
 * Returns whether `topic` is a recognised bare core topic.
 *
 * @param topic - the topic string to test
 * @returns `true` when `topic` is present in {@link CORE_TOPICS}
 */
export function isCoreTopic(topic: string): topic is CoreTopic {
  return CORE_TOPICS_SET.has(topic);
}
