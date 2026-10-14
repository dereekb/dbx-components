import { describe, expect, it } from 'vitest';
import { uniqueNotificationTaskKey } from '../notification/notification.create';
import { type FormSpaceDocument } from './formspace';
import { formSpaceSubmissionNotificationTaskKey, formSpaceSubmissionNotificationTaskTemplate } from './formspace.task';

describe('formSpaceSubmissionNotificationTaskKey()', () => {
  it('should return the key of the first attempt task', () => {
    expect(formSpaceSubmissionNotificationTaskKey({ formSpaceId: 'abc' })).toBe('nb/not_not/nbn/abc_FSPS');
  });

  it('should return the key of a later attempt task', () => {
    expect(formSpaceSubmissionNotificationTaskKey({ formSpaceId: 'abc', reopenCount: 2 })).toBe('nb/not_not/nbn/abc_FSPS_r2');
  });

  it('should be the unique task location of the submission template', () => {
    const formSpaceDocument = { id: 'abc', key: 'fsp/abc' } as unknown as FormSpaceDocument;
    const template = formSpaceSubmissionNotificationTaskTemplate({ formSpaceDocument, reopenCount: 2 });

    expect(formSpaceSubmissionNotificationTaskKey({ formSpaceId: 'abc', reopenCount: 2 })).toBe(uniqueNotificationTaskKey({ notificationModel: template.notificationModel, uniqueId: template.unique as string }));
  });
});
