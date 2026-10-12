import { describe, it, expect } from 'vitest';
import { type } from 'arktype';
import { updateNotificationTaskBotEntryParamsType } from './notification.api';
import { notificationTaskBotKeyForModel } from './notification.taskbot';

describe('updateNotificationTaskBotEntryParamsType', () => {
  const baseParams = {
    key: notificationTaskBotKeyForModel('pr/abc'),
    i: 'ping'
  };

  it('should accept an updateData patch', () => {
    const result = updateNotificationTaskBotEntryParamsType({ ...baseParams, updateData: { c: null, iv: 5 } });
    expect(result instanceof type.errors).toBe(false);
    expect((result as { updateData: unknown }).updateData).toEqual({ c: null, iv: 5 });
  });

  it('should accept a null updateData', () => {
    const result = updateNotificationTaskBotEntryParamsType({ ...baseParams, updateData: null });
    expect(result instanceof type.errors).toBe(false);
  });

  it('should refuse an array updateData', () => {
    const result = updateNotificationTaskBotEntryParamsType({ ...baseParams, updateData: [1] });
    expect(result instanceof type.errors).toBe(true);
  });

  it('should refuse a string updateData', () => {
    const result = updateNotificationTaskBotEntryParamsType({ ...baseParams, updateData: 'x' });
    expect(result instanceof type.errors).toBe(true);
  });
});
