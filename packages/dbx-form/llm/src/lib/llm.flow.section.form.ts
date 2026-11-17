import { DestroyRef, inject, type Type } from '@angular/core';
import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxFormState, DbxMutableForm, stripEmptyForgeValues } from '@dereekb/dbx-form';
import { SubscriptionObject } from '@dereekb/rxjs';
import { areEqualPOJOValues, type Destroyable, type Maybe } from '@dereekb/util';
import { combineLatest, distinctUntilChanged, filter, first, map, switchMap, withLatestFrom } from 'rxjs';
import { DBX_LLM_FLOW_SECTION_FORM_DISABLED_KEY, type DbxLlmFlowSectionFormBindingTarget } from './llm.flow';

/**
 * The parts of a form that bindDbxLlmFlowSectionForm() uses: a DbxMutableForm, or an adapter onto part of a form (like the options group of the
 * raw input's form).
 */
export type DbxLlmFlowSectionBindableForm<F = unknown> = Pick<DbxMutableForm<F>, 'currentValue' | 'stream$' | 'setValue' | 'setDisabled'>;

const BOUND_FORMS = new WeakSet<DbxLlmFlowSectionBindableForm<unknown>>();

interface DbxLlmFlowSectionFormBindingValueRef {
  readonly value: unknown;
}

/**
 * Whether the form is already bound to a section by bindDbxLlmFlowSectionForm().
 *
 * @param form - The form.
 * @returns True if bound.
 */
export function isDbxLlmFlowSectionFormBound(form: DbxLlmFlowSectionBindableForm<unknown>): boolean {
  return BOUND_FORMS.has(form);
}

export interface BindDbxLlmFlowSectionFormConfig<F = unknown> {
  readonly form: DbxLlmFlowSectionBindableForm<F>;
  readonly target: DbxLlmFlowSectionFormBindingTarget<F>;
}

/**
 * Binds a form to a section (or any DbxLlmFlowSectionFormBindingTarget).
 *
 * - Seeds the form with draft changes made elsewhere (store, other bindings), only when they differ from the form's value. A first seed without a value lets the form's defaults flow into the store.
 * - Pushes the form's own value changes to the store. Pushes follow the form's value stream, never a value read at a state event (forge emits its USED event before the new value), and skip echoes of the last seed so two bound forms cannot feed each other stale values.
 * - While the first seed is pending on a form that isn't ready yet, pushes wait until the form is USED, so its defaults don't overwrite the seed.
 * - Reports validity while unlocked, and disables the form while the section locks it.
 *
 * @param config - The form and target.
 * @returns Destroys the binding.
 */
