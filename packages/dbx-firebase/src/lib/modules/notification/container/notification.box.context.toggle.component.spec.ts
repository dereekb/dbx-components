import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type Maybe } from '@dereekb/util';
import { type DbxFirebaseNotificationUserSettingsNotificationBoxConfig } from '../service/notification.settings';
import { DbxFirebaseNotificationBoxContext } from '../store/notification.box.context';
import { DbxFirebaseNotificationBoxContextToggleComponent } from './notification.box.context.toggle.component';

/**
 * Projected view that reads the context, like the settings store does.
 */
@Component({
  selector: 'dbx-test-notification-box-context-probe',
  template: `
    <span class="probe-enabled">{{ enabledSignal() }}</span>
  `
})
class TestNotificationBoxContextProbeComponent {
  readonly context = inject(DbxFirebaseNotificationBoxContext);
  readonly enabledSignal = toSignal(this.context.enabled$);
}

@Component({
  template: `
    <dbx-firebase-notification-box-context-toggle [notificationBox]="notificationBox()" [enabled]="enabled()" [globalLabel]="globalLabel()">
      <dbx-test-notification-box-context-probe></dbx-test-notification-box-context-probe>
    </dbx-firebase-notification-box-context-toggle>
  `,
  imports: [DbxFirebaseNotificationBoxContextToggleComponent, TestNotificationBoxContextProbeComponent]
})
class TestDbxFirebaseNotificationBoxContextToggleHostComponent {
  readonly notificationBox = signal<Maybe<DbxFirebaseNotificationUserSettingsNotificationBoxConfig>>({ modelKey: 'gb/gb1', modelName: 'guestbook' });
  readonly enabled = signal<Maybe<boolean>>(undefined);
  readonly globalLabel = signal<Maybe<string>>(undefined);
}

describe('DbxFirebaseNotificationBoxContextToggleComponent', () => {
  let fixture: ComponentFixture<TestDbxFirebaseNotificationBoxContextToggleHostComponent>;

  async function detectChanges(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function toggle(): DbxFirebaseNotificationBoxContextToggleComponent {
    return fixture.debugElement.query(By.directive(DbxFirebaseNotificationBoxContextToggleComponent)).componentInstance as DbxFirebaseNotificationBoxContextToggleComponent;
  }

  function probe(): TestNotificationBoxContextProbeComponent {
    return fixture.debugElement.query(By.directive(TestNotificationBoxContextProbeComponent)).componentInstance as TestNotificationBoxContextProbeComponent;
  }

  function toggleButtons(): HTMLButtonElement[] {
    return fixture.debugElement.queryAll(By.css('mat-button-toggle button')).map((x) => x.nativeElement as HTMLButtonElement);
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestDbxFirebaseNotificationBoxContextToggleHostComponent);
    await detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should provide the context to the projected content', () => {
    expect(probe().context).toBe(toggle());
  });

  it('should start on by default', () => {
    expect(probe().enabledSignal()).toBe(true);
  });

  it('should start from the enabled input', async () => {
    fixture.componentInstance.enabled.set(false);
    await detectChanges();
    expect(probe().enabledSignal()).toBe(false);
  });

  it("should label the options after the box's model", () => {
    const labels = toggleButtons().map((x) => x.textContent?.trim());
    expect(labels).toEqual(['This guestbook', 'All guestbooks']);
  });

  it('should use the label inputs', async () => {
    fixture.componentInstance.globalLabel.set('Everything');
    await detectChanges();
    expect(toggleButtons()[1].textContent?.trim()).toBe('Everything');
  });

  it('should turn the context off when the global option is clicked', async () => {
    toggleButtons()[1].click();
    await detectChanges();
    expect(probe().enabledSignal()).toBe(false);
  });

  it('should disable the toggle while locked', async () => {
    toggle().setLocked(true);
    await detectChanges();
    expect(toggleButtons().every((x) => x.disabled)).toBe(true);

    toggle().setLocked(false);
    await detectChanges();
    expect(toggleButtons().some((x) => x.disabled)).toBe(false);
  });
});
