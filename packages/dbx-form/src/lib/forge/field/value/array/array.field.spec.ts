import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { type ArrayItemDefinitionTemplate, type FormConfig, withLoggerConfig } from '@ng-forge/dynamic-forms';
import { waitForMs } from '@dereekb/util';
import { firstValueFrom } from 'rxjs';
import { dbxForgeArrayField } from './array.field';
import { DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME } from '../../wrapper/array-field/array-field.wrapper';
import { DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME } from '../../wrapper/array-field/array-field.element.wrapper';
import { DbxForgeArrayFieldWrapperComponent } from '../../wrapper/array-field/array-field.wrapper.component';
import { dbxForgeArrayFieldTemplateWithItemValues } from '../../wrapper/array-field/array-field.duplicate';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';
import { dbxForgeTextField } from '../text/text.field';
import { dbxForgeToggleField } from '../boolean/boolean.field';

// ============================================================================
// Runtime Factory Tests - dbxForgeArrayField()
// ============================================================================

describe('dbxForgeArrayField()', () => {
  const basicFields = [{ key: 'name', type: 'input' as const, label: 'Name' }] as any[];

  it('should create a field with array type', () => {
    const field = dbxForgeArrayField({ key: 'items', template: basicFields });
    expect(field.type).toBe('array');
  });

  it('should use the provided key', () => {
    const field = dbxForgeArrayField({ key: 'phones', template: basicFields });
    expect(field.key).toBe('phones');
  });

  it('should pass maxLength on the field def', () => {
    const field = dbxForgeArrayField({ key: 'items', template: basicFields, maxLength: 5 });
    expect(field.maxLength).toBe(5);
  });

  describe('outer wrapper', () => {
    it('should add the array field wrapper', () => {
      const field = dbxForgeArrayField({ key: 'items', template: basicFields });
      const wrapper = (field.wrappers as any[])?.find((w) => w.type === DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME);
      expect(wrapper).toBeDefined();
    });

    it('should pass label to wrapper props', () => {
      const field = dbxForgeArrayField({ key: 'items', template: basicFields, props: { label: 'My Items' } });
      const wrapper = (field.wrappers as any[])?.find((w) => w.type === DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME);
      expect(wrapper.props.label).toBe('My Items');
    });

    it('should pass hint to wrapper props', () => {
      const field = dbxForgeArrayField({ key: 'items', template: basicFields, props: { hint: 'A list of items' } });
      const wrapper = (field.wrappers as any[])?.find((w) => w.type === DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME);
      expect(wrapper.props.hint).toBe('A list of items');
    });

    it('should pass addText to wrapper props', () => {
      const field = dbxForgeArrayField({ key: 'items', template: basicFields, props: { addText: 'Add Item' } });
      const wrapper = (field.wrappers as any[])?.find((w) => w.type === DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME);
      expect(wrapper.props.addText).toBe('Add Item');
    });
  });

  describe('element wrapper', () => {
    // The container + element wrapper now live on the outer array wrapper's itemTemplate,
    // not on field.fields. The array starts empty and items are spawned from itemTemplate.
    function getOuterWrapper(field: any): any {
      return (field.wrappers as any[]).find((w) => w.type === DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME);
    }

    function getContainer(field: any): any {
      return getOuterWrapper(field).props.itemTemplate[0];
    }

    function getElementWrapper(field: any): any {
      return getContainer(field).wrappers[0];
    }

    it('should wrap fields in a ContainerField with the element wrapper', () => {
      const field = dbxForgeArrayField({ key: 'items', template: basicFields }) as any;
      const container = getContainer(field);
      expect(container.type).toBe('container');

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.type).toBe(DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME);
    });

    it('should contain the original fields inside the container', () => {
      const fields = [
        { key: 'name', type: 'input' as const, label: 'Name' },
        { key: 'email', type: 'input' as const, label: 'Email' }
      ] as any[];

      const field = dbxForgeArrayField({ key: 'items', template: fields }) as any;
      const container = getContainer(field);
      expect(container.fields).toEqual(fields);
    });

    it('should pass elementProps to the element wrapper', () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: basicFields,
        elementProps: { labelForEntry: 'Item', disableRearrange: true }
      }) as any;

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.props.labelForEntry).toBe('Item');
      expect(elementWrapper.props.disableRearrange).toBe(true);
    });

    it('should flow removeText from outer props to element wrapper', () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: basicFields,
        props: { removeText: 'Delete' }
      }) as any;

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.props.removeText).toBe('Delete');
    });

    it('should flow allowRemove from outer props to element wrapper', () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: basicFields,
        props: { allowRemove: false }
      }) as any;

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.props.allowRemove).toBe(false);
    });

    it('should flow disableRearrange from outer props to element wrapper', () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: basicFields,
        props: { disableRearrange: true }
      }) as any;

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.props.disableRearrange).toBe(true);
    });

    it('should allow elementProps to override flowed outer props', () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: basicFields,
        props: { removeText: 'Delete' },
        elementProps: { removeText: 'Custom Remove' }
      }) as any;

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.props.removeText).toBe('Custom Remove');
    });
  });
});

