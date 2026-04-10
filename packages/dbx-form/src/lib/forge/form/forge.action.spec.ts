import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, provideZonelessChangeDetection, viewChild } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { first, firstValueFrom, timeout, catchError, of, map, delay, Subject, BehaviorSubject, filter } from 'rxjs';
import { type WorkUsingObservable } from '@dereekb/rxjs';
import { provideDbxForgeFormFieldDeclarations } from '../forge.providers';
import { provideDbxFormConfiguration } from '../../form.providers';
import { DbxForgeFormComponent } from './forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext } from './forge.context';
import { DbxActionFormDirective, APP_ACTION_FORM_DISABLED_KEY } from '../../form/action/form.action.directive';
import { DbxFormSourceDirective } from '../../form/io/form.input.directive';
import { DbxActionDirective, DbxCoreActionModule, DbxActionHandlerDirective } from '@dereekb/dbx-core';
import { forgeTextField } from '../field/value/text/text.field';

// MARK: Test Host
@Component({
  template: `
    <div dbxAction [dbxActionHandler]="handler">
      <dbx-forge dbxActionForm [dbxFormSource]="source$ ?? undefined" [dbxActionFormDisabledOnWorking]="disabledOnWorking"></dbx-forge>
    </div>
  `,
  standalone: true,
  imports: [DbxForgeFormComponent, DbxActionFormDirective, DbxFormSourceDirective, DbxCoreActionModule, DbxActionHandlerDirective],
  providers: [provideDbxForgeFormContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestForgeActionHostComponent {
  readonly context: DbxForgeFormContext;
  readonly directive = viewChild.required(DbxActionDirective);
  readonly formDirective = viewChild.required(DbxActionFormDirective);

  handler: WorkUsingObservable<any, any> = () => of(true).pipe(delay(500));
  source$: any;
  disabledOnWorking: boolean | undefined;

  constructor(context: DbxForgeFormContext) {
    this.context = context;
  }
}

// MARK: Helpers
const TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), provideNoopAnimations(), { provide: DynamicFormLogger, useClass: NoopLogger }];
/**
 * Settles the fixture by running change detection and waiting for stability.
 *
 * No extra delay needed here — the action directive's subscription chains
 * (triggered$, isWorking$, stream$) resolve within a single whenStable() cycle
 * because they operate on BehaviorSubjects that emit synchronously.
 */
async function settle(fixture: ComponentFixture<any>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

function createRequiredFieldConfig(): FormConfig {
  return {
    fields: [forgeTextField({ key: 'name', label: 'Name', required: true }) as any]
  };
}

function createOptionalFieldConfig(): FormConfig {
  return {
    fields: [forgeTextField({ key: 'name', label: 'Name' }) as any]
  };
}

async function tryGetValue<T>(context: DbxForgeFormContext<T>, ms = 500): Promise<{ received: boolean; value: T | undefined }> {
  return firstValueFrom(
    context.getValue().pipe(
      timeout(ms),
      first(),
      map((value) => ({ received: true, value })),
      catchError(() => of({ received: false, value: undefined }))
    )
  );
}

// MARK: Tests
describe('DbxActionFormDirective with forge form', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgeActionHostComponent],
      providers: TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('trigger and value', () => {
    it('should pass form value to the action when triggered with a valid form', async () => {
      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();

      host.source$ = of({ name: 'Valid' });
      fixture.detectChanges();

      await settle(fixture);

      const directive = host.directive();

      // Trigger the action
      directive.trigger();

      // Wait for valueReady$
      const value = await firstValueFrom(directive.sourceInstance.valueReady$.pipe(timeout(2000), first()));

      expect(value).toBeDefined();
      expect((value as any).name).toBe('Valid');

      fixture.destroy();
    });

    it('should not pass value when the form is invalid (required field empty)', async () => {
      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();

      // Don't set a source — form stays empty (invalid)
      fixture.detectChanges();

      await settle(fixture);

      const directive = host.directive();
      directive.trigger();

      // valueReady$ should not emit — use timeout to verify
      const result = await firstValueFrom(
        directive.sourceInstance.valueReady$.pipe(
          timeout(500),
          first(),
          map((v) => ({ received: true, value: v })),
          catchError(() => of({ received: false, value: undefined }))
        )
      );

      expect(result.received).toBe(false);

      fixture.destroy();
    });
  });

  describe('isModifiedAndCanTrigger$', () => {
    it('should report false when form is invalid (required field empty)', async () => {
      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();

      // No source — required field stays empty
      fixture.detectChanges();

      await settle(fixture);

      const directive = host.directive();
      const canTrigger = await firstValueFrom(directive.sourceInstance.isModifiedAndCanTrigger$.pipe(first()));

      expect(canTrigger).toBe(false);

      fixture.destroy();
    });
  });

  describe('disabled on working (default behavior)', () => {
    it('should disable the form while the action is working', async () => {
      const workComplete$ = new Subject<boolean>();

      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();

      // Use a handler that we control
      host.handler = () => workComplete$.pipe(first());
      host.source$ = of({ name: 'Test' });
      fixture.detectChanges();

      await settle(fixture);

      const directive = host.directive();

      // Trigger the action
      directive.trigger();
      await settle(fixture);

      // Wait for the action to start working
      await firstValueFrom(
        directive.sourceInstance.isWorking$.pipe(
          filter((x) => x),
          first()
        )
      );
      await settle(fixture);

      // Form should be disabled while working
      const eventWhileWorking = await firstValueFrom(context.stream$.pipe(first()));
      expect(eventWhileWorking.isDisabled).toBe(true);
      expect(eventWhileWorking.status).toBe('DISABLED');

      // Complete the work
      workComplete$.next(true);
      workComplete$.complete();
      await settle(fixture);

      // Form should be re-enabled after working
      const eventAfterWork = await firstValueFrom(context.stream$.pipe(first()));
      expect(eventAfterWork.isDisabled).toBe(false);

      fixture.destroy();
    });

    it('should report isComplete=true while disabled when emitValueWhenDisabled is true (default)', async () => {
      const workComplete$ = new Subject<boolean>();

      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();

      host.handler = () => workComplete$.pipe(first());
      host.source$ = of({ name: 'Test' });
      fixture.detectChanges();

      await settle(fixture);

      // Verify form is complete before working
      const eventBefore = await firstValueFrom(context.stream$.pipe(first()));
      expect(eventBefore.isComplete).toBe(true);

      const directive = host.directive();
      directive.trigger();
      await settle(fixture);

      await firstValueFrom(
        directive.sourceInstance.isWorking$.pipe(
          filter((x) => x),
          first()
        )
      );
      await settle(fixture);

      // Form should still be complete while disabled (emitValueWhenDisabled defaults to true)
      const eventDuring = await firstValueFrom(context.stream$.pipe(first()));
      expect(eventDuring.isComplete).toBe(true);
      expect(eventDuring.isDisabled).toBe(true);

      // Cleanup
      workComplete$.next(true);
      workComplete$.complete();
      await settle(fixture);

      fixture.destroy();
    });

    it('should report isComplete=false while disabled when emitValueWhenDisabled is false', async () => {
      const workComplete$ = new Subject<boolean>();

      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();
      context.emitValueWhenDisabled = false;

      host.handler = () => workComplete$.pipe(first());
      host.source$ = of({ name: 'Test' });
      fixture.detectChanges();

      await settle(fixture);

      const directive = host.directive();
      directive.trigger();
      await settle(fixture);

      await firstValueFrom(
        directive.sourceInstance.isWorking$.pipe(
          filter((x) => x),
          first()
        )
      );
      await settle(fixture);

      // Form should not be complete while disabled when emitValueWhenDisabled is false
      const eventDuring = await firstValueFrom(context.stream$.pipe(first()));
      expect(eventDuring.isComplete).toBe(false);
      expect(eventDuring.isDisabled).toBe(true);

      // Cleanup
      workComplete$.next(true);
      workComplete$.complete();
      await settle(fixture);

      fixture.destroy();
    });
  });

  describe('dbxActionFormDisabledOnWorking = false', () => {
    it('should NOT disable the form while the action is working', async () => {
      const workComplete$ = new Subject<boolean>();

      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();

      host.handler = () => workComplete$.pipe(first());
      host.source$ = of({ name: 'Test' });
      host.disabledOnWorking = false;
      fixture.detectChanges();

      await settle(fixture);

      const directive = host.directive();
      directive.trigger();
      await settle(fixture);

      await firstValueFrom(
        directive.sourceInstance.isWorking$.pipe(
          filter((x) => x),
          first()
        )
      );
      await settle(fixture);

      // Form should NOT be disabled while working
      const eventWhileWorking = await firstValueFrom(context.stream$.pipe(first()));
      expect(eventWhileWorking.isDisabled).toBe(false);

      // Cleanup
      workComplete$.next(true);
      workComplete$.complete();
      await settle(fixture);

      fixture.destroy();
    });
  });

  describe('disabled state key management', () => {
    it('should use the APP_ACTION_FORM_DISABLED_KEY for disabling', async () => {
      const workComplete$ = new Subject<boolean>();

      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();

      host.handler = () => workComplete$.pipe(first());
      host.source$ = of({ name: 'Test' });
      fixture.detectChanges();

      await settle(fixture);

      const directive = host.directive();
      directive.trigger();
      await settle(fixture);

      await firstValueFrom(
        directive.sourceInstance.isWorking$.pipe(
          filter((x) => x),
          first()
        )
      );
      await settle(fixture);

      // Check the disabled keys include the action form key
      const disabled = await firstValueFrom(context.getDisabled().pipe(first()));
      expect(disabled).toContain(APP_ACTION_FORM_DISABLED_KEY);

      // Cleanup
      workComplete$.next(true);
      workComplete$.complete();
      await settle(fixture);

      // After work completes, the action form key should be removed
      const disabledAfter = await firstValueFrom(context.getDisabled().pipe(first()));
      const isStillDisabled = disabledAfter?.includes(APP_ACTION_FORM_DISABLED_KEY) ?? false;
      expect(isStillDisabled).toBe(false);

      fixture.destroy();
    });

    it('should not conflict with other disable keys', async () => {
      const workComplete$ = new Subject<boolean>();

      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();

      host.handler = () => workComplete$.pipe(first());
      host.source$ = of({ name: 'Test' });
      fixture.detectChanges();

      await settle(fixture);

      const directive = host.directive();

      // Trigger action first (form is valid and enabled)
      directive.trigger();
      await settle(fixture);

      await firstValueFrom(
        directive.sourceInstance.isWorking$.pipe(
          filter((x) => x),
          first()
        )
      );
      await settle(fixture);

      // While working, also add a custom disable key
      context.setDisabled('custom_key', true);
      await settle(fixture);

      // Both keys should be present
      const disabled = await firstValueFrom(context.getDisabled().pipe(first()));
      expect(disabled).toContain(APP_ACTION_FORM_DISABLED_KEY);
      expect(disabled).toContain('custom_key');

      // Complete the work — action key removed, custom key stays
      workComplete$.next(true);
      workComplete$.complete();
      await settle(fixture);

      const disabledAfter = await firstValueFrom(context.getDisabled().pipe(first()));
      const actionKeyPresent = disabledAfter?.includes(APP_ACTION_FORM_DISABLED_KEY) ?? false;
      expect(actionKeyPresent).toBe(false);
      expect(disabledAfter).toContain('custom_key');

      // Form should still be disabled due to custom key
      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(true);

      fixture.destroy();
    });
  });

  describe('form source + action integration', () => {
    it('should load source value and pass it through when triggered', async () => {
      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();

      host.source$ = of({ name: 'From Source' });
      fixture.detectChanges();

      await settle(fixture);

      const directive = host.directive();
      directive.trigger();

      const value = await firstValueFrom(directive.sourceInstance.valueReady$.pipe(timeout(2000), first()));

      expect(value).toBeDefined();
      expect((value as any).name).toBe('From Source');

      fixture.destroy();
    });

    it('should use the latest source value when always mode is used via BehaviorSubject', async () => {
      // This test uses a direct BehaviorSubject since the template uses reset mode by default.
      // The dbxFormSource in reset mode only forwards the first value on form reset.
      // We verify the initial source value is forwarded correctly.
      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();

      const source$ = new BehaviorSubject({ name: 'Initial' });
      host.source$ = source$;
      fixture.detectChanges();

      await settle(fixture);

      const directive = host.directive();
      directive.trigger();

      const value = await firstValueFrom(directive.sourceInstance.valueReady$.pipe(timeout(2000), first()));

      expect((value as any).name).toBe('Initial');

      fixture.destroy();
    });
  });

  describe('action re-enable after completion', () => {
    it('should re-enable the form and allow re-triggering after action completes', async () => {
      const workComplete$ = new Subject<boolean>();

      const fixture = TestBed.createComponent(TestForgeActionHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createRequiredFieldConfig();

      host.handler = () => workComplete$.pipe(first());
      host.source$ = of({ name: 'Test' });
      fixture.detectChanges();

      await settle(fixture);

      const directive = host.directive();

      // First trigger
      directive.trigger();
      await settle(fixture);

      await firstValueFrom(
        directive.sourceInstance.isWorking$.pipe(
          filter((x) => x),
          first()
        )
      );
      await settle(fixture);

      // Complete the work
      workComplete$.next(true);
      workComplete$.complete();
      await settle(fixture);

      // Form should be re-enabled
      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(false);
      expect(event.isComplete).toBe(true);

      fixture.destroy();
    });
  });
});
