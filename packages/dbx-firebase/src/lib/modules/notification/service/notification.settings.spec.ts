import { describe, expect, it } from 'vitest';
import { firestoreModelIdentity, notificationBoxIdForModel, NotificationBoxRecipientFlag, NotificationDeliveryMethod, type NotificationTemplateTypeInfo } from '@dereekb/firebase';
import {
  DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_GLOBAL_MODE_SETTINGS_HINT,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_GLOBAL_MODE_SWITCH_OFF_HINT,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_HINT,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_MODE,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_NOT_RECIPIENT_MESSAGE,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_OVERRIDE_DESCRIPTION,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SWITCH_LABEL,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SWITCH_OFF_HINT,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_GROUP,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_HINT,
  DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_PER_BOX_MODE_HINT,
  dbxFirebaseNotificationSettingsCellStates,
  dbxFirebaseNotificationSettingsListItemValues,
  dbxFirebaseNotificationUserBoxConfigUpdateParams,
  dbxFirebaseNotificationUserGlobalConfigUpdateParams,
  dbxFirebaseNotificationUserSettingsNotificationBoxTarget,
  dbxFirebaseNotificationUserSettingsTexts,
  dbxFirebaseNotificationUserSettingsUpdateParams,
  dbxFirebaseNotificationUserTextPhoneNumberUpdateParams
} from './notification.settings';

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

describe('dbxFirebaseNotificationUserSettingsNotificationBoxTarget()', () => {
  const modelKey = 'gb/gb1';
  const notificationBoxId = notificationBoxIdForModel(modelKey);

  it('should resolve the box id from the model key', () => {
    expect(dbxFirebaseNotificationUserSettingsNotificationBoxTarget({ modelKey })).toEqual({ modelKey, notificationBoxId });
  });

  it('should resolve the model key from the box id', () => {
    expect(dbxFirebaseNotificationUserSettingsNotificationBoxTarget({ notificationBoxId })).toEqual({ modelKey, notificationBoxId });
  });

  it('should return undefined when neither is set', () => {
    expect(dbxFirebaseNotificationUserSettingsNotificationBoxTarget({})).toBeUndefined();
    expect(dbxFirebaseNotificationUserSettingsNotificationBoxTarget(undefined)).toBeUndefined();
  });
});

describe('dbxFirebaseNotificationUserSettingsTexts()', () => {
  it('should only return the hint without a box', () => {
    expect(dbxFirebaseNotificationUserSettingsTexts({})).toEqual({ hint: DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_HINT });
  });

  it('should say the global settings take priority on the global settings page in perBox mode', () => {
    expect(dbxFirebaseNotificationUserSettingsTexts({ mode: 'perBox' })).toEqual({ hint: DEFAULT_DBX_FIREBASE_NOTIFICATION_SETTINGS_PER_BOX_MODE_HINT });
  });

  describe('global mode', () => {
    it('should be the default mode', () => {
      expect(DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_MODE).toBe('global');
    });

    it('should return the generic box texts when the model has no name', () => {
      const texts = dbxFirebaseNotificationUserSettingsTexts({ notificationBox: { modelKey: 'gb/gb1' } });
      expect(texts.hint).toBe(DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_GLOBAL_MODE_SETTINGS_HINT);
      expect(texts.notRecipientMessage).toBe(DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_NOT_RECIPIENT_MESSAGE);
      expect(texts.boxSwitchLabel).toBe(DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SWITCH_LABEL);
      expect(texts.boxSwitchOffHint).toBe(DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_GLOBAL_MODE_SWITCH_OFF_HINT);
    });

    it("should name the box's model and say the settings apply to all of its kind", () => {
      const texts = dbxFirebaseNotificationUserSettingsTexts({ notificationBox: { modelKey: 'gb/gb1', modelName: 'guestbook' } });
      expect(texts.hint).toContain('These settings apply to all guestbooks.');
      expect(texts.boxSwitchLabel).toBe('Get notifications for this guestbook');
      expect(texts.boxSwitchOffHint).toBe("You won't get any notifications for this guestbook. The settings below still apply to your other guestbooks.");
      expect(texts.notRecipientMessage).toBe('You do not receive notifications for this guestbook.');
      expect(texts.inactiveRecipientMessage).toBe('Notifications for this guestbook are turned off for you.');
    });

    it('should not have override texts, since the cells are the global settings', () => {
      const texts = dbxFirebaseNotificationUserSettingsTexts({ notificationBox: { modelKey: 'gb/gb1', modelName: 'guestbook' }, hasToggle: true });
      expect(texts.overrideDescription).toBeUndefined();
      expect(texts.globalHint).toBeUndefined();
    });
  });

  describe('perBox mode', () => {
    it('should return the generic box texts when the model has no name', () => {
      const texts = dbxFirebaseNotificationUserSettingsTexts({ notificationBox: { modelKey: 'gb/gb1' }, mode: 'perBox' });
      expect(texts.hint).toBe(DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_HINT);
      expect(texts.notRecipientMessage).toBe(DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_NOT_RECIPIENT_MESSAGE);
      expect(texts.overrideDescription).toBe(DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_OVERRIDE_DESCRIPTION);
      expect(texts.boxSwitchOffHint).toBe(DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SWITCH_OFF_HINT);
      expect(texts.boxScopeLabel).toBe('Only here');
      expect(texts.globalScopeLabel).toBe('Everywhere');
    });

    it("should name the box's model and say the global settings take priority", () => {
      const texts = dbxFirebaseNotificationUserSettingsTexts({ notificationBox: { modelKey: 'gb/gb1', modelName: 'guestbook' }, mode: 'perBox' });
      expect(texts.hint).toContain('Grayed-out settings are set by your settings for all guestbooks, which take priority.');
      expect(texts.overrideDescription).toBe('Your setting for all guestbooks takes priority over this.');
      expect(texts.boxScopeLabel).toBe('This guestbook');
      expect(texts.globalScopeLabel).toBe('All guestbooks');
    });

    it('should point the override description at the toggle', () => {
      const texts = dbxFirebaseNotificationUserSettingsTexts({ notificationBox: { modelKey: 'gb/gb1', modelName: 'guestbook', modelPluralName: 'books' }, mode: 'perBox', hasToggle: true });
      expect(texts.overrideDescription).toBe('Your setting for all books takes priority over this. Switch to All books to change it.');
    });
  });
});

