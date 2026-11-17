import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type DbxFormEvent, DbxFormState, DbxMutableForm } from '@dereekb/dbx-form';
import { filterMaybe } from '@dereekb/rxjs';
import { BooleanStringKeyArrayUtility, type BooleanStringKeyArray, type Destroyable, type Maybe } from '@dereekb/util';
import { BehaviorSubject, type Observable } from 'rxjs';
import { type DbxLlmFlowSectionConfig } from './llm.flow';
import { DbxLlmFlowStore } from './llm.flow.store';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';
import { bindDbxLlmFlowSectionForm } from './llm.flow.section.form';

type TestValue = Record<string, unknown>;

/**
 * More setValue() calls than this means the bindings are feeding each other. The fake form stops applying values past it, so a regression fails instead of spinning forever.
 */
const MAX_SET_VALUE_CALLS = 25;

/**
 * Mimics DbxForgeFormContext's ordering: setValue() emits the USED state synchronously and the new value later (forge applies it in an effect).
 */
class TestFakeLlmForm extends DbxMutableForm<TestValue> {
  readonly lockSet = undefined;
  setValueCalls = 0;

  private readonly _value = new BehaviorSubject<Maybe<TestValue>>(undefined);
  private readonly _state = new BehaviorSubject<DbxFormEvent>({ state: DbxFormState.INITIALIZING, isComplete: false, status: 'INVALID' });
  private readonly _disabled = new BehaviorSubject<BooleanStringKeyArray>(undefined);

  readonly stream$: Observable<DbxFormEvent> = this._state.asObservable();

  constructor(readonly normalize: (value: TestValue) => TestValue = (x) => x) {
    super();
  }

  get value(): Maybe<TestValue> {
    return this._value.value;
  }

  /**
   * Renders the form with its defaults (forge's not-ready RESET state).
   *
   * @param defaults - The default value.
   */
  render(defaults: TestValue = {}): void {
    this._value.next(this.normalize(defaults));
    this._emit(DbxFormState.RESET);
  }

  /**
   * A user edit: the value changes, then the USED state.
   *
   * @param value - The edited value.
   */
  edit(value: TestValue): void {
    this._value.next(this.normalize(value));
    this._emit(DbxFormState.USED);
  }

  getValue(): Observable<TestValue> {
    return this._value.pipe(filterMaybe());
  }

  getDisabled(): Observable<BooleanStringKeyArray> {
    return this._disabled.asObservable();
  }

  setValue(value: Maybe<Partial<TestValue>>): void {
    this.setValueCalls += 1;

    if (this.setValueCalls <= MAX_SET_VALUE_CALLS) {
      this._emit(DbxFormState.USED);
      queueMicrotask(() => this._value.next(this.normalize({ ...value })));
    }
  }

  resetForm(): void {
    // not used
  }

  setDisabled(key?: string, disabled = true): void {
    this._disabled.next(BooleanStringKeyArrayUtility.set(this._disabled.value, key ?? 'default', disabled));
    this._emit(this._state.value.state);
  }

  forceFormUpdate(): void {
    // not used
  }

