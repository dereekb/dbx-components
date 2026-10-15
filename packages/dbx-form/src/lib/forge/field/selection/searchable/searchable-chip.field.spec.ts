/**
 * Exhaustive type and runtime tests for the searchable chip forge field.
 */
import { describe, it, expect, beforeEach, afterEach, expectTypeOf } from 'vitest';
import { type DynamicText, type LogicConfig, type ValidatorConfig, type ValidationMessages, type FormConfig, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { firstValueFrom, first, of, timeout } from 'rxjs';
import type { DbxForgeSearchableChipFieldConfig, DbxForgeSearchableChipFieldDef, DbxForgeSearchableChipFieldProps } from './searchable-chip.field';
import { DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_INPUT_PREVIEW, dbxForgeSearchableChipField, dbxForgeSearchableStringChipField } from './searchable-chip.field';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, inject } from '@angular/core';
import { provideDbxForgeFormFieldDeclarations } from '../../../../forge/forge.providers';
import { provideDbxFormConfiguration } from '../../../../form.providers';
import { DbxForgeFormComponent } from '../../../../forge/form/forge.component';
import { DbxForgeFormContext, provideDbxForgeFormContext } from '../../../../forge/form/forge.context';
import { DbxForgeSearchableChipFieldComponent } from './searchable-chip.field.component';
import { By } from '@angular/platform-browser';
import type { MatChipInputEvent } from '@angular/material/chips';
import { waitForMs } from '@dereekb/util';
import { DbxRouterWebProviderConfig } from '@dereekb/dbx-web';

// MARK: Shared Stubs
const stubSearch = (_text: string) => of([{ value: 'a' }]);
const stubDisplayForValue = (values: { value: string }[]) => of(values.map((v) => ({ ...v, label: String(v.value) })));

/**
 * Extracts the inner field from a wrapper field using the utility function.
 * Returns `any` for convenient runtime property access in tests.
 */
function getInnerField(field: any): any {
  return field;
}

// ============================================================================
// DbxForgeSearchableChipFieldConfig - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeSearchableChipFieldConfig - Exhaustive Whitelist', () => {
  type ExpectedKeys =
    // From DbxForgeFieldFunctionDef<DbxForgeSearchableChipFieldDef>
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
    | 'col'
    | 'tabIndex'
    | 'excludeValueIfHidden'
    | 'excludeValueIfDisabled'
    | 'excludeValueIfReadonly'
    | 'skipAutoWrappers'
    | 'skipDefaultWrappers'
    | 'nullable'
    // Phantom brand
    | '__fieldDef';

  type ActualKeys = keyof DbxForgeSearchableChipFieldConfig;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  describe('required keys', () => {
    it('key is required', () => {
      expectTypeOf<DbxForgeSearchableChipFieldConfig['key']>().toEqualTypeOf<string>();
    });
  });

  describe('inherited optional keys', () => {
    it('label', () => {
      expectTypeOf<DbxForgeSearchableChipFieldConfig['label']>().toEqualTypeOf<DynamicText | undefined>();
    });

    it('required', () => {
      expectTypeOf<DbxForgeSearchableChipFieldConfig['required']>().toEqualTypeOf<boolean | undefined>();
    });

    it('validators', () => {
      expectTypeOf<DbxForgeSearchableChipFieldConfig['validators']>().toEqualTypeOf<ValidatorConfig[] | undefined>();
    });

    it('validationMessages', () => {
      expectTypeOf<DbxForgeSearchableChipFieldConfig['validationMessages']>().toEqualTypeOf<ValidationMessages | undefined>();
    });
  });

  describe('generic type parameter preservation', () => {
    it('value preserves generic type', () => {
      type StringConfig = DbxForgeSearchableChipFieldConfig<string>;
      expectTypeOf<StringConfig['value']>().toEqualTypeOf<string | string[] | undefined>();
    });
  });
});

// ============================================================================
// DbxForgeSearchableChipFieldDef - Exhaustive Whitelist
// ============================================================================

