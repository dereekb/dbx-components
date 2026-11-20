import { describe, expect, it } from 'vitest';
import { addDays } from 'date-fns';
import { type DocumentDataWithIdAndKey, type NotificationRedirectEntry } from '@dereekb/firebase';
import {
  DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_ERROR_MESSAGE,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_EXPIRED_MESSAGE,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_NOT_OWNER_MESSAGE,
  type DbxFirebaseNotificationRedirectDecisionInput,
  dbxFirebaseNotificationRedirectDecision,
  dbxFirebaseNotificationRedirectReplaceSegueRef
} from './notification.redirect';

describe('dbxFirebaseNotificationRedirectDecision()', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  const jobsList = { ref: 'app.jobs' };
  const home = { ref: 'app.home' };
  const jobPage = { ref: 'app.jobs.job', refParams: { id: 'abc' } };
  const jobExpiredMessage = 'This notification has expired, but you can view the other available jobs.';

  const config: DbxFirebaseNotificationRedirectDecisionInput['config'] = {
    defaultFallback: home,
    prefixes: {
      j: { fallback: jobsList, expiredMessage: jobExpiredMessage }
    }
  };

  function entry(xat: Date): DocumentDataWithIdAndKey<NotificationRedirectEntry> {
    return { id: 'j-a8Kd02Lm', key: 'nre/j-a8Kd02Lm', cat: now, xat, m: 'job/abc' };
  }

  it('should open the target page of a live entry', () => {
    const result = dbxFirebaseNotificationRedirectDecision({ config, id: 'j-a8Kd02Lm', load: { type: 'found', entry: entry(addDays(now, 1)), targetSegueRef: jobPage }, now });
    expect(result).toEqual({ outcome: 'target', segueRef: jobPage });
  });

  it("should open the prefix's fallback without a message when a live entry has no target page", () => {
    const result = dbxFirebaseNotificationRedirectDecision({ config, id: 'j-a8Kd02Lm', load: { type: 'found', entry: entry(addDays(now, 1)) }, now });
    expect(result).toEqual({ outcome: 'no_target', segueRef: jobsList });
  });

  it("should open the prefix's fallback with its message when the entry has expired", () => {
    const result = dbxFirebaseNotificationRedirectDecision({ config, id: 'j-a8Kd02Lm', load: { type: 'found', entry: entry(now), targetSegueRef: jobPage }, now });
    expect(result).toEqual({ outcome: 'expired', segueRef: jobsList, message: jobExpiredMessage });
  });

  it("should open the prefix's fallback with its message when the entry no longer exists", () => {
    const result = dbxFirebaseNotificationRedirectDecision({ config, id: 'j-a8Kd02Lm', load: { type: 'missing' }, now });
    expect(result).toEqual({ outcome: 'expired', segueRef: jobsList, message: jobExpiredMessage });
  });

  it('should open the default fallback with the default message for an unknown prefix', () => {
    const result = dbxFirebaseNotificationRedirectDecision({ config, id: 'x-a8Kd02Lm', load: { type: 'missing' }, now });
    expect(result).toEqual({ outcome: 'expired', segueRef: home, message: DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_EXPIRED_MESSAGE });
  });

  it('should open the default fallback for an id that is not a short link id', () => {
    const result = dbxFirebaseNotificationRedirectDecision({ config, id: 'not a link', load: { type: 'missing' }, now });
    expect(result.segueRef).toBe(home);
  });

  it('should say the link belongs to a different account', () => {
    const result = dbxFirebaseNotificationRedirectDecision({ config, id: 'j-a8Kd02Lm', load: { type: 'not_owner' }, now });
    expect(result).toEqual({ outcome: 'not_owner', segueRef: jobsList, message: DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_NOT_OWNER_MESSAGE });
  });

  it('should say the link could not be opened on an error', () => {
    const result = dbxFirebaseNotificationRedirectDecision({ config, id: 'j-a8Kd02Lm', load: { type: 'error' }, now });
    expect(result).toEqual({ outcome: 'error', segueRef: jobsList, message: DEFAULT_DBX_FIREBASE_NOTIFICATION_REDIRECT_ERROR_MESSAGE });
  });

  it('should use the configured messages', () => {
    const configWithMessages = { ...config, expiredMessage: 'Gone.', notOwnerMessage: 'Not yours.' };
    expect(dbxFirebaseNotificationRedirectDecision({ config: configWithMessages, id: 'x-a8Kd02Lm', load: { type: 'missing' }, now }).message).toBe('Gone.');
    expect(dbxFirebaseNotificationRedirectDecision({ config: configWithMessages, id: 'j-a8Kd02Lm', load: { type: 'not_owner' }, now }).message).toBe('Not yours.');
  });
});

describe('dbxFirebaseNotificationRedirectReplaceSegueRef()', () => {
  it('should add the replace options of both routers', () => {
    expect(dbxFirebaseNotificationRedirectReplaceSegueRef({ ref: 'app.home' })).toEqual({ ref: 'app.home', refOptions: { location: 'replace', replaceUrl: true } });
  });

  it('should keep options already on the segue ref', () => {
    expect(dbxFirebaseNotificationRedirectReplaceSegueRef({ ref: 'app.home', refOptions: { location: true } }).refOptions).toEqual({ location: true, replaceUrl: true });
  });

  it('should accept a ref string', () => {
    expect(dbxFirebaseNotificationRedirectReplaceSegueRef('app.home').ref).toBe('app.home');
  });
});