// ============================================================================
// Runtime Form Scenarios - dbxForgeArrayField()
// ============================================================================

describe('scenarios', () => {
  let fixture: ComponentFixture<DbxForgeAsyncConfigFormComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...DBX_FORGE_TEST_PROVIDERS, withLoggerConfig({ derivations: 'verbose' })]
    });

    fixture = TestBed.createComponent(DbxForgeAsyncConfigFormComponent);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  describe('config resolution', () => {
    it('should resolve the array field config with wrappers', async () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: [dbxForgeTextField({ key: 'name', label: 'Name' })]
      });

      fixture.componentInstance.config.set({ fields: [field] });
      fixture.detectChanges();
      await fixture.whenStable();

      const formConfig: FormConfig = await firstValueFrom(fixture.componentInstance.context.config$);
      expect(formConfig.fields.length).toBe(1);
      expect(formConfig.fields[0].type).toBe('array');
    });
  });

  describe('value', () => {
    it('should start with zero items (array starts empty)', async () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: [dbxForgeTextField({ key: 'name', label: 'Name' })]
      });

      fixture.componentInstance.config.set({ fields: [field] });
      fixture.detectChanges();
      await fixture.whenStable();

      const value = await firstValueFrom(fixture.componentInstance.getValue());

      // Array starts empty — items are added via the add button
      expect((value as any).items).toHaveLength(0);
    });

    it('should read value when items are set', async () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: [dbxForgeTextField({ key: 'name', label: 'Name' })]
      });

      fixture.componentInstance.config.set({ fields: [field] });
      fixture.detectChanges();
      await fixture.whenStable();

      fixture.componentInstance.setValue({ items: ['Alice', 'Bob'] });
      fixture.detectChanges();
      await waitForMs(0);
      await fixture.whenStable();

      const value = await firstValueFrom(fixture.componentInstance.getValue());
      expect(value).toEqual({ items: ['Alice', 'Bob'] });
    });
  });

  describe('duplicateItem', () => {
    function getParentWrapper(): DbxForgeArrayFieldWrapperComponent {
      const wrapper = fixture.debugElement.query(By.directive(DbxForgeArrayFieldWrapperComponent))?.componentInstance as DbxForgeArrayFieldWrapperComponent | undefined;
      if (!wrapper) {
        throw new Error('DbxForgeArrayFieldWrapperComponent was not rendered');
      }
      return wrapper;
    }

    async function settle(ms = 50) {
      fixture.detectChanges();
      await waitForMs(ms);
      await fixture.whenStable();
    }

    it('baseline: addItem adds a slot (sanity check that dispatcher works)', async () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: [dbxForgeTextField({ key: 'name', label: 'Name' }), dbxForgeToggleField({ key: 'disable', label: 'Disable Remove' })]
      });

      fixture.componentInstance.config.set({ fields: [field] });
      await settle();

      fixture.componentInstance.setValue({
        items: [{ name: 'alpha', disable: false }]
      });
      await settle(100);

      getParentWrapper().addItem();
      await settle(100);

      const value = (await firstValueFrom(fixture.componentInstance.getValue())) as { items: unknown[] };
      expect(value.items).toHaveLength(2);
    });

    it('diagnostic: addItem after a 2-item setValue grows to 3', async () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: [dbxForgeTextField({ key: 'name', label: 'Name' }), dbxForgeToggleField({ key: 'disable', label: 'Disable Remove' })]
      });

      fixture.componentInstance.config.set({ fields: [field] });
      await settle();

      fixture.componentInstance.setValue({
        items: [
          { name: 'alpha', disable: false },
          { name: 'beta', disable: true }
        ]
      });
      await settle(200);

      const beforeValue = (await firstValueFrom(fixture.componentInstance.getValue())) as { items: unknown[] };
      expect(beforeValue.items).toHaveLength(2);

      getParentWrapper().addItem();
      await settle(200);

      const afterValue = (await firstValueFrom(fixture.componentInstance.getValue())) as { items: unknown[] };
      expect(afterValue.items).toHaveLength(3);
    });

    it('duplicates an object item via insertAt, inserting at the target index with the source values', async () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: [dbxForgeTextField({ key: 'name', label: 'Name' }), dbxForgeToggleField({ key: 'disable', label: 'Disable Remove' })]
      });

      fixture.componentInstance.config.set({ fields: [field] });
      await settle();

      fixture.componentInstance.setValue({
        items: [
          { name: 'alpha', disable: false },
          { name: 'beta', disable: true }
        ]
      });
      await settle(200);

      const beforeValue = (await firstValueFrom(fixture.componentInstance.getValue())) as { items: unknown[] };
      expect(beforeValue.items).toHaveLength(2);

      getParentWrapper().duplicateItem(0, 2); // duplicate 'alpha' to the end
      await settle(200);

      const value = (await firstValueFrom(fixture.componentInstance.getValue())) as { items: { name: string; disable: boolean }[] };

      expect(value.items).toHaveLength(3);
      expect(value.items[0]).toMatchObject({ name: 'alpha', disable: false });
      expect(value.items[1]).toMatchObject({ name: 'beta', disable: true });
      expect(value.items[2]).toMatchObject({ name: 'alpha', disable: false });
    });

    it('inserts the duplicate immediately after the source when toIndex === fromIndex + 1', async () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: [dbxForgeTextField({ key: 'name', label: 'Name' }), dbxForgeToggleField({ key: 'disable', label: 'Disable Remove' })]
      });

      fixture.componentInstance.config.set({ fields: [field] });
      await settle();

      fixture.componentInstance.setValue({
        items: [
          { name: 'alpha', disable: false },
          { name: 'beta', disable: true }
        ]
      });
      await settle(100);

      getParentWrapper().duplicateItem(0, 1); // duplicate 'alpha' immediately after itself
      await settle(300);

      const value = (await firstValueFrom(fixture.componentInstance.getValue())) as { items: { name: string; disable: boolean }[] };

      expect(value.items).toHaveLength(3);
      expect(value.items[0]).toMatchObject({ name: 'alpha', disable: false });
      expect(value.items[1]).toMatchObject({ name: 'alpha', disable: false });
      expect(value.items[2]).toMatchObject({ name: 'beta', disable: true });
    });

    it('is a no-op when fromIndex is out of range', async () => {
      const field = dbxForgeArrayField({
        key: 'items',
        template: [dbxForgeTextField({ key: 'name', label: 'Name' }), dbxForgeToggleField({ key: 'disable', label: 'Disable Remove' })]
      });

      fixture.componentInstance.config.set({ fields: [field] });
      await settle();

      fixture.componentInstance.setValue({
        items: [{ name: 'alpha', disable: false }]
      });
      await settle(100);

      getParentWrapper().duplicateItem(5, 0); // out of range
      await settle(50);

      const value = (await firstValueFrom(fixture.componentInstance.getValue())) as { items: { name: string; disable: boolean }[] };

      expect(value.items).toHaveLength(1);
    });
  });
});

