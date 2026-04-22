import { Injectable, Signal, computed, inject, untracked } from '@angular/core';
import { type ArrayContext, type EvaluationContext, DynamicForm, DynamicFormLogger } from '@ng-forge/dynamic-forms';
import type { FieldTree } from '@angular/forms/signals';

/**
 * Abstract injectable that exposes the active {@link DynamicForm} instance as a signal.
 *
 * Implemented by {@link DbxForgeFormComponent} and provided via
 * `{ provide: DbxForgeDynamicFormSignalRef, useExisting: DbxForgeFormComponent }`.
 *
 * Services provided at the forge-component level cannot inject ng-forge's
 * `RootFormRegistryService` (which is provided BY `DynamicForm`, a child of
 * {@link DbxForgeFormComponent}). This abstract ref lets higher-level services
 * ({@link DbxForgeFormContextService}) reactively read from DynamicForm without
 * relying on its injector.
 */
export abstract class DbxForgeDynamicFormSignalRef {
  abstract readonly dynamicForm: Signal<DynamicForm<any, any> | undefined>;
}

/**
 * Input for {@link DbxForgeFormContextService.createArrayItemEvaluationContext}.
 */
export interface DbxForgeArrayItemEvaluationContextInput {
  /**
   * The array context for the current array item, retrieved via `inject(ARRAY_CONTEXT)`
   * inside an array element wrapper.
   */
  readonly arrayContext: ArrayContext;
  /**
   * When true, reads from the form value / array index signals create reactive
   * dependencies so a consuming `computed()` re-evaluates on change.
   *
   * When false (default), reads are wrapped in `untracked()` to prevent cycles
   * in validators and similar non-reactive callers.
   */
  readonly reactive?: boolean;
}

/**
 * Provides {@link EvaluationContext} objects for dbx-forge wrapper and field components.
 *
 * Mirrors the subset of ng-forge's internal `FieldContextRegistryService` that we can
 * build from the public API. Provided at the {@link DbxForgeFormComponent} level so
 * every descendant wrapper/field can inject it without repeating providers.
 *
 * Reads form state via {@link DbxForgeDynamicFormSignalRef} — ng-forge's
 * `RootFormRegistryService` is provided below the forge component and is not
 * reachable from this injector level.
 *
 * Currently supports array-item-scoped contexts. Field-level and display-only
 * contexts may be added later as needs arise.
 */
@Injectable()
export class DbxForgeFormContextService {
  private readonly _signalRef = inject(DbxForgeDynamicFormSignalRef);
  private readonly _logger = inject(DynamicFormLogger);

  /**
   * The active {@link DynamicForm} instance (undefined until the view-child resolves).
   */
  readonly dynamicForm = this._signalRef.dynamicForm;

  /**
   * Current form value as a plain record. Empty object when the DynamicForm hasn't
   * mounted yet.
   */
  readonly formValue: Signal<Record<string, unknown>> = computed(() => {
    const form = this._signalRef.dynamicForm();
    return (form?.formValue() ?? {}) as Record<string, unknown>;
  });

  /**
   * The active Signal Form tree, or undefined until the DynamicForm mounts.
   */
  readonly rootForm: Signal<FieldTree<Record<string, unknown>> | undefined> = computed(() => {
    const form = this._signalRef.dynamicForm();
    return form?.form() as FieldTree<Record<string, unknown>> | undefined;
  });

  /**
   * Builds an {@link EvaluationContext} scoped to the current array item.
   *
   * - `fieldValue` is the current item.
   * - `formValue` is the current item (item-scoped, matching ng-forge's buildArrayScopedContext).
   * - `rootFormValue` is the full form.
   * - `arrayIndex` / `arrayPath` come from the provided {@link ArrayContext}.
   * - `fieldPath` is `"${arrayKey}.${index}"`.
   *
   * Falls back to the root form value as `formValue` when the array item lookup fails
   * (bad index, missing array, or non-object item).
   */
  createArrayItemEvaluationContext(input: DbxForgeArrayItemEvaluationContextInput): EvaluationContext {
    const { arrayContext, reactive = false } = input;
    const arrayKey = arrayContext.arrayKey;

    const rootFormValue = reactive ? this.formValue() : untracked(() => this.formValue());
    const index = reactive ? arrayContext.index() : untracked(() => arrayContext.index());

    const arrayData = _getNestedValue(rootFormValue, arrayKey);
    let itemValue: unknown = undefined;
    let scopedFormValue: Record<string, unknown> | undefined;

    if (Array.isArray(arrayData) && index >= 0 && index < arrayData.length) {
      const item = arrayData[index];
      itemValue = item;
      if (item != null && typeof item === 'object') {
        scopedFormValue = item as Record<string, unknown>;
      }
    }

    const fieldPath = `${arrayKey}.${index}`;
    let result: EvaluationContext;

    if (!scopedFormValue) {
      result = {
        fieldValue: itemValue,
        formValue: rootFormValue,
        fieldPath,
        customFunctions: {},
        logger: this._logger
      };
    } else {
      result = {
        fieldValue: itemValue,
        formValue: scopedFormValue,
        rootFormValue,
        arrayIndex: index,
        arrayPath: arrayKey,
        fieldPath,
        customFunctions: {},
        logger: this._logger
      };
    }

    return result;
  }
}

/**
 * Resolves a dotted path against a record (e.g. `"orders.items"` → rec.orders.items).
 * Returns undefined if any segment is missing.
 *
 * Mirrors ng-forge's internal `getNestedValue` (not exported from the public API) for
 * the nested array-key case.
 */
function _getNestedValue(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = source;
  let aborted = false;

  for (const segment of segments) {
    if (current == null || typeof current !== 'object') {
      aborted = true;
      break;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return aborted ? undefined : current;
}