describe('DbxForgeSearchableChipFieldDef - Exhaustive Whitelist', () => {
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

  type ActualKeys = keyof DbxForgeSearchableChipFieldDef;

  it('should have exactly the expected keys', () => {
    expectTypeOf<ActualKeys>().toEqualTypeOf<ExpectedKeys>();
  });

  it('type is literal dbx-searchable-chip', () => {
    expectTypeOf<DbxForgeSearchableChipFieldDef['type']>().toEqualTypeOf<'dbx-searchable-chip'>();
  });

  it('props is DbxForgeSearchableChipFieldProps', () => {
    expectTypeOf<DbxForgeSearchableChipFieldDef['props']>().toEqualTypeOf<DbxForgeSearchableChipFieldProps | undefined>();
  });
});

// ============================================================================
// Usage Tests (type-level)
// ============================================================================

describe('DbxForgeSearchableChipFieldDef - Usage', () => {
  it('should accept valid searchable chip field configuration', () => {
    const field = {
      type: 'dbx-searchable-chip',
      key: 'tags',
      label: 'Tags'
    } as const satisfies DbxForgeSearchableChipFieldDef;

    expectTypeOf(field.type).toEqualTypeOf<'dbx-searchable-chip'>();
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeSearchableChipField()
// ============================================================================

describe('dbxForgeSearchableChipField()', () => {
  function minimalConfig() {
    return {
      key: 'tags',
      props: {
        search: stubSearch,
        displayForValue: stubDisplayForValue
      }
    } as Parameters<typeof dbxForgeSearchableChipField>[0];
  }

  function withProps(extra: Record<string, unknown>) {
    return { ...minimalConfig(), props: { ...minimalConfig().props, ...extra } } as any;
  }

  // MARK: Wrapper structure
  it('should return a wrapper with type "wrapper"', () => {
    const wrapper = dbxForgeSearchableChipField(minimalConfig());
    expect(wrapper.type).toBe('dbx-searchable-chip');
  });

  it('should use key_wrapper naming for the wrapper key', () => {
    const wrapper = dbxForgeSearchableChipField(minimalConfig());
    expect(wrapper.key).toBe('tags');
  });

  // MARK: Inner field structure
  it('should set the label on the inner field when provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField({ ...minimalConfig(), label: 'Tags' }) as any);
    expect(inner.label).toBe('Tags');
  });

  it('should map hint to inner field props.hint', () => {
    const inner = getInnerField(dbxForgeSearchableChipField({ ...minimalConfig(), hint: 'Add tags' } as any) as any);
    expect(inner.props?.hint).toBe('Add tags');
  });

  it('should not set hint on inner field when hint is not provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.hint).toBeUndefined();
  });

  it('should set the correct inner field type', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(minimalConfig()) as any);
    expect(inner.type).toBe('dbx-searchable-chip');
  });

  it('should set the key on the inner field', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(minimalConfig()) as any);
    expect(inner.key).toBe('tags');
  });

  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField({ ...minimalConfig(), required: true }) as any);
    expect(inner.required).toBe(true);
  });

  it('should not set required on the inner field when not provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(minimalConfig()) as any);
    expect(inner.required).toBeUndefined();
  });

  it('should set readonly on the inner field when provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField({ ...minimalConfig(), readonly: true }) as any);
    expect(inner.readonly).toBe(true);
  });

  // MARK: Props passthrough
  it('should propagate search through inner field props', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate allowStringValues through inner field props when provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(withProps({ allowStringValues: true })) as any);
    expect(inner.props?.allowStringValues).toBe(true);
  });

  it('should not set allowStringValues on the inner field when not provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.allowStringValues).toBeUndefined();
  });

  it('should propagate searchOnEmptyText through inner field props when provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(withProps({ searchOnEmptyText: true })) as any);
    expect(inner.props?.searchOnEmptyText).toBe(true);
  });

  it('should not set searchOnEmptyText on the inner field when not provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.searchOnEmptyText).toBeUndefined();
  });

  it('should propagate multiSelect through inner field props when provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(withProps({ multiSelect: false })) as any);
    expect(inner.props?.multiSelect).toBe(false);
  });

  it('should not set multiSelect on the inner field when not provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.multiSelect).toBeUndefined();
  });

  it('should propagate asArrayValue through inner field props when provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(withProps({ asArrayValue: false })) as any);
    expect(inner.props?.asArrayValue).toBe(false);
  });

  it('should propagate textInputValidator through inner field props when provided', () => {
    const validator = () => null;
    const inner = getInnerField(dbxForgeSearchableChipField(withProps({ textInputValidator: validator })) as any);
    expect(inner.props?.textInputValidator).toBe(validator);
  });

  it('should not set textInputValidator on the inner field when not provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(minimalConfig()) as any);
    expect(inner.props?.textInputValidator).toBeUndefined();
  });

  it('should propagate suggestions and suggestionsLabel through inner field props when provided', () => {
    const suggestions = [{ label: 'A', value: 'a' }];
    const inner = getInnerField(dbxForgeSearchableChipField(withProps({ suggestions, suggestionsLabel: 'Recommended' })) as any);
    expect(inner.props?.suggestions).toBe(suggestions);
    expect(inner.props?.suggestionsLabel).toBe('Recommended');
  });

  it('should propagate useAnchor through inner field props when provided', () => {
    const inner = getInnerField(dbxForgeSearchableChipField(withProps({ useAnchor: true })) as any);
    expect(inner.props?.useAnchor).toBe(true);
  });

  it('should propagate anchorForValue through inner field props when provided', () => {
    const anchorFn = () => ({
      onClick: () => {
        /* noop */
      }
    });
    const inner = getInnerField(dbxForgeSearchableChipField(withProps({ anchorForValue: anchorFn })) as any);
    expect(inner.props?.anchorForValue).toBe(anchorFn);
  });

  // MARK: Logic passthrough
  it('should pass logic through to the inner field definition', () => {
    const logic: LogicConfig[] = [{ type: 'hidden', condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true } }];
    const inner = getInnerField(dbxForgeSearchableChipField({ ...minimalConfig(), logic }) as any);
    expect(inner.logic).toEqual(logic);
  });
});

