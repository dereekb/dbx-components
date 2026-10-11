import { describe, expect, it } from 'vitest';
import { appNotificationTaskBotScriptConfigService, notificationTaskBotScriptConfigRecord } from './notification.taskbot.script';

describe('notificationTaskBotScriptConfigRecord()', () => {
  it('should index the configs by script type', () => {
    const record = notificationTaskBotScriptConfigRecord([{ scriptType: 'a' }, { scriptType: 'b', historyLimit: 3 }]);
    expect(Object.keys(record)).toEqual(['a', 'b']);
    expect(record['b'].historyLimit).toBe(3);
  });

  it('should throw on a duplicate script type', () => {
    expect(() => notificationTaskBotScriptConfigRecord([{ scriptType: 'a' }, { scriptType: 'a' }])).toThrow();
  });

  it('should throw when allowOwnerOptOut is set without a group', () => {
    expect(() => notificationTaskBotScriptConfigRecord([{ scriptType: 'a', allowOwnerOptOut: true }])).toThrow();
  });

  it('should throw on an invalid group key', () => {
    expect(() => notificationTaskBotScriptConfigRecord([{ scriptType: 'a', group: { key: 'Bad Key', name: 'Bad' } }])).toThrow();
  });

  it('should throw on conflicting definitions of one group key', () => {
    expect(() =>
      notificationTaskBotScriptConfigRecord([
        { scriptType: 'a', group: { key: 'g', name: 'G' } },
        { scriptType: 'b', group: { key: 'g', name: 'Other' } }
      ])
    ).toThrow();
  });

  it('should allow equal definitions of one group key', () => {
    expect(() =>
      notificationTaskBotScriptConfigRecord([
        { scriptType: 'a', group: { key: 'g', name: 'G' } },
        { scriptType: 'b', group: { key: 'g', name: 'G' } }
      ])
    ).not.toThrow();
  });
});

describe('appNotificationTaskBotScriptConfigService()', () => {
  const service = appNotificationTaskBotScriptConfigService(notificationTaskBotScriptConfigRecord([{ scriptType: 'a', historyLimit: 5 }]));

  it('should return the registered config', () => {
    expect(service.configForScriptType('a').historyLimit).toBe(5);
    expect(service.registeredConfigForScriptType('a')).toBeDefined();
  });

  it('should fall back to a bare config for an unregistered script type', () => {
    expect(service.configForScriptType('unknown')).toEqual({ scriptType: 'unknown' });
    expect(service.registeredConfigForScriptType('unknown')).toBeUndefined();
  });

  it('should list the known script types', () => {
    expect(service.getAllKnownScriptTypes()).toEqual(['a']);
    expect(service.getAllKnownScriptConfigs()).toHaveLength(1);
  });

  it('should default to an empty registry', () => {
    expect(appNotificationTaskBotScriptConfigService().getAllKnownScriptTypes()).toEqual([]);
  });
});

describe('appNotificationTaskBotScriptConfigService() opt-out lookups', () => {
  const group = { key: 'reminders', name: 'Reminders' };
  const otherGroup = { key: 'other', name: 'Other' };
  const service = appNotificationTaskBotScriptConfigService(notificationTaskBotScriptConfigRecord([{ scriptType: 'optional', group, allowOwnerOptOut: true }, { scriptType: 'required', group }, { scriptType: 'required_other', group: otherGroup }, { scriptType: 'ungrouped' }]));

  it('should return the group key of a script that allows owner opt-out', () => {
    expect(service.optOutGroupKeyForScriptType('optional')).toBe('reminders');
  });

  it('should return undefined for scripts that do not allow owner opt-out', () => {
    expect(service.optOutGroupKeyForScriptType('required')).toBeUndefined();
    expect(service.optOutGroupKeyForScriptType('ungrouped')).toBeUndefined();
    expect(service.optOutGroupKeyForScriptType('unknown')).toBeUndefined();
  });

  it('should only return groups that have an opt-out-able script', () => {
    expect(service.optOutGroupForKey('reminders')).toBe(group);
    expect(service.optOutGroupForKey('other')).toBeUndefined();
  });
});
