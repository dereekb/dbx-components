import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { type FieldDef, type FormConfig, type LogicConfig, type SchemaDefinition } from '@ng-forge/dynamic-forms';
import { copyFormConfigCustomFnConfig, dbxForgeFinalizeFormConfig, type DbxForgeField, mergeDbxForgeFieldFormConfig } from './forge.form';
import { dbxForgeAddressGroup, dbxForgeAddressListField } from '../field/value/text/text.address.field';
import { dbxForgeStateField } from '../field/value/text/text.additional.field';
import { SELF_DEPENDENCY_TOKEN } from '../field';

/**
 * Walks a fields tree (recursing through container/group/row/array `fields` and SimplifiedArrayField `template`)
 * and returns the first field whose `key` matches.
 */
function findFieldByKey(fields: readonly FieldDef<unknown>[], key: string): FieldDef<unknown> | undefined {
  for (const field of fields) {
    if ((field as { key?: string }).key === key) {
      return field;
    }

    const children = (field as { fields?: unknown }).fields;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (Array.isArray(child)) {
          const found = findFieldByKey(child as FieldDef<unknown>[], key);
          if (found) return found;
        } else if (child && typeof child === 'object') {
          const found = findFieldByKey([child as FieldDef<unknown>], key);
          if (found) return found;
        }
      }
    }

    const template = (field as { template?: unknown }).template;
    if (Array.isArray(template)) {
      const found = findFieldByKey(template as FieldDef<unknown>[], key);
      if (found) return found;
    } else if (template && typeof template === 'object') {
      const found = findFieldByKey([template as FieldDef<unknown>], key);
      if (found) return found;
    }
  }

  return undefined;
}

function testSchemaDefinition(name: string): SchemaDefinition {
  return { name };
}

function testFormConfig(config: Partial<FormConfig> = {}): FormConfig {
  return { fields: [], ...config } as FormConfig;
}

describe('mergeDbxForgeFieldFormConfig()', () => {
  it('should return empty config when given no inputs', () => {
    const result = mergeDbxForgeFieldFormConfig();
    expect(result.schemas).toBeUndefined();
    expect(result.externalData).toBeUndefined();
    expect(result.customFnConfig).toBeUndefined();
  });

  it('should return empty config when given an empty input', () => {
    const result = mergeDbxForgeFieldFormConfig({});
    expect(result.schemas).toBeUndefined();
    expect(result.externalData).toBeUndefined();
    expect(result.customFnConfig).toBeUndefined();
  });

  describe('schemas', () => {
    it('should merge schemas from multiple inputs', () => {
      const schemaA = testSchemaDefinition('a');
      const schemaB = testSchemaDefinition('b');

      const result = mergeDbxForgeFieldFormConfig({ schemas: [schemaA] }, { schemas: [schemaB] });

      expect(result.schemas).toEqual([schemaA, schemaB]);
    });

    it('should skip inputs without schemas', () => {
      const schemaA = testSchemaDefinition('a');

      const result = mergeDbxForgeFieldFormConfig({ schemas: [schemaA] }, {});

      expect(result.schemas).toEqual([schemaA]);
    });
  });

  describe('externalData', () => {
    it('should merge externalData from multiple inputs', () => {
      const sigA = signal('a');
      const sigB = signal('b');

      const result = mergeDbxForgeFieldFormConfig({ externalData: { a: sigA } }, { externalData: { b: sigB } });

      expect(result.externalData).toEqual({ a: sigA, b: sigB });
    });

    it('should override externalData with the same key', () => {
      const sigA = signal('first');
      const sigB = signal('second');

      const result = mergeDbxForgeFieldFormConfig({ externalData: { key: sigA } }, { externalData: { key: sigB } });

      expect(result.externalData!['key']).toBe(sigB);
    });
  });

  describe('customFnConfig', () => {
    it('should merge customFunctions from multiple inputs', () => {
      const fnA = () => true;
      const fnB = () => false;

      const result = mergeDbxForgeFieldFormConfig({ customFnConfig: { customFunctions: { a: fnA } } }, { customFnConfig: { customFunctions: { b: fnB } } });

      expect(result.customFnConfig!.customFunctions).toEqual({ a: fnA, b: fnB });
    });

    it('should merge different customFnConfig sub-properties', () => {
      const fn = () => true;
      const validator = () => null;

      const result = mergeDbxForgeFieldFormConfig({ customFnConfig: { customFunctions: { a: fn } } }, { customFnConfig: { validators: { v: validator } } });

      expect(result.customFnConfig!.customFunctions).toEqual({ a: fn });
      expect(result.customFnConfig!.validators).toEqual({ v: validator });
    });

    it('should override customFunctions with the same key', () => {
      const fnA = () => true;
      const fnB = () => false;

      const result = mergeDbxForgeFieldFormConfig({ customFnConfig: { customFunctions: { x: fnA } } }, { customFnConfig: { customFunctions: { x: fnB } } });

      expect(result.customFnConfig!.customFunctions!['x']).toBe(fnB);
    });
  });
});

