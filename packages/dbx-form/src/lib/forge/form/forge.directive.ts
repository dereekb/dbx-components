import { Directive, inject, input, type OnDestroy, type OnInit, effect } from '@angular/core';
import { type FormConfig } from '@ng-forge/dynamic-forms';
import { type Maybe } from '@dereekb/util';
import { type Observable, shareReplay } from 'rxjs';
import { SubscriptionObject, filterMaybe, type MaybeObservableOrValue, maybeValueFromObservableOrValue } from '@dereekb/rxjs';
import { DbxForgeFormContext } from './forge.context';
import { distinctUntilChanged } from 'rxjs/operators';
import { toObservable } from '@angular/core/rxjs-interop';
import { type DbxFormDisabledKey } from '../../form/form';

/**
 * Base directive for forge form components. Injects the DbxForgeFormContext and
 * provides utility methods for form interaction.
 */
@Directive()
export abstract class AbstractForgeFormDirective<T = unknown> implements OnDestroy {
  readonly context = inject(DbxForgeFormContext<T>, { self: true });
  readonly disabled = input(false);

  private readonly _disabledEffect = effect(() => {
    if (this.disabled()) {
      this.context.setDisabled('directive', true);
    } else {
      this.context.setDisabled('directive', false);
    }
  });

  getValue(): Observable<T> {
    return this.context.getValue();
  }

  setValue(value: Maybe<Partial<T>>): void {
    this.context.setValue(value);
  }

  resetForm(): void {
    this.context.resetForm();
  }

  clearValue(): void {
    this.context.setValue(undefined);
  }

  setDisabled(key?: DbxFormDisabledKey, disabled?: boolean): void {
    this.context.setDisabled(key, disabled);
  }

  ngOnDestroy(): void {
    // Context handles its own cleanup
  }
}

/**
 * Base directive for forge forms with static (synchronous) FormConfig.
 */
@Directive()
export abstract class AbstractSyncForgeFormDirective<T = unknown> extends AbstractForgeFormDirective<T> implements OnInit {
  abstract readonly config: FormConfig;

  ngOnInit(): void {
    this.context.config = this.config;
  }
}

/**
 * Base directive for forge forms with dynamic (Observable) FormConfig.
 */
@Directive()
export abstract class AbstractAsyncForgeFormDirective<T = unknown> extends AbstractForgeFormDirective<T> implements OnInit, OnDestroy {
  abstract readonly config$: Observable<Maybe<FormConfig>>;

  private readonly _configSub = new SubscriptionObject();

  ngOnInit(): void {
    this._configSub.subscription = this.config$.pipe(distinctUntilChanged(), filterMaybe()).subscribe((config) => {
      this.context.config = config;
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._configSub.destroy();
  }
}

/**
 * Base directive for forge forms driven by an external config input that gets
 * transformed into a FormConfig Observable.
 *
 * Uses toObservable to convert the signal-based input into an Observable stream,
 * then pipes through maybeValueFromObservableOrValue to unwrap nested observables.
 */
@Directive()
export abstract class AbstractConfigAsyncForgeFormDirective<T = unknown, C = unknown> extends AbstractAsyncForgeFormDirective<T> {
  readonly configInput = input<MaybeObservableOrValue<C>>(undefined, { alias: 'config' });

  readonly currentConfig$: Observable<Maybe<C>> = toObservable(this.configInput).pipe(maybeValueFromObservableOrValue());

  /**
   * Subclasses must implement this to map C → FormConfig.
   * For simple cases where C is FormConfig, just pipe through directly.
   */
  abstract override readonly config$: Observable<Maybe<FormConfig>>;
}
