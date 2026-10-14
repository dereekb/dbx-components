import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';

import { type FormConfig, type FormOptions, DynamicForm, EventDispatcher, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { firstValueFrom, take, toArray } from 'rxjs';
import { addDays, isSameDay, startOfDay } from 'date-fns';
import { provideDbxForgeFormFieldDeclarations } from '../../../forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { dbxForgeFixedDateRangeField } from './fixeddaterange.field';
import { DbxForgeFixedDateRangeFieldComponent } from './fixeddaterange.field.component';
import { DateRangeType, type DateRange } from '@dereekb/date';
import { DbxDateTimeValueMode } from '../../../../field/value/date/date.value';
import { type Maybe } from '@dereekb/util';

// MARK: Test Host Component
@Component({
  template: `
    @if (config) {
      <form [dynamic-form]="config" [(value)]="formValue" [formOptions]="formOptions()"></form>
    }
  `,
  imports: [DynamicForm],
  providers: [EventDispatcher]
})
class TestForgeFixedDateRangeHostComponent {
  config!: FormConfig;
  readonly formValue = signal<any>({});
  readonly formOptions = signal<FormOptions | undefined>(undefined);
}

const FORGE_FIXEDDATERANGE_TEST_PROVIDERS = [provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

const SETTLE_TIME = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function settle(fixture: ComponentFixture<TestForgeFixedDateRangeHostComponent>, ms: number = SETTLE_TIME): Promise<void> {
  fixture.detectChanges();
  await delay(ms);
  fixture.detectChanges();
  await delay(50);
  fixture.detectChanges();
}

function formatTypedDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function typeIntoInput(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

function getTextInputs(fixture: ComponentFixture<TestForgeFixedDateRangeHostComponent>): { start: HTMLInputElement; end: HTMLInputElement } {
  const start = fixture.debugElement.query(By.css('input[matStartDate]')).nativeElement as HTMLInputElement;
  const end = fixture.debugElement.query(By.css('input[matEndDate]')).nativeElement as HTMLInputElement;
  return { start, end };
}

function normalTypedRangeConfig(): FormConfig {
  return {
    fields: [
      dbxForgeFixedDateRangeField({
        key: 'range',
        props: {
          selectionMode: 'normal',
          dateRangeInput: { type: DateRangeType.CALENDAR_MONTH, distance: 1 },
          valueMode: DbxDateTimeValueMode.DATE
        }
      })
    ]
  };
}

function getComponent(fixture: ComponentFixture<TestForgeFixedDateRangeHostComponent>): Maybe<DbxForgeFixedDateRangeFieldComponent> {
  return fixture.debugElement.query(By.directive(DbxForgeFixedDateRangeFieldComponent))?.componentInstance as Maybe<DbxForgeFixedDateRangeFieldComponent>;
}

describe('DbxForgeFixedDateRangeFieldComponent integration', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgeFixedDateRangeHostComponent],
      providers: FORGE_FIXEDDATERANGE_TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('props reach the component (fix verification)', () => {
    it('should propagate selectionMode from config to the component', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;

      host.config = {
        fields: [
          dbxForgeFixedDateRangeField({
            key: 'range',
            props: {
              selectionMode: 'normal',
              dateRangeInput: { type: DateRangeType.WEEKS_RANGE, distance: 1 }
            }
          })
        ]
      };
      await settle(fixture);

      const comp = getComponent(fixture);
      expect(comp).toBeDefined();
      // With the fix, props.selectionMode reaches the component and the signal is set
      const mode = await firstValueFrom(comp!.selectionMode$);
      expect(mode).toBe('normal');

      fixture.destroy();
    });

    it('should propagate dateRangeInput from config to the component', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;
      const dateRangeInput = { type: DateRangeType.WEEKS_RANGE, distance: 1 } as const;

      host.config = {
        fields: [
          dbxForgeFixedDateRangeField({
            key: 'range',
            props: { dateRangeInput }
          })
        ]
      };
      await settle(fixture);

      const comp = getComponent(fixture);
      expect(comp).toBeDefined();
      const input = await firstValueFrom(comp!.dateRangeInput$);
      expect(input).toEqual(dateRangeInput);

      fixture.destroy();
    });

    it('should default to "single" mode when selectionMode is not provided', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;

      host.config = {
        fields: [
          dbxForgeFixedDateRangeField({
            key: 'range',
            props: { dateRangeInput: { type: DateRangeType.WEEKS_RANGE, distance: 1 } }
          })
        ]
      };
      await settle(fixture);

      const comp = getComponent(fixture);
      const mode = await firstValueFrom(comp!.selectionMode$);
      expect(mode).toBe('single');

      fixture.destroy();
    });
  });

  describe('single mode selection', () => {
    it('should produce a range from dateRangeInput on the first click', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;

      host.config = {
        fields: [
          dbxForgeFixedDateRangeField({
            key: 'range',
            props: {
              selectionMode: 'single',
              dateRangeInput: { type: DateRangeType.WEEKS_RANGE, distance: 1 },
              valueMode: DbxDateTimeValueMode.DATE
            }
          })
        ]
      };
      await settle(fixture);

      const comp = getComponent(fixture)!;

      // Subscribe before emitting so we observe the selection
      const received$ = comp.dateRangeSelection$.pipe(take(1));
      const pick = addDays(startOfDay(new Date()), 1);

      const result = firstValueFrom(received$);
      comp.setDateRange({ start: pick }, 'calendar');

      const range = (await result) as DateRange;
      expect(range).toBeDefined();
      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
      // End of a WEEKS_RANGE is after the start
      expect(range.end.getTime()).toBeGreaterThan(range.start.getTime());

      fixture.destroy();
    });
  });

  describe('normal mode selection (two-click behavior)', () => {
    it('first click selects start, second click extends to end', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;

      host.config = {
        fields: [
          dbxForgeFixedDateRangeField({
            key: 'range',
            props: {
              selectionMode: 'normal',
              dateRangeInput: { type: DateRangeType.CALENDAR_MONTH, distance: 1 },
              valueMode: DbxDateTimeValueMode.DATE
            }
          })
        ]
      };
      await settle(fixture);

      const comp = getComponent(fixture)!;
      const firstClickDate = addDays(startOfDay(new Date()), 2);
      const secondClickDate = addDays(startOfDay(new Date()), 5);

      // Single subscription so the scan accumulator is preserved across both clicks.
      // _selectionEvent is a plain Subject, so each new subscription would start with an empty acc.
      const collected = firstValueFrom(comp.dateRangeSelection$.pipe(take(2), toArray()));
      comp.setDateRange({ start: firstClickDate }, 'calendar');
      comp.setDateRange({ start: secondClickDate }, 'calendar');

      const [firstRange, secondRange] = (await collected) as DateRange[];

      // First click: start = end = firstClickDate
      expect(firstRange).toBeDefined();
      expect(firstRange.start.getTime()).toBe(firstClickDate.getTime());
      expect(firstRange.end.getTime()).toBe(firstClickDate.getTime());

      // Second click: end extends to secondClickDate, still starting from first
      expect(secondRange).toBeDefined();
      expect(secondRange.start.getTime()).toBe(firstClickDate.getTime());
      expect(secondRange.end.getTime()).toBe(secondClickDate.getTime());

      fixture.destroy();
    });

    it('second click before the first start should flip the range', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;

      // Use DAYS_RADIUS so the boundary extends both before and after the first click.
      // CALENDAR_MONTH anchors on endOfWeek(date) and can exclude dates earlier in the same month,
      // which would cause the second (earlier) click to be outside the boundary and reset to 'start'
      // instead of flipping.
      host.config = {
        fields: [
          dbxForgeFixedDateRangeField({
            key: 'range',
            props: {
              selectionMode: 'normal',
              dateRangeInput: { type: DateRangeType.DAYS_RADIUS, distance: 10 },
              valueMode: DbxDateTimeValueMode.DATE
            }
          })
        ]
      };
      await settle(fixture);

      const comp = getComponent(fixture)!;
      const firstClickDate = addDays(startOfDay(new Date()), 5);
      const secondClickDate = addDays(startOfDay(new Date()), 2);

      // Single subscription so the scan accumulator is preserved across both clicks.
      const collected = firstValueFrom(comp.dateRangeSelection$.pipe(take(2), toArray()));
      comp.setDateRange({ start: firstClickDate }, 'calendar');
      comp.setDateRange({ start: secondClickDate }, 'calendar');

      const [, secondRange] = (await collected) as DateRange[];

      // Range should have secondClickDate as start and firstClickDate as end
      expect(secondRange.start.getTime()).toBe(secondClickDate.getTime());
      expect(secondRange.end.getTime()).toBe(firstClickDate.getTime());

      fixture.destroy();
    });
  });

  describe('external value change after user selection', () => {
    it('should accept an externally-set value after the user has already picked a date', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;

      host.config = {
        fields: [
          dbxForgeFixedDateRangeField({
            key: 'range',
            props: {
              selectionMode: 'single',
              dateRangeInput: { type: DateRangeType.WEEKS_RANGE, distance: 1 },
              valueMode: DbxDateTimeValueMode.DATE
            }
          })
        ]
      };
      await settle(fixture);

      const comp = getComponent(fixture)!;

      // Step 1: User picks a date on the calendar
      const userPick = addDays(startOfDay(new Date()), 1);
      const received$ = comp.dateRangeSelection$.pipe(take(1));
      const result = firstValueFrom(received$);
      comp.setDateRange({ start: userPick }, 'calendar');
      await result;

      // Wait for the selection to propagate to the field value
      await settle(fixture);

      const valueAfterUserPick = host.formValue() as { range?: DateRange };
      expect(valueAfterUserPick.range).toBeDefined();

      // Step 2: Set the form value externally to a different range
      const externalStart = addDays(startOfDay(new Date()), 10);
      const externalEnd = addDays(externalStart, 7);
      const externalValue = { range: { start: externalStart, end: externalEnd } };
      host.formValue.set(externalValue);

      // Wait for the external value to propagate
      await settle(fixture);

      // Step 3: Verify the external value sticks and is not overwritten by the user's prior selection
      const valueAfterExternalSet = host.formValue() as { range?: DateRange };
      expect(valueAfterExternalSet.range).toBeDefined();
      expect(startOfDay(valueAfterExternalSet.range!.start).getTime()).toBe(externalStart.getTime());
      expect(startOfDay(valueAfterExternalSet.range!.end).getTime()).toBe(externalEnd.getTime());

      fixture.destroy();
    });
  });

  describe('arbitrary_quick mode selection', () => {
    it('first click sets full boundary range', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;

      host.config = {
        fields: [
          dbxForgeFixedDateRangeField({
            key: 'range',
            props: {
              selectionMode: 'arbitrary_quick',
              dateRangeInput: { type: DateRangeType.DAYS_RANGE, distance: 5 },
              valueMode: DbxDateTimeValueMode.DATE
            }
          })
        ]
      };
      await settle(fixture);

      const comp = getComponent(fixture)!;
      const pick = addDays(startOfDay(new Date()), 1);

      const promise = firstValueFrom(comp.dateRangeSelection$.pipe(take(1)));
      comp.setDateRange({ start: pick }, 'calendar');
      const range = (await promise) as DateRange;

      expect(range).toBeDefined();
      expect(range.start).toBeInstanceOf(Date);
      expect(range.end).toBeInstanceOf(Date);
      // Full boundary means end > start
      expect(range.end.getTime()).toBeGreaterThan(range.start.getTime());

      fixture.destroy();
    });
  });

  describe('typed text input', () => {
    const typedStart = addDays(startOfDay(new Date()), 3);
    const typedEnd = addDays(startOfDay(new Date()), 6);

    function expectTypedRange(host: TestForgeFixedDateRangeHostComponent) {
      const range = (host.formValue() as { range?: DateRange }).range;
      expect(range).toBeDefined();
      expect(isSameDay(range!.start, typedStart)).toBe(true);
      expect(isSameDay(range!.end, typedEnd)).toBe(true);
    }

    function expectNoTypedRange(host: TestForgeFixedDateRangeHostComponent) {
      const range = (host.formValue() as { range?: DateRange }).range;
      expect(range != null && isSameDay(range.start, typedStart)).toBe(false);
    }

    it('should not apply typed dates before the typing debounce without a commit', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;
      host.config = normalTypedRangeConfig();
      await settle(fixture);

      const { start, end } = getTextInputs(fixture);
      typeIntoInput(start, formatTypedDate(typedStart));
      typeIntoInput(end, formatTypedDate(typedEnd));

      await delay(20);
      fixture.detectChanges();
      expectNoTypedRange(host);

      fixture.destroy();
    });

    it('should commit typed dates when an input loses focus', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;
      host.config = normalTypedRangeConfig();
      await settle(fixture);

      const { start, end } = getTextInputs(fixture);
      typeIntoInput(start, formatTypedDate(typedStart));
      typeIntoInput(end, formatTypedDate(typedEnd));
      end.dispatchEvent(new Event('blur'));

      await delay(20);
      fixture.detectChanges();
      expectTypedRange(host);

      fixture.destroy();
    });

    it('should commit typed dates when Enter is pressed', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;
      host.config = normalTypedRangeConfig();
      await settle(fixture);

      const { start, end } = getTextInputs(fixture);
      typeIntoInput(start, formatTypedDate(typedStart));
      typeIntoInput(end, formatTypedDate(typedEnd));
      end.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

      await delay(20);
      fixture.detectChanges();
      expectTypedRange(host);

      fixture.destroy();
    });

    it('should ignore incomplete typed text on blur', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;
      host.config = normalTypedRangeConfig();
      await settle(fixture);

      const { start, end } = getTextInputs(fixture);
      typeIntoInput(start, formatTypedDate(typedStart));
      typeIntoInput(end, `${typedEnd.getMonth() + 1}/${typedEnd.getDate()}`);
      end.dispatchEvent(new Event('blur'));

      await delay(20);
      fixture.detectChanges();
      expectNoTypedRange(host);

      fixture.destroy();
    });
  });

  describe('picker limits', () => {
    it('should apply the min limit right away', async () => {
      const fixture = TestBed.createComponent(TestForgeFixedDateRangeHostComponent);
      const host = fixture.componentInstance;

      host.config = {
        fields: [
          dbxForgeFixedDateRangeField({
            key: 'range',
            props: {
              selectionMode: 'normal',
              pickerConfig: { limits: { min: 'today_start' } }
            }
          })
        ]
      };
      await settle(fixture);

      const comp = getComponent(fixture)!;
      expect(comp.minDateSignal()).toBeInstanceOf(Date);

      fixture.destroy();
    });
  });
});
