import { describe, expect, it } from 'vitest';
import { NotificationDeliveryMethod } from './notification.config';
import { notificationMessageUnlistedDeliveryMethods } from './notification.message';

const { EMAIL, TEXT, NOTIFICATION_SUMMARY } = NotificationDeliveryMethod;
const CONTENT = { title: 'Title' };

describe('notificationMessageUnlistedDeliveryMethods()', () => {
  it('should return the delivery methods the message has content for that the template type does not list', () => {
    const result = notificationMessageUnlistedDeliveryMethods({ emailContent: CONTENT, textContent: CONTENT, notificationSummaryContent: {} }, { userConfigurableDeliveryMethods: [EMAIL] });
    expect(result).toEqual([TEXT, NOTIFICATION_SUMMARY]);
  });

  it('should return nothing when the template type lists every delivery method the message has content for', () => {
    const result = notificationMessageUnlistedDeliveryMethods({ emailContent: CONTENT }, { userConfigurableDeliveryMethods: [EMAIL] });
    expect(result).toEqual([]);
  });

  it('should compare against the default delivery methods when the template type lists none', () => {
    const result = notificationMessageUnlistedDeliveryMethods({ emailContent: CONTENT, textContent: CONTENT, notificationSummaryContent: {} }, {});
    expect(result).toEqual([]);
  });

  it('should compare against only the forced delivery methods when the template type forces methods and lists none', () => {
    const result = notificationMessageUnlistedDeliveryMethods({ emailContent: CONTENT, textContent: CONTENT, notificationSummaryContent: {} }, { forcedDeliveryMethods: [EMAIL] });
    expect(result).toEqual([TEXT, NOTIFICATION_SUMMARY]);
  });

  it('should count forced delivery methods as listed', () => {
    const result = notificationMessageUnlistedDeliveryMethods({ emailContent: CONTENT, notificationSummaryContent: {} }, { userConfigurableDeliveryMethods: [NOTIFICATION_SUMMARY], forcedDeliveryMethods: [EMAIL] });
    expect(result).toEqual([]);
  });

  it('should ignore delivery methods the message has no content for', () => {
    const result = notificationMessageUnlistedDeliveryMethods({}, { userConfigurableDeliveryMethods: [] });
    expect(result).toEqual([]);
  });
});