// ============================================================================
// Runtime Factory Tests - dbxForgeSearchableStringChipField()
// ============================================================================

describe('dbxForgeSearchableStringChipField()', () => {
  function minimalConfig() {
    return {
      key: 'keywords',
      props: {
        search: stubSearch,
        displayForValue: stubDisplayForValue
      }
    } as Parameters<typeof dbxForgeSearchableStringChipField>[0];
  }

  it('should return a field with type "dbx-searchable-chip"', () => {
    const wrapper = dbxForgeSearchableStringChipField(minimalConfig());
    expect(wrapper.type).toBe('dbx-searchable-chip');
  });

  it('should use the key directly', () => {
    const wrapper = dbxForgeSearchableStringChipField(minimalConfig());
    expect(wrapper.key).toBe('keywords');
  });

  it('should set the label on the inner field when provided', () => {
    const inner = getInnerField(dbxForgeSearchableStringChipField({ ...minimalConfig(), label: 'Keywords' }) as any);
    expect(inner.label).toBe('Keywords');
  });

  it('should map hint to inner field props.hint', () => {
    const inner = getInnerField(dbxForgeSearchableStringChipField({ ...minimalConfig(), hint: 'Enter keywords' } as any) as any);
    expect(inner.props?.hint).toBe('Enter keywords');
  });

  it('should set the correct inner field type', () => {
    const inner = getInnerField(dbxForgeSearchableStringChipField(minimalConfig()) as any);
    expect(inner.type).toBe('dbx-searchable-chip');
  });

  it('should set the key on the inner field', () => {
    const inner = getInnerField(dbxForgeSearchableStringChipField(minimalConfig()) as any);
    expect(inner.key).toBe('keywords');
  });

  it('should force allowStringValues to true so Enter commits the typed value as a chip', () => {
    const inner = getInnerField(dbxForgeSearchableStringChipField(minimalConfig()) as any);
    expect(inner.props?.allowStringValues).toBe(true);
  });

  it('should set required on the inner field when provided', () => {
    const inner = getInnerField(dbxForgeSearchableStringChipField({ ...minimalConfig(), required: true }) as any);
    expect(inner.required).toBe(true);
  });

  it('should propagate search through inner field props', () => {
    const inner = getInnerField(dbxForgeSearchableStringChipField(minimalConfig()) as any);
    expect(inner.props?.search).toBe(stubSearch);
  });

  it('should propagate displayForValue through inner field props', () => {
    const inner = getInnerField(dbxForgeSearchableStringChipField(minimalConfig()) as any);
    expect(inner.props?.displayForValue).toBe(stubDisplayForValue);
  });

  it('should propagate searchOnEmptyText through inner field props when provided', () => {
    const inner = getInnerField(dbxForgeSearchableStringChipField({ ...minimalConfig(), props: { ...minimalConfig().props, searchOnEmptyText: true } } as any) as any);
    expect(inner.props?.searchOnEmptyText).toBe(true);
  });
});

