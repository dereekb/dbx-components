import { describe, expect, it } from 'vitest';
import { ACTION_ENTRIES, ACTION_ROLE_ORDER, ACTION_STATE_VALUES, getActionDirectiveBySelector, getActionEntries, getActionEntriesByRole, getActionEntry, getActionEntryByClassName, getActionStateEntry, type ActionDirectiveInfo, type ActionStateInfo } from './index.js';

describe('actions registry', () => {
  it('exposes a non-empty list and covers all three roles', () => {
    expect(ACTION_ENTRIES.length).toBeGreaterThan(0);
    expect(getActionEntries()).toBe(ACTION_ENTRIES);
    for (const role of ACTION_ROLE_ORDER) {
      expect(getActionEntriesByRole(role).length, `no entries for role ${role}`).toBeGreaterThan(0);
    }
  });

  it('gives every entry a unique slug and a known role', () => {
    const slugs = new Set<string>();
    const knownRoles = new Set<string>(ACTION_ROLE_ORDER);
    for (const entry of ACTION_ENTRIES) {
      expect(slugs.has(entry.slug), `duplicate slug: ${entry.slug}`).toBe(false);
      slugs.add(entry.slug);
      expect(knownRoles.has(entry.role), `unknown role on ${entry.slug}: ${entry.role}`).toBe(true);
    }
  });

  it('every state entry has a known stateValue and reachable transitions', () => {
    const stateValues = new Set<string>(ACTION_STATE_VALUES);
    const stateSlugs = new Set<string>();
    const states = ACTION_ENTRIES.filter((e): e is ActionStateInfo => e.role === 'state');
    expect(states.length).toBeGreaterThanOrEqual(7);

    for (const state of states) {
      expect(stateValues.has(state.stateValue), `unknown stateValue ${state.stateValue}`).toBe(true);
      expect(stateSlugs.has(state.stateValue), `duplicate stateValue ${state.stateValue}`).toBe(false);
      stateSlugs.add(state.stateValue);
      for (const target of state.transitionsTo) {
        expect(stateValues.has(target), `${state.stateValue} → ${target} references unknown state`).toBe(true);
      }
      for (const source of state.transitionsFrom) {
        expect(stateValues.has(source), `${source} → ${state.stateValue} references unknown state`).toBe(true);
      }
    }
  });

  it('every directive entry references only real states in stateInteraction', () => {
    const stateValues = new Set<string>(ACTION_STATE_VALUES);
    const directives = ACTION_ENTRIES.filter((e): e is ActionDirectiveInfo => e.role === 'directive');
    expect(directives.length).toBeGreaterThanOrEqual(14);

    for (const directive of directives) {
      for (const state of directive.stateInteraction) {
        expect(stateValues.has(state), `${directive.slug} stateInteraction references unknown ${state}`).toBe(true);
      }
    }
  });

  it('directive selectors are unique across the directive set', () => {
    const seen = new Set<string>();
    for (const entry of ACTION_ENTRIES) {
      if (entry.role !== 'directive') {
        continue;
      }
      const tokens = entry.selector.split(',').map((t) => t.trim());
      for (const token of tokens) {
        expect(seen.has(token), `duplicate selector token: ${token}`).toBe(false);
        seen.add(token);
      }
    }
  });

  it('looks up entries by slug, selector, class name, and state value', () => {
    expect(getActionEntry('handler')?.role).toBe('directive');
    expect(getActionEntry('action-context-store')?.role).toBe('store');
    expect(getActionEntry('not-a-thing')).toBeUndefined();

    const handlerBySelector = getActionDirectiveBySelector('[dbxActionHandler]');
    expect(handlerBySelector?.slug).toBe('handler');
    expect(getActionDirectiveBySelector('dbxActionHandler')?.slug).toBe('handler');
    expect(getActionDirectiveBySelector('[notReal]')).toBeUndefined();

    expect(getActionEntryByClassName('DbxActionHandlerDirective')?.slug).toBe('handler');
    expect(getActionEntryByClassName('actioncontextstore')?.slug).toBe('action-context-store');

    expect(getActionStateEntry('working')?.stateValue).toBe('WORKING');
    expect(getActionStateEntry('not-a-state')).toBeUndefined();
  });
});
