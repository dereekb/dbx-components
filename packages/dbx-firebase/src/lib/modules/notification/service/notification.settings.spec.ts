import { describe, expect, it } from 'vitest';
import { firestoreModelIdentity, NotificationDeliveryMethod, type NotificationTemplateTypeInfo } from '@dereekb/firebase';
import { DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_GROUP, dbxFirebaseNotificationSettingsCellStates, dbxFirebaseNotificationSettingsListItemValues, dbxFirebaseNotificationUserGlobalConfigUpdateParams, dbxFirebaseNotificationUserTextPhoneNumberUpdateParams } from './notification.settings';

const { EMAIL, TEXT, NOTIFICATION_SUMMARY } = NotificationDeliveryMethod;
const COLUMNS = [EMAIL, TEXT, NOTIFICATION_SUMMARY];

const profileIdentity = firestoreModelIdentity('profile', 'p');
const guestbookIdentity = firestoreModelIdentity('guestbook', 'gb');
const profileGroup = { key: 'profile', name: 'Your Profile', sortOrder: 0 };
const guestbookGroup = { key: 'guestbook', name: 'Guestbooks', sortOrder: 1 };

const typeInfos: NotificationTemplateTypeInfo[] = [
  { type: 'E', name: 'Example', description: 'Example notification.', notificationModelIdentity: profileIdentity, group: profileGroup },
  { type: 'CAL_INV', name: 'Calendar Invite', description: 'Calendar invite.', notificationModelIdentity: profileIdentity, group: profileGroup, userConfigurableDeliveryMethods: [EMAIL] },
  { type: 'TEST', name: 'Test', description: 'Test.', notificationModelIdentity: profileIdentity, group: profileGroup, hideFromUserSettings: true },
  { type: 'GBE_C', name: 'Guestbook Entry Created', description: 'Created.', notificationModelIdentity: guestbookIdentity, group: guestbookGroup, sortOrder: 1 },
  { type: 'GBE_L', name: 'Guestbook Entry Liked', description: 'Liked.', notificationModelIdentity: guestbookIdentity, group: guestbookGroup, sortOrder: 0, onlySendToExplicitlyEnabledRecipients: true },
  { type: 'X', name: 'Ungrouped', description: 'Ungrouped.', notificationModelIdentity: guestbookIdentity }
];

describe('dbxFirebaseNotificationSettingsListItemValues()', () => {
  const items = dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS });

  it('should drop types hidden from user settings', () => {
    expect(items.find((x) => x.type === 'TEST')).toBeUndefined();
  });

  it('should drop types hidden by the config', () => {
    const result = dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, hiddenTemplateTypes: ['E'] });
    expect(result.find((x) => x.type === 'E')).toBeUndefined();
  });

  it('should intersect each type with the columns', () => {
    expect(items.find((x) => x.type === 'CAL_INV')?.deliveryMethods).toEqual([EMAIL]);
    expect(items.find((x) => x.type === 'E')?.deliveryMethods).toEqual(COLUMNS);
  });

  it('should drop types with no configurable column', () => {
    const result = dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: [TEXT] });
    expect(result.find((x) => x.type === 'CAL_INV')).toBeUndefined();
  });

  it('should sort by sortOrder then name', () => {
    const guestbookTypes = items.filter((x) => x.group.key === 'guestbook').map((x) => x.type);
    expect(guestbookTypes).toEqual(['GBE_L', 'GBE_C']);
  });

  it('should put ungrouped types in the default group', () => {
    expect(items.find((x) => x.type === 'X')?.group).toBe(DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_GROUP);
  });

  it('should group ungrouped types by notification model when configured', () => {
    const result = dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, fallbackGroupBy: 'notificationModel' });
    expect(result.find((x) => x.type === 'X')?.group.key).toBe('guestbook');
  });

  describe('selecting groups and types', () => {
    it('should only show the selected groups', () => {
      const result = dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, groups: ['guestbook'] });
      expect(result.map((x) => x.type)).toEqual(['GBE_L', 'GBE_C']);
    });

    it('should match the fallback group of an ungrouped type', () => {
      const result = dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, groups: [DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_GROUP.key] });
      expect(result.map((x) => x.type)).toEqual(['X']);
    });

    it('should only show the selected types', () => {
      const result = dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, templateTypes: ['E', 'GBE_C'] });
      expect(result.map((x) => x.type).sort()).toEqual(['E', 'GBE_C']);
    });

    it('should show the selected groups and the selected types together', () => {
      const result = dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, groups: ['guestbook'], templateTypes: ['E'] });
      expect(result.map((x) => x.type).sort()).toEqual(['E', 'GBE_C', 'GBE_L']);
    });

    it('should still drop hidden types', () => {
      const result = dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, groups: ['profile'], hiddenTemplateTypes: ['E'] });
      expect(result.map((x) => x.type)).toEqual(['CAL_INV']);
    });

    it('should show nothing for an empty selection', () => {
      expect(dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, groups: [] })).toEqual([]);
    });
  });
});

