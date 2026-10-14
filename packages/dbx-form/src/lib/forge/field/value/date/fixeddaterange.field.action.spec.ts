import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { ApplicationRef, Component, inject } from '@angular/core';
import { By } from '@angular/platform-browser';
import { type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { catchError, firstValueFrom, of, Subject, timeout } from 'rxjs';
import { addDays, startOfDay } from 'date-fns';
import { DateRangeType, type DateRange } from '@dereekb/date';
import { AbstractFilterSourceDirective, DbxCoreActionModule, DbxActionHandlerDirective, completeOnDestroy, provideFilterSourceDirective } from '@dereekb/dbx-core';
import { DbxFilterPopoverPendingChanges, DbxFilterPopoverPendingChangesInstance, DbxFilterWrapperComponent } from '@dereekb/dbx-web';
import { type Maybe, waitForMs } from '@dereekb/util';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { provideDbxForgeFormFieldDeclarations } from '../../../forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { DbxForgeFormComponent } from '../../../form/forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext } from '../../../form/forge.context';
import { DbxActionFormDirective } from '../../../../form/action/form.action.directive';
import { DbxDateTimeValueMode } from '../../../../field/value/date/date.value';
import { dbxForgeFixedDateRangeField } from './fixeddaterange.field';
import { DbxForgeFixedDateRangeFieldComponent } from './fixeddaterange.field.component';

/**
 * The latency regression proof for a fixed date range field inside an auto-triggered action form (the filter popover pipeline):
 * a calendar pick or committed typed dates must reach the action handler in tens of milliseconds. The bounds are about 10× the
 * expected cost, so a reintroduced ~1s timer anywhere in the chain fails them.
 */

interface TestFixedDateRangeValue {
  readonly range?: Maybe<DateRange>;
}

// MARK: Test Host
@Component({
  template: `
    <div dbxAction dbxActionEnforceModified dbxActionAutoTrigger useInstantTriggerPreset [dbxActionHandler]="handler">
      <dbx-forge dbxActionForm></dbx-forge>
    </div>
  `,
  imports: [DbxForgeFormComponent, DbxActionFormDirective, DbxCoreActionModule, DbxActionHandlerDirective],
  providers: [provideDbxForgeFormContext()]
})
class TestForgeFixedDateRangeActionHostComponent {
  readonly context = inject(DbxForgeFormContext);
  readonly handled = completeOnDestroy(new Subject<TestFixedDateRangeValue>());

  readonly handler: WorkUsingObservable<TestFixedDateRangeValue, boolean> = (value) => {
    this.handled.next(value);
    return of(true);
  };
}

// MARK: Filter Popover Host
@Component({
  template: `
    <dbx-filter-wrapper dbxActionEnforceModified dbxActionAutoTrigger useInstantTriggerPreset [showButtons]="false">
      <dbx-forge dbxActionForm></dbx-forge>
    </dbx-filter-wrapper>
  `,
  imports: [DbxFilterWrapperComponent, DbxForgeFormComponent, DbxActionFormDirective, DbxCoreActionModule],
  providers: [provideDbxForgeFormContext(), provideFilterSourceDirective(TestForgeFixedDateRangeFilterPopoverHostComponent), { provide: DbxFilterPopoverPendingChanges, useFactory: () => new DbxFilterPopoverPendingChangesInstance() }]
})
class TestForgeFixedDateRangeFilterPopoverHostComponent extends AbstractFilterSourceDirective<TestFixedDateRangeValue> {
  readonly context = inject(DbxForgeFormContext);
  readonly pendingChanges = inject(DbxFilterPopoverPendingChanges) as DbxFilterPopoverPendingChangesInstance;
}

const TEST_PROVIDERS = [provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

function createNormalRangeConfig(): FormConfig {
  return {
    fields: [
      dbxForgeFixedDateRangeField({
        key: 'range',
        props: {
          selectionMode: 'normal',
          dateRangeInput: { type: DateRangeType.CALENDAR_MONTH, distance: 1 },
          valueMode: DbxDateTimeValueMode.DATE
        }
      }) as any
    ]
  };
}

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await waitForMs(500);
  fixture.detectChanges();
  await waitForMs(50);
  fixture.detectChanges();

  // Typed text is cleared by the field's first inbound value sync, which can land after the fixed waits on a loaded machine.
  await firstValueFrom(getField(fixture).valueInSystemTimezone$);
}

