import { describe, expect, it } from 'vitest';
import { uniqueNotificationTaskKey } from './notification.create';

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
