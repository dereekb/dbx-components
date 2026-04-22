/**
 * Exhaustive type and runtime tests for the pickable chip forge field.
 */
import { describe, it, expect } from 'vitest';
import { expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type SchemaApplicationConfig, type ValidatorConfig, type ValidationMessages, type FormConfig, DynamicForm, EventDispatcher, DynamicFormLogger, NoopLogger, withLoggerConfig } from '@ng-forge/dynamic-forms';
import { of } from 'rxjs';
import type { DbxForgePickableChipFieldConfig } from './pickable-chip.field';
import { dbxForgePickableChipField } from './pickable-chip.field';
import type { DbxForgePickableChipFieldDef, DbxForgePickableFieldProps } from './pickable.field';
import { DbxForgePickableChipFieldComponent } from './pickable-chip.field.component';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, ChangeDetectionStrategy, signal, provideZonelessChangeDetection } from '@angular/core';
import { By } from '@angular/platform-browser';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';
import { firstValueFrom } from 'rxjs';
import { waitForMs, type Maybe } from '@dereekb/util';
import { provideDbxForgeFormFieldDeclarations } from '../../../forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';

// MARK: Shared Stubs
const stubLoadValues = () => of([{ value: 'a' }, { value: 'b' }]);
const stubDisplayForValue = (values: { value: string }[]) => of(values.map((v) => ({ ...v, label: String(v.value) })));
const stubFilterValues = (_text: string | undefined | null, values: { value: string }[]) => of(values.map((v) => v.value));

// ============================================================================
// DbxForgePickableChipFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgePickableChipFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgePickableChipFieldDef>
    | 'key'
    | 'label'
    | 'placeholder'
    | 'value'
    | 'required'
    | 'readonly'
    | 'disabled'
    | 'hidden'
    | 'className'
    | 'meta'
    | 'logic'
    | 'props'
    | 'hint'
    | 'description'
    | 'pattern'
    | 'minLength'
    | 'maxLength'
    | 'min'
    | 'max'
    | 'email'
    | 'validators'
    | 'validationMessages'
    | 'derivation'
    | 'schemas'
    | 'wrappers'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    | 'nullable'
    // Phantom brand
    | '__fieldDef';

  type ActualKeys = keyof DbxForgePickableChipFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('inherited optional keys', () => {
    it('label', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['label']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('required', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['required']>().toEqualTypeOf<boolean | undefined>();
    });

    it('validators', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['validators']>().toEqualTypeOf<ValidatorConfig[] | undefined>();
    });

    it('validationMessages', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['validationMessages']>().toEqualTypeOf<ValidationMessages | undefined>();
    });

    it('schemas', () => {
      expectTypeOf<DbxForgePickableChipFieldConfig['schemas']>().toEqualTypeOf<SchemaApplicationConfig[] | undefined>();
    });
  });

  describe('generic type parameter preservation', () => {
    it('value preserves generic type', () => {
      type StringConfig = DbxForgePickableChipFieldConfig<string>;
      expectTypeOf<StringConfig['value']>().toEqualTypeOf<string | string[] | undefined>();
    });

    it('hint is accessible with concrete generics', () => {
      // hint/description are conditional on the props type having a hint property.
      // With default generics the conditional defers to never; with concrete types it resolves.
      const config: DbxForgePickableChipFieldConfig<string> = { key: 'test', hint: 'test hint' } as any;
      expect(config.hint).toBe('test hint');
    });
  });
});

// ============================================================================
// DbxForgePickableChipFieldDef - Exhaustive Whitelist
// ============================================================================