export function bindDbxLlmFlowSectionForm<F = unknown>(config: BindDbxLlmFlowSectionFormConfig<F>): Destroyable {
  const { form, target } = config;
  const binding = target.registerFormBinding();
  const seedSub = new SubscriptionObject();
  const pushSub = new SubscriptionObject();
  const validSub = new SubscriptionObject();
  const lockSub = new SubscriptionObject();

  let isFirstSeed = true;
  let awaitingUsed = false;
  let lastValue: DbxLlmFlowSectionFormBindingValueRef | undefined;
  let seedEcho: DbxLlmFlowSectionFormBindingValueRef | undefined;

  BOUND_FORMS.add(form as DbxLlmFlowSectionBindableForm<unknown>);

  function pushValue(value: unknown): void {
    if (lastValue == null || !areEqualPOJOValues(lastValue.value, value)) {
      lastValue = { value };
      const isEcho = seedEcho != null && areEqualPOJOValues(seedEcho.value, value);
      seedEcho = undefined;

      if (!isEcho) {
        target.setDraftFormValue(binding.id, value as Maybe<F>);
      }
    }
  }

  seedSub.subscription = target
    .formSeed$(binding.id)
    .pipe(
      map((x) => stripEmptyForgeValues(x)),
      switchMap((seed) =>
        form.currentValue().pipe(
          first(),
          map((current) => ({ seed, current: stripEmptyForgeValues(current) }))
        )
      )
    )
    .subscribe(({ seed, current }) => {
      const firstSeed = isFirstSeed;
      isFirstSeed = false;

      if ((seed != null || !firstSeed) && !areEqualPOJOValues(current, seed)) {
        const value = seed ?? {};
        awaitingUsed = awaitingUsed || firstSeed;
        seedEcho = { value };
        form.setValue(value as Partial<F>);
      } else if (firstSeed) {
        pushValue(current); // let the form's defaults flow into the store
      }
    });

  pushSub.subscription = form
    .currentValue()
    .pipe(
      withLatestFrom(form.stream$),
      filter(([, event]) => {
        if (awaitingUsed && event.state === DbxFormState.USED) {
          awaitingUsed = false;
        }

        return !isFirstSeed && !awaitingUsed && event.state !== DbxFormState.INITIALIZING;
      }),
      map(([value]) => stripEmptyForgeValues(value))
    )
    .subscribe(pushValue);

  validSub.subscription = combineLatest([form.stream$.pipe(filter((event) => event.state !== DbxFormState.INITIALIZING)), target.formLocked$])
    .pipe(
      filter(([, locked]) => !locked),
      map(([event]) => event.isComplete),
      distinctUntilChanged()
    )
    .subscribe((valid) => target.setFormValid(binding.id, valid));

  lockSub.subscription = target.formLocked$.pipe(distinctUntilChanged()).subscribe((locked) => form.setDisabled(DBX_LLM_FLOW_SECTION_FORM_DISABLED_KEY, locked));

  return {
    destroy: () => {
      BOUND_FORMS.delete(form as DbxLlmFlowSectionBindableForm<unknown>);
      seedSub.destroy();
      pushSub.destroy();
      validSub.destroy();
      lockSub.destroy();
      binding.destroy();
    }
  };
}

/**
 * Binds the DbxMutableForm provided by the current injection context's own injector, unless it is missing or already bound. The binding is destroyed with the injection context.
 *
 * @param target - The binding target.
 * @returns The binding, if one was made.
 */
export function bindDbxLlmFlowSectionFormInInjectionContext<F = unknown>(target: DbxLlmFlowSectionFormBindingTarget<F>): Maybe<Destroyable> {
  const form = inject(DbxMutableForm<F>, { self: true, optional: true });
  let result: Maybe<Destroyable>;

  if (form != null && !isDbxLlmFlowSectionFormBound(form)) {
    const ref = bindDbxLlmFlowSectionForm({ form, target });
    inject(DestroyRef).onDestroy(() => ref.destroy());
    result = ref;
  }

  return result;
}

/**
 * Wraps an injection config so the created form component is bound to the target. The created component must provide its DbxMutableForm itself (e.g. provideDbxForgeFormContext()).
 *
 * Memoize the result: injection configs compare init by reference.
 *
 * @param config - The form component's injection config.
 * @param target - The binding target.
 * @returns The wrapped config.
 */
export function dbxLlmFlowSectionFormInjectionConfig<T, F = unknown>(config: DbxInjectionComponentConfig<T>, target: DbxLlmFlowSectionFormBindingTarget<F>): DbxInjectionComponentConfig<T> {
  return {
    ...config,
    init: (instance: T) => {
      config.init?.(instance);
      bindDbxLlmFlowSectionFormInInjectionContext(target);
    }
  };
}

/**
 * Creates the injection config that renders a section's form component, auto-bound to the target unless autoBindForm is false.
 *
 * Memoize the result: injection configs compare init by reference.
 *
 * @param formComponent - The section config's form component.
 * @param autoBindForm - The section config's autoBindForm. Defaults to true.
 * @param target - The binding target.
 * @returns The injection config, or undefined when there is no form component.
 */
export function dbxLlmFlowSectionFormComponentInjectionConfig<F = unknown>(formComponent: Maybe<Type<unknown>>, autoBindForm: Maybe<boolean>, target: DbxLlmFlowSectionFormBindingTarget<F>): Maybe<DbxInjectionComponentConfig> {
  let result: Maybe<DbxInjectionComponentConfig>;

  if (formComponent != null) {
    const config: DbxInjectionComponentConfig = { componentClass: formComponent };
    result = autoBindForm === false ? config : dbxLlmFlowSectionFormInjectionConfig(config, target);
  }

  return result;
}
