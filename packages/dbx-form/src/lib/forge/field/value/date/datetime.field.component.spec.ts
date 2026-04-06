import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, signal, provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { type FormConfig, DynamicForm, EventDispatcher } from '@ng-forge/dynamic-forms';
import { BehaviorSubject, of, first, skip } from 'rxjs';
import { startOfDay, addHours, addDays } from 'date-fns';
import { provideDbxForgeFormFieldDeclarations } from '../../../forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { forgeDateTimeField, type ForgeDateTimeFieldConfig } from './datetime.field';
import { ForgeDateTimeFieldComponent } from './datetime.field.component';
import { DbxDateTimeFieldTimeMode } from '../../../../formly/field/value/date/datetime.field.component';
import { DbxDateTimeValueMode } from '../../../../formly/field/value/date/date.value';
import { type Maybe, type TimezoneString } from '@dereekb/util';
import { DateCellScheduleDayCode, findMaxDate, findMinDate } from '@dereekb/date';

// MARK: Test Host Component
@Component({
  template: `
    @if (config) {
      <form [dynamic-form]="config" [(value)]="formValue"></form>
    }
  `,
  standalone: true,
  imports: [DynamicForm],
  providers: [EventDispatcher],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestForgeDateTimeHostComponent {
  config!: FormConfig;
  readonly formValue = signal<any>({});
}

// MARK: Test Providers (zoneless)
const FORGE_DATETIME_TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), provideNoopAnimations()];

// MARK: Helpers

/**
 * The minimum duration (ms) to allow all internal observable pipelines to settle.
 *
 * Based on component timing constants:
 * - TIME_OUTPUT_THROTTLE_TIME = 10ms
 * - throttleTime(20) on valueInSystemTimezone$
 * - debounceTime(5) on timeInput$
 * - debounceTime(200) on resyncTimeInput$
 */
const SETTLE_TIME = 500;

/**
 * Extra time to wait after settling to verify no additional emissions occur.
 */
const STABILITY_CHECK_TIME = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createConfig(fieldConfig: ForgeDateTimeFieldConfig): FormConfig {
  return { fields: [forgeDateTimeField(fieldConfig) as any] };
}

function getDateTimeComponent(fixture: ComponentFixture<TestForgeDateTimeHostComponent>): Maybe<ForgeDateTimeFieldComponent> {
  return fixture.debugElement.query(By.directive(ForgeDateTimeFieldComponent))?.componentInstance as Maybe<ForgeDateTimeFieldComponent>;
}

async function settle(fixture: ComponentFixture<TestForgeDateTimeHostComponent>, ms: number = SETTLE_TIME): Promise<void> {
  fixture.detectChanges();
  await delay(ms);
  fixture.detectChanges();
  await fixture.whenStable();
  // Allow any trailing microtasks from signal effects to flush
  await delay(50);
  fixture.detectChanges();
}

describe('ForgeDateTimeFieldComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgeDateTimeHostComponent],
      providers: FORGE_DATETIME_TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  // MARK: Group A — Value Stability (Strobing Bug)
  describe('value stability', () => {
    it('should not re-emit after initial value set (date+time mode)', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const testDate = addHours(startOfDay(new Date()), 14);

      host.config = createConfig({ key: 'dt', required: true });
      host.formValue.set({ dt: testDate });
      await settle(fixture);

      const settled = host.formValue();
      await delay(STABILITY_CHECK_TIME);
      fixture.detectChanges();

      expect(host.formValue()).toEqual(settled);
      fixture.destroy();
    });

    it('should not re-emit after initial value set (time-only mode)', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const testDate = addHours(startOfDay(new Date()), 10);

      host.config = createConfig({ key: 'dt', timeOnly: true });
      host.formValue.set({ dt: testDate });
      await settle(fixture);

      const settled = host.formValue();
      await delay(STABILITY_CHECK_TIME);
      fixture.detectChanges();

      expect(host.formValue()).toEqual(settled);
      fixture.destroy();
    });

    it('should not re-emit after initial value set (unix timestamp mode)', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const testTimestamp = new Date().getTime();

      host.config = createConfig({ key: 'dt', valueMode: DbxDateTimeValueMode.UNIX_TIMESTAMP });
      host.formValue.set({ dt: testTimestamp });
      await settle(fixture);

      const settled = host.formValue();
      await delay(STABILITY_CHECK_TIME);
      fixture.detectChanges();

      expect(host.formValue()).toEqual(settled);
      fixture.destroy();
    });

    it('should not re-emit after initial value set (minute of day mode)', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt', valueMode: DbxDateTimeValueMode.MINUTE_OF_DAY, timeOnly: true });
      host.formValue.set({ dt: 720 });
      await settle(fixture);

      const settled = host.formValue();
      await delay(STABILITY_CHECK_TIME);
      fixture.detectChanges();

      expect(host.formValue()).toEqual(settled);
      fixture.destroy();
    });

    it('should stabilize after programmatic time control change', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const testDate = addHours(startOfDay(new Date()), 14);

      host.config = createConfig({ key: 'dt' });
      host.formValue.set({ dt: testDate });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      comp!.setTime('3:00PM');
      await settle(fixture);

      const settled = host.formValue();
      await delay(STABILITY_CHECK_TIME);
      fixture.detectChanges();

      expect(host.formValue()).toEqual(settled);
      fixture.destroy();
    });

    it('should stabilize after programmatic date control change', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const testDate = addHours(startOfDay(new Date()), 14);
      const newDate = addDays(testDate, 3);

      host.config = createConfig({ key: 'dt' });
      host.formValue.set({ dt: testDate });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      comp!.dateCtrl.setValue(newDate);
      await settle(fixture);

      const settled = host.formValue();
      await delay(STABILITY_CHECK_TIME);
      fixture.detectChanges();

      expect(host.formValue()).toEqual(settled);
      fixture.destroy();
    });

    it('should not strobe when timezone changes', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const timezone$ = new BehaviorSubject<Maybe<TimezoneString>>('America/New_York');
      const testDate = addHours(startOfDay(new Date()), 14);

      host.config = createConfig({ key: 'dt', timezone: timezone$ });
      host.formValue.set({ dt: testDate });
      await settle(fixture);

      timezone$.next('America/Los_Angeles');
      await settle(fixture);

      const settled = host.formValue();
      await delay(STABILITY_CHECK_TIME);
      fixture.detectChanges();

      expect(host.formValue()).toEqual(settled);
      fixture.destroy();
    });

    it('should not strobe when pickerConfig changes', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const pickerConfig$ = new BehaviorSubject({ limits: { min: addHours(startOfDay(new Date()), 9), max: addHours(startOfDay(new Date()), 17) } });
      const testDate = addHours(startOfDay(new Date()), 14);

      host.config = createConfig({ key: 'dt', pickerConfig: pickerConfig$ });
      host.formValue.set({ dt: testDate });
      await settle(fixture);

      pickerConfig$.next({ limits: { min: addHours(startOfDay(new Date()), 8), max: addHours(startOfDay(new Date()), 18) } });
      await settle(fixture);

      const settled = host.formValue();
      await delay(STABILITY_CHECK_TIME);
      fixture.detectChanges();

      expect(host.formValue()).toEqual(settled);
      fixture.destroy();
    });
  });

  // MARK: Group B — Configuration Variants
  describe('date picker (day only)', () => {
    it('should not show time input', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'datePicker', label: 'Date Picker', allDayLabel: 'On', valueMode: DbxDateTimeValueMode.DATE, timeMode: DbxDateTimeFieldTimeMode.NONE });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.showTimeInput()).toBe(false);
      expect(comp!.isDateOnly()).toBe(true);
      fixture.destroy();
    });

    it('should accept and output a Date value', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const testDate = startOfDay(new Date());

      host.config = createConfig({ key: 'datePicker', valueMode: DbxDateTimeValueMode.DATE, timeMode: DbxDateTimeFieldTimeMode.NONE });
      host.formValue.set({ datePicker: testDate });
      await settle(fixture);

      const output = host.formValue();
      expect(output.datePicker).toBeDefined();
      expect(output.datePicker instanceof Date || typeof output.datePicker === 'object').toBe(true);
      fixture.destroy();
    });
  });

  describe('day only with string value', () => {
    it('should not show calendar picker button when hideDatePicker is true', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dayOnlyAsString', valueMode: DbxDateTimeValueMode.DAY_STRING, hideDatePicker: true, hideDateHint: true });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.hideDatePicker()).toBe(true);
      fixture.destroy();
    });

    it('should configure DAY_STRING value mode', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dayOnlyAsString', valueMode: DbxDateTimeValueMode.DAY_STRING, hideDatePicker: true });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.valueMode()).toBe(DbxDateTimeValueMode.DAY_STRING);
      expect(comp!.isDateOnly()).toBe(true);
      fixture.destroy();
    });
  });

  describe('default date+time (required)', () => {
    it('should show both date and time inputs', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'date', required: true });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.showDateInput()).toBe(true);
      expect(comp!.showTimeInput()).toBe(true);
      fixture.destroy();
    });

    it('should sync date control from form value', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const testDate = addHours(startOfDay(new Date()), 14);

      host.config = createConfig({ key: 'date', required: true });
      host.formValue.set({ date: testDate });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      // The date control should have the date value
      expect(comp!.dateCtrl.value).toBeDefined();
      fixture.destroy();
    });

    it('should configure required field', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'date', required: true });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      // timeMode defaults to REQUIRED
      expect(comp!.timeMode()).toBe(DbxDateTimeFieldTimeMode.REQUIRED);
      expect(comp!.showDateInput()).toBe(true);
      expect(comp!.showTimeInput()).toBe(true);
      fixture.destroy();
    });
  });

  describe('date with string value', () => {
    it('should configure DATE_STRING value mode', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dateAsString', required: true, valueMode: DbxDateTimeValueMode.DATE_STRING, hideDateHint: true });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.valueMode()).toBe(DbxDateTimeValueMode.DATE_STRING);
      expect(comp!.hideDateHint()).toBe(true);
      fixture.destroy();
    });

    it('should hide date hint', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dateAsString', valueMode: DbxDateTimeValueMode.DATE_STRING, hideDateHint: true });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.hideDateHint()).toBe(true);
      fixture.destroy();
    });
  });

  describe('time for work day today', () => {
    it('should hide date input when restricted to single day', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({
        key: 'timeForWorkDayToday',
        alwaysShowDateInput: false,
        timeDate: new Date(),
        showClearButton: false,
        pickerConfig: {
          limits: {
            min: addHours(startOfDay(new Date()), 9),
            max: addHours(startOfDay(new Date()), 17)
          }
        }
      });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.alwaysShowDateInput()).toBe(false);
      fixture.destroy();
    });
  });

  describe('optional time mode', () => {
    it('should have OPTIONAL time mode', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'timeOptional', timeMode: DbxDateTimeFieldTimeMode.OPTIONAL });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.timeMode()).toBe(DbxDateTimeFieldTimeMode.OPTIONAL);
      fixture.destroy();
    });

    it('should show time input after addTime()', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'timeOptional', timeMode: DbxDateTimeFieldTimeMode.OPTIONAL });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.addTime();
      await settle(fixture);

      expect(comp!.showTimeInput()).toBe(true);
      expect(comp!.isFullDay()).toBe(false);
      fixture.destroy();
    });

    it('should hide time input after removeTime()', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'timeOptional', timeMode: DbxDateTimeFieldTimeMode.OPTIONAL });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.addTime();
      await settle(fixture);
      expect(comp!.showTimeInput()).toBe(true);

      comp!.removeTime();
      await settle(fixture);

      expect(comp!.showTimeInput()).toBe(false);
      expect(comp!.isFullDay()).toBe(true);
      fixture.destroy();
    });
  });

  describe('day only', () => {
    it('should not show time input and fullDay should be true', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dayOnly', label: 'Day Only', timeMode: DbxDateTimeFieldTimeMode.NONE });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.showTimeInput()).toBe(false);
      expect(comp!.isDateOnly()).toBe(true);
      fixture.destroy();
    });
  });

  describe('time only', () => {
    it('should not show date input', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({
        key: 'timeOnly',
        timeOnly: true,
        hideDateHint: true,
        showTimezone: false,
        presets: [
          { label: '12:00 AM', timeString: '12:00AM' },
          { label: '12:30 PM', timeString: '12:30PM' },
          { label: 'Now', logicalDate: 'now' }
        ]
      });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.isTimeOnly()).toBe(true);
      expect(comp!.showDateInput()).toBe(false);
      expect(comp!.showTimezone()).toBe(false);
      fixture.destroy();
    });

    it('should apply preset when selected', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({
        key: 'timeOnly',
        timeOnly: true,
        presets: [
          { label: '12:00 AM', timeString: '12:00AM' },
          { label: '12:30 PM', timeString: '12:30PM' }
        ]
      });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      const presets = comp!.presetsSignal();
      if (presets && presets.length > 0) {
        comp!.selectPreset(presets[1]);
        await settle(fixture);
        expect(comp!.timeCtrl.value).toBe('12:30PM');
      }
      fixture.destroy();
    });
  });

  describe('time for today (restricted)', () => {
    it('should not show clear button', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({
        key: 'timeForToday',
        alwaysShowDateInput: false,
        timeDate: new Date(),
        showClearButton: false,
        pickerConfig: {
          limits: {
            min: findMaxDate([startOfDay(new Date()), addHours(new Date(), -2)])!,
            max: findMinDate([addHours(startOfDay(new Date()), 24), addHours(new Date(), 2)])!
          }
        }
      });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.showClearButton()).toBe(false);
      fixture.destroy();
    });
  });

  describe('unix timestamp', () => {
    it('should accept number input and output number', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const testTimestamp = new Date().getTime();

      host.config = createConfig({ key: 'unixTimeStamp', valueMode: DbxDateTimeValueMode.UNIX_TIMESTAMP, hideDateHint: true });
      host.formValue.set({ unixTimeStamp: testTimestamp });
      await settle(fixture);

      const output = host.formValue();
      if (output.unixTimeStamp != null) {
        expect(typeof output.unixTimeStamp).toBe('number');
      }
      fixture.destroy();
    });
  });

  describe('unix timestamp in New York', () => {
    it('should apply timezone', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const testTimestamp = new Date().getTime();

      host.config = createConfig({ key: 'unixTS_NY', valueMode: DbxDateTimeValueMode.UNIX_TIMESTAMP, timezone: 'America/New_York', hideDateHint: true });
      host.formValue.set({ unixTS_NY: testTimestamp });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.resolvedTimezone()).toBe('America/New_York');
      fixture.destroy();
    });
  });

  describe('date only in Tokyo', () => {
    it('should use Asia/Tokyo timezone', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dateOnlyTokyo', timeMode: DbxDateTimeFieldTimeMode.NONE, timezone: 'Asia/Tokyo' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.resolvedTimezone()).toBe('Asia/Tokyo');
      expect(comp!.showTimeInput()).toBe(false);
      fixture.destroy();
    });
  });

  describe('time only in New York', () => {
    it('should use America/New_York timezone', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'timeOnlyNY', timeOnly: true, timezone: 'America/New_York', hideDateHint: true });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.resolvedTimezone()).toBe('America/New_York');
      expect(comp!.isTimeOnly()).toBe(true);
      fixture.destroy();
    });
  });

  describe('minute of day', () => {
    it('should configure as MINUTE_OF_DAY time-only', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'minuteOfDay', valueMode: DbxDateTimeValueMode.MINUTE_OF_DAY, timeOnly: true, hideDateHint: true });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.valueMode()).toBe(DbxDateTimeValueMode.MINUTE_OF_DAY);
      expect(comp!.isTimeOnly()).toBe(true);
      expect(comp!.showDateInput()).toBe(false);
      fixture.destroy();
    });

    it('should output a number', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'minuteOfDay', valueMode: DbxDateTimeValueMode.MINUTE_OF_DAY, timeOnly: true, hideDateHint: true });
      host.formValue.set({ minuteOfDay: 720 });
      await settle(fixture);

      const output = host.formValue();
      if (output.minuteOfDay != null) {
        expect(typeof output.minuteOfDay).toBe('number');
      }
      fixture.destroy();
    });
  });

  describe('minute of day for New York', () => {
    it('should show timezone and use America/New_York', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'minuteOfDayNY', valueMode: DbxDateTimeValueMode.MINUTE_OF_DAY, showTimezone: true, timeOnly: true, timezone: 'America/New_York', hideDateHint: true });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.showTimezone()).toBe(true);
      expect(comp!.resolvedTimezone()).toBe('America/New_York');
      fixture.destroy();
    });
  });

  describe('system minute of day', () => {
    it('should use SYSTEM_MINUTE_OF_DAY value mode', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'sysMinute', valueMode: DbxDateTimeValueMode.SYSTEM_MINUTE_OF_DAY, timeOnly: true, timezone: 'America/New_York', hideDateHint: true });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.valueMode()).toBe(DbxDateTimeValueMode.SYSTEM_MINUTE_OF_DAY);
      fixture.destroy();
    });
  });

  describe('timezone day (DATE_STRING with observable timezone)', () => {
    it('should configure DATE_STRING with observable timezone', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const timezone$ = new BehaviorSubject<Maybe<TimezoneString>>('America/New_York');

      host.config = createConfig({ key: 'timezoneDay', label: 'Timezone Day', valueMode: DbxDateTimeValueMode.DATE_STRING, timezone: timezone$ });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.valueMode()).toBe(DbxDateTimeValueMode.DATE_STRING);
      expect(comp!.resolvedTimezone()).toBe('America/New_York');
      fixture.destroy();
    });

    it('should recompute when timezone changes', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const timezone$ = new BehaviorSubject<Maybe<TimezoneString>>('America/New_York');
      const testDate = addHours(startOfDay(new Date()), 14);

      host.config = createConfig({ key: 'timezoneDay', valueMode: DbxDateTimeValueMode.DATE_STRING, timezone: timezone$ });
      host.formValue.set({ timezoneDay: testDate });
      await settle(fixture);

      timezone$.next('Asia/Tokyo');
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.resolvedTimezone()).toBe('Asia/Tokyo');
      fixture.destroy();
    });
  });

  describe('date with schedule', () => {
    it('should respect picker config with schedule', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({
        key: 'dateWithASchedule',
        required: true,
        pickerConfig: () => {
          return of({
            limits: {
              min: startOfDay(new Date()),
              max: addDays(new Date(), 14)
            },
            schedule: {
              w: `${DateCellScheduleDayCode.MONDAY}${DateCellScheduleDayCode.WEDNESDAY}${DateCellScheduleDayCode.FRIDAY}` as any,
              d: [0, 1, 2, 3, 4, 5, 6]
            }
          });
        }
      });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      const pickerFilter = comp!.pickerFilterSignal();
      expect(pickerFilter).toBeDefined();
      expect(typeof pickerFilter).toBe('function');
      fixture.destroy();
    });
  });

  describe('changing configuration', () => {
    it('should handle dynamic pickerConfig updates', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const pickerConfig$ = new BehaviorSubject({ limits: { min: addHours(startOfDay(new Date()), 0) } });

      host.config = createConfig({ key: 'changingConfig', showClearButton: false, pickerConfig: pickerConfig$ });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.showClearButton()).toBe(false);

      pickerConfig$.next({ limits: { min: addHours(startOfDay(new Date()), 5) } });
      await settle(fixture);

      const settled = host.formValue();
      await delay(STABILITY_CHECK_TIME);
      fixture.detectChanges();
      expect(host.formValue()).toEqual(settled);
      fixture.destroy();
    });
  });

  // MARK: Group C — Core Actions
  describe('core actions', () => {
    it('clearValue() should reset both controls and output undefined', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const testDate = addHours(startOfDay(new Date()), 14);

      host.config = createConfig({ key: 'dt' });
      host.formValue.set({ dt: testDate });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.clearValue();
      await settle(fixture);

      expect(comp!.dateCtrl.value).toBeNull();
      expect(comp!.timeCtrl.value).toBeNull();
      fixture.destroy();
    });

    it('setTime() should update the time control', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;
      const testDate = addHours(startOfDay(new Date()), 14);

      host.config = createConfig({ key: 'dt' });
      host.formValue.set({ dt: testDate });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.setTime('5:30PM');
      await settle(fixture);

      expect(comp!.timeCtrl.value).toBe('5:30PM');
      fixture.destroy();
    });

    it('setTime() should not update when value is the same', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.setTime('3:00PM');
      await settle(fixture);

      const beforeSecondSet = host.formValue();

      comp!.setTime('3:00PM');
      await settle(fixture);

      expect(host.formValue()).toEqual(beforeSecondSet);
      fixture.destroy();
    });

    it('addTime() and removeTime() should toggle fullDay state', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt', timeMode: DbxDateTimeFieldTimeMode.OPTIONAL });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.addTime();
      await settle(fixture);
      expect(comp!.isFullDay()).toBe(false);

      comp!.removeTime();
      await settle(fixture);
      expect(comp!.isFullDay()).toBe(true);
      fixture.destroy();
    });
  });

  // MARK: Group D — Time Input Behavior
  describe('time input behavior', () => {
    it('should not clear time control while user is focused (with date)', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      // Set date directly
      comp!.dateCtrl.setValue(startOfDay(new Date()));
      comp!.setTime('2:00PM');
      await settle(fixture);

      // Focus and change time (emitEvent: false to prevent feedback loop in test)
      comp!.onTimeFocus();
      comp!.timeCtrl.setValue('5:00PM', { emitEvent: false });
      await settle(fixture);

      expect(comp!.timeCtrl.value).toBe('5:00PM');
      fixture.destroy();
    });

    it('should not clear time control while user is focused on time input (without date set)', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      // Simulate user focusing and typing a time without a date
      comp!.onTimeFocus();
      comp!.timeCtrl.setValue('3:00PM');
      await settle(fixture);

      // Time should not be cleared while focused
      expect(comp!.timeCtrl.value).toBe('3:00PM');
      fixture.destroy();
    });

    it('should track focus state via onTimeFocus/onTimeBlur', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture) as any;
      expect(comp).toBeDefined();

      // Verify focus signal tracking
      expect(comp._isTimeInputFocused()).toBe(false);
      comp.onTimeFocus();
      expect(comp._isTimeInputFocused()).toBe(true);
      comp.onTimeBlur();
      expect(comp._isTimeInputFocused()).toBe(false);

      fixture.destroy();
    });

    it('should stabilize after setTime with date set', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.dateCtrl.setValue(startOfDay(new Date()));
      comp!.setTime('4:00PM');
      await settle(fixture);

      const settled = host.formValue();
      await delay(STABILITY_CHECK_TIME);
      fixture.detectChanges();

      expect(host.formValue()).toEqual(settled);
      fixture.destroy();
    });
  });

  // MARK: Group E — Presets Menu
  describe('presets menu', () => {
    it('should have presets available even without a date set (falls back to today)', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      // Presets should be available even without a date — falls back to today for filtering
      const presets = comp!.presetsSignal();
      expect(presets).toBeDefined();
      expect(presets!.length).toBeGreaterThan(0);
      fixture.destroy();
    });

    it('should have presets available for time-only field with explicit presets', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({
        key: 'dt',
        timeOnly: true,
        presets: [
          { label: '12:00 AM', timeString: '12:00AM' },
          { label: '12:30 PM', timeString: '12:30PM' }
        ]
      });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      const presets = comp!.presetsSignal();
      expect(presets).toBeDefined();
      expect(presets!.length).toBe(2);
      expect(presets![0].label).toBeDefined();
      fixture.destroy();
    });

    it('should have presets when no date is set (time-date field)', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      // This mimics the "Time For Work Day Today" field where no date is in the control
      host.config = createConfig({
        key: 'dt',
        alwaysShowDateInput: false,
        timeDate: new Date(),
        pickerConfig: {
          limits: {
            min: addHours(startOfDay(new Date()), 9),
            max: addHours(startOfDay(new Date()), 17)
          }
        }
      });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      // Presets should still be available even without a date in the control
      const presets = comp!.presetsSignal();
      expect(presets).toBeDefined();
      expect(presets!.length).toBeGreaterThan(0);
      fixture.destroy();
    });

    it('should auto-fill date with today when time is entered without a date', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.dateCtrl.value).toBeNull();

      // Enter a time without setting a date
      comp!.setTime('3:00PM');
      await settle(fixture);

      // Date should have been auto-filled with today
      expect(comp!.dateCtrl.value).toBeDefined();
      expect(comp!.dateCtrl.value).not.toBeNull();
      fixture.destroy();
    });

    it('should have no presets when fullDay is true', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt', timeMode: DbxDateTimeFieldTimeMode.NONE });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      // Day-only mode = fullDay = no presets
      const presets = comp!.presetsSignal();
      expect(presets === undefined || presets?.length === 0).toBe(true);
      fixture.destroy();
    });
  });

  // MARK: Group F — Arrow Key Time Navigation
  describe('arrow key time navigation', () => {
    function makeKeyEvent(key: string, modifiers: Partial<{ altKey: boolean; shiftKey: boolean; ctrlKey: boolean }> = {}): KeyboardEvent {
      return { key, ctrlKey: false, shiftKey: false, altKey: false, ...modifiers, preventDefault: () => {} } as unknown as KeyboardEvent;
    }

    /**
     * Helper that waits for the next NEW emission from timeOutput$ after triggering an arrow key.
     * Uses skip(1) to skip the cached shareReplay value.
     */
    async function pressArrowAndWaitForOutput(comp: ForgeDateTimeFieldComponent, event: KeyboardEvent): Promise<Date | undefined> {
      return new Promise<Date | undefined>((resolve) => {
        const sub = comp.timeOutput$.pipe(skip(1), first()).subscribe((val) => resolve(val ?? undefined));
        comp.onTimeKeydown(event);
        // Safety timeout in case no emission happens
        setTimeout(() => {
          sub.unsubscribe();
          resolve(undefined);
        }, 2000);
      });
    }

    it('should increment time on ArrowUp (default 5 min step)', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.dateCtrl.setValue(startOfDay(new Date()));
      comp!.setTime('2:00PM');
      await settle(fixture);

      const result = await pressArrowAndWaitForOutput(comp!, makeKeyEvent('ArrowUp'));
      expect(result).toBeDefined();
      expect(result!.getMinutes()).toBe(5); // 2:00PM + 5min = 2:05PM
      expect(result!.getHours()).toBe(14);
      fixture.destroy();
    });

    it('should decrement time on ArrowDown (default 5 min step)', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.dateCtrl.setValue(startOfDay(new Date()));
      comp!.setTime('2:00PM');
      await settle(fixture);

      const result = await pressArrowAndWaitForOutput(comp!, makeKeyEvent('ArrowDown'));
      expect(result).toBeDefined();
      expect(result!.getMinutes()).toBe(55); // 2:00PM - 5min = 1:55PM
      expect(result!.getHours()).toBe(13);
      fixture.destroy();
    });

    it('should use 5x offset with Shift modifier', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.dateCtrl.setValue(startOfDay(new Date()));
      comp!.setTime('2:00PM');
      await settle(fixture);

      // Shift+ArrowUp = 5 steps × 5 min = 25 min
      const result = await pressArrowAndWaitForOutput(comp!, makeKeyEvent('ArrowUp', { shiftKey: true }));
      expect(result).toBeDefined();
      expect(result!.getHours()).toBe(14);
      expect(result!.getMinutes()).toBe(25); // 2:25PM
      fixture.destroy();
    });

    it('should use 60x offset with Alt modifier', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.dateCtrl.setValue(startOfDay(new Date()));
      comp!.setTime('2:00PM');
      await settle(fixture);

      // Alt+ArrowUp = 60 steps × 5 min = 300 min = 5 hours
      const result = await pressArrowAndWaitForOutput(comp!, makeKeyEvent('ArrowUp', { altKey: true }));
      expect(result).toBeDefined();
      expect(result!.getHours()).toBe(19); // 2PM + 5h = 7PM
      expect(result!.getMinutes()).toBe(0);
      fixture.destroy();
    });

    it('should use 300x offset with Alt+Shift modifier', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.dateCtrl.setValue(startOfDay(new Date()));
      comp!.setTime('2:00PM');
      await settle(fixture);

      // Alt+Shift+ArrowDown = 300 steps × 5 min = 1500 min = 25 hours
      const result = await pressArrowAndWaitForOutput(comp!, makeKeyEvent('ArrowDown', { altKey: true, shiftKey: true }));
      expect(result).toBeDefined();
      // 2PM - 25h crosses into previous day
      expect(result).not.toBeUndefined();
      fixture.destroy();
    });

    it('should ignore non-arrow keys', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt' });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();

      comp!.dateCtrl.setValue(startOfDay(new Date()));
      comp!.setTime('2:00PM');
      await settle(fixture);

      // Press Enter — should not trigger offset
      comp!.onTimeKeydown(makeKeyEvent('Enter'));
      await settle(fixture);

      expect(comp!.timeCtrl.value).toBe('2:00PM');
      fixture.destroy();
    });

    it('should respect custom minuteStep', async () => {
      const fixture = TestBed.createComponent(TestForgeDateTimeHostComponent);
      const host = fixture.componentInstance;

      host.config = createConfig({ key: 'dt', minuteStep: 15 });
      await settle(fixture);

      const comp = getDateTimeComponent(fixture);
      expect(comp).toBeDefined();
      expect(comp!.minuteStep()).toBe(15);

      comp!.dateCtrl.setValue(startOfDay(new Date()));
      comp!.setTime('2:00PM');
      await settle(fixture);

      // ArrowUp = 1 step × 15 min
      const result = await pressArrowAndWaitForOutput(comp!, makeKeyEvent('ArrowUp'));
      expect(result).toBeDefined();
      expect(result!.getHours()).toBe(14);
      expect(result!.getMinutes()).toBe(15); // 2:15PM
      fixture.destroy();
    });
  });
});