describe('DbxForgePickableChipFieldDef - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From FieldDef
    | 'key'
    | 'type'
    | 'label'
    | 'props'
    | 'className'
    | 'disabled'
    | 'readonly'
    | 'hidden'
    | 'tabIndex'
    | 'col'
    | 'meta'
    // Value exclusion config
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    // From FieldWithValidation
    | 'required'
    | 'email'
    | 'min'
    | 'max'
    | 'minLength'
    | 'maxLength'
    | 'pattern'
    | 'validators'
    | 'validationMessages'
    | 'logic'
    | 'derivation'
    | 'schemas'
    | 'wrappers'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
    // From BaseValueField
    | 'value'
    | 'placeholder'
    | 'nullable';

  type ActualKeys = keyof DbxForgePickableChipFieldDef;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('type is literal dbx-pickable-chip', () => {
    expectTypeOf<DbxForgePickableChipFieldDef['type']>().toEqualTypeOf<'dbx-pickable-chip'>();
  });

  it('value is T | T[] (default: unknown | unknown[])', () => {
    expectTypeOf<DbxForgePickableChipFieldDef['value']>().toEqualTypeOf<unknown | unknown[] | undefined>();
  });

  it('props is DbxForgePickableFieldProps', () => {
    expectTypeOf<DbxForgePickableChipFieldDef['props']>().toEqualTypeOf<DbxForgePickableFieldProps | undefined>();
  });
});

// ============================================================================
// Usage Tests (type-level)
// ============================================================================