function getField(fixture: ComponentFixture<unknown>): DbxForgeFixedDateRangeFieldComponent {
  return fixture.debugElement.query(By.directive(DbxForgeFixedDateRangeFieldComponent)).componentInstance as DbxForgeFixedDateRangeFieldComponent;
}

function typeIntoInput(fixture: ComponentFixture<unknown>, selector: string, date: Date): void {
  const input = fixture.debugElement.query(By.css(selector)).nativeElement as HTMLInputElement;
  input.value = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  input.dispatchEvent(new Event('input'));
}

function nextHandled(host: TestForgeFixedDateRangeActionHostComponent, ms: number): Promise<Maybe<TestFixedDateRangeValue>> {
  return firstValueFrom(
    host.handled.pipe(
      timeout(ms),
      catchError(() => of(undefined))
    )
  );
}

describe('DbxForgeFixedDateRangeFieldComponent in an auto-triggered action form', () => {
  const typedStart = addDays(startOfDay(new Date()), 3);
  const typedEnd = addDays(startOfDay(new Date()), 6);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgeFixedDateRangeActionHostComponent],
      providers: TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should reach the handler shortly after a calendar pick', async () => {
    const fixture = TestBed.createComponent(TestForgeFixedDateRangeActionHostComponent);
    const host = fixture.componentInstance;
    host.context.config = createNormalRangeConfig();
    await settle(fixture);

    const handled = nextHandled(host, 400);
    getField(fixture).selectedChange(typedStart);
    fixture.detectChanges();

    const value = await handled;
    expect(value?.range?.start.getTime()).toBe(typedStart.getTime());

    fixture.destroy();
  });

  it('should reach the handler shortly after typed dates are committed', async () => {
    const fixture = TestBed.createComponent(TestForgeFixedDateRangeActionHostComponent);
    const host = fixture.componentInstance;
    host.context.config = createNormalRangeConfig();
    await settle(fixture);

    typeIntoInput(fixture, 'input[matStartDate]', typedStart);
    typeIntoInput(fixture, 'input[matEndDate]', typedEnd);

    const handled = nextHandled(host, 400);
    getField(fixture).commitTextInput();
    fixture.detectChanges();

    const value = await handled;
    expect(value?.range?.start.getTime()).toBe(typedStart.getTime());

    fixture.destroy();
  });

  it('should apply uncommitted typed dates only after the typing debounce', async () => {
    const fixture = TestBed.createComponent(TestForgeFixedDateRangeActionHostComponent);
    const host = fixture.componentInstance;
    host.context.config = createNormalRangeConfig();
    await settle(fixture);

    // Checks the debounce, not latency: the typing debounce alone is 500ms, so the upper bound is generous.
    const handled = nextHandled(host, 3000);
    const early = nextHandled(host, 300);

    typeIntoInput(fixture, 'input[matStartDate]', typedStart);
    typeIntoInput(fixture, 'input[matEndDate]', typedEnd);
    fixture.detectChanges();

    expect(await early).toBeUndefined();

    const value = await handled;
    expect(value?.range?.start.getTime()).toBe(typedStart.getTime());

    fixture.destroy();
  });
});

describe('DbxForgeFixedDateRangeFieldComponent in a filter popover', () => {
  const typedStart = addDays(startOfDay(new Date()), 3);
  const typedEnd = addDays(startOfDay(new Date()), 6);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgeFixedDateRangeFilterPopoverHostComponent],
      providers: TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should apply committed typed dates synchronously when the popover applies pending changes before closing', async () => {
    const fixture = TestBed.createComponent(TestForgeFixedDateRangeFilterPopoverHostComponent);
    const host = fixture.componentInstance;
    host.context.config = createNormalRangeConfig();
    await settle(fixture);

    const setFilter = vi.spyOn(host, 'setFilter');

    typeIntoInput(fixture, 'input[matStartDate]', typedStart);
    typeIntoInput(fixture, 'input[matEndDate]', typedEnd);

    // what the filter popover does on Save: commit the input (blur), run pending effects, then apply pending changes; all synchronously
    getField(fixture).commitTextInput();
    TestBed.inject(ApplicationRef).tick();
    host.pendingChanges.applyPending();

    expect(setFilter).toHaveBeenCalledTimes(1);
    expect(setFilter.mock.calls[0][0].range?.start.getTime()).toBe(typedStart.getTime());

    fixture.destroy();
  });
});