describe('copyFormConfigCustomFnConfig()', () => {
  it('should return an empty object for undefined input', () => {
    const result = copyFormConfigCustomFnConfig(undefined);
    expect(result).toEqual({});
  });

  it('should return an empty object for empty input', () => {
    const result = copyFormConfigCustomFnConfig({});
    expect(result).toEqual({});
  });

  it('should shallow-copy sub-properties', () => {
    const fn = () => true;
    const input: FormConfig['customFnConfig'] = { customFunctions: { a: fn } };

    const result = copyFormConfigCustomFnConfig(input);

    expect(result!.customFunctions).toEqual({ a: fn });
    expect(result!.customFunctions).not.toBe(input!.customFunctions);
  });

  it('should copy multiple sub-properties independently', () => {
    const fn = () => true;
    const validator = () => null;
    const input: FormConfig['customFnConfig'] = {
      customFunctions: { a: fn },
      validators: { v: validator }
    };

    const result = copyFormConfigCustomFnConfig(input);

    expect(result!.customFunctions).toEqual({ a: fn });
    expect(result!.validators).toEqual({ v: validator });
    expect(result!.customFunctions).not.toBe(input!.customFunctions);
    expect(result!.validators).not.toBe(input!.validators);
  });
});

describe('dbxForgeFinalizeFormConfig()', () => {
  it('should return the input config when fields have no _formConfig', () => {
    const input = testFormConfig({
      fields: [{ type: 'input', key: 'name' }]
    });

    const result = dbxForgeFinalizeFormConfig(input);

    expect(result.input).toBe(input);
    expect(result.extractedFieldFormConfigs).toEqual([]);
    expect(result.config.fields).toBe(input.fields);
  });

  it('should extract and merge _formConfig from fields', () => {
    const schema = testSchemaDefinition('test');
    const sig = signal('value');

    const fieldWithConfig: DbxForgeField<any> = {
      type: 'input',
      key: 'name',
      _formConfig: {
        schemas: [schema],
        externalData: { ext: sig }
      }
    };

    const input = testFormConfig({ fields: [fieldWithConfig] });
    const result = dbxForgeFinalizeFormConfig(input);

    expect(result.extractedFieldFormConfigs).toHaveLength(1);
    expect(result.config.schemas).toEqual([schema]);
    expect(result.config.externalData!['ext']).toBe(sig);
  });

  it('should merge field schemas with input schemas', () => {
    const inputSchema = testSchemaDefinition('input');
    const fieldSchema = testSchemaDefinition('field');

    const fieldWithConfig: DbxForgeField<any> = {
      type: 'input',
      key: 'name',
      _formConfig: { schemas: [fieldSchema] }
    };

    const input = testFormConfig({
      fields: [fieldWithConfig],
      schemas: [inputSchema]
    });

    const result = dbxForgeFinalizeFormConfig(input);

    expect(result.config.schemas).toContainEqual(inputSchema);
    expect(result.config.schemas).toContainEqual(fieldSchema);
  });

  it('should deduplicate schemas by name', () => {
    const schema = testSchemaDefinition('shared');

    const fieldWithConfig: DbxForgeField<any> = {
      type: 'input',
      key: 'name',
      _formConfig: { schemas: [schema] }
    };

    const input = testFormConfig({
      fields: [fieldWithConfig],
      schemas: [schema]
    });

    const result = dbxForgeFinalizeFormConfig(input);
    const schemaNames = result.config.schemas!.map((s) => s.name);

    expect(schemaNames.filter((n) => n === 'shared')).toHaveLength(1);
  });

  it('should merge customFnConfig from fields into the input config', () => {
    const inputFn = () => 'input';
    const fieldFn = () => 'field';

    const fieldWithConfig: DbxForgeField<any> = {
      type: 'input',
      key: 'name',
      _formConfig: { customFnConfig: { customFunctions: { fieldFn } } }
    };

    const input = testFormConfig({
      fields: [fieldWithConfig],
      customFnConfig: { customFunctions: { inputFn } }
    });

    const result = dbxForgeFinalizeFormConfig(input);

    expect(result.config.customFnConfig!.customFunctions!['inputFn']).toBe(inputFn);
    expect(result.config.customFnConfig!.customFunctions!['fieldFn']).toBe(fieldFn);
  });

  it('should not mutate the input customFnConfig', () => {
    const inputFn = () => 'input';
    const fieldFn = () => 'field';

    const fieldWithConfig: DbxForgeField<any> = {
      type: 'input',
      key: 'name',
      _formConfig: { customFnConfig: { customFunctions: { fieldFn } } }
    };

    const inputCustomFnConfig = { customFunctions: { inputFn } };
    const input = testFormConfig({
      fields: [fieldWithConfig],
      customFnConfig: inputCustomFnConfig
    });

    dbxForgeFinalizeFormConfig(input);

    expect(inputCustomFnConfig.customFunctions).toEqual({ inputFn });
    expect((inputCustomFnConfig.customFunctions as any)['fieldFn']).toBeUndefined();
  });

  it('should skip fields without _formConfig', () => {
    const fieldWithConfig: DbxForgeField<any> = {
      type: 'input',
      key: 'a',
      _formConfig: { schemas: [testSchemaDefinition('s')] }
    };

    const fieldWithout: DbxForgeField<any> = {
      type: 'input',
      key: 'b'
    };

    const input = testFormConfig({ fields: [fieldWithConfig, fieldWithout] });
    const result = dbxForgeFinalizeFormConfig(input);

    expect(result.extractedFieldFormConfigs).toHaveLength(1);
  });

  describe('nested _formConfig extraction', () => {
    it('should extract _formConfig from a field nested in a container', () => {
      const derivationFn = () => 'computed';

      const nestedField: DbxForgeField<any> = {
        type: 'input',
        key: 'state',
        _formConfig: { customFnConfig: { derivations: { __fn__state_1: derivationFn } } }
      };

      const container = {
        type: 'container',
        key: 'wrapper',
        fields: [nestedField],
        wrappers: []
      };

      const input = testFormConfig({ fields: [container as any] });
      const result = dbxForgeFinalizeFormConfig(input);

      expect(result.extractedFieldFormConfigs).toHaveLength(1);
      expect(result.config.customFnConfig!.derivations!['__fn__state_1']).toBe(derivationFn);
    });

    it('should extract _formConfig from a field nested in a group', () => {
      const validatorFn = () => null;

      const nestedField: DbxForgeField<any> = {
        type: 'input',
        key: 'state',
        _formConfig: { customFnConfig: { validators: { __vfn__state_1: validatorFn } } }
      };

      const group = {
        type: 'group',
        key: 'address',
        fields: [nestedField]
      };

      const input = testFormConfig({ fields: [group as any] });
      const result = dbxForgeFinalizeFormConfig(input);

      expect(result.config.customFnConfig!.validators!['__vfn__state_1']).toBe(validatorFn);
    });

    it('should extract _formConfig from a field nested two levels deep (group inside container)', () => {
      const fn = () => 'value';

      const leaf: DbxForgeField<any> = {
        type: 'input',
        key: 'state',
        _formConfig: { customFnConfig: { derivations: { __fn__state_1: fn } } }
      };

      const group = { type: 'group', key: 'address', fields: [leaf] };
      const container = { type: 'container', key: 'wrapper', fields: [group], wrappers: [] };

      const input = testFormConfig({ fields: [container as any] });
      const result = dbxForgeFinalizeFormConfig(input);

      expect(result.config.customFnConfig!.derivations!['__fn__state_1']).toBe(fn);
    });

    it('should extract _formConfig from a field nested inside a SimplifiedArrayField template (single field)', () => {
      const fn = () => 'value';

      const templateField: DbxForgeField<any> = {
        type: 'input',
        key: 'tag',
        _formConfig: { customFnConfig: { derivations: { __fn__tag_1: fn } } }
      };

      const arrayField = {
        type: 'array',
        key: 'tags',
        template: templateField
      };

      const input = testFormConfig({ fields: [arrayField as any] });
      const result = dbxForgeFinalizeFormConfig(input);

      expect(result.config.customFnConfig!.derivations!['__fn__tag_1']).toBe(fn);
    });

    it('should extract _formConfig from fields nested inside a SimplifiedArrayField template (array)', () => {
      const fn = () => 'value';

      const templateField: DbxForgeField<any> = {
        type: 'input',
        key: 'state',
        _formConfig: { customFnConfig: { derivations: { __fn__state_1: fn } } }
      };

      const arrayField = {
        type: 'array',
        key: 'addresses',
        template: [templateField]
      };

      const input = testFormConfig({ fields: [arrayField as any] });
      const result = dbxForgeFinalizeFormConfig(input);

      expect(result.config.customFnConfig!.derivations!['__fn__state_1']).toBe(fn);
    });

    it('should extract _formConfig._hiddenFields from a nested field', () => {
      const hiddenField = { type: 'hidden', key: 'shadow', value: 'x', hidden: true } as any;

      const nestedField: DbxForgeField<any> = {
        type: 'input',
        key: 'visible',
        _formConfig: { _hiddenFields: [hiddenField] }
      };

      const container = { type: 'container', key: 'wrapper', fields: [nestedField], wrappers: [] };

      const input = testFormConfig({ fields: [container as any] });
      const result = dbxForgeFinalizeFormConfig(input);

      expect(result.config.fields).toContain(hiddenField);
    });
  });

  describe('globalDefaults', () => {
    it('should apply global defaultValidationMessages when input has none', () => {
      const input = testFormConfig({
        fields: [{ type: 'input', key: 'name' }]
      });

      const result = dbxForgeFinalizeFormConfig(input, {
        defaultValidationMessages: { required: 'Global required' }
      });

      expect(result.config.defaultValidationMessages).toEqual({ required: 'Global required' });
    });

    it('should let input defaultValidationMessages override global defaults', () => {
      const input = testFormConfig({
        fields: [{ type: 'input', key: 'name' }],
        defaultValidationMessages: { required: 'Input required' }
      });

      const result = dbxForgeFinalizeFormConfig(input, {
        defaultValidationMessages: { required: 'Global required' }
      });

      expect(result.config.defaultValidationMessages?.['required']).toBe('Input required');
    });

    it('should let field-level _formConfig.defaultValidationMessages override both global and input', () => {
      const fieldWithConfig: DbxForgeField<any> = {
        type: 'input',
        key: 'name',
        _formConfig: { defaultValidationMessages: { required: 'Field required' } }
      };

      const input = testFormConfig({
        fields: [fieldWithConfig],
        defaultValidationMessages: { required: 'Input required' }
      });

      const result = dbxForgeFinalizeFormConfig(input, {
        defaultValidationMessages: { required: 'Global required' }
      });

      expect(result.config.defaultValidationMessages?.['required']).toBe('Field required');
    });

    it('should preserve global keys that are not overridden', () => {
      const input = testFormConfig({
        fields: [{ type: 'input', key: 'name' }],
        defaultValidationMessages: { required: 'Input required' }
      });

      const result = dbxForgeFinalizeFormConfig(input, {
        defaultValidationMessages: { required: 'Global required', email: 'Global email' }
      });

      expect(result.config.defaultValidationMessages?.['required']).toBe('Input required');
      expect(result.config.defaultValidationMessages?.['email']).toBe('Global email');
    });

    it('should behave identically to no globalDefaults when globalDefaults is undefined', () => {
      const input = testFormConfig({
        fields: [{ type: 'input', key: 'name' }],
        defaultValidationMessages: { required: 'Input required' }
      });

      const result = dbxForgeFinalizeFormConfig(input);

      expect(result.config.defaultValidationMessages).toEqual({ required: 'Input required' });
    });
  });

  // ============================================================================
  // Idempotent transform wiring through composite factories
  //
  // Isolates whether the transform is correctly described in the finalized
  // FormConfig, so we can tell whether a runtime "no-op" is a dbx-form
  // wiring problem or an ng-forge runtime problem.
  // ============================================================================

  describe('idempotentTransform wiring', () => {
    describe('standalone dbxForgeStateField({ asCode: true })', () => {
      const stateField = dbxForgeStateField({ asCode: true });
      const result = dbxForgeFinalizeFormConfig({ fields: [stateField as never] });

      const derivations = result.config.customFnConfig?.derivations ?? {};
      const derivationName = Object.keys(derivations).find((name) => name.startsWith('__fn__state_'));

      it('should register the idempotent-transform derivation in customFnConfig', () => {
        expect(derivationName).toBeDefined();
        expect(typeof derivations[derivationName as string]).toBe('function');
      });

      it('should attach a derivation logic entry to the state field that references the registered derivation', () => {
        const stateInField = findFieldByKey(result.config.fields, 'state') as FieldDef<unknown> & { logic?: LogicConfig[] };
        expect(stateInField).toBeDefined();

        const derivationLogic = stateInField.logic?.find((entry) => entry.type === 'derivation') as (LogicConfig & { type: 'derivation'; functionName?: string; dependsOn?: string[] }) | undefined;

        expect(derivationLogic).toBeDefined();
        expect(derivationLogic?.functionName).toBe(derivationName);
        expect(derivationLogic?.dependsOn).toEqual([SELF_DEPENDENCY_TOKEN]);
      });

      it('should run the registered derivation and uppercase a lowercase value', () => {
        const fn = derivations[derivationName as string] as (ctx: { fieldValue: unknown }) => unknown;
        expect(fn({ fieldValue: 'tx' })).toBe('TX');
      });
    });

    describe('dbxForgeAddressGroup({ stateField: { asCode: true } })', () => {
      const group = dbxForgeAddressGroup({ stateField: { asCode: true } });
      const result = dbxForgeFinalizeFormConfig({ fields: [group as never] });

      const derivations = result.config.customFnConfig?.derivations ?? {};
      const derivationName = Object.keys(derivations).find((name) => name.startsWith('__fn__state_'));

      it('should still register the idempotent-transform derivation in customFnConfig (pulled up from the nested state field)', () => {
        expect(derivationName).toBeDefined();
        expect(typeof derivations[derivationName as string]).toBe('function');
      });

      it('should still attach a derivation logic entry on the deeply-nested state field referencing the registered derivation', () => {
        const stateInField = findFieldByKey(result.config.fields, 'state') as (FieldDef<unknown> & { logic?: LogicConfig[] }) | undefined;
        expect(stateInField).toBeDefined();

        const derivationLogic = stateInField?.logic?.find((entry) => entry.type === 'derivation') as (LogicConfig & { type: 'derivation'; functionName?: string; dependsOn?: string[] }) | undefined;

        expect(derivationLogic).toBeDefined();
        expect(derivationLogic?.functionName).toBe(derivationName);
        // dependsOn currently uses the field's local key; ng-forge needs to resolve it
        // relative to the state field's group context (`address.state`) at runtime.
        expect(derivationLogic?.dependsOn).toEqual([SELF_DEPENDENCY_TOKEN]);
      });

      it('should run the same registered derivation against a lowercase value (proving the dbx-form wiring is correct)', () => {
        const fn = derivations[derivationName as string] as (ctx: { fieldValue: unknown }) => unknown;
        expect(fn({ fieldValue: 'tx' })).toBe('TX');
      });
    });

    describe('dbxForgeAddressListField({ stateField: { asCode: true } })', () => {
      const list = dbxForgeAddressListField({ stateField: { asCode: true } });
      const result = dbxForgeFinalizeFormConfig({ fields: [list as never] });

      const derivations = result.config.customFnConfig?.derivations ?? {};
      const derivationName = Object.keys(derivations).find((name) => name.startsWith('__fn__state_'));

      it('should register the idempotent-transform derivation pulled up from the array template state field', () => {
        expect(derivationName).toBeDefined();
        expect(typeof derivations[derivationName as string]).toBe('function');
      });

      it('should attach the derivation logic entry on the state field inside the array item template', () => {
        const stateInField = findFieldByKey(result.config.fields, 'state') as (FieldDef<unknown> & { logic?: LogicConfig[] }) | undefined;
        expect(stateInField).toBeDefined();

        const derivationLogic = stateInField?.logic?.find((entry) => entry.type === 'derivation') as (LogicConfig & { type: 'derivation'; functionName?: string; dependsOn?: string[] }) | undefined;

        expect(derivationLogic).toBeDefined();
        expect(derivationLogic?.functionName).toBe(derivationName);
        expect(derivationLogic?.dependsOn).toEqual([SELF_DEPENDENCY_TOKEN]);
      });
    });
  });

  // ============================================================================
  // Cross-sibling dependency resolution inside a group
  //
  // The auto-applied SELF_DEPENDENCY_TOKEN only covers self-referential
  // transforms. A user-authored derivation that declares `dependsOn: ['line1']`
  // on a field inside a group must be left untouched by dbx-form so ng-forge
  // can resolve it relative to the field's parent group at runtime.
  // ============================================================================

  describe('cross-sibling dependency resolution inside a group', () => {
    it('should preserve user-supplied dependsOn (not rewrite to $self) on a derivation declared inside a group', () => {
      const derivedField = {
        type: 'input',
        key: 'derived',
        logic: [
          {
            type: 'derivation',
            trigger: 'onChange',
            functionName: 'concat',
            dependsOn: ['line1']
          }
        ]
      };

      const group = {
        type: 'group',
        key: 'address',
        fields: [{ type: 'input', key: 'line1' }, derivedField]
      };

      const input = testFormConfig({
        fields: [group as never],
        customFnConfig: {
          derivations: {
            concat: (ctx: { formValue: { address?: { line1?: string } } }) => 'derived: ' + (ctx.formValue?.address?.line1 ?? '')
          }
        }
      });

      const result = dbxForgeFinalizeFormConfig(input);
      const derivedInField = findFieldByKey(result.config.fields, 'derived') as FieldDef<unknown> & { logic?: LogicConfig[] };
      const derivationLogic = derivedInField.logic?.find((entry) => entry.type === 'derivation') as (LogicConfig & { type: 'derivation'; dependsOn?: string[] }) | undefined;

      expect(derivationLogic).toBeDefined();
      expect(derivationLogic?.dependsOn).toEqual(['line1']);
      expect(result.config.customFnConfig?.derivations?.['concat']).toBeDefined();
    });

    it('should preserve user-supplied dependsOn on a top-level derivation as well', () => {
      const fieldWithLogic = {
        type: 'input',
        key: 'derived',
        logic: [
          {
            type: 'derivation',
            trigger: 'onChange',
            functionName: 'concat',
            dependsOn: ['name']
          }
        ]
      };

      const input = testFormConfig({
        fields: [{ type: 'input', key: 'name' }, fieldWithLogic as never]
      });

      const result = dbxForgeFinalizeFormConfig(input);
      const derivedInField = findFieldByKey(result.config.fields, 'derived') as FieldDef<unknown> & { logic?: LogicConfig[] };
      const derivationLogic = derivedInField.logic?.find((entry) => entry.type === 'derivation') as (LogicConfig & { type: 'derivation'; dependsOn?: string[] }) | undefined;

      expect(derivationLogic?.dependsOn).toEqual(['name']);
    });
  });
});
