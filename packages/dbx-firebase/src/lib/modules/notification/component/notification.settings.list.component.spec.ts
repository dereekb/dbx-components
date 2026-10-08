import { Component, computed, Injectable, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatTooltip } from '@angular/material/tooltip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DbxListTitleGroupDirective, DbxRouterWebProviderConfig } from '@dereekb/dbx-web';
import { firestoreModelIdentity, NotificationDeliveryMethod, type NotificationTemplateType, type NotificationTemplateTypeInfo, type NotificationUserDefaultNotificationBoxRecipientConfig, type NotificationUserNotificationBoxRecipientConfig } from '@dereekb/firebase';
import { successResult } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { type DbxFirebaseNotificationSettingsCellEdits, dbxFirebaseNotificationSettingsCellStates, dbxFirebaseNotificationSettingsListItemValues } from '../service/notification.settings';
import { DbxFirebaseNotificationSettingsListDelegate, dbxFirebaseNotificationSettingsListGroupDelegate } from './notification.settings.list';
import { DbxFirebaseNotificationSettingsListComponent } from './notification.settings.list.component';
import { DbxFirebaseNotificationSettingsListGroupHeaderComponent } from './notification.settings.list.group.component';

const { EMAIL, TEXT, NOTIFICATION_SUMMARY } = NotificationDeliveryMethod;
const COLUMNS = [EMAIL, TEXT, NOTIFICATION_SUMMARY];

const profileIdentity = firestoreModelIdentity('profile', 'p');
const guestbookIdentity = firestoreModelIdentity('guestbook', 'gb');

const TYPE_INFOS: NotificationTemplateTypeInfo[] = [
  { type: 'E', name: 'Example', description: 'Example notification.', notificationModelIdentity: profileIdentity, group: { key: 'profile', name: 'Your Profile', sortOrder: 0 } },
  { type: 'CAL_INV', name: 'Calendar Invite', description: 'Calendar invite.', notificationModelIdentity: profileIdentity, group: { key: 'profile', name: 'Your Profile', sortOrder: 0 }, userConfigurableDeliveryMethods: [EMAIL] },
  { type: 'FRC', name: 'Forced Notice', description: 'Always emailed.', notificationModelIdentity: profileIdentity, group: { key: 'profile', name: 'Your Profile', sortOrder: 0 }, forcedDeliveryMethods: [EMAIL] },
  { type: 'GBE_C', name: 'Guestbook Entry Created', description: 'Created.', notificationModelIdentity: guestbookIdentity, group: { key: 'guestbook', name: 'Guestbooks', sortOrder: 1 } }
];

const ITEMS = dbxFirebaseNotificationSettingsListItemValues({ typeInfos: TYPE_INFOS, deliveryMethods: COLUMNS });

/**
 * Fake delegate that keeps its pending edits in a signal, like the settings store does.
 */
@Injectable()
class TestNotificationSettingsListDelegate extends DbxFirebaseNotificationSettingsListDelegate {
  readonly edits = signal<DbxFirebaseNotificationSettingsCellEdits>({});
  readonly disabledDeliveryMethods = signal<NotificationDeliveryMethod[]>([]);
  readonly gc = signal<Maybe<Partial<Pick<NotificationUserDefaultNotificationBoxRecipientConfig, 'c' | 'dm'>>>>(undefined);
  readonly boxConfig = signal<Maybe<Partial<Pick<NotificationUserNotificationBoxRecipientConfig, 'c'>>>>(undefined);

  readonly columnsSignal = signal(COLUMNS);
  readonly disabledSignal = signal(false);
  readonly cellStatesSignal = computed(() => dbxFirebaseNotificationSettingsCellStates({ items: ITEMS, deliveryMethods: COLUMNS, gc: this.gc(), boxConfig: this.boxConfig(), edits: this.edits(), disabledDeliveryMethods: this.disabledDeliveryMethods() }));

  setCellValue(type: NotificationTemplateType, method: NotificationDeliveryMethod, value: Maybe<boolean>): void {
    const edits = this.edits();
    this.edits.set({ ...edits, [type]: { ...edits[type], [method]: value ?? null } });
  }
}

@Component({
  template: `
    <dbx-firebase-notification-settings-list [state]="state" [dbxListTitleGroup]="groupDelegate"></dbx-firebase-notification-settings-list>
  `,
  imports: [DbxFirebaseNotificationSettingsListComponent, DbxListTitleGroupDirective],
  providers: [{ provide: DbxFirebaseNotificationSettingsListDelegate, useClass: TestNotificationSettingsListDelegate }]
})
class TestDbxFirebaseNotificationSettingsListComponent {
  readonly state = successResult(ITEMS);
  readonly groupDelegate = dbxFirebaseNotificationSettingsListGroupDelegate(DbxFirebaseNotificationSettingsListGroupHeaderComponent);
}

