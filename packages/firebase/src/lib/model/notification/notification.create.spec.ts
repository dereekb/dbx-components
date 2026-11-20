import { describe, expect, it } from 'vitest';
import { createNotificationTemplate, uniqueNotificationTaskKey } from './notification.create';

describe('uniqueNotificationTaskKey()', () => {
  it('should return the key of the unique task in the notification model box', () => {
    expect(uniqueNotificationTaskKey({ notificationModel: 'profile/abc', uniqueId: 'abc_T' })).toBe('nb/profile_abc/nbn/abc_T');
  });

  it('should default to the notification task box when the notification model is omitted', () => {
    expect(uniqueNotificationTaskKey({ uniqueId: 'abc_T' })).toBe('nb/not_not/nbn/abc_T');
  });

  it('should default to the notification task box when the notification model is null', () => {
    expect(uniqueNotificationTaskKey({ notificationModel: null, uniqueId: 'abc_T' })).toBe('nb/not_not/nbn/abc_T');
  });
});

describe('createNotificationTemplate()', () => {
  it('should pass through the redirect entry template', () => {
    const template = createNotificationTemplate({ notificationModel: 'gb/abc', type: 'T', targetModel: 'gb/abc', redirectEntry: { prefix: 'gb', o: 'pr/abc' } });
    expect(template.redirectEntry).toEqual({ prefix: 'gb', o: 'pr/abc' });
    expect(template.n.m).toBe('gb/abc');
  });

  it('should pass through an existing short link id on the item', () => {
    const template = createNotificationTemplate({ notificationModel: 'gb/abc', type: 'T', l: 'gb-a8Kd02Lm' });
    expect(template.n.l).toBe('gb-a8Kd02Lm');
    expect(template.redirectEntry).toBeUndefined();
  });
});
