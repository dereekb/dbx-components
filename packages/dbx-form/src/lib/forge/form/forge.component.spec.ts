import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, provideZonelessChangeDetection, inject } from '@angular/core';

import { type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { first, firstValueFrom, timeout, catchError, of, map } from 'rxjs';
import { provideDbxForgeFormFieldDeclarations } from '../forge.providers';
import { provideDbxFormConfiguration } from '../../form.providers';
import { DbxForgeFormComponent } from './forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext, stripForgeInternalKeys, stripEmptyForgeValues } from './forge.context';
import { forgeTextField } from '../field/value/text/text.field';
import { forgeToggleWrapper } from '../field/wrapper/wrapper';
import { DBX_FORGE_FORM_COMPONENT_TEMPLATE } from './forge.component.template';

// MARK: Test Host
@Component({
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  standalone: true,
  imports: [DbxForgeFormComponent],
  providers: [provideDbxForgeFormContext()],
  changeDetection: ChangeDetectionStrategy.OnPush
})
class TestForgeFormHostComponent {
  readonly context = inject(DbxForgeFormContext);
}

// MARK: Helpers
export const DBX_FORGE_TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

/**
 * Settles the fixture by running change detection and waiting for stability.
 *
 * No extra delay needed — the forge form component uses signal effects that
 * resolve within a single whenStable() cycle for basic form state and value tests.
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

// MARK: Tests
describe('DbxForgeFormComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgeFormHostComponent],
      providers: DBX_FORGE_TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('validation gating (requireValid = true)', () => {
    it('should not emit getValue() when a required field is empty', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      // getValue() should not emit because the required field is empty
      const result = await firstValueFrom(
        context.getValue().pipe(
          timeout(500),
          first(),
          map((value) => ({ received: true, value })),
          catchError(() => of({ received: false, value: undefined }))
        )
      );

      expect(result.received).toBe(false);
      fixture.destroy();
    });

    it('should emit getValue() when a required field has a value', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      // Set a valid value
      context.setValue({ name: 'Test' } as any);
      await settle(fixture);

      const result = await firstValueFrom(
        context.getValue().pipe(
          timeout(500),
          first(),
          map((value) => ({ received: true, value })),
          catchError(() => of({ received: false, value: undefined }))
        )
      );

      expect(result.received).toBe(true);
      expect((result.value as any)?.name).toBe('Test');
      fixture.destroy();
    });

    it('should emit getValue() for optional fields even when empty', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createOptionalFieldConfig();

      await settle(fixture);

      const result = await firstValueFrom(
        context.getValue().pipe(
          timeout(500),
          first(),
          map((value) => ({ received: true, value })),
          catchError(() => of({ received: false, value: undefined }))
        )
      );

      expect(result.received).toBe(true);
      fixture.destroy();
    });

    it('should report isComplete=false in stream$ when required field is empty', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(false);
      expect(event.status).toBe('INVALID');
      fixture.destroy();
    });

    it('should report isComplete=true in stream$ when required field has a value', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      context.setValue({ name: 'Valid' } as any);
      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(true);
      expect(event.status).toBe('VALID');
      fixture.destroy();
    });
  });

  describe('requireValid = false', () => {
    it('should emit getValue() even when a required field is empty', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      const result = await firstValueFrom(
        context.getValue().pipe(
          timeout(500),
          first(),
          map((value) => ({ received: true, value })),
          catchError(() => of({ received: false, value: undefined }))
        )
      );

      expect(result.received).toBe(true);
      fixture.destroy();
    });

    it('should still report isComplete=false in stream$ when invalid', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(false);
      fixture.destroy();
    });
  });

  describe('stripInternalKeys (default true)', () => {
    it('should strip _ prefixed keys from toggle wrapper output', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false; // let values through regardless of validation

      context.config = {
        fields: [
          forgeToggleWrapper({
            label: 'Show details',
            fields: [forgeTextField({ key: 'detail', label: 'Detail' }) as any]
          }) as any
        ]
      };

      await settle(fixture);

      const value = await firstValueFrom(context.getValue().pipe(timeout(500), first()));

      // Should not have any keys starting with _
      const keys = Object.keys(value as object);
      const underscoreKeys = keys.filter((k) => k.startsWith('_'));
      expect(underscoreKeys).toEqual([]);

      fixture.destroy();
    });

    it('should preserve domain model keys from inside wrappers', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;

      context.config = {
        fields: [
          forgeToggleWrapper({
            label: 'Show details',
            defaultOpen: true,
            fields: [forgeTextField({ key: 'name', label: 'Name' }) as any]
          }) as any
        ]
      };

      await settle(fixture);

      // Set a non-empty value so it survives empty value stripping
      context.setValue({ name: 'Test' } as any);
      await settle(fixture);

      const value = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
      expect(value).toHaveProperty('name');
      expect((value as any).name).toBe('Test');

      fixture.destroy();
    });
  });

  describe('stripInternalKeys = false', () => {
    it('should preserve _ prefixed keys in output', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.stripInternalKeys = false;

      context.config = {
        fields: [
          forgeToggleWrapper({
            label: 'Show details',
            fields: [forgeTextField({ key: 'detail', label: 'Detail' }) as any]
          }) as any
        ]
      };

      await settle(fixture);

      const value = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
      const keys = Object.keys(value as object);
      const underscoreKeys = keys.filter((k) => k.startsWith('_'));
      expect(underscoreKeys.length).toBeGreaterThan(0);

      fixture.destroy();
    });
  });

  describe('disabled state', () => {
    it('should report isDisabled=true and status=DISABLED when form is disabled', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createOptionalFieldConfig();

      await settle(fixture);

      context.setDisabled(undefined, true);
      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(true);
      expect(event.status).toBe('DISABLED');
      // isComplete stays true by default (emitValueWhenDisabled=true)
      expect(event.isComplete).toBe(true);

      fixture.destroy();
    });

    it('should restore isDisabled=false after re-enabling', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createOptionalFieldConfig();

      await settle(fixture);

      context.setDisabled(undefined, true);
      await settle(fixture);

      context.setDisabled(undefined, false);
      await settle(fixture);

      const event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(false);
      expect(event.isComplete).toBe(true);

      fixture.destroy();
    });

    it('should track multiple disable keys independently', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createOptionalFieldConfig();

      await settle(fixture);

      context.setDisabled('key_a', true);
      context.setDisabled('key_b', true);
      await settle(fixture);

      let event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(true);

      // Remove one key — still disabled
      context.setDisabled('key_a', false);
      await settle(fixture);

      event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(true);

      // Remove last key — now enabled
      context.setDisabled('key_b', false);
      await settle(fixture);

      event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isDisabled).toBe(false);

      fixture.destroy();
    });

    it('should report isComplete=true when valid and disabled with emitValueWhenDisabled=true (default)', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createRequiredFieldConfig();

      await settle(fixture);

      context.setValue({ name: 'Valid' } as any);
      await settle(fixture);

      // Confirm valid and complete
      let event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(true);
      expect(event.status).toBe('VALID');

      // Disable
      context.setDisabled(undefined, true);
      await settle(fixture);

      event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(true);
      expect(event.isDisabled).toBe(true);
      expect(event.status).toBe('DISABLED');

      fixture.destroy();
    });

    it('should report isComplete=false when valid and disabled with emitValueWhenDisabled=false', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createRequiredFieldConfig();
      context.emitValueWhenDisabled = false;

      await settle(fixture);

      context.setValue({ name: 'Valid' } as any);
      await settle(fixture);

      let event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(true);

      context.setDisabled(undefined, true);
      await settle(fixture);

      event = await firstValueFrom(context.stream$.pipe(first()));
      expect(event.isComplete).toBe(false);
      expect(event.isDisabled).toBe(true);
      expect(event.status).toBe('DISABLED');

      fixture.destroy();
    });

    it('should expose disabled state via getDisabled()', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const context = fixture.componentInstance.context;
      context.config = createOptionalFieldConfig();

      await settle(fixture);

      context.setDisabled('test_key', true);
      await settle(fixture);

      const disabled = await firstValueFrom(context.getDisabled().pipe(first()));
      expect(disabled).toContain('test_key');

      fixture.destroy();
    });

    it('should propagate disabled to DynamicForm via formOptions', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const forgeComponent = fixture.debugElement.children[0].componentInstance as DbxForgeFormComponent;
      const context = fixture.componentInstance.context;
      context.config = createOptionalFieldConfig();

      await settle(fixture);

      // Initially not disabled
      expect(forgeComponent.isDisabled()).toBe(false);
      expect(forgeComponent.formOptionsSignal()).toBeUndefined();

      // Disable via context
      context.setDisabled(undefined, true);
      await settle(fixture);

      // formOptionsSignal should now return { disabled: true }
      expect(forgeComponent.isDisabled()).toBe(true);
      expect(forgeComponent.formOptionsSignal()).toEqual({ disabled: true });

      // The DynamicForm should report disabled
      const dynamicForm = forgeComponent.dynamicForm();
      expect(dynamicForm).toBeTruthy();
      expect(dynamicForm!.disabled()).toBe(true);

      fixture.destroy();
    });

    it('should propagate disabled to DynamicForm.disabled() signal (form-level, not field-level)', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const forgeComponent = fixture.debugElement.children[0].componentInstance as DbxForgeFormComponent;
      const context = fixture.componentInstance.context;
      context.config = createOptionalFieldConfig();

      await settle(fixture);

      // Disable
      context.setDisabled(undefined, true);
      await settle(fixture);

      // DynamicForm exposes a form-level disabled signal
      const dynamicForm = forgeComponent.dynamicForm();
      expect(dynamicForm).toBeTruthy();
      expect(dynamicForm!.disabled()).toBe(true);

      // Note: FormOptions.disabled does NOT propagate to individual FieldState.disabled().
      // Custom field components use inject(FORM_OPTIONS) to read form-level disabled instead.

      fixture.destroy();
    });

    it('should re-enable DynamicForm.disabled() after un-disabling', async () => {
      const fixture = TestBed.createComponent(TestForgeFormHostComponent);
      const forgeComponent = fixture.debugElement.children[0].componentInstance as DbxForgeFormComponent;
      const context = fixture.componentInstance.context;
      context.config = createOptionalFieldConfig();

      await settle(fixture);

      // Disable then re-enable
      context.setDisabled(undefined, true);
      await settle(fixture);

      context.setDisabled(undefined, false);
      await settle(fixture);

      const dynamicForm = forgeComponent.dynamicForm();
      expect(dynamicForm!.disabled()).toBe(false);

      fixture.destroy();
    });
  });
});

// MARK: stripForgeInternalKeys unit tests
describe('stripForgeInternalKeys()', () => {
  it('should strip primitive _ keys', () => {
    const result = stripForgeInternalKeys({ _toggle_1: false, name: 'Bob' });
    expect(result).toEqual({ name: 'Bob' });
  });

  it('should unwrap object _ keys (sections)', () => {
    const result = stripForgeInternalKeys({ _section_6: { name: '' } });
    expect(result).toEqual({ name: '' });
  });

  it('should handle mixed toggle + section output', () => {
    const result = stripForgeInternalKeys({ _toggle_1: false, _section_6: { name: '' } });
    expect(result).toEqual({ name: '' });
  });

  it('should handle nested sections', () => {
    const result = stripForgeInternalKeys({
      _section_1: {
        _subsection_1: { email: 'x' },
        name: 'y'
      }
    });
    expect(result).toEqual({ email: 'x', name: 'y' });
  });

  it('should preserve non-underscore keys', () => {
    const result = stripForgeInternalKeys({ firstName: 'Alice', lastName: 'Smith' });
    expect(result).toEqual({ firstName: 'Alice', lastName: 'Smith' });
  });

  it('should preserve arrays', () => {
    const result = stripForgeInternalKeys({ items: [1, 2, 3] });
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('should preserve Date values', () => {
    const date = new Date('2026-04-15T05:00:00.000Z');
    const result = stripForgeInternalKeys({ start: date, _toggle_1: false });
    expect(result).toEqual({ start: date });
    expect((result as any).start).toBe(date);
  });

  it('should return null/undefined as-is', () => {
    expect(stripForgeInternalKeys(null)).toBe(null);
    expect(stripForgeInternalKeys(undefined)).toBe(undefined);
  });

  it('should return primitives as-is', () => {
    expect(stripForgeInternalKeys('hello' as any)).toBe('hello');
    expect(stripForgeInternalKeys(42 as any)).toBe(42);
  });

  it('should recursively clean non-underscore object values', () => {
    const result = stripForgeInternalKeys({
      profile: { _toggle_1: true, name: 'Bob' }
    });
    expect(result).toEqual({ profile: { name: 'Bob' } });
  });
});

// MARK: stripEmptyForgeValues unit tests
describe('stripEmptyForgeValues()', () => {
  it('should strip empty string values', () => {
    const result = stripEmptyForgeValues({ name: '', age: 25 });
    expect(result).toEqual({ age: 25 });
  });

  it('should strip null values', () => {
    const result = stripEmptyForgeValues({ name: null, active: true });
    expect(result).toEqual({ active: true });
  });

  it('should strip undefined values', () => {
    const result = stripEmptyForgeValues({ name: undefined, count: 0 });
    expect(result).toEqual({ count: 0 });
  });

  it('should preserve false values', () => {
    const result = stripEmptyForgeValues({ toggle: false, name: '' });
    expect(result).toEqual({ toggle: false });
  });

  it('should preserve zero values', () => {
    const result = stripEmptyForgeValues({ count: 0, label: '' });
    expect(result).toEqual({ count: 0 });
  });

  it('should preserve empty arrays', () => {
    const result = stripEmptyForgeValues({ items: [], name: '' });
    expect(result).toEqual({ items: [] });
  });

  it('should preserve non-empty arrays', () => {
    const result = stripEmptyForgeValues({ items: [1, 2, 3] });
    expect(result).toEqual({ items: [1, 2, 3] });
  });

  it('should recursively strip nested empty values', () => {
    const result = stripEmptyForgeValues({ profile: { name: '', email: '' } });
    expect(result).toEqual({});
  });

  it('should keep nested objects with non-empty values', () => {
    const result = stripEmptyForgeValues({ profile: { name: 'Bob', email: '' } });
    expect(result).toEqual({ profile: { name: 'Bob' } });
  });

  it('should handle deeply nested objects', () => {
    const result = stripEmptyForgeValues({
      a: { b: { c: '', d: 'keep' }, e: null }
    });
    expect(result).toEqual({ a: { b: { d: 'keep' } } });
  });

  it('should return null/undefined as-is', () => {
    expect(stripEmptyForgeValues(null)).toBe(null);
    expect(stripEmptyForgeValues(undefined)).toBe(undefined);
  });

  it('should return primitives as-is', () => {
    expect(stripEmptyForgeValues('hello' as any)).toBe('hello');
    expect(stripEmptyForgeValues(42 as any)).toBe(42);
  });

  it('should preserve Date values', () => {
    const date = new Date('2026-04-15T05:00:00.000Z');
    const result = stripEmptyForgeValues({ start: date, end: '' });
    expect(result).toEqual({ start: date });
    expect((result as any).start).toBe(date);
  });

  it('should preserve Date values alongside other non-empty values', () => {
    const start = new Date('2026-04-15T05:00:00.000Z');
    const end = new Date('2026-04-20T05:00:00.000Z');
    const result = stripEmptyForgeValues({ start, end, name: 'test' });
    expect(result).toEqual({ start, end, name: 'test' });
  });

  it('should return empty object when all values are empty', () => {
    const result = stripEmptyForgeValues({ a: '', b: null, c: undefined });
    expect(result).toEqual({});
  });

  it('should work with combined stripForgeInternalKeys output', () => {
    const afterInternalStrip = stripForgeInternalKeys({
      _toggle_1: false,
      _section_6: { name: '', email: '' }
    });
    const result = stripEmptyForgeValues(afterInternalStrip);
    expect(result).toEqual({});
  });

  it('should preserve values from combined strip when non-empty', () => {
    const afterInternalStrip = stripForgeInternalKeys({
      _toggle_1: false,
      _section_6: { name: 'Bob', email: '' }
    });
    const result = stripEmptyForgeValues(afterInternalStrip);
    expect(result).toEqual({ name: 'Bob' });
  });
});
