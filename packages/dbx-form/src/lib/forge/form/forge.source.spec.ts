import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, provideZonelessChangeDetection, inject } from '@angular/core';

import { type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { first, firstValueFrom, timeout, catchError, of, map, BehaviorSubject, Subject, delay as delayOp } from 'rxjs';
import { provideDbxForgeFormFieldDeclarations } from '../forge.providers';
import { provideDbxFormConfiguration } from '../../form.providers';
import { DbxForgeFormComponent } from './forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext } from './forge.context';
import { DbxFormSourceDirective } from '../../form/io/form.input.directive';
import { dbxForgeTextField } from '../field/value/text/text.field';
import { dbxForgeNumberField } from '../field/value/number/number.field';
import { waitForMs, type Maybe } from '@dereekb/util';
import type { ObservableOrValue } from '@dereekb/rxjs';
import type { DbxFormSourceDirectiveMode } from '../../form/io/form.input.directive';

// MARK: Interfaces
interface TestFormValue {
  readonly name: string;
  readonly age?: number;
}

// MARK: Test Host
@Component({
  template: `
    <dbx-forge [dbxFormSource]="source$ ?? undefined" [dbxFormSourceMode]="sourceMode"></dbx-forge>
  `,
  standalone: true,
  imports: [DbxForgeFormComponent, DbxFormSourceDirective],
  providers: [provideDbxForgeFormContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestForgeSourceHostComponent {
  readonly context = inject(DbxForgeFormContext) as DbxForgeFormContext<TestFormValue>;

  source$: Maybe<ObservableOrValue<Maybe<Partial<TestFormValue>>>>;
  sourceMode: Maybe<DbxFormSourceDirectiveMode>;
}

// MARK: Helpers
const TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

/**
 * Settles the fixture by running change detection and waiting for stability.
 *
 * The short delay is needed because dbxFormSource uses RxJS subscription chains
 * (combineLatest, switchMap, throttleTime) that schedule work across multiple
 * microtasks. whenStable() resolves before these intermediate emissions propagate
 * through to the form's signal-based value and back out to the context.
 */
async function settle(fixture: ComponentFixture<any>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await waitForMs(50);
  fixture.detectChanges();
  await fixture.whenStable();
}

function createNameFieldConfig(required = false): FormConfig {
  return {
    fields: [dbxForgeTextField({ key: 'name', label: 'Name', required }) as any]
  };
}

function createNameAndAgeFieldConfig(nameRequired = false): FormConfig {
  return {
    fields: [dbxForgeTextField({ key: 'name', label: 'Name', required: nameRequired }) as any, dbxForgeNumberField({ key: 'age', label: 'Age' }) as any]
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
describe('DbxFormSourceDirective with forge form', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgeSourceHostComponent],
      providers: TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('reset mode (default)', () => {
    it('should set the form value from a static source on initial reset', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      host.source$ = of({ name: 'Alice' });
      fixture.detectChanges();

      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect(result.value).toEqual({ name: 'Alice' });

      fixture.destroy();
    });

    it('should set the form value from a BehaviorSubject source on initial reset', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'Bob' });
      host.source$ = source$;
      fixture.detectChanges();

      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect(result.value).toEqual({ name: 'Bob' });

      fixture.destroy();
    });

    it('should not forward subsequent source changes in reset mode', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'First' });
      host.source$ = source$;
      fixture.detectChanges();

      await settle(fixture);

      // Verify initial value was set
      const initial = await tryGetValue(context);
      expect(initial.value).toEqual({ name: 'First' });

      // Emit a new value — should be ignored in reset mode
      source$.next({ name: 'Second' });
      await settle(fixture);

      const after = await tryGetValue(context);
      // Form should still have the first value since we're in USED state now
      expect(after.received).toBe(true);

      fixture.destroy();
    });

    it('should transition to USED state after dbxFormSource sets initial value', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      host.source$ = of({ name: 'Alice' });
      fixture.detectChanges();

      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      // After dbxFormSource sets the value, form should be USED (not stuck in RESET)
      expect(event.state).toBe(1); // DbxFormState.USED = 1

      fixture.destroy();
    });

    it('should emit RESET on stream$ after resetForm when form was USED', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      host.source$ = of({ name: 'Alice' });
      fixture.detectChanges();
      await settle(fixture);

      // Confirm USED
      const usedEvent = await firstValueFrom(context.stream$.pipe(first()));
      expect(usedEvent.state).toBe(1); // USED

      // Collect all state emissions after this point
      const states: number[] = [];
      const sub = context.stream$.subscribe((e) => states.push(e.state));

      context.resetForm();
      await settle(fixture);

      sub.unsubscribe();

      // Should have emitted at least one RESET (0) after the resetForm call
      expect(states).toContain(0); // DbxFormState.RESET = 0

      fixture.destroy();
    });

    it('should re-apply source value after resetForm() is called', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'Initial' });
      host.source$ = source$;
      fixture.detectChanges();

      await settle(fixture);

      // Initial value set
      const initial = await tryGetValue(context);
      expect(initial.value).toEqual({ name: 'Initial' });

      // Update the source (won't apply yet — reset mode ignores while USED)
      source$.next({ name: 'Updated' });
      await settle(fixture);

      // Reset the form — should re-apply the latest source value
      context.resetForm();
      await settle(fixture);

      const afterReset = await tryGetValue(context);
      expect(afterReset.received).toBe(true);
      expect(afterReset.value).toEqual({ name: 'Updated' });

      fixture.destroy();
    });

    it('should re-apply source value on multiple consecutive resets', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'V1' });
      host.source$ = source$;
      fixture.detectChanges();

      await settle(fixture);
      expect((await tryGetValue(context)).value).toEqual({ name: 'V1' });

      // First reset cycle
      source$.next({ name: 'V2' });
      context.resetForm();
      await settle(fixture);
      expect((await tryGetValue(context)).value).toEqual({ name: 'V2' });

      // Second reset cycle
      source$.next({ name: 'V3' });
      context.resetForm();
      await settle(fixture);
      expect((await tryGetValue(context)).value).toEqual({ name: 'V3' });

      fixture.destroy();
    });

    it('should forward value again after form is reset via setValue', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'Initial' });
      host.source$ = source$;
      fixture.detectChanges();

      await settle(fixture);

      // Initial value set
      const initial = await tryGetValue(context);
      expect(initial.value).toEqual({ name: 'Initial' });

      // Change source and reset the form
      source$.next({ name: 'After Reset' });
      context.setValue({ name: 'After Reset' });
      await settle(fixture);

      const afterReset = await tryGetValue(context);
      expect(afterReset.received).toBe(true);
      expect(afterReset.value).toEqual({ name: 'After Reset' });

      fixture.destroy();
    });
  });

  describe('always mode', () => {
    it('should forward values continuously', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'First' });
      host.source$ = source$;
      host.sourceMode = 'always';
      fixture.detectChanges();

      await settle(fixture);

      const first = await tryGetValue(context);
      expect(first.value).toEqual({ name: 'First' });

      // Emit a new value — should be forwarded in always mode
      source$.next({ name: 'Updated' });
      await settle(fixture);

      const updated = await tryGetValue(context);
      expect(updated.received).toBe(true);
      expect(updated.value).toEqual({ name: 'Updated' });

      fixture.destroy();
    });

    it('should forward multiple sequential updates', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'A' });
      host.source$ = source$;
      host.sourceMode = 'always';
      fixture.detectChanges();

      await settle(fixture);

      source$.next({ name: 'B' });
      await settle(fixture);

      source$.next({ name: 'C' });
      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.value).toEqual({ name: 'C' });

      fixture.destroy();
    });

    it('should continue forwarding values after resetForm()', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'Before' });
      host.source$ = source$;
      host.sourceMode = 'always';
      fixture.detectChanges();

      await settle(fixture);
      expect((await tryGetValue(context)).value).toEqual({ name: 'Before' });

      // Reset and update source
      context.resetForm();
      source$.next({ name: 'After' });
      await settle(fixture);

      expect((await tryGetValue(context)).value).toEqual({ name: 'After' });

      fixture.destroy();
    });
  });

  describe('every mode', () => {
    it('should forward values continuously like always mode', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'First' });
      host.source$ = source$;
      host.sourceMode = 'every';
      fixture.detectChanges();

      await settle(fixture);
      expect((await tryGetValue(context)).value).toEqual({ name: 'First' });

      source$.next({ name: 'Second' });
      await settle(fixture);
      expect((await tryGetValue(context)).value).toEqual({ name: 'Second' });

      fixture.destroy();
    });

    it('should forward multiple sequential updates', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'A' });
      host.source$ = source$;
      host.sourceMode = 'every';
      fixture.detectChanges();

      await settle(fixture);

      source$.next({ name: 'B' });
      await settle(fixture);

      source$.next({ name: 'C' });
      await settle(fixture);

      expect((await tryGetValue(context)).value).toEqual({ name: 'C' });

      fixture.destroy();
    });

    it('should continue forwarding values after resetForm()', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'Before' });
      host.source$ = source$;
      host.sourceMode = 'every';
      fixture.detectChanges();

      await settle(fixture);
      expect((await tryGetValue(context)).value).toEqual({ name: 'Before' });

      context.resetForm();
      source$.next({ name: 'After' });
      await settle(fixture);

      expect((await tryGetValue(context)).value).toEqual({ name: 'After' });

      fixture.destroy();
    });
  });

  describe('validation interaction', () => {
    it('should not emit getValue() when source provides empty value for required field', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig(true); // required

      host.source$ = of({ name: '' });
      fixture.detectChanges();

      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(false);

      fixture.destroy();
    });

    it('should emit getValue() when source provides valid value for required field', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig(true); // required

      host.source$ = of({ name: 'Valid' });
      fixture.detectChanges();

      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect(result.value).toEqual({ name: 'Valid' });

      fixture.destroy();
    });

    it('should emit invalid value when requireValid is false', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.requireValid = false;
      context.config = createNameFieldConfig(true); // required

      host.source$ = of({ name: '' });
      fixture.detectChanges();

      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);

      fixture.destroy();
    });

    it('should report isComplete=false in stream$ when source pushes invalid value', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig(true); // required

      // Push an empty value for a required field
      host.source$ = of({ name: '' });
      fixture.detectChanges();

      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(false);
      expect(event.status).toBe('INVALID');

      fixture.destroy();
    });

    it('should report isComplete=true in stream$ when source pushes valid value', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig(true); // required

      host.source$ = of({ name: 'Valid' });
      fixture.detectChanges();

      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(true);
      expect(event.status).toBe('VALID');

      fixture.destroy();
    });

    it('should transition from invalid to valid when source updates with always mode', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig(true); // required

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: '' });
      host.source$ = source$;
      host.sourceMode = 'always';
      fixture.detectChanges();

      await settle(fixture);

      // Should be invalid
      const invalidEvent = await firstValueFrom(context.stream$.pipe(first()));
      expect(invalidEvent.isComplete).toBe(false);

      // Push a valid value
      source$.next({ name: 'Now Valid' });
      await settle(fixture);

      const validEvent = await firstValueFrom(context.stream$.pipe(first()));
      expect(validEvent.isComplete).toBe(true);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect(result.value).toEqual({ name: 'Now Valid' });

      fixture.destroy();
    });

    it('should transition from valid to invalid when source clears a required field in always mode', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig(true); // required

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'Valid' });
      host.source$ = source$;
      host.sourceMode = 'always';
      fixture.detectChanges();

      await settle(fixture);

      // Should be valid
      const validResult = await tryGetValue(context);
      expect(validResult.received).toBe(true);

      // Clear the required field
      source$.next({ name: '' });
      await settle(fixture);

      const invalidEvent = await firstValueFrom(context.stream$.pipe(first()));
      expect(invalidEvent.isComplete).toBe(false);

      fixture.destroy();
    });
  });

  describe('multi-field forms', () => {
    it('should set partial values via source, leaving other fields at defaults', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameAndAgeFieldConfig();

      // Only provide name, not age
      host.source$ = of({ name: 'Alice' });
      fixture.detectChanges();

      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect((result.value as any)?.name).toBe('Alice');

      fixture.destroy();
    });

    it('should set all fields via source', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameAndAgeFieldConfig();

      host.source$ = of({ name: 'Alice', age: 30 });
      fixture.detectChanges();

      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect((result.value as any)?.name).toBe('Alice');
      expect((result.value as any)?.age).toBe(30);

      fixture.destroy();
    });

    it('should handle extra keys in source that do not match form fields', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      // Source has keys the form does not know about
      host.source$ = of({ name: 'Alice', unknownField: 'ignored' } as any);
      fixture.detectChanges();

      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect((result.value as any)?.name).toBe('Alice');

      fixture.destroy();
    });
  });

  describe('null / undefined source', () => {
    it('should not set form value when source is undefined', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig(true); // required

      host.source$ = undefined;
      fixture.detectChanges();

      await settle(fixture);

      // Form should remain at defaults (empty), and since required, getValue() should not emit
      const result = await tryGetValue(context);
      expect(result.received).toBe(false);

      fixture.destroy();
    });

    it('should not crash when source emits null', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Maybe<Partial<TestFormValue>>>(null);
      host.source$ = source$;
      fixture.detectChanges();

      await settle(fixture);

      // Form should still be functional with default values
      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.state).toBeDefined();

      fixture.destroy();
    });

    it('should set value after source transitions from null to a value in always mode', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Maybe<Partial<TestFormValue>>>(null);
      host.source$ = source$;
      host.sourceMode = 'always';
      fixture.detectChanges();

      await settle(fixture);

      // Transition to a real value
      source$.next({ name: 'Arrived' });
      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect(result.value).toEqual({ name: 'Arrived' });

      fixture.destroy();
    });
  });

  describe('empty value stripping', () => {
    it('should strip empty string values from source-provided data', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameAndAgeFieldConfig();

      // Provide name but empty string default for age
      host.source$ = of({ name: 'Alice', age: undefined } as any);
      fixture.detectChanges();

      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      // age should be stripped as empty
      expect((result.value as any)?.name).toBe('Alice');

      fixture.destroy();
    });
  });

  describe('delayed source (async formTemplate$)', () => {
    // Reproduces the OIDC client-update page scenario:
    //   formTemplate$ = store.data$.pipe(map(...))
    // The value arrives asynchronously, AFTER the form has rendered and
    // ng-forge has written its initial field defaults back through the
    // two-way [(value)] binding.
    //
    // The forge form must keep itself in RESET state during init so that
    // dbxFormSource 'reset' mode still forwards the async source value when
    // it eventually emits. Once the value is forwarded, the form applies it
    // over top of any ng-forge field defaults.
    it('should apply a delayed source value that arrives after the form has settled (reset mode)', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig(true); // required — forces ng-forge defaults writeback

      const source$ = new Subject<Partial<TestFormValue>>();
      host.source$ = source$;
      fixture.detectChanges();
      await settle(fixture);

      source$.next({ name: 'LateAsync' });
      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect(result.value).toEqual({ name: 'LateAsync' });

      fixture.destroy();
    });

    it('should apply a delayed source value via delay() operator (reset mode)', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig(true);

      host.source$ = of({ name: 'DelayedAsync' }).pipe(delayOp(100));
      fixture.detectChanges();

      await settle(fixture);
      await new Promise((resolve) => setTimeout(resolve, 150));
      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect(result.value).toEqual({ name: 'DelayedAsync' });

      fixture.destroy();
    });

    it('should apply an async source value when the config is also async and arrives after the source', async () => {
      // Reproduces the real OIDC flow where BOTH the FormConfig and the source
      // value arrive asynchronously. In that flow the source value typically
      // arrives AT OR BEFORE the config is loaded (Firestore prefetch), so the
      // value is set against the forge context while the form hasn't rendered
      // yet. ng-forge then renders, writes its defaults, and without the fix
      // would wipe the set value.
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;

      // Source emits immediately
      host.source$ = of({ name: 'AsyncConfigValue' });
      fixture.detectChanges();
      await settle(fixture);

      // Config arrives LATER (simulating async currentConfig$ in AbstractConfigAsyncForgeFormDirective).
      context.config = createNameFieldConfig(true);
      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect(result.value).toEqual({ name: 'AsyncConfigValue' });

      fixture.destroy();
    });

    it('should apply a delayed source value for a multi-field form with some undefined optional fields', async () => {
      // Models the OIDC form_value shape where logo_uri / client_uri can be
      // undefined. ng-forge must not throw NG01902 (orphan field) when a
      // provided key is undefined.
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameAndAgeFieldConfig(true);

      const source$ = new Subject<Partial<TestFormValue>>();
      host.source$ = source$;
      fixture.detectChanges();
      await settle(fixture);

      // Only `name` is defined; `age` is undefined — matching the real OIDC case.
      source$.next({ name: 'NameOnly', age: undefined } as Partial<TestFormValue>);
      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect((result.value as any)?.name).toBe('NameOnly');

      fixture.destroy();
    });
  });

  describe('late config assignment', () => {
    it('should work when config is assigned after source', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;

      // Set source before config
      host.source$ = of({ name: 'Early' });
      fixture.detectChanges();

      await settle(fixture);

      // Now assign config
      context.config = createNameFieldConfig();
      fixture.detectChanges();

      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect(result.value).toEqual({ name: 'Early' });

      fixture.destroy();
    });
  });

  describe('source change', () => {
    it('should update form when BehaviorSubject source emits new values in always mode', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'V1' });
      host.source$ = source$;
      host.sourceMode = 'always';
      fixture.detectChanges();

      await settle(fixture);

      expect((await tryGetValue(context)).value).toEqual({ name: 'V1' });

      source$.next({ name: 'V2' });
      await settle(fixture);

      expect((await tryGetValue(context)).value).toEqual({ name: 'V2' });

      source$.next({ name: 'V3' });
      await settle(fixture);

      expect((await tryGetValue(context)).value).toEqual({ name: 'V3' });

      fixture.destroy();
    });
  });

  describe('form state', () => {
    it('should still accept source values and report form state', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      host.source$ = of({ name: 'Hello' });
      fixture.detectChanges();

      await settle(fixture);

      // Form should report state correctly after source-driven value
      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.state).toBeDefined();
      expect(event.status).toBe('VALID');

      fixture.destroy();
    });
  });

  describe('disabled form', () => {
    it('should report isDisabled=true in stream$ when form is disabled', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      host.source$ = of({ name: 'Test' });
      fixture.detectChanges();

      await settle(fixture);

      // Disable the form
      context.setDisabled(undefined, true);
      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(true);
      expect(event.status).toBe('DISABLED');
      // isComplete stays true by default (emitValueWhenDisabled=true)
      expect(event.isComplete).toBe(true);

      fixture.destroy();
    });

    it('should report isDisabled=false after re-enabling the form', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      host.source$ = of({ name: 'Test' });
      fixture.detectChanges();

      await settle(fixture);

      // Disable then re-enable
      context.setDisabled(undefined, true);
      await settle(fixture);

      context.setDisabled(undefined, false);
      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(false);
      expect(event.status).toBe('VALID');
      expect(event.isComplete).toBe(true);

      fixture.destroy();
    });

    it('should accept source values while disabled and emit them when re-enabled', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      const source$ = new BehaviorSubject<Partial<TestFormValue>>({ name: 'Initial' });
      host.source$ = source$;
      host.sourceMode = 'always';
      fixture.detectChanges();

      await settle(fixture);

      // Disable the form
      context.setDisabled(undefined, true);
      await settle(fixture);

      // Push a new value while disabled
      source$.next({ name: 'While Disabled' });
      await settle(fixture);

      // Re-enable
      context.setDisabled(undefined, false);
      await settle(fixture);

      const result = await tryGetValue(context);
      expect(result.received).toBe(true);
      expect(result.value).toEqual({ name: 'While Disabled' });

      fixture.destroy();
    });

    it('should support multiple disable keys', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig();

      host.source$ = of({ name: 'Test' });
      fixture.detectChanges();

      await settle(fixture);

      // Disable with two different keys
      context.setDisabled('loading', true);
      context.setDisabled('saving', true);
      await settle(fixture);

      let event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(true);

      // Remove one key — still disabled because the other key remains
      context.setDisabled('loading', false);
      await settle(fixture);

      event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(true);

      // Remove the second key — now re-enabled
      context.setDisabled('saving', false);
      await settle(fixture);

      event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(false);
      expect(event.isComplete).toBe(true);

      fixture.destroy();
    });

    it('should report isComplete=true when form is disabled with valid values (emitValueWhenDisabled=true default)', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig(true); // required

      host.source$ = of({ name: 'Valid' });
      fixture.detectChanges();

      await settle(fixture);

      // Verify valid and complete first
      let event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(true);

      // Disable — isComplete stays true with emitValueWhenDisabled=true (default)
      context.setDisabled(undefined, true);
      await settle(fixture);

      event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(true);
      expect(event.isDisabled).toBe(true);

      fixture.destroy();
    });

    it('should report isComplete=false when form is disabled with emitValueWhenDisabled=false', async () => {
      const fixture = TestBed.createComponent(TestForgeSourceHostComponent);
      const host = fixture.componentInstance;
      const context = host.context;
      context.config = createNameFieldConfig(true); // required
      context.emitValueWhenDisabled = false;

      host.source$ = of({ name: 'Valid' });
      fixture.detectChanges();

      await settle(fixture);

      let event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(true);

      context.setDisabled(undefined, true);
      await settle(fixture);

      event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(false);
      expect(event.isDisabled).toBe(true);

      fixture.destroy();
    });
  });
});
