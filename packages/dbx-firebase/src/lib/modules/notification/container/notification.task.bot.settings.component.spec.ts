import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODEL_NOT_AVAILABLE_ERROR_CODE, NotificationFunctions, type NotificationTaskBotOwnerOptOutGroup } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { TransitionService } from '@uirouter/core';
import { DbxFirebaseNotificationTaskBotSettingsComponent } from './notification.task.bot.settings.component';

@Component({
  template: `
    <dbx-firebase-notification-task-bot-settings [modelKey]="modelKey()"></dbx-firebase-notification-task-bot-settings>
  `,
  imports: [DbxFirebaseNotificationTaskBotSettingsComponent]
})
class TestDbxFirebaseNotificationTaskBotSettingsHostComponent {
  readonly modelKey = signal<Maybe<string>>('pr/uid1');
}

const PING_GROUP: NotificationTaskBotOwnerOptOutGroup = { key: 'ping_reminders', name: 'Ping Reminders', description: 'Pings.' };
const EMAIL_GROUP: NotificationTaskBotOwnerOptOutGroup = { key: 'email_reminders', name: 'Email Reminders', optOutAt: new Date() };

describe('DbxFirebaseNotificationTaskBotSettingsComponent', () => {
  let fixture: ComponentFixture<TestDbxFirebaseNotificationTaskBotSettingsHostComponent>;

  async function render(optOuts: () => Promise<unknown>): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationFunctions, useValue: { notificationTaskBot: { readNotificationTaskBot: { optOuts: vi.fn(optOuts) }, updateNotificationTaskBot: { optOut: vi.fn() } } } },
        { provide: TransitionService, useValue: { onStart: () => () => undefined } }
      ]
    });

    fixture = TestBed.createComponent(TestDbxFirebaseNotificationTaskBotSettingsHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture.debugElement.query(By.directive(DbxFirebaseNotificationTaskBotSettingsComponent)).nativeElement as HTMLElement;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should render a switch per group, on when the owner receives it', async () => {
    const element = await render(() => Promise.resolve({ groups: [PING_GROUP, EMAIL_GROUP] }));
    const rows = element.querySelectorAll('.dbx-firebase-notification-task-bot-settings-row');
    const switches = Array.from(element.querySelectorAll('mat-slide-toggle button')) as HTMLButtonElement[];

    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain(PING_GROUP.name);
    expect(switches.map((x) => x.getAttribute('aria-checked'))).toEqual(['true', 'false']);
  });

  it('should show the empty state when there are no groups', async () => {
    const element = await render(() => Promise.resolve({ groups: [] }));
    expect(element.textContent).toContain('There are no bot settings you can change.');
  });

  it('should show the missing state when the model has no bot', async () => {
    const element = await render(() => Promise.reject({ code: MODEL_NOT_AVAILABLE_ERROR_CODE, message: 'Not available.' }));
    expect(element.textContent).toContain('There are no bot settings to change yet.');
  });
});
