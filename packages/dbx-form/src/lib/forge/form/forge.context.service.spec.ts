import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal, type Signal } from '@angular/core';
import { type ArrayContext, type DynamicForm, DynamicFormLogger, NoopLogger } from '@ng-forge/dynamic-forms';
import { DbxForgeDynamicFormSignalRef, DbxForgeFormContextService } from './forge.context.service';

function makeArrayContext(arrayKey: string, indexSignal: Signal<number>): ArrayContext {
  return {
    arrayKey,
    index: indexSignal,
    formValue: undefined,
    field: { key: arrayKey, type: 'array' } as ArrayContext['field']
  };
}

/**
 * Minimal stub exposing the `formValue` / `form` signals the service reads from a DynamicForm.
 */
function makeFakeDynamicForm(formValue: Record<string, unknown>): DynamicForm {
  return {
    formValue: () => formValue,
    form: () => undefined
  } as unknown as DynamicForm;
}

describe('DbxForgeFormContextService', () => {
  let service: DbxForgeFormContextService;
  let dynamicFormSignal: ReturnType<typeof signal<DynamicForm | undefined>>;

  beforeEach(() => {
    dynamicFormSignal = signal<DynamicForm | undefined>(undefined);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DynamicFormLogger, useClass: NoopLogger },
        {
          provide: DbxForgeDynamicFormSignalRef,
          useValue: { dynamicForm: dynamicFormSignal } satisfies DbxForgeDynamicFormSignalRef
        },
        DbxForgeFormContextService
      ]
    });

    service = TestBed.inject(DbxForgeFormContextService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function setFormValue(value: Record<string, unknown>): void {
    dynamicFormSignal.set(makeFakeDynamicForm(value));
  }

  describe('createArrayItemEvaluationContext', () => {
    it('scopes fieldValue and formValue to the current array item', () => {
      const items = [
        { name: 'first', disable: false },
        { name: 'second', disable: true }
      ];
      setFormValue({ people: items });

      const indexSignal = signal(1);
      const ctx = service.createArrayItemEvaluationContext({
        arrayContext: makeArrayContext('people', indexSignal)
      });

      expect(ctx.fieldValue).toEqual(items[1]);
      expect(ctx.formValue).toEqual(items[1]);
      expect(ctx.rootFormValue).toEqual({ people: items });
      expect(ctx.arrayIndex).toBe(1);
      expect(ctx.arrayPath).toBe('people');
      expect(ctx.fieldPath).toBe('people.1');
    });

    it('supports dotted array paths (nested arrays)', () => {
      const items = [{ v: 'a' }, { v: 'b' }];
      setFormValue({ nested: { list: items } });

      const ctx = service.createArrayItemEvaluationContext({
        arrayContext: makeArrayContext('nested.list', signal(0))
      });

      expect(ctx.fieldValue).toEqual(items[0]);
      expect(ctx.formValue).toEqual(items[0]);
      expect(ctx.arrayPath).toBe('nested.list');
      expect(ctx.fieldPath).toBe('nested.list.0');
    });

    it('falls back to root formValue when the array item is missing', () => {
      setFormValue({ people: [{ name: 'only' }] });

      const ctx = service.createArrayItemEvaluationContext({
        arrayContext: makeArrayContext('people', signal(5))
      });

      expect(ctx.fieldValue).toBeUndefined();
      expect(ctx.formValue).toEqual({ people: [{ name: 'only' }] });
      expect(ctx.arrayIndex).toBeUndefined();
      expect(ctx.arrayPath).toBeUndefined();
    });

    it('falls back to root formValue when the array key is absent', () => {
      setFormValue({ other: 'data' });

      const ctx = service.createArrayItemEvaluationContext({
        arrayContext: makeArrayContext('people', signal(0))
      });

      expect(ctx.fieldValue).toBeUndefined();
      expect(ctx.formValue).toEqual({ other: 'data' });
    });

    it('falls back when the array item is a primitive (non-object)', () => {
      setFormValue({ tags: ['a', 'b', 'c'] });

      const ctx = service.createArrayItemEvaluationContext({
        arrayContext: makeArrayContext('tags', signal(1))
      });

      expect(ctx.fieldValue).toBe('b');
      // non-object items cannot be used as scoped formValue — fall back to root
      expect(ctx.formValue).toEqual({ tags: ['a', 'b', 'c'] });
      expect(ctx.arrayIndex).toBeUndefined();
    });

    it('returns an empty form when no DynamicForm is mounted yet', () => {
      const ctx = service.createArrayItemEvaluationContext({
        arrayContext: makeArrayContext('people', signal(0))
      });

      expect(ctx.fieldValue).toBeUndefined();
      expect(ctx.formValue).toEqual({});
    });

    it('populates the minimum required EvaluationContext fields', () => {
      setFormValue({ people: [{ name: 'a' }] });

      const ctx = service.createArrayItemEvaluationContext({
        arrayContext: makeArrayContext('people', signal(0))
      });

      expect(ctx.customFunctions).toEqual({});
      expect(ctx.logger).toBeDefined();
    });

    it('reflects updates to the DynamicForm signal when reactive=true', () => {
      setFormValue({ people: [{ name: 'before' }] });
      const indexSignal = signal(0);

      const firstCtx = service.createArrayItemEvaluationContext({
        arrayContext: makeArrayContext('people', indexSignal),
        reactive: true
      });
      expect(firstCtx.fieldValue).toEqual({ name: 'before' });

      setFormValue({ people: [{ name: 'after' }] });

      const secondCtx = service.createArrayItemEvaluationContext({
        arrayContext: makeArrayContext('people', indexSignal),
        reactive: true
      });
      expect(secondCtx.fieldValue).toEqual({ name: 'after' });
    });
  });
});
