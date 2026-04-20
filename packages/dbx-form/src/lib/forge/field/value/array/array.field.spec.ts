import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { type FormConfig, withLoggerConfig } from '@ng-forge/dynamic-forms';
import { waitForMs } from '@dereekb/util';
import { firstValueFrom } from 'rxjs';
import { dbxForgeArrayField } from './array.field';
import { DBX_FORGE_ARRAY_FIELD_WRAPPER_NAME } from '../../wrapper/array-field/array-field.wrapper';
import { DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME } from '../../wrapper/array-field/array-field.element.wrapper';
import { DBX_FORGE_TEST_PROVIDERS } from '../../../form/forge.component.spec';
import { DbxForgeAsyncConfigFormComponent } from '../../../form';
import { forgeTextField } from '../text/text.field';

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
    function getElementWrapper(field: any): any {
      return field.fields[0].wrappers[0];
    }

    it('should wrap fields in a ContainerField with the element wrapper', () => {
      const field = dbxForgeArrayField({ key: 'items', template: basicFields }) as any;
      expect(field.fields).toHaveLength(1);
      expect(field.fields[0].type).toBe('container');

      const elementWrapper = getElementWrapper(field);
      expect(elementWrapper.type).toBe(DBX_FORGE_ARRAY_FIELD_ELEMENT_WRAPPER_NAME);
    });

    it('should contain the original fields inside the container', () => {
      const fields = [
        { key: 'name', type: 'input' as const, label: 'Name' },
        { key: 'email', type: 'input' as const, label: 'Email' }
      ] as any[];

      const field = dbxForgeArrayField({ key: 'items', template: fields }) as any;
      expect(field.fields).toEqual([]); // array starts empty now
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
        template: [forgeTextField({ key: 'name', label: 'Name' })]
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
        template: [forgeTextField({ key: 'name', label: 'Name' })]
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
        template: [forgeTextField({ key: 'name', label: 'Name' })]
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
});
