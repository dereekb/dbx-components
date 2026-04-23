import { describe, it, expect } from 'vitest';
import type { AsyncCustomValidator, BaseValueField, CustomValidator, FieldMeta, LogicConfig } from '@ng-forge/dynamic-forms';
import { dbxForgeFieldFunction, dbxForgeBuildFieldDef, type DbxForgeFieldFunctionDef, type DbxForgeFieldFunction, type DbxForgeBuildFieldDefFunction } from './field';
import type { DbxForgeField } from '../form/forge.form';

// MARK: Test Types
interface TestFieldProps {
  hint?: string;
}

type TestFieldDef = BaseValueField<TestFieldProps, string> & { type: 'test' };

interface TestFieldConfig extends DbxForgeFieldFunctionDef<TestFieldDef> {
  readonly extra?: string;
}

// MARK: Test Field Factory
const forgeTestField: DbxForgeFieldFunction<TestFieldConfig> = dbxForgeFieldFunction<TestFieldConfig>({
  type: 'test',
  buildFieldDef: dbxForgeBuildFieldDef((x, config) => {
    // base configure function — intentionally minimal
  })
});

// MARK: Tests
describe('dbxForgeFieldFunction()', () => {
  it('should set the type on the result', () => {
    const field = forgeTestField({ key: 'name' });
    expect(field.type).toBe('test');
  });

  it('should set the key from input', () => {
    const field = forgeTestField({ key: 'myKey' });
    expect(field.key).toBe('myKey');
  });

  it('should pass through label', () => {
    const field = forgeTestField({ key: 'x', label: 'My Label' });
    expect(field.label).toBe('My Label');
  });

  it('should pass through required', () => {
    const field = forgeTestField({ key: 'x', required: true });
    expect(field.required).toBe(true);
  });

  it('should pass through readonly', () => {
    const field = forgeTestField({ key: 'x', readonly: true });
    expect(field.readonly).toBe(true);
  });

  it('should pass through props from input', () => {
    const field = forgeTestField({ key: 'x', props: { hint: 'some hint' } });
    expect(field.props?.hint).toBe('some hint');
  });
});