describe('dbxFirebaseNotificationSettingsCellStates()', () => {
  const items = dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS });

  it('should default email/in-app on and text off', () => {
    const states = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS });
    expect(states['E'][EMAIL]?.defaultValue).toBe(true);
    expect(states['E'][NOTIFICATION_SUMMARY]?.defaultValue).toBe(true);
    expect(states['E'][TEXT]?.defaultValue).toBe(false);
  });

  it('should default email off for explicit opt-in types', () => {
    const states = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS });
    expect(states['GBE_L'][EMAIL]?.defaultValue).toBe(false);
  });

  it('should use the row sd as the default', () => {
    const states = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { c: { E: { sd: false } } } });
    expect(states['E'][EMAIL]?.defaultValue).toBe(false);
  });

  it('should mark methods the type cannot configure unavailable', () => {
    const states = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS });
    expect(states['CAL_INV'][EMAIL]?.available).toBe(true);
    expect(states['CAL_INV'][TEXT]?.available).toBe(false);
  });

  it('should read saved values and overlay pending edits', () => {
    const states = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { c: { E: { st: true, se: false } } }, edits: { E: { [TEXT]: null, [EMAIL]: false } } });
    expect(states['E'][TEXT]?.value).toBeNull();
    expect(states['E'][TEXT]?.modified).toBe(true);
    expect(states['E'][EMAIL]?.value).toBe(false);
    expect(states['E'][EMAIL]?.modified).toBe(false);
  });

  it('should disable cells for disabled methods, preferring the pending list', () => {
    const saved = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { dm: [TEXT] } });
    expect(saved['E'][TEXT]?.disabled).toBe(true);

    const pending = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { dm: [TEXT] }, disabledDeliveryMethods: [] });
    expect(pending['E'][TEXT]?.disabled).toBe(false);
  });
});

describe('dbxFirebaseNotificationUserGlobalConfigUpdateParams()', () => {
  it('should return undefined when nothing changed', () => {
    expect(dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc: { c: { E: { st: true } } } })).toBeUndefined();
    expect(dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc: { c: { E: { st: true } } }, edits: { E: { [TEXT]: true } } })).toBeUndefined();
    expect(dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc: { dm: [TEXT] }, disabledDeliveryMethods: [TEXT] })).toBeUndefined();
  });

  it('should send only the changed cells', () => {
    const result = dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc: { c: { E: { se: true } } }, edits: { E: { [EMAIL]: true, [TEXT]: true } } });
    expect(result).toEqual({ configs: [{ type: 'E', st: true }] });
  });

  it('should send null to clear a cell', () => {
    const result = dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc: { c: { E: { se: false, st: true } } }, edits: { E: { [TEXT]: null } } });
    expect(result).toEqual({ configs: [{ type: 'E', st: null }] });
  });

  it('should only send the cleared cell of a type left with no set cells', () => {
    const result = dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc: { c: { E: { st: true } } }, edits: { E: { [TEXT]: null } } });
    expect(result).toEqual({ configs: [{ type: 'E', st: null }] });
  });

  it('should add a new type', () => {
    const result = dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc: {}, edits: { GBE_C: { [NOTIFICATION_SUMMARY]: false } } });
    expect(result).toEqual({ configs: [{ type: 'GBE_C', sn: false }] });
  });

  it('should send the full disabled methods list when it changed', () => {
    expect(dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc: {}, disabledDeliveryMethods: [TEXT] })).toEqual({ dm: [TEXT] });
    expect(dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc: { dm: [TEXT] }, disabledDeliveryMethods: [] })).toEqual({ dm: null });
  });

  it('should combine cell and disabled method changes', () => {
    const result = dbxFirebaseNotificationUserGlobalConfigUpdateParams({ gc: {}, edits: { E: { [EMAIL]: false } }, disabledDeliveryMethods: [TEXT] });
    expect(result).toEqual({ configs: [{ type: 'E', se: false }], dm: [TEXT] });
  });
});

describe('dbxFirebaseNotificationUserTextPhoneNumberUpdateParams()', () => {
  const { EMAIL, TEXT } = NotificationDeliveryMethod;
  const phoneNumber = '+15555550100';

  it('should save the phone number', () => {
    expect(dbxFirebaseNotificationUserTextPhoneNumberUpdateParams({ phoneNumber })).toEqual({ t: phoneNumber });
  });

  it('should turn texts on', () => {
    expect(dbxFirebaseNotificationUserTextPhoneNumberUpdateParams({ gc: { dm: [TEXT, EMAIL] }, phoneNumber })).toEqual({ t: phoneNumber, dm: [EMAIL] });
    expect(dbxFirebaseNotificationUserTextPhoneNumberUpdateParams({ gc: { dm: [TEXT] }, phoneNumber })).toEqual({ t: phoneNumber, dm: null });
  });

  it('should leave the other disabled methods alone', () => {
    expect(dbxFirebaseNotificationUserTextPhoneNumberUpdateParams({ gc: { dm: [EMAIL] }, phoneNumber })).toEqual({ t: phoneNumber });
  });
});