describe('dbxFirebaseNotificationSettingsCellStates() with a box config', () => {
  const items = dbxFirebaseNotificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, groups: ['guestbook'] });

  it('should read the values and default from the box config', () => {
    const states = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { c: { GBE_C: { st: true } } }, boxConfig: { c: { GBE_C: { se: true, sd: false } } } });
    expect(states['GBE_C'][EMAIL]?.value).toBe(true);
    expect(states['GBE_C'][NOTIFICATION_SUMMARY]?.value).toBeNull();
    expect(states['GBE_C'][NOTIFICATION_SUMMARY]?.defaultValue).toBe(false);
  });

  it('should override the cells a gc cell sets', () => {
    const states = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { c: { GBE_C: { st: true } } }, boxConfig: { c: {} }, overrideDescription: 'Overridden.' });
    expect(states['GBE_C'][TEXT]?.override).toEqual({ value: true, description: 'Overridden.' });
    expect(states['GBE_C'][EMAIL]?.override).toBeUndefined();
  });

  it('should override every cell of a type whose gc sets sd', () => {
    const states = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { c: { GBE_C: { sd: false } } }, boxConfig: { c: {} } });
    COLUMNS.forEach((method) => {
      expect(states['GBE_C'][method]?.override).toEqual({ value: false, description: DEFAULT_DBX_FIREBASE_NOTIFICATION_BOX_SETTINGS_OVERRIDE_DESCRIPTION });
    });
  });

  it('should keep a disabled method disabled and not overridden', () => {
    const states = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { dm: [TEXT] }, boxConfig: { c: {} } });
    expect(states['GBE_C'][TEXT]?.disabled).toBe(true);
    expect(states['GBE_C'][TEXT]?.override).toBeUndefined();
  });

  it('should not set override keys without a box config', () => {
    const states = dbxFirebaseNotificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { c: { GBE_C: { sd: false } } } });
    expect('override' in (states['GBE_C'][EMAIL] ?? {})).toBe(false);
  });
});

