import { describe, expect, it } from 'vitest';
import { CORE_TOPICS, CORE_TOPICS_SET, isCoreTopic } from './core-topics.js';

describe('core-topics vocabulary', () => {
  it('is non-empty', () => {
    expect(CORE_TOPICS.length).toBeGreaterThan(0);
  });

  it('contains only lowercase entries with no whitespace and no `:` separator', () => {
    for (const topic of CORE_TOPICS) {
      expect(topic, `'${topic}' must be lowercase`).toBe(topic.toLowerCase());
      expect(topic, `'${topic}' must not contain whitespace`).not.toMatch(/\s/);
      expect(topic, `'${topic}' must not contain ':' (reserved for namespaces)`).not.toContain(':');
    }
  });

  it('has no duplicate entries', () => {
    const seen = new Set<string>();
    for (const topic of CORE_TOPICS) {
      expect(seen.has(topic), `duplicate topic: ${topic}`).toBe(false);
      seen.add(topic);
    }
  });

  it('exposes a Set with one entry per CORE_TOPICS member', () => {
    expect(CORE_TOPICS_SET.size).toBe(CORE_TOPICS.length);
  });

  it('isCoreTopic returns true for every CORE_TOPICS member and false otherwise', () => {
    for (const topic of CORE_TOPICS) {
      expect(isCoreTopic(topic)).toBe(true);
    }
    expect(isCoreTopic('not-a-real-topic')).toBe(false);
    expect(isCoreTopic('Date')).toBe(false);
    expect(isCoreTopic('dereekb-util:duration')).toBe(false);
  });
});
