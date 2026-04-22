import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { type FormConfig, type SchemaDefinition } from '@ng-forge/dynamic-forms';
import { copyFormConfigCustomFnConfig, dbxForgeFinalizeFormConfig, type DbxForgeField, type DbxForgeFieldFormConfig, mergeDbxForgeFieldFormConfig } from './forge.form';

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
});