describe('dbxFirebaseNotificationUserBoxConfigUpdateParams()', () => {
  it('should only send the changed cells', () => {
    const result = dbxFirebaseNotificationUserBoxConfigUpdateParams({ notificationBoxId: 'nb', boxConfig: { c: { GBE_C: { se: true } } }, edits: { GBE_C: { [EMAIL]: true, [TEXT]: false } } });
    expect(result).toEqual({ nb: 'nb', configs: [{ type: 'GBE_C', st: false }] });
  });

  it('should send null to clear a cell', () => {
    const result = dbxFirebaseNotificationUserBoxConfigUpdateParams({ notificationBoxId: 'nb', boxConfig: { c: { GBE_C: { se: true } } }, edits: { GBE_C: { [EMAIL]: null } } });
    expect(result).toEqual({ nb: 'nb', configs: [{ type: 'GBE_C', se: null }] });
  });

  it('should return undefined when nothing changed', () => {
    expect(dbxFirebaseNotificationUserBoxConfigUpdateParams({ notificationBoxId: 'nb', boxConfig: { c: { GBE_C: { se: true } } }, edits: { GBE_C: { [EMAIL]: true } } })).toBeUndefined();
  });
});

describe('dbxFirebaseNotificationUserSettingsUpdateParams()', () => {
  it('should send the cell changes as gc without a box', () => {
    expect(dbxFirebaseNotificationUserSettingsUpdateParams({ gc: {}, edits: { E: { [TEXT]: true } } })).toEqual({ gc: { configs: [{ type: 'E', st: true }] } });
  });

  it('should send the cell changes as the box config with resync', () => {
    expect(dbxFirebaseNotificationUserSettingsUpdateParams({ gc: {}, notificationBoxId: 'nb', boxConfig: { c: {} }, edits: { GBE_C: { [TEXT]: true } } })).toEqual({ bc: [{ nb: 'nb', configs: [{ type: 'GBE_C', st: true }] }], resync: true });
  });

  it('should send the switch changes as gc with a box', () => {
    expect(dbxFirebaseNotificationUserSettingsUpdateParams({ gc: {}, notificationBoxId: 'nb', boxConfig: { c: {} }, edits: { GBE_C: { [TEXT]: true } }, disabledDeliveryMethods: [EMAIL] })).toEqual({ gc: { dm: [EMAIL] }, bc: [{ nb: 'nb', configs: [{ type: 'GBE_C', st: true }] }], resync: true });
  });

  it('should return undefined when nothing changed', () => {
    expect(dbxFirebaseNotificationUserSettingsUpdateParams({ gc: {}, notificationBoxId: 'nb', boxConfig: { c: {} }, edits: {}, disabledDeliveryMethods: [] })).toBeUndefined();
    expect(dbxFirebaseNotificationUserSettingsUpdateParams({ gc: {}, edits: {} })).toBeUndefined();
  });

  describe('box switch', () => {
    it('should opt out of the box with resync', () => {
      expect(dbxFirebaseNotificationUserSettingsUpdateParams({ gc: {}, notificationBoxEnabledChange: { notificationBoxId: 'nb', enabled: false } })).toEqual({ bc: [{ nb: 'nb', f: NotificationBoxRecipientFlag.OPT_OUT }], resync: true });
    });

    it('should opt back in to the box with ENABLED', () => {
      expect(dbxFirebaseNotificationUserSettingsUpdateParams({ gc: {}, notificationBoxEnabledChange: { notificationBoxId: 'nb', enabled: true } })).toEqual({ bc: [{ nb: 'nb', f: NotificationBoxRecipientFlag.ENABLED }], resync: true });
    });

    it('should send the box switch alongside cell changes to gc', () => {
      expect(dbxFirebaseNotificationUserSettingsUpdateParams({ gc: {}, edits: { GBE_C: { [TEXT]: true } }, notificationBoxEnabledChange: { notificationBoxId: 'nb', enabled: false } })).toEqual({
        gc: { configs: [{ type: 'GBE_C', st: true }] },
        bc: [{ nb: 'nb', f: NotificationBoxRecipientFlag.OPT_OUT }],
        resync: true
      });
    });

    it('should merge the box switch into the cell changes of the same box', () => {
      expect(dbxFirebaseNotificationUserSettingsUpdateParams({ gc: {}, notificationBoxId: 'nb', boxConfig: { c: {} }, edits: { GBE_C: { [TEXT]: true } }, notificationBoxEnabledChange: { notificationBoxId: 'nb', enabled: false } })).toEqual({
        bc: [{ nb: 'nb', configs: [{ type: 'GBE_C', st: true }], f: NotificationBoxRecipientFlag.OPT_OUT }],
        resync: true
      });
    });
  });
});