describe('DbxForgePickableChipFieldDef - Usage', () => {
  it('should accept valid pickable chip field configuration', () => {
    const field = {
      type: 'dbx-pickable-chip',
      key: 'tags',
      label: 'Tags'
    } as const satisfies DbxForgePickableChipFieldDef;

    expectTypeOf(field.type).toEqualTypeOf<'dbx-pickable-chip'>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgePickableChipField()
// ============================================================================

describe('dbxForgePickableChipField()', () => {
  function minimalConfig() {
    return {
      key: 'tags',
      props: {
        loadValues: stubLoadValues,
        displayForValue: stubDisplayForValue
      }
    } as DbxForgePickableChipFieldConfig<string>;
  }

  // MARK: Field structure
  it('should create a field with dbx-pickable-chip type', () => {
    const field = dbxForgePickableChipField(minimalConfig());
    expect(field.type).toBe('dbx-pickable-chip');
  });

  it('should use the data key directly', () => {
    const field = dbxForgePickableChipField(minimalConfig());
    expect(field.key).toBe('tags');
  });

  it('should have wrappers defined on the field', () => {
    const field = dbxForgePickableChipField(minimalConfig());
    expect((field as any).wrappers).toBeDefined();
  });

  // MARK: Inner field structure
  it('should create an inner field with dbx-pickable-chip type', () => {
    const inner = dbxForgePickableChipField(minimalConfig());
    expect(inner.type).toBe('dbx-pickable-chip');
  });

  it('should set the data key on the inner field', () => {
    const inner = dbxForgePickableChipField(minimalConfig());
    expect(inner.key).toBe('tags');
  });

  it('should set label on the inner field', () => {
    const inner = dbxForgePickableChipField({ ...minimalConfig(), label: 'Tags' });
    expect(inner.label).toBe('Tags');
  });

  // MARK: Required/readonly passthrough
  it('should set required on the inner field when provided', () => {
    const inner = dbxForgePickableChipField({ ...minimalConfig(), required: true });
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = dbxForgePickableChipField(minimalConfig());
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = dbxForgePickableChipField({ ...minimalConfig(), readonly: true });
    expect(inner.readonly).toBe(true);
  });

  // MARK: Hint/description mapping
  it('should map description to inner field props.hint', () => {
    const inner = dbxForgePickableChipField({ ...minimalConfig(), description: 'Pick your tags' });
    expect(inner.props?.hint).toBe('Pick your tags');
  });

  it('should map hint to inner field props.hint', () => {
    const inner = dbxForgePickableChipField({ ...minimalConfig(), hint: 'Pick your tags' });
    expect(inner.props?.hint).toBe('Pick your tags');
  });

  it('should not set hint on inner field when neither hint nor description is provided', () => {
    const inner = dbxForgePickableChipField(minimalConfig());
    expect(inner.props?.hint).toBeUndefined();
  });

  // MARK: Props passthrough
  it('should propagate loadValues through inner field props', () => {
    const inner = dbxForgePickableChipField(minimalConfig());
    expect(inner.props?.loadValues).toBe(stubLoadValues);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = dbxForgePickableChipField(minimalConfig());
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate multiSelect through inner field props when provided', () => {
    const inner = dbxForgePickableChipField({ ...minimalConfig(), props: { ...minimalConfig().props!, multiSelect: false } });
    expect(inner.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect on the inner field when not provided', () => {
    const inner = dbxForgePickableChipField(minimalConfig());
    expect(inner.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through inner field props when provided', () => {
    const inner = dbxForgePickableChipField({ ...minimalConfig(), props: { ...minimalConfig().props!, asArrayValue: false } });
    expect(inner.props?.asArrayValue).toBe(false);
  });

  it('should propagate filterValues through inner field props when provided', () => {
    const config = { ...minimalConfig(), props: { ...minimalConfig().props!, filterValues: stubFilterValues } } as DbxForgePickableChipFieldConfig<string>;
    const inner = dbxForgePickableChipField(config);
    expect(inner.props?.filterValues).toBe(stubFilterValues);
  });

  it('should propagate filterLabel through inner field props when provided', () => {
    const inner = dbxForgePickableChipField({ ...minimalConfig(), props: { ...minimalConfig().props!, filterLabel: 'Search tags' } });
    expect(inner.props?.filterLabel).toBe('Search tags');
  });

  it('should not set filterLabel on the inner field when not provided', () => {
    const inner = dbxForgePickableChipField(minimalConfig());
    expect(inner.props?.filterLabel).toBeUndefined();
  });

  // MARK: Logic passthrough
  it('should pass logic through to the inner field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const inner = dbxForgePickableChipField({ ...minimalConfig(), logic });
    expect(inner.logic).toEqual(logic);
  });

  // MARK: Validators passthrough
  it('should pass validators through to the inner field definition', () => {
    const validators: ValidatorConfig[] = [{ type: 'custom' as const, expression: 'fieldValue != null', kind: 'mustSelectTag' }];
    const inner = dbxForgePickableChipField({ ...minimalConfig(), validators });
    expect(inner.validators).toEqual(validators);
  });

  // MARK: ValidationMessages passthrough
  it('should pass validationMessages through to the inner field definition', () => {
    const validationMessages: ValidationMessages = { mustSelectTag: 'Please select at least one tag' };
    const inner = dbxForgePickableChipField({ ...minimalConfig(), validationMessages });
    expect(inner.validationMessages).toEqual(validationMessages);
  });
});

// ============================================================================
// Runtime Form Scenarios - dbxForgePickableChipField()
// ============================================================================

describe('scenarios', () => {
  let fixture: ComponentFixture<DbxForgeAsyncConfigFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...DBX_FORGE_TEST_PROVIDERS]
    });

    fixture = TestBed.createComponent(DbxForgeAsyncConfigFormComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('config resolution', () => {
    it('should resolve the wrapper field config containing the inner pickable chip field', async () => {
      const field = dbxForgePickableChipField({
        key: 'tags',
        label: 'Tags',
        props: {
          loadValues: stubLoadValues,
          displayForValue: stubDisplayForValue
        }
      } as DbxForgePickableChipFieldConfig<string>);

      fixture.componentInstance.config.set({ fields: [field] });

      fixture.detectChanges();
      await fixture.whenStable();

      const formConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);
      expect(formConfig.fields.length).toBe(1);
      expect(formConfig.fields[0].type).toBe('dbx-pickable-chip');
    });
  });

  describe('initial value', () => {
    // Regression test for a bug where the demo's String Item Chips field was
    // emitting { stringItemChips: [''] } when no items had been selected, and
    // { stringItemChips: ['', 'a'] } after the user picked 'a'.
    //
    // Root cause: ng-forge defaults a string-typed field to `''` before any
    // user interaction. AbstractForgePickableItemFieldDirective's sync effect
    // then runs `convertMaybeToArray('')` which produces `['']` rather than
    // `[]`, and that bogus empty-string "selection" gets persisted back into
    // the form value the next time the user toggles a chip.
    it('should not emit an array containing an empty string when no items are selected', async () => {
      const field = dbxForgePickableChipField({
        key: 'stringItemChips',
        label: 'String Item Chips',
        hint: 'This is a simple string item chip picker.',
        props: {
          loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
          displayForValue: stubDisplayForValue
        }
      } as DbxForgePickableChipFieldConfig<string>);

      // Inspect the raw form value so a `['']` leak through stripEmptyForgeValues is visible.
      const context = fixture.componentInstance.context;
      context.stripEmptyValues = false;
      context.stripInternalKeys = false;
      context.requireValid = false;

      fixture.componentInstance.config.set({ fields: [field] });

      fixture.detectChanges();
      await fixture.whenStable();
      // Extra settle for the lazy-loaded chip field component + its sync effect.
      await waitForMs(200);
      fixture.detectChanges();
      await fixture.whenStable();

      const value = (await firstValueFrom(fixture.componentInstance.getValue())) as { stringItemChips?: unknown };
      expect(value.stringItemChips).not.toEqual(['']);
    });
  });
});

// ============================================================================
// DbxForgePickableChipFieldComponent — direct component interaction
// ============================================================================

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
class TestForgePickableChipHostComponent {
  config!: FormConfig;
  readonly formValue = signal<any>({});
}

const FORGE_PICKABLE_CHIP_TEST_PROVIDERS = [provideZonelessChangeDetection(), provideDbxForgeFormFieldDeclarations(), provideDbxFormConfiguration(), { provide: DynamicFormLogger, useClass: NoopLogger }];

function getChipComponent(fixture: ComponentFixture<TestForgePickableChipHostComponent>): Maybe<DbxForgePickableChipFieldComponent<string>> {
  return fixture.debugElement.query(By.directive(DbxForgePickableChipFieldComponent))?.componentInstance as Maybe<DbxForgePickableChipFieldComponent<string>>;
}

async function settle(fixture: ComponentFixture<TestForgePickableChipHostComponent>, ms = 300): Promise<void> {
  fixture.detectChanges();
  await waitForMs(ms);
  fixture.detectChanges();
  await waitForMs(50);
  fixture.detectChanges();
}

describe('DbxForgePickableChipFieldComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestForgePickableChipHostComponent],
      providers: FORGE_PICKABLE_CHIP_TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should emit ["a"] (not ["", "a"]) after picking value "a" with no prior selection', async () => {
    const field = dbxForgePickableChipField({
      key: 'stringItemChips',
      label: 'String Item Chips',
      hint: 'This is a simple string item chip picker.',
      props: {
        loadValues: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
        displayForValue: stubDisplayForValue
      }
    } as DbxForgePickableChipFieldConfig<string>);

    const fixture = TestBed.createComponent(TestForgePickableChipHostComponent);
    fixture.componentInstance.config = { fields: [field] };

    await settle(fixture);

    const chip = getChipComponent(fixture);
    expect(chip).toBeDefined();

    // Load the items the directive has built from the available values and
    // simulate the user toggling the first one ("a"). This mirrors what the
    // chip template does when the user clicks a mat-chip.
    const items = chip!.itemsSignal();
    const itemA = items.find((x) => (x.itemValue as any).value === 'a');
    expect(itemA).toBeDefined();
    chip!.itemClicked(itemA!);

    await settle(fixture);

    expect(fixture.componentInstance.formValue()).toEqual({ stringItemChips: ['a'] });

    fixture.destroy();
  });
});
