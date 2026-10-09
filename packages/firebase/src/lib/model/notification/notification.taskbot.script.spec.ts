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