// ============================================================================
// Component-level tests - DbxForgeSearchableChipFieldComponent
// ============================================================================

@Component({
  template: `
    <dbx-forge></dbx-forge>
  `,
  imports: [DbxForgeFormComponent],
  providers: [provideDbxForgeFormContext()]
})
class SearchableChipTestHostComponent {
  readonly context = inject(DbxForgeFormContext);
}

const SEARCHABLE_CHIP_TEST_PROVIDERS = [
  provideDbxForgeFormFieldDeclarations(),
  provideDbxFormConfiguration(),
  { provide: DynamicFormLogger, useClass: NoopLogger },
  { provide: DbxRouterWebProviderConfig, useValue: { anchorSegueRefComponent: { componentClass: SearchableChipTestHostComponent } } as DbxRouterWebProviderConfig }
];

async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
}

describe('DbxForgeSearchableChipFieldComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [SearchableChipTestHostComponent],
      providers: SEARCHABLE_CHIP_TEST_PROVIDERS
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function createSingleSelectChipConfig(): FormConfig {
    return {
      fields: [
        dbxForgeSearchableChipField<string>({
          key: 'pickOne',
          label: 'Pick a Single Value',
          props: {
            allowStringValues: false,
            searchOnEmptyText: true,
            multiSelect: false,
            asArrayValue: false,
            search: () => of([{ value: 'a' }, { value: 'b' }, { value: 'c' }]),
            displayForValue: (values: any[]) => of(values.map((v: any) => ({ ...v, label: String(v.value) })))
          }
        })
      ]
    };
  }

  it('should replace the existing value when selecting a new value in single-select mode', async () => {
    const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
    const context = fixture.componentInstance.context;
    context.requireValid = false;
    context.config = createSingleSelectChipConfig();

    await settle(fixture);

    context.setValue({ pickOne: 'a' } as any);
    await settle(fixture);

    const afterFirstSelect = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect(afterFirstSelect?.pickOne).toBe('a');

    context.setValue({ pickOne: 'b' } as any);
    await settle(fixture);

    const afterSecondSelect = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect(afterSecondSelect?.pickOne).toBe('b');

    fixture.destroy();
  });

  // MARK: Enter key commits typed value
  function createStringChipConfig(): FormConfig {
    return {
      fields: [
        dbxForgeSearchableStringChipField({
          key: 'urls',
          label: 'URLs',
          props: {
            searchOnEmptyText: false,
            search: () => of([]),
            displayForValue: (values) => of(values.map((v) => ({ ...v, label: String(v.value) })))
          }
        }) as any
      ]
    };
  }

  async function settleWithLazyLoad(fixture: ComponentFixture<unknown>, ms = 300): Promise<void> {
    fixture.detectChanges();
    await waitForMs(ms);
    fixture.detectChanges();
    await waitForMs(50);
    fixture.detectChanges();
  }

  function getChipFieldComponent(fixture: ComponentFixture<unknown>): DbxForgeSearchableChipFieldComponent<string> {
    const debugEl = fixture.debugElement.query(By.directive(DbxForgeSearchableChipFieldComponent));
    if (!debugEl) {
      throw new Error('DbxForgeSearchableChipFieldComponent not found');
    }
    return debugEl.componentInstance as DbxForgeSearchableChipFieldComponent<string>;
  }

  it('dbxForgeSearchableStringChipField: pressing Enter commits the typed value as a chip', async () => {
    const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
    const context = fixture.componentInstance.context;
    context.requireValid = false;
    context.config = createStringChipConfig();

    await settleWithLazyLoad(fixture);

    const component = getChipFieldComponent(fixture);

    // Simulate the user typing into the input.
    component.inputCtrl.setValue('https://example.com');
    await settle(fixture);

    // Simulate Enter -> matChipInputTokenEnd dispatched by MatChipInput.
    component.addChip({
      value: 'https://example.com',
      chipInput: {
        clear: () => {
          /* noop */
        }
      }
    } as unknown as MatChipInputEvent);
    await settle(fixture);

    const afterAdd = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect(afterAdd?.urls).toEqual(['https://example.com']);

    // A second Enter should append another chip (multi-select is the default).
    component.inputCtrl.setValue('https://other.example.com');
    await settle(fixture);
    component.addChip({
      value: 'https://other.example.com',
      chipInput: {
        clear: () => {
          /* noop */
        }
      }
    } as unknown as MatChipInputEvent);
    await settle(fixture);

    const afterSecond = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect(afterSecond?.urls).toEqual(['https://example.com', 'https://other.example.com']);

    fixture.destroy();
  });

  // MARK: asArrayValue scenarios
  describe('asArrayValue', () => {
    it('asArrayValue: true (default) should emit an array value', async () => {
      const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = {
        fields: [
          dbxForgeSearchableChipField<string>({
            key: 'tags',
            label: 'Tags',
            props: {
              searchOnEmptyText: true,
              asArrayValue: true,
              search: () => of([{ value: 'x' }, { value: 'y' }]),
              displayForValue: (values: any[]) => of(values.map((v: any) => ({ ...v, label: String(v.value) })))
            }
          })
        ]
      };

      await settle(fixture);

      // Set a single-element array value
      context.setValue({ tags: ['x'] } as any);
      await settle(fixture);

      const afterFirst = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
      expect(afterFirst?.tags).toEqual(['x']);

      // Set a two-element array value
      context.setValue({ tags: ['x', 'y'] } as any);
      await settle(fixture);

      const afterSecond = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
      expect(afterSecond?.tags).toEqual(['x', 'y']);

      fixture.destroy();
    });

    it('asArrayValue: false should emit a single (non-array) value', async () => {
      const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = {
        fields: [
          dbxForgeSearchableChipField<string>({
            key: 'pick',
            label: 'Pick One',
            props: {
              searchOnEmptyText: true,
              asArrayValue: false,
              search: () => of([{ value: 'a' }, { value: 'b' }]),
              displayForValue: (values: any[]) => of(values.map((v: any) => ({ ...v, label: String(v.value) })))
            }
          })
        ]
      };

      await settle(fixture);

      // Set a single value (not wrapped in an array)
      context.setValue({ pick: 'a' } as any);
      await settle(fixture);

      const afterFirst = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
      expect(afterFirst?.pick).toBe('a');

      // Replace with a different single value
      context.setValue({ pick: 'b' } as any);
      await settle(fixture);

      const afterSecond = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
      expect(afterSecond?.pick).toBe('b');

      fixture.destroy();
    });
  });

  it('dbxForgeSearchableStringChipField: rejects the typed value when textInputValidator fails', async () => {
    const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
    const context = fixture.componentInstance.context;
    context.requireValid = false;
    context.config = {
      fields: [
        dbxForgeSearchableStringChipField({
          key: 'urls',
          label: 'URLs',
          props: {
            searchOnEmptyText: false,
            textInputValidator: (ctrl) => (ctrl.value && String(ctrl.value).startsWith('https://') ? null : { invalid: { message: 'Invalid URL' } }),
            search: () => of([]),
            displayForValue: (values) => of(values.map((v) => ({ ...v, label: String(v.value) })))
          }
        }) as any
      ]
    };

    await settleWithLazyLoad(fixture);

    const component = getChipFieldComponent(fixture);

    component.inputCtrl.setValue('not-a-url');
    await settle(fixture);
    component.addChip({
      value: 'not-a-url',
      chipInput: {
        clear: () => {
          /* noop */
        }
      }
    } as unknown as MatChipInputEvent);
    await settle(fixture);

    const afterInvalid = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect(afterInvalid?.urls ?? []).toEqual([]);

    component.inputCtrl.setValue('https://valid.example.com');
    await settle(fixture);
    component.addChip({
      value: 'https://valid.example.com',
      chipInput: {
        clear: () => {
          /* noop */
        }
      }
    } as unknown as MatChipInputEvent);
    await settle(fixture);

    const afterValid = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
    expect(afterValid?.urls).toEqual(['https://valid.example.com']);

    fixture.destroy();
  });

  // MARK: Input Preview
  describe('inputOnNewLine and inputPreview', () => {
    function createInputConfig(props: { inputOnNewLine?: boolean; inputPreview?: string }, placeholder?: string): FormConfig {
      return {
        fields: [
          dbxForgeSearchableStringChipField({
            key: 'urls',
            label: 'URLs',
            placeholder,
            props: {
              searchOnEmptyText: false,
              search: () => of([]),
              displayForValue: (values) => of(values.map((v) => ({ ...v, label: String(v.value) }))),
              ...props
            }
          }) as any
        ]
      };
    }

    async function createInputComponent(props: { inputOnNewLine?: boolean; inputPreview?: string }, placeholder?: string) {
      const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createInputConfig(props, placeholder);

      await settleWithLazyLoad(fixture);

      return { fixture, component: getChipFieldComponent(fixture) };
    }

    it('should not show an input preview or put the input on a new line by default', async () => {
      const { fixture, component } = await createInputComponent({}, 'https://example.com');

      expect(component.inputOnNewLineSignal()).toBe(false);
      expect(component.inputPreviewSignal()).toBeUndefined();
      expect(component.inputPlaceholderSignal()).toBe('https://example.com');
      expect(fixture.nativeElement.querySelector('.dbx-searchable-chip-field-input-new-line')).toBeNull();

      fixture.destroy();
    });

    it('should always show a configured placeholder instead of the input preview', async () => {
      const { fixture, component } = await createInputComponent({ inputOnNewLine: true }, 'https://example.com');

      expect(fixture.nativeElement.querySelector('.dbx-searchable-chip-field-input-new-line')).toBeTruthy();
      expect(component.inputPreviewSignal()).toBe(DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_INPUT_PREVIEW);
      expect(component.inputPlaceholderSignal()).toBe('https://example.com');

      component.onFocus();
      expect(component.inputPlaceholderSignal()).toBe('https://example.com');

      fixture.destroy();
    });

    it('should default the input preview to "|" when inputOnNewLine is true and no placeholder is configured, and show the search placeholder while focused', async () => {
      const { fixture, component } = await createInputComponent({ inputOnNewLine: true });

      expect(component.inputPlaceholderSignal()).toBe(DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_INPUT_PREVIEW);

      component.onFocus();
      expect(component.inputPlaceholderSignal()).toBe(component.searchInputPlaceholderSignal());

      component.onBlur();
      expect(component.inputPlaceholderSignal()).toBe(DEFAULT_DBX_FORGE_SEARCHABLE_CHIP_FIELD_INPUT_PREVIEW);

      fixture.destroy();
    });

    it('should use a configured inputPreview when no placeholder is configured', async () => {
      const { fixture, component } = await createInputComponent({ inputPreview: 'Add a URL...' });

      expect(component.inputPlaceholderSignal()).toBe('Add a URL...');

      fixture.destroy();
    });
  });

  // MARK: Backspace
  describe('backspaceRemovesChips', () => {
    function createBackspaceConfig(backspaceRemovesChips?: boolean): FormConfig {
      return {
        fields: [
          dbxForgeSearchableStringChipField({
            key: 'urls',
            label: 'URLs',
            props: {
              searchOnEmptyText: false,
              search: () => of([]),
              displayForValue: (values) => of(values.map((v) => ({ ...v, label: String(v.value) }))),
              backspaceRemovesChips
            }
          }) as any
        ]
      };
    }

    async function pressBackspaceOnLastChip(backspaceRemovesChips?: boolean): Promise<unknown> {
      const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createBackspaceConfig(backspaceRemovesChips);

      await settleWithLazyLoad(fixture);

      context.setValue({ urls: ['https://a.example.com', 'https://b.example.com'] } as any);
      await settleWithLazyLoad(fixture);

      const chipRows: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('mat-chip-row');
      expect(chipRows.length).toBe(2);

      const lastChipAction = chipRows[1].querySelector<HTMLElement>('.mat-mdc-chip-action') ?? chipRows[1];
      lastChipAction.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', keyCode: 8, bubbles: true, cancelable: true }));
      await settle(fixture);

      const value = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
      fixture.destroy();
      return (value as any)?.urls;
    }

    it('should not remove a chip when Backspace is pressed on it by default', async () => {
      const urls = await pressBackspaceOnLastChip();
      expect(urls).toEqual(['https://a.example.com', 'https://b.example.com']);
    });

    it('should remove a chip when Backspace is pressed on it when backspaceRemovesChips is true', async () => {
      const urls = await pressBackspaceOnLastChip(true);
      expect(urls).toEqual(['https://a.example.com']);
    });
  });

  // MARK: Suggestions
  describe('suggestions', () => {
    const SINGLE_SUGGESTION = { label: 'Single', value: 'https://single.example.com' };
    const MULTI_SUGGESTION = { label: 'Multi', value: ['https://a.example.com', 'https://b.example.com'] };

    function createSuggestionChipConfig(suggestionsLabel?: string): FormConfig {
      return {
        fields: [
          dbxForgeSearchableStringChipField({
            key: 'urls',
            label: 'URLs',
            props: {
              searchOnEmptyText: false,
              search: () => of([]),
              displayForValue: (values) => of(values.map((v) => ({ ...v, label: String(v.value) }))),
              suggestions: [SINGLE_SUGGESTION, MULTI_SUGGESTION],
              suggestionsLabel
            }
          }) as any
        ]
      };
    }

    it('should render a suggestion chip for each suggestion with the default label', async () => {
      const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createSuggestionChipConfig();

      await settleWithLazyLoad(fixture);

      const component = getChipFieldComponent(fixture);
      expect(component.visibleSuggestionsSignal().map((x) => x.label)).toEqual(['Single', 'Multi']);
      expect(component.suggestionsLabelSignal()).toBe('Suggestions');

      const suggestionsEl: HTMLElement = fixture.nativeElement.querySelector('.dbx-searchable-chip-field-suggestions');
      expect(suggestionsEl).toBeTruthy();
      expect(suggestionsEl.querySelectorAll('mat-chip-option').length).toBe(2);

      fixture.destroy();
    });

    it('should use the configured suggestionsLabel', async () => {
      const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createSuggestionChipConfig('Recommended');

      await settleWithLazyLoad(fixture);

      const component = getChipFieldComponent(fixture);
      expect(component.suggestionsLabelSignal()).toBe('Recommended');

      fixture.destroy();
    });

    it('should add every value of a picked suggestion and hide it once all of its values are selected', async () => {
      const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createSuggestionChipConfig();

      await settleWithLazyLoad(fixture);

      const component = getChipFieldComponent(fixture);
      component.addSuggestion(MULTI_SUGGESTION);
      await settle(fixture);

      const afterAdd = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
      expect(afterAdd?.urls).toEqual(MULTI_SUGGESTION.value);
      expect(component.visibleSuggestionsSignal().map((x) => x.label)).toEqual(['Single']);

      fixture.destroy();
    });

    it('should keep a suggestion visible while only some of its values are selected, and not duplicate selected values when picked', async () => {
      const fixture = TestBed.createComponent(SearchableChipTestHostComponent);
      const context = fixture.componentInstance.context;
      context.requireValid = false;
      context.config = createSuggestionChipConfig();

      await settleWithLazyLoad(fixture);

      context.setValue({ urls: ['https://a.example.com'] } as any);
      await settleWithLazyLoad(fixture);

      const component = getChipFieldComponent(fixture);
      expect(component.visibleSuggestionsSignal().map((x) => x.label)).toEqual(['Single', 'Multi']);

      component.addSuggestion(MULTI_SUGGESTION);
      await settle(fixture);

      const afterAdd = await firstValueFrom(context.getValue().pipe(timeout(500), first()));
      expect(afterAdd?.urls).toEqual(['https://a.example.com', 'https://b.example.com']);
      expect(component.visibleSuggestionsSignal().map((x) => x.label)).toEqual(['Single']);

      fixture.destroy();
    });
  });
});
