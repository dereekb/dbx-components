import { describe, expect, it } from 'vitest';
import { firestoreModelIdentity } from '../../common/firestore/collection/collection';
import { NotificationDeliveryMethod } from './notification.config';
import { type NotificationTemplateTypeInfo } from './notification.details';
import { compareNotificationTemplateTypeInfoGroups, DEFAULT_NOTIFICATION_SETTINGS_BOX_OVERRIDE_DESCRIPTION, DEFAULT_NOTIFICATION_SETTINGS_GROUP, notificationSettingsCellStates, notificationSettingsListItemValues } from './notification.settings';

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

const forcedTypeInfos: NotificationTemplateTypeInfo[] = [
  { type: 'F', name: 'Forced', description: 'Forced.', notificationModelIdentity: profileIdentity, group: profileGroup, forcedDeliveryMethods: [EMAIL] },
  { type: 'F_ONLY', name: 'Forced Only', description: 'Forced only.', notificationModelIdentity: profileIdentity, group: profileGroup, userConfigurableDeliveryMethods: [EMAIL], forcedDeliveryMethods: [EMAIL] }
];

describe('notificationSettingsListItemValues()', () => {
  const items = notificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS });

  it('should drop types hidden from user settings', () => {
    expect(items.find((x) => x.type === 'TEST')).toBeUndefined();
  });

  it('should drop types hidden by the config', () => {
    const result = notificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, hiddenTemplateTypes: ['E'] });
    expect(result.find((x) => x.type === 'E')).toBeUndefined();
  });

  it('should intersect each type with the columns', () => {
    expect(items.find((x) => x.type === 'CAL_INV')?.deliveryMethods).toEqual([EMAIL]);
    expect(items.find((x) => x.type === 'E')?.deliveryMethods).toEqual(COLUMNS);
  });

  it('should drop types with no configurable column', () => {
    const result = notificationSettingsListItemValues({ typeInfos, deliveryMethods: [TEXT] });
    expect(result.find((x) => x.type === 'CAL_INV')).toBeUndefined();
  });

  it('should sort by sortOrder then name', () => {
    const guestbookTypes = items.filter((x) => x.group.key === 'guestbook').map((x) => x.type);
    expect(guestbookTypes).toEqual(['GBE_L', 'GBE_C']);
  });

  it('should put ungrouped types in the default group', () => {
    expect(items.find((x) => x.type === 'X')?.group).toBe(DEFAULT_NOTIFICATION_SETTINGS_GROUP);
  });

  it('should group ungrouped types by notification model when configured', () => {
    const result = notificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, fallbackGroupBy: 'notificationModel' });
    expect(result.find((x) => x.type === 'X')?.group.key).toBe('guestbook');
  });

  describe('selecting groups and types', () => {
    it('should only show the selected groups', () => {
      const result = notificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, groups: ['guestbook'] });
      expect(result.map((x) => x.type)).toEqual(['GBE_L', 'GBE_C']);
    });

    it('should match the fallback group of an ungrouped type', () => {
      const result = notificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, groups: [DEFAULT_NOTIFICATION_SETTINGS_GROUP.key] });
      expect(result.map((x) => x.type)).toEqual(['X']);
    });

    it('should only show the selected types', () => {
      const result = notificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, templateTypes: ['E', 'GBE_C'] });
      expect(result.map((x) => x.type).sort()).toEqual(['E', 'GBE_C']);
    });

    it('should show the selected groups and the selected types together', () => {
      const result = notificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, groups: ['guestbook'], templateTypes: ['E'] });
      expect(result.map((x) => x.type).sort()).toEqual(['E', 'GBE_C', 'GBE_L']);
    });

    it('should still drop hidden types', () => {
      const result = notificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, groups: ['profile'], hiddenTemplateTypes: ['E'] });
      expect(result.map((x) => x.type)).toEqual(['CAL_INV']);
    });

    it('should show nothing for an empty selection', () => {
      expect(notificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS, groups: [] })).toEqual([]);
    });
  });
});

describe('notificationSettingsListItemValues() forced delivery methods', () => {
  const items = notificationSettingsListItemValues({ typeInfos: forcedTypeInfos, deliveryMethods: COLUMNS });

  it('should leave forced methods out of the configurable delivery methods', () => {
    const item = items.find((x) => x.type === 'F');
    expect(item?.deliveryMethods).toEqual([TEXT, NOTIFICATION_SUMMARY]);
    expect(item?.forcedDeliveryMethods).toEqual([EMAIL]);
  });

  it('should keep a row whose only shown column is forced', () => {
    const item = items.find((x) => x.type === 'F_ONLY');
    expect(item?.deliveryMethods).toEqual([]);
    expect(item?.forcedDeliveryMethods).toEqual([EMAIL]);
  });

  it('should set an empty forced list for types without forced methods', () => {
    const [item] = notificationSettingsListItemValues({ typeInfos: [typeInfos[0]], deliveryMethods: COLUMNS });
    expect(item.forcedDeliveryMethods).toEqual([]);
  });
});