describe('DbxFirebaseNotificationSettingsListComponent', () => {
  let fixture: ComponentFixture<TestDbxFirebaseNotificationSettingsListComponent>;
  let delegate: TestNotificationSettingsListDelegate;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function rows() {
    return fixture.debugElement.queryAll(By.css('dbx-firebase-notification-settings-list-view-item'));
  }

  function rowFor(name: string) {
    return rows().find((x) => (x.nativeElement as HTMLElement).textContent?.includes(name));
  }

  function cellButtons(name: string): HTMLButtonElement[] {
    return (rowFor(name)?.queryAll(By.css('button')) ?? []).map((x) => x.nativeElement as HTMLButtonElement);
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: LiveAnnouncer, useValue: { announce: () => Promise.resolve() } },
        { provide: DbxRouterWebProviderConfig, useValue: { anchorSegueRefComponent: {} } }
      ]
    });

    fixture = TestBed.createComponent(TestDbxFirebaseNotificationSettingsListComponent);
    delegate = fixture.debugElement.injector.get(DbxFirebaseNotificationSettingsListDelegate) as TestNotificationSettingsListDelegate;

    await detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render a group header per group in sort order', () => {
    const headers = fixture.debugElement.queryAll(By.css('dbx-firebase-notification-settings-list-group-header')).map((x) => (x.nativeElement as HTMLElement).textContent ?? '');

    expect(headers.length).toBe(2);
    expect(headers[0]).toContain('Your Profile');
    expect(headers[1]).toContain('Guestbooks');
  });

  it('should label each column in the group header', () => {
    const header = fixture.debugElement.query(By.css('dbx-firebase-notification-settings-list-group-header'));
    expect(header.queryAll(By.css('.dbx-firebase-notification-settings-column-header')).length).toBe(COLUMNS.length);
  });

  it('should render one row per template type', () => {
    expect(rows().length).toBe(ITEMS.length);
  });

  it('should render a button per available cell and a placeholder per unavailable cell', () => {
    expect(cellButtons('Example').length).toBe(3);
    expect(cellButtons('Calendar Invite').length).toBe(1);
    expect(rowFor('Calendar Invite')?.queryAll(By.css('.dbx-firebase-notification-settings-cell-unavailable')).length).toBe(2);
  });

  it('should label a cell with its default state', () => {
    const [email, text] = cellButtons('Example');

    expect(email.getAttribute('aria-label')).toBe('Example Email: Default (On)');
    expect(text.getAttribute('aria-label')).toBe('Example Text: Default (Off)');
  });

  it('should send a click to the delegate and keep the same row and focus', async () => {
    const row = rowFor('Example')?.nativeElement;
    const text = cellButtons('Example')[1];

    text.focus();
    text.click();
    await detectChanges();

    expect(delegate.edits()['E']?.[TEXT]).toBe(true);
    expect(delegate.cellStatesSignal()['E'][TEXT]?.modified).toBe(true);

    expect(rowFor('Example')?.nativeElement).toBe(row);

    const textAfter = cellButtons('Example')[1];
    expect(textAfter).toBe(text);
    expect(document.activeElement).toBe(text);
    expect(textAfter.getAttribute('aria-label')).toBe('Example Text: On');
  });

  it('should mark a modified cell', async () => {
    cellButtons('Example')[1].click();
    await detectChanges();

    expect(rowFor('Example')?.queryAll(By.css('.dbx-firebase-notification-settings-cell-modified')).length).toBe(1);
  });

  it('should disable the cells of a disabled method', async () => {
    delegate.disabledDeliveryMethods.set([TEXT]);
    await detectChanges();

    const [email, text] = cellButtons('Example');
    expect(text.disabled).toBe(true);
    expect(email.disabled).toBe(false);
  });

  it('should disable every cell while the delegate is disabled', async () => {
    delegate.disabledSignal.set(true);
    await detectChanges();

    expect(cellButtons('Example').every((x) => x.disabled)).toBe(true);
  });

  it('should show an overridden cell as disabled with the override value, and ignore clicks', async () => {
    delegate.gc.set({ c: { E: { st: true } } });
    delegate.boxConfig.set({ c: { E: { st: false } } });
    await detectChanges();

    const [email, text] = cellButtons('Example');
    expect(text.disabled).toBe(true);
    expect(text.getAttribute('aria-label')).toBe('Example Text: On');
    expect(email.disabled).toBe(false);
    expect(rowFor('Example')?.queryAll(By.css('.dbx-firebase-notification-settings-cell-overridden')).length).toBe(1);

    text.click();
    await detectChanges();
    expect(delegate.edits()['E']?.[TEXT]).toBeUndefined();
  });

  describe('forced cell', () => {
    function forcedCell(): HTMLElement | undefined {
      return rowFor('Forced Notice')?.query(By.css('.dbx-firebase-notification-settings-cell-forced'))?.nativeElement as HTMLElement | undefined;
    }

    it('should render a forced cell as a success-colored icon with no button', () => {
      const cell = forcedCell();
      const icon = cell?.querySelector('mat-icon');

      expect(cell).toBeDefined();
      expect(cell?.querySelector('button')).toBeNull();
      expect(icon?.classList.contains('dbx-success')).toBe(true);
      expect(icon?.getAttribute('role')).toBe('img');
      expect(icon?.getAttribute('aria-label')).toBe('Forced Notice Email: Always on');
      expect(cellButtons('Forced Notice').length).toBe(2);
    });

    it('should explain the forced cell in its tooltip', () => {
      const tooltip = rowFor('Forced Notice')?.query(By.css('.dbx-firebase-notification-settings-cell-forced'))?.injector.get(MatTooltip);
      expect(tooltip?.message).toBe('Email is always on for this notification.');
    });

    it('should use the disabled color when the method is turned off account-wide', async () => {
      delegate.disabledDeliveryMethods.set([EMAIL]);
      await detectChanges();

      const icon = forcedCell()?.querySelector('mat-icon');
      expect(icon?.classList.contains('dbx-disabled')).toBe(true);
      expect(icon?.classList.contains('dbx-success')).toBe(false);
    });

    it('should not make an edit when the forced cell is clicked', async () => {
      forcedCell()?.click();
      forcedCell()?.querySelector('mat-icon')?.dispatchEvent(new MouseEvent('click'));
      await detectChanges();

      expect(delegate.edits()['FRC']).toBeUndefined();
    });
  });
});