describe('configure parameter', () => {
  describe('getFieldDef()', () => {
    it('should return the mutable field def', () => {
      let capturedKey: string | undefined;

      forgeTestField({ key: 'test-key' }, (x) => {
        capturedKey = x.getFieldDef().key;
      });

      expect(capturedKey).toBe('test-key');
    });
  });

  describe('getProps()', () => {
    it('should return the mutable props', () => {
      let capturedHint: string | undefined;

      forgeTestField({ key: 'x', props: { hint: 'hello' } }, (x) => {
        capturedHint = x.getProps()?.hint;
      });

      expect(capturedHint).toBe('hello');
    });
  });

  describe('validation', () => {
    it('should add validators via addValidation()', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addValidation({
          validators: { type: 'required' }
        });
      });

      expect(field.validators).toBeDefined();
      expect(field.validators).toHaveLength(1);
      expect(field.validators![0].type).toBe('required');
    });

    it('should merge validationMessages via addValidation()', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addValidation({
          validationMessages: { required: 'This field is required' }
        });
      });

      expect(field.validationMessages?.required).toBe('This field is required');
    });

    it('should merge validators from multiple addValidation() calls', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addValidation({ validators: { type: 'required' } });
        x.addValidation({ validators: { type: 'email' } });
      });

      expect(field.validators).toHaveLength(2);
      expect(field.validators!.map((v) => v.type)).toContain('required');
      expect(field.validators!.map((v) => v.type)).toContain('email');
    });

    it('should deduplicate validators by type', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addValidation({ validators: { type: 'required' } });
        x.addValidation({ validators: { type: 'required' } });
      });

      expect(field.validators).toHaveLength(1);
    });

    it('should merge validationMessages from multiple addValidation() calls', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addValidation({ validationMessages: { required: 'Required' } });
        x.addValidation({ validationMessages: { email: 'Invalid email' } });
      });

      expect(field.validationMessages?.required).toBe('Required');
      expect(field.validationMessages?.email).toBe('Invalid email');
    });

    it('should replace validators entirely via setValidation()', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addValidation({ validators: { type: 'required' } });
        x.setValidation({
          validators: [{ type: 'email' }],
          validationMessages: { email: 'Must be email' }
        });
      });

      expect(field.validators).toHaveLength(1);
      expect(field.validators![0].type).toBe('email');
      expect(field.validationMessages?.email).toBe('Must be email');
    });

    it('should return current validation via getValidation()', () => {
      forgeTestField({ key: 'x' }, (x) => {
        x.addValidation({ validators: { type: 'required' }, validationMessages: { required: 'Req' } });

        const validation = x.getValidation();
        expect(validation.validators).toHaveLength(1);
        expect(validation.validationMessages?.required).toBe('Req');
      });
    });

    it('should return empty default validation via getDefaultValidation()', () => {
      forgeTestField({ key: 'x' }, (x) => {
        const defaults = x.getDefaultValidation();
        expect(defaults).toEqual({});
      });
    });

    it('should not throw when calling injectDefaultValidation()', () => {
      expect(() => {
        forgeTestField({ key: 'x' }, (x) => {
          x.injectDefaultValidation();
        });
      }).not.toThrow();
    });

    it('should not deduplicate custom validators with different functionNames', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addValidation({ validators: { type: 'custom', functionName: 'validatorA' } });
        x.addValidation({ validators: { type: 'custom', functionName: 'validatorB' } });
      });

      expect(field.validators).toHaveLength(2);
    });

    it('should not deduplicate async validators with different functionNames', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addValidation({ validators: { type: 'async', functionName: 'asyncA' } });
        x.addValidation({ validators: { type: 'async', functionName: 'asyncB' } });
      });

      expect(field.validators).toHaveLength(2);
    });

    describe('inline fn validators', () => {
      it('should register a custom validator fn and replace with auto-generated functionName', () => {
        const myValidator: CustomValidator = () => null;

        const field = forgeTestField({ key: 'x' }, (x) => {
          x.addValidation({
            validators: [{ type: 'custom', fn: myValidator }]
          });
        });

        const validators = field.validators!;
        expect(validators).toHaveLength(1);
        expect(validators[0].type).toBe('custom');
        expect((validators[0] as any).fn).toBeUndefined();
        expect((validators[0] as any).functionName).toBeDefined();
        expect((validators[0] as any).functionName).toContain('__vfn__x_');

        const formConfig = (field as DbxForgeField<any>)._formConfig;
        expect(formConfig?.customFnConfig?.validators).toBeDefined();
        expect(Object.values(formConfig!.customFnConfig!.validators!)).toContain(myValidator);
      });

      it('should register an async validator fn and replace with auto-generated functionName', () => {
        const myAsyncValidator: AsyncCustomValidator = {
          params: () => ({}),
          factory: () => ({}) as any,
          onSuccess: () => null
        };

        const field = forgeTestField({ key: 'x' }, (x) => {
          x.addValidation({
            validators: [{ type: 'async', fn: myAsyncValidator }]
          });
        });

        const validators = field.validators!;
        expect(validators).toHaveLength(1);
        expect(validators[0].type).toBe('async');
        expect((validators[0] as any).fn).toBeUndefined();
        expect((validators[0] as any).functionName).toBeDefined();

        const formConfig = (field as DbxForgeField<any>)._formConfig;
        expect(formConfig?.customFnConfig?.asyncValidators).toBeDefined();
        expect(Object.values(formConfig!.customFnConfig!.asyncValidators!)).toContain(myAsyncValidator);
      });

      it('should preserve explicit functionName when provided alongside fn', () => {
        const myValidator: CustomValidator = () => null;

        const field = forgeTestField({ key: 'x' }, (x) => {
          x.addValidation({
            validators: [{ type: 'custom', functionName: 'myExplicitName', fn: myValidator }]
          });
        });

        const validators = field.validators!;
        expect((validators[0] as any).functionName).toBe('myExplicitName');

        const formConfig = (field as DbxForgeField<any>)._formConfig;
        expect(formConfig!.customFnConfig!.validators!['myExplicitName']).toBe(myValidator);
      });

      it('should remove fn and reusableDefinition from finalized validator entries', () => {
        const myValidator: CustomValidator = () => null;

        const field = forgeTestField({ key: 'x' }, (x) => {
          x.addValidation({
            validators: [{ type: 'custom', fn: myValidator, functionName: 'test', reusableDefinition: true }]
          });
        });

        const validators = field.validators!;
        expect((validators[0] as any).fn).toBeUndefined();
        expect((validators[0] as any).reusableDefinition).toBeUndefined();
        expect((validators[0] as any).functionName).toBe('test');
      });

      it('should preserve params on the finalized ValidatorConfig for reusable definitions', () => {
        const myAsyncValidator: AsyncCustomValidator = {
          params: () => ({}),
          factory: () => ({}) as any
        };

        const field = forgeTestField({ key: 'x' }, (x) => {
          x.addValidation({
            validators: [
              {
                type: 'async',
                fn: myAsyncValidator,
                functionName: 'checkAvailable',
                reusableDefinition: true,
                params: { checkFn: 'someValue' }
              }
            ]
          });
        });

        const validators = field.validators!;
        expect((validators[0] as any).params).toEqual({ checkFn: 'someValue' });
      });
    });

    describe('formValidationMessages', () => {
      it('should merge formValidationMessages into _formConfig.defaultValidationMessages', () => {
        const field = forgeTestField({ key: 'x' }, (x) => {
          x.addValidation({
            formValidationMessages: { customError: 'Custom error message' }
          });
        });

        const formConfig = (field as DbxForgeField<any>)._formConfig;
        expect(formConfig?.defaultValidationMessages?.['customError']).toBe('Custom error message');
      });

      it('should accumulate formValidationMessages from multiple addValidation calls', () => {
        const field = forgeTestField({ key: 'x' }, (x) => {
          x.addValidation({ formValidationMessages: { errorA: 'Message A' } });
          x.addValidation({ formValidationMessages: { errorB: 'Message B' } });
        });

        const formConfig = (field as DbxForgeField<any>)._formConfig;
        expect(formConfig?.defaultValidationMessages?.['errorA']).toBe('Message A');
        expect(formConfig?.defaultValidationMessages?.['errorB']).toBe('Message B');
      });

      it('should keep field-level validationMessages separate from formValidationMessages', () => {
        const field = forgeTestField({ key: 'x' }, (x) => {
          x.addValidation({
            validationMessages: { required: 'Field-level required' },
            formValidationMessages: { customError: 'Form-level custom error' }
          });
        });

        expect(field.validationMessages?.required).toBe('Field-level required');

        const formConfig = (field as DbxForgeField<any>)._formConfig;
        expect(formConfig?.defaultValidationMessages?.['customError']).toBe('Form-level custom error');
      });
    });
  });

  describe('meta', () => {
    it('should set meta via addMeta()', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addMeta({ autocomplete: 'name' } as FieldMeta);
      });

      expect(field.meta).toBeDefined();
      expect((field.meta as any)?.autocomplete).toBe('name');
    });

    it('should merge meta from multiple addMeta() calls', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addMeta({ autocomplete: 'name' } as FieldMeta);
        x.addMeta({ inputmode: 'text' } as FieldMeta);
      });

      expect((field.meta as any)?.autocomplete).toBe('name');
      expect((field.meta as any)?.inputmode).toBe('text');
    });

    it('should replace meta entirely via setMeta()', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addMeta({ autocomplete: 'name' } as FieldMeta);
        x.setMeta({ inputmode: 'numeric' } as FieldMeta);
      });

      expect((field.meta as any)?.autocomplete).toBeUndefined();
      expect((field.meta as any)?.inputmode).toBe('numeric');
    });

    it('should return current meta via getMeta()', () => {
      forgeTestField({ key: 'x' }, (x) => {
        x.addMeta({ autocomplete: 'email' } as FieldMeta);
        const meta = x.getMeta();
        expect((meta as any)?.autocomplete).toBe('email');
      });
    });

    it('should not modify meta when addMeta() is called with undefined', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addMeta({ autocomplete: 'name' } as FieldMeta);
        x.addMeta(undefined);
      });

      expect((field.meta as any)?.autocomplete).toBe('name');
    });
  });

  describe('logic', () => {
    it('should add state logic via addLogic()', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addLogic({
          type: 'hidden',
          condition: { type: 'fieldValue', fieldPath: 'toggle', operator: 'equals', value: true }
        });
      });

      const logic = (field as any).logic as LogicConfig[];
      expect(logic).toHaveLength(1);
      expect(logic[0].type).toBe('hidden');
    });

    it('should add function derivation logic via addLogic()', () => {
      const myFn = () => 'derived';

      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addLogic({
          type: 'derivation',
          functionName: 'myDerivation',
          fn: myFn
        });
      });

      const logic = (field as any).logic;
      expect(logic).toHaveLength(1);
      expect(logic[0].type).toBe('derivation');
      expect(logic[0].functionName).toBe('myDerivation');
    });

    it('should add function derivation with fn only (no functionName) and auto-generate functionName', () => {
      const myFn = () => 42;

      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addLogic({
          type: 'derivation',
          fn: myFn
        });
      });

      const logic = (field as any).logic;
      expect(logic).toHaveLength(1);
      expect(logic[0].type).toBe('derivation');
      // fn is removed during finalization; a functionName is auto-generated
      expect(logic[0].fn).toBeUndefined();
      expect(logic[0].functionName).toBeDefined();
    });

    it('should add async function derivation logic via addLogic()', () => {
      const asyncFn = async () => Promise.resolve(100);

      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addLogic({
          type: 'derivation',
          source: 'asyncFunction',
          asyncFunctionName: 'fetchValue',
          fn: asyncFn
        });
      });

      const logic = (field as any).logic;
      expect(logic).toHaveLength(1);
      expect(logic[0].source).toBe('asyncFunction');
      expect(logic[0].asyncFunctionName).toBe('fetchValue');
    });

    it('should add async function derivation with fn only (no asyncFunctionName) and auto-generate name', () => {
      const asyncFn = async () => Promise.resolve('result');

      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addLogic({
          type: 'derivation',
          source: 'asyncFunction',
          fn: asyncFn
        });
      });

      const logic = (field as any).logic;
      expect(logic).toHaveLength(1);
      expect(logic[0].source).toBe('asyncFunction');
      // fn is removed during finalization; a functionName is auto-generated
      expect(logic[0].fn).toBeUndefined();
      expect(logic[0].functionName).toBeDefined();
    });

    it('should add expression derivation logic via addLogic()', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addLogic({
          type: 'derivation',
          expression: 'formValue.a + formValue.b'
        });
      });

      const logic = (field as any).logic;
      expect(logic).toHaveLength(1);
      expect(logic[0].expression).toBe('formValue.a + formValue.b');
    });

    it('should accumulate logic from multiple addLogic() calls', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addLogic({ type: 'hidden', condition: true });
        x.addLogic({ type: 'derivation', expression: 'formValue.a' });
        x.addLogic({ type: 'disabled', condition: false });
      });

      const logic = (field as any).logic as LogicConfig[];
      expect(logic).toHaveLength(3);
      expect(logic[0].type).toBe('hidden');
      expect(logic[1].type).toBe('derivation');
      expect(logic[2].type).toBe('disabled');
    });

    it('should accept an array in addLogic()', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addLogic([
          { type: 'hidden', condition: true },
          { type: 'readonly', condition: false }
        ]);
      });

      const logic = (field as any).logic as LogicConfig[];
      expect(logic).toHaveLength(2);
    });

    it('should replace logic entirely via setLogic()', () => {
      const field = forgeTestField({ key: 'x' }, (x) => {
        x.addLogic({ type: 'hidden', condition: true });
        x.addLogic({ type: 'disabled', condition: false });
        x.setLogic({ type: 'readonly', condition: true });
      });

      const logic = (field as any).logic as LogicConfig[];
      expect(logic).toHaveLength(1);
      expect(logic[0].type).toBe('readonly');
    });

    it('should return current logic via getLogic()', () => {
      forgeTestField({ key: 'x' }, (x) => {
        expect(x.getLogic()).toBeUndefined();

        x.addLogic({ type: 'hidden', condition: true });
        const logic = x.getLogic();
        expect(logic).toHaveLength(1);
      });
    });
  });

  describe('configure()', () => {
    it('should delegate to another build function', () => {
      let wasConfigured = false;

      const otherFn: DbxForgeBuildFieldDefFunction<TestFieldConfig> = (instance) => {
        wasConfigured = true;
        instance.addValidation({ validationMessages: { custom: 'From other' } });
      };

      const field = forgeTestField({ key: 'x' }, (x) => {
        x.configure(otherFn);
      });

      expect(wasConfigured).toBe(true);
      expect(field.validationMessages?.['custom']).toBe('From other');
    });

    it('should apply multiple configure() calls in order', () => {
      const order: number[] = [];

      const first: DbxForgeBuildFieldDefFunction<TestFieldConfig> = () => {
        order.push(1);
      };
      const second: DbxForgeBuildFieldDefFunction<TestFieldConfig> = () => {
        order.push(2);
      };

      forgeTestField({ key: 'x' }, (x) => {
        x.configure(first);
        x.configure(second);
      });

      expect(order).toEqual([1, 2]);
    });
  });
});