  private _emit(state: DbxFormState): void {
    const isDisabled = BooleanStringKeyArrayUtility.isTrue(this._disabled.value);
    this._state.next({ state, isComplete: !isDisabled, status: isDisabled ? 'DISABLED' : 'VALID', isDisabled });
  }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('bindDbxLlmFlowSectionForm()', () => {
  let flowStore: DbxLlmFlowStore;
  let sectionStore: DbxLlmFlowSectionStore<TestValue, string>;
  let bindings: Destroyable[];

  function makeSection(config: DbxLlmFlowSectionConfig<TestValue>): void {
    const injector = Injector.create({ providers: [DbxLlmFlowSectionStore], parent: TestBed.inject(Injector) });
    sectionStore = injector.get(DbxLlmFlowSectionStore) as DbxLlmFlowSectionStore<TestValue, string>;
    sectionStore.register({ config });
  }

  function bind(form: TestFakeLlmForm): TestFakeLlmForm {
    bindings.push(bindDbxLlmFlowSectionForm({ form, target: sectionStore }));
    return form;
  }

  function draftFormValue(): Maybe<TestValue> {
    return sectionStore.section?.draft.formValue;
  }

  beforeEach(() => {
    bindings = [];
    TestBed.configureTestingModule({ providers: [DbxLlmFlowStore] });
    flowStore = TestBed.inject(DbxLlmFlowStore);
  });

  afterEach(() => {
    bindings.forEach((x) => x.destroy());
    TestBed.resetTestingModule();
  });

  it('should seed the form and keep the draft over the form defaults', async () => {
    makeSection({ key: 'brief', hasForm: true, initialDraft: { formValue: { topic: 'seeded' } } });
    const form = bind(new TestFakeLlmForm());
    form.render({});
    await flush();

    expect(form.value).toEqual({ topic: 'seeded' });
    expect(draftFormValue()).toEqual({ topic: 'seeded' });
    expect(form.setValueCalls).toBe(1);
  });

  it('should let the form defaults flow into the store when there is no draft', async () => {
    makeSection({ key: 'brief', hasForm: true });
    const form = bind(new TestFakeLlmForm());
    form.render({ topic: 'default' });
    await flush();

    expect(draftFormValue()).toEqual({ topic: 'default' });
    expect(form.setValueCalls).toBe(0);
  });

  it('should not push the stale value forge reports with its USED state', async () => {
    makeSection({ key: 'brief', hasForm: true, initialDraft: { formValue: { topic: 'seeded' } } });
    const a = bind(new TestFakeLlmForm());
    const b = bind(new TestFakeLlmForm());
    a.render({});
    b.render({});
    await flush();

    a.edit({ topic: 'from a' });
    await flush();

    expect(draftFormValue()).toEqual({ topic: 'from a' });
    expect(b.value).toEqual({ topic: 'from a' });
    expect(a.value).toEqual({ topic: 'from a' });
    expect(a.setValueCalls + b.setValueCalls).toBeLessThan(5);
  });

  it('should settle two bound forms when one normalizes the values it is given', async () => {
    makeSection({ key: 'brief', hasForm: true, initialDraft: { formValue: { topic: 'seeded' } } });
    const plain = bind(new TestFakeLlmForm());
    const normalizing = bind(new TestFakeLlmForm((x) => ({ ...x, flag: false })));
    plain.render({});
    normalizing.render({});
    await flush();

    plain.edit({ topic: 'edited' });
    await flush();

    expect(draftFormValue()).toEqual({ topic: 'edited', flag: false });
    expect(plain.value).toEqual({ topic: 'edited', flag: false });
    expect(normalizing.value).toEqual({ topic: 'edited', flag: false });
    expect(plain.setValueCalls + normalizing.setValueCalls).toBeLessThan(MAX_SET_VALUE_CALLS);

    normalizing.edit({ topic: 'from normalizing' });
    await flush();

    expect(draftFormValue()).toEqual({ topic: 'from normalizing', flag: false });
    expect(plain.value).toEqual({ topic: 'from normalizing', flag: false });
    expect(plain.setValueCalls + normalizing.setValueCalls).toBeLessThan(MAX_SET_VALUE_CALLS);
  });

  it('should disable the form and stop reporting validity while the section is locked', async () => {
    makeSection({ key: 'brief', hasForm: true, initialDraft: { formValue: { topic: 'seeded' } } });
    const form = bind(new TestFakeLlmForm());
    form.render({});
    await flush();
    expect(sectionStore.section?.formValid).toBe(true);

    flowStore.startRun('brief', 'run');
    await flush();

    let disabled: Maybe<boolean>;
    form.stream$.subscribe((x) => (disabled = x.isDisabled)).unsubscribe();
    expect(disabled).toBe(true);
    expect(sectionStore.section?.formValid).toBe(true);
  });
});
