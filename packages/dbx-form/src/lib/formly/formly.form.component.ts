import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormlyFieldConfig, FormlyFormOptions, FormlyModule } from '@ngx-formly/core';
import { distinctUntilChanged, map, throttleTime, startWith, BehaviorSubject, Observable, Subject, switchMap, shareReplay, of, scan, filter, timer, first, merge, delay } from 'rxjs';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxForm, DbxFormDisabledKey, DbxFormEvent, DbxFormState, DEFAULT_FORM_DISABLED_KEY, provideDbxMutableForm, toggleDisableFormControl } from '../form/form';
import { DbxFormlyContext, DbxFormlyContextDelegate, DbxFormlyInitialize } from './formly.context';
import { scanCount, switchMapMaybeObs, SubscriptionObject } from '@dereekb/rxjs';
import { BooleanStringKeyArray, BooleanStringKeyArrayUtility, iterablesAreSetEquivalent, type Maybe } from '@dereekb/util';
import { toSignal } from '@angular/core/rxjs-interop';

export interface DbxFormlyFormState {
  changesSinceLastResetCount: number;
  isFormValid: boolean;
  isFormDisabled: boolean;
}

/**
 * Used for rending a form from a DbxFormlyContext.
 */
@Component({
  selector: 'dbx-formly',
  exportAs: 'formly',
  template: `
    <form [formGroup]="form" class="dbx-formly">
      <formly-form [form]="form" [fields]="fieldsSignal()" [model]="model"></formly-form>
    </form>
  `,
  host: {
    class: 'dbx-formly'
  },
  providers: provideDbxMutableForm(DbxFormlyComponent),
  imports: [FormsModule, ReactiveFormsModule, FormlyModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFormlyComponent<T> extends AbstractSubscriptionDirective implements DbxForm, DbxFormlyContextDelegate<T>, OnInit, OnDestroy {
  private readonly _dbxFormlyContext = inject(DbxFormlyContext<T>);

  private readonly _fields = new BehaviorSubject<Maybe<Observable<FormlyFieldConfig[]>>>(undefined);
  private readonly _events = new BehaviorSubject<DbxFormEvent>({ isComplete: false, state: DbxFormState.INITIALIZING, status: 'PENDING' });
  private readonly _disabled = new BehaviorSubject<BooleanStringKeyArray>(undefined);

  private readonly _reset = new BehaviorSubject<Date>(new Date());
  private readonly _forceUpdate = new Subject<void>();

  private readonly _disabledSub = new SubscriptionObject();
  private readonly _enforceDisabledSub = new SubscriptionObject();

  readonly form = new FormGroup({});

  model: T = {} as T;
  options: FormlyFormOptions = {};

  readonly fields$ = this._fields.pipe(switchMapMaybeObs(), distinctUntilChanged(), shareReplay(1));

  readonly stream$: Observable<DbxFormEvent> = this._reset.pipe(
    switchMap((lastResetAt) =>
      this.form.valueChanges.pipe(
        startWith(0),
        distinctUntilChanged(),
        throttleTime(50, undefined, { leading: true, trailing: true }),
        scanCount(-1),
        // update on validation changes too. Does not count towards changes since last reset.
        switchMap((changesSinceLastReset) => this.form.statusChanges.pipe(startWith(this.form.status), distinctUntilChanged()).pipe(map(() => changesSinceLastReset))),
        map((changesSinceLastResetCount: number) => ({
          changesSinceLastResetCount,
          isFormValid: this.form.status !== 'PENDING' && this.form.valid,
          isFormDisabled: this.form.disabled
        })),
        scan(
          (acc: DbxFormlyFormState, next: DbxFormlyFormState) => {
            // Pass forward valid if next was a disabled change/check, which changes angular form's isValid value.
            // If it was valid prior, then it should be valid now, unless we just reset, in which case it might not be valid.
            const valid = next.isFormValid || (next.isFormDisabled && acc.isFormValid && acc.changesSinceLastResetCount > 0);

            return {
              changesSinceLastResetCount: next.changesSinceLastResetCount,
              isFormValid: valid,
              isFormDisabled: next.isFormDisabled
            };
          },
          {
            changesSinceLastResetCount: 0,
            isFormValid: false,
            isFormDisabled: false
          }
        ),
        switchMap(({ changesSinceLastResetCount, isFormValid, isFormDisabled }) => {
          const nextState = () => {
            const isReset = changesSinceLastResetCount <= 1; // first emission after reset is the first value.
            const complete = isFormValid;

            const nextState: DbxFormEvent = {
              isComplete: complete,
              state: isReset ? DbxFormState.RESET : DbxFormState.USED,
              status: this.form.status,
              untouched: this.form.untouched,
              pristine: this.form.pristine,
              changesCount: changesSinceLastResetCount,
              lastResetAt,
              disabled: this.disabled,
              isDisabled: isFormDisabled
            };

            return nextState;
          };

          const state = nextState();

          if (isFormValid && this.form.untouched) {
            return timer(150, 200).pipe(
              // every 200 ms check if the form is now marked touched, then push a new state
              filter(() => this.form.touched),
              map(() => nextState()),
              // only push the new state once
              first(),
              // send the first value immediately
              startWith(state)
            );
          } else {
            return of(state);
          }
        })
      )
    ),
    shareReplay(1)
  );

  private readonly _fieldsSignal = toSignal(this.fields$, { initialValue: undefined });
  readonly fieldsSignal = computed(() => this._fieldsSignal() ?? []);

  ngOnInit(): void {
    this._dbxFormlyContext.setDelegate(this);

    const resyncDisabledState = () => {
      const isDisabled = BooleanStringKeyArrayUtility.isTrue(this._disabled.value);
      let change = false;

      if (this.form.disabled !== isDisabled) {
        toggleDisableFormControl(this.form, isDisabled, { emitEvent: true });
        change = true;
      }

      return change;
    };

    this._disabledSub.subscription = this._disabled.pipe(distinctUntilChanged(iterablesAreSetEquivalent)).subscribe(() => {
      resyncDisabledState();
    });

    // NOTE: Form sometimes becomes undisabled somewhere/somehow. Re-enforce the disabled state where necessary.
    this._enforceDisabledSub.subscription = merge([
      this._reset.pipe(
        map(() => 'RESET'),
        delay(50)
      ),
      this.form.statusChanges.pipe(throttleTime(50, undefined, { leading: true, trailing: true }))
    ]).subscribe((change) => {
      resyncDisabledState();
    });
  }

  override ngOnDestroy(): void {
    this._dbxFormlyContext.lockSet.onNextUnlock(() => {
      super.ngOnDestroy();
      this._dbxFormlyContext.clearDelegate(this);
      this._events.complete();
      this._fields.complete();
      this._reset.complete();
      this._forceUpdate.complete();
      this._disabled.complete();
      this._disabledSub.destroy();
      this._enforceDisabledSub.destroy();
    });
  }

  // MARK: Delegate
  init(initialize: DbxFormlyInitialize<T>): void {
    this._fields.next(initialize.fields);
    this._disabled.next(initialize.initialDisabled);
  }

  getValue(): Observable<T> {
    return of(this.form.value as T);
  }

  setValue(value: T): void {
    // console.log('set value: ', value);
    this.model = structuredClone(value) as T;

    if (this.options.updateInitialValue) {
      this.options.updateInitialValue();
      this.options.resetModel?.();
    }

    // Re-mark as untouched and pristine.
    this.form.markAsUntouched();
    this.form.markAsPristine();

    // After updating the value, if the form is still untouched mark it as pristine again.
    // Sometimes the values get marked as changed and break pristine before a user has time to interact.
    setTimeout(() => {
      if (this.form.untouched) {
        this.form.markAsPristine();
      }
    }, 500);

    // ping reset
    this.resetForm();
  }

  resetForm(): void {
    if (this.options.resetModel) {
      this.options.resetModel();
    }

    this._reset.next(new Date());
  }

  get isDisabled(): boolean {
    return BooleanStringKeyArrayUtility.isTrue(this.disabled);
  }

  get disabled(): BooleanStringKeyArray {
    return this._disabled.value;
  }

  getDisabled(): Observable<BooleanStringKeyArray> {
    return this._disabled.asObservable();
  }

  setDisabled(key?: DbxFormDisabledKey, disabled = true): void {
    const next = BooleanStringKeyArrayUtility.set(this.disabled, key ?? DEFAULT_FORM_DISABLED_KEY, disabled);
    this._disabled.next(next);
  }

  // MARK: Update
  forceFormUpdate(): void {
    this._forceUpdate.next();
  }
}