describe('notificationSettingsCellStates()', () => {
  const items = notificationSettingsListItemValues({ typeInfos, deliveryMethods: COLUMNS });

  it('should default email/in-app on and text off', () => {
    const states = notificationSettingsCellStates({ items, deliveryMethods: COLUMNS });
    expect(states['E'][EMAIL]?.defaultValue).toBe(true);
    expect(states['E'][NOTIFICATION_SUMMARY]?.defaultValue).toBe(true);
    expect(states['E'][TEXT]?.defaultValue).toBe(false);
  });

  it('should default email off for explicit opt-in types', () => {
    const states = notificationSettingsCellStates({ items, deliveryMethods: COLUMNS });
    expect(states['GBE_L'][EMAIL]?.defaultValue).toBe(false);
  });

  it('should use the row sd as the default', () => {
    const states = notificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { c: { E: { sd: false } } } });
    expect(states['E'][EMAIL]?.defaultValue).toBe(false);
  });

  it('should mark methods the type cannot configure unavailable', () => {
    const states = notificationSettingsCellStates({ items, deliveryMethods: COLUMNS });
    expect(states['CAL_INV'][EMAIL]?.available).toBe(true);
    expect(states['CAL_INV'][TEXT]?.available).toBe(false);
  });

  it('should read saved values and overlay pending edits', () => {
    const states = notificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { c: { E: { st: true, se: false } } }, edits: { E: { [TEXT]: null, [EMAIL]: false } } });
    expect(states['E'][TEXT]?.value).toBeNull();
    expect(states['E'][TEXT]?.modified).toBe(true);
    expect(states['E'][EMAIL]?.value).toBe(false);
    expect(states['E'][EMAIL]?.modified).toBe(false);
  });

  it('should disable cells for disabled methods, preferring the pending list', () => {
    const saved = notificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { dm: [TEXT] } });
    expect(saved['E'][TEXT]?.disabled).toBe(true);

    const pending = notificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { dm: [TEXT] }, disabledDeliveryMethods: [] });
    expect(pending['E'][TEXT]?.disabled).toBe(false);
  });

  it('should read box cells from the box config and mark the cells gc decides as overridden', () => {
    const states = notificationSettingsCellStates({ items, deliveryMethods: COLUMNS, gc: { c: { E: { se: false } } }, boxConfig: { c: { E: { st: true } } } });
    expect(states['E'][TEXT]?.value).toBe(true);
    expect(states['E'][TEXT]?.override).toBeUndefined();
    expect(states['E'][EMAIL]?.value).toBeNull();
    expect(states['E'][EMAIL]?.override).toEqual({ value: false, description: DEFAULT_NOTIFICATION_SETTINGS_BOX_OVERRIDE_DESCRIPTION });
  });
  describe('forced delivery methods', () => {
    const forcedItems = notificationSettingsListItemValues({ typeInfos: forcedTypeInfos, deliveryMethods: COLUMNS });

    it('should show a forced cell that is always on and cannot be configured', () => {
      const states = notificationSettingsCellStates({ items: forcedItems, deliveryMethods: COLUMNS, gc: { c: { F: { sd: false, se: false } } }, edits: { F: { [EMAIL]: false } } });
      expect(states['F'][EMAIL]).toEqual({ method: EMAIL, available: false, forced: true, value: null, defaultValue: true, disabled: false, modified: false });
      expect(states['F'][NOTIFICATION_SUMMARY]?.forced).toBeUndefined();
      expect(states['F'][NOTIFICATION_SUMMARY]?.defaultValue).toBe(false);
    });

    it('should disable a forced cell when its method is turned off account-wide', () => {
      const states = notificationSettingsCellStates({ items: forcedItems, deliveryMethods: COLUMNS, gc: { dm: [EMAIL] } });
      expect(states['F'][EMAIL]?.forced).toBe(true);
      expect(states['F'][EMAIL]?.disabled).toBe(true);
    });

    it('should not override a forced cell in the box view', () => {
      const states = notificationSettingsCellStates({ items: forcedItems, deliveryMethods: COLUMNS, gc: { c: { F: { se: false } } }, boxConfig: { c: { F: { se: false } } } });
      expect(states['F'][EMAIL]?.override).toBeUndefined();
      expect(states['F'][EMAIL]?.value).toBeNull();
      expect(states['F'][EMAIL]?.defaultValue).toBe(true);
    });
  });
});

describe('compareNotificationTemplateTypeInfoGroups()', () => {
  it('should sort by sortOrder, with unset last, then name', () => {
    const sorted = [{ name: 'B' }, { name: 'C', sortOrder: 0 }, { name: 'A' }].sort(compareNotificationTemplateTypeInfoGroups);
    expect(sorted.map((x) => x.name)).toEqual(['C', 'A', 'B']);
  });
});