// ============================================================================
// Unit Tests - dbxForgeArrayFieldTemplateWithItemValues()
// ============================================================================

describe('dbxForgeArrayFieldTemplateWithItemValues', () => {
  it('populates leaf field values from the source item', () => {
    const template = [
      { key: 'name', type: 'text', value: '' },
      { key: 'disable', type: 'toggle', value: false }
    ] as unknown as ArrayItemDefinitionTemplate;

    const result = dbxForgeArrayFieldTemplateWithItemValues(template, { name: 'hello', disable: true });

    expect(result).toEqual([
      { key: 'name', type: 'text', value: 'hello' },
      { key: 'disable', type: 'toggle', value: true }
    ]);
  });

  it('recurses into the outer array-item container using the source item as-is', () => {
    const template = [
      {
        key: 'test2-container',
        type: 'container',
        fields: [
          { key: 'name', type: 'text', value: '' },
          { key: 'disable', type: 'toggle', value: false }
        ]
      }
    ] as unknown as ArrayItemDefinitionTemplate;

    const result = dbxForgeArrayFieldTemplateWithItemValues(template, { name: 'hello', disable: true });

    expect(result).toEqual([
      {
        key: 'test2-container',
        type: 'container',
        fields: [
          { key: 'name', type: 'text', value: 'hello' },
          { key: 'disable', type: 'toggle', value: true }
        ]
      }
    ]);
  });

  it('recurses into nested groups using the sub-object from the source', () => {
    const template = [
      {
        key: 'item-container',
        type: 'container',
        fields: [
          { key: 'name', type: 'text' },
          {
            key: 'address',
            type: 'group',
            fields: [
              { key: 'street', type: 'text' },
              { key: 'city', type: 'text' }
            ]
          }
        ]
      }
    ] as unknown as ArrayItemDefinitionTemplate;

    const result = dbxForgeArrayFieldTemplateWithItemValues(template, {
      name: 'Alice',
      address: { street: '1 Way', city: 'Metropolis' }
    });

    expect(result).toEqual([
      {
        key: 'item-container',
        type: 'container',
        fields: [
          { key: 'name', type: 'text', value: 'Alice' },
          {
            key: 'address',
            type: 'group',
            fields: [
              { key: 'street', type: 'text', value: '1 Way' },
              { key: 'city', type: 'text', value: 'Metropolis' }
            ]
          }
        ]
      }
    ]);
  });

  it('leaves fields untouched when the source is missing their key', () => {
    const template = [
      { key: 'name', type: 'text', value: 'default-name' },
      { key: 'disable', type: 'toggle', value: false }
    ] as unknown as ArrayItemDefinitionTemplate;

    const result = dbxForgeArrayFieldTemplateWithItemValues(template, { name: 'only-name' });

    expect(result).toEqual([
      { key: 'name', type: 'text', value: 'only-name' },
      { key: 'disable', type: 'toggle', value: false }
    ]);
  });

  it('returns the template unchanged when the source is null or primitive', () => {
    const template = [{ key: 'name', type: 'text', value: 'default' }] as unknown as ArrayItemDefinitionTemplate;

    expect(dbxForgeArrayFieldTemplateWithItemValues(template, null)).toBe(template);
    expect(dbxForgeArrayFieldTemplateWithItemValues(template, undefined)).toBe(template);
    expect(dbxForgeArrayFieldTemplateWithItemValues(template, 42)).toBe(template);
    expect(dbxForgeArrayFieldTemplateWithItemValues(template, 'string-item')).toBe(template);
  });

  it('does not mutate the input template', () => {
    const template = [
      {
        key: 'container',
        type: 'container',
        fields: [{ key: 'name', type: 'text', value: '' }]
      }
    ] as unknown as ArrayItemDefinitionTemplate;
    const frozenBefore = JSON.parse(JSON.stringify(template));

    dbxForgeArrayFieldTemplateWithItemValues(template, { name: 'new' });

    expect(template).toEqual(frozenBefore);
  });
});
