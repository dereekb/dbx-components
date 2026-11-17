import { Component, computed, DestroyRef, effect, ElementRef, inject, input, output, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { cleanSubscription } from '@dereekb/dbx-core';
import { AbstractAsyncForgeFormDirective, DBX_FORGE_FORM_COMPONENT_TEMPLATE, dbxForgeFormComponentProviders, DbxForgeFormComponentImportsModule, dbxForgeGroup, dbxForgeTextAreaField } from '@dereekb/dbx-form';
import { type Destroyable, type Maybe } from '@dereekb/util';
import { type FieldDef, type FormConfig } from '@ng-forge/dynamic-forms';
import { combineLatest, distinctUntilChanged, map, type Observable } from 'rxjs';
import { bindDbxLlmFlowSectionForm, type DbxLlmFlowSectionBindableForm } from './llm.flow.section.form';
import { DbxLlmFlowSectionStore } from './llm.flow.section.store';

/**
 * Key of the raw input textarea in the raw input's form.
 */
export const DBX_LLM_FLOW_SECTION_RAW_INPUT_FORM_TEXT_KEY = 'rawInput';

/**
 * Key of the group of the section's option fields in the raw input's form.
 */
export const DBX_LLM_FLOW_SECTION_RAW_INPUT_FORM_OPTIONS_KEY = 'options';

/**
 * CSS class of the raw input textarea field.
 */
export const DBX_LLM_FLOW_SECTION_RAW_INPUT_TEXT_FIELD_CLASS = 'dbx-llm-flow-section-raw-input-text';

/**
 * Value of the raw input's forge form.
 */
export interface DbxLlmFlowSectionRawInputFormValue {
  readonly rawInput?: Maybe<string>;
  /**
   * The section's options (its form value), when the section has option fields.
   */
  readonly options?: Maybe<object>;
}

/**
 * The forge form of the raw input of the nearest section: the raw input textarea with a copy button, then the section's option fields in an
 * options group.
 *
 * The text and the options come from the section store, and every write sets both, so neither is lost. The text is only written when the
 * textarea shows other text, so typing never moves the cursor. Typed text is read by the raw input from the textarea's bubbling input event.
 * The options group is bound to the section with bindDbxLlmFlowSectionForm(), so it is the section's form value: option changes update the
 * draft, and it is disabled while the section runs.
 */
@Component({
  selector: 'dbx-llm-flow-section-raw-input-form',
  template: DBX_FORGE_FORM_COMPONENT_TEMPLATE,
  providers: dbxForgeFormComponentProviders(),
  imports: [DbxForgeFormComponentImportsModule]
})
export class DbxLlmFlowSectionRawInputFormComponent extends AbstractAsyncForgeFormDirective<DbxLlmFlowSectionRawInputFormValue> {
  readonly sectionStore = inject(DbxLlmFlowSectionStore);
  private readonly _elementRef = inject(ElementRef<HTMLElement>);

  readonly label = input.required<string>();
  readonly rows = input.required<number>();
  readonly readonlyText = input<boolean>(false);
  readonly copyDisabled = input<boolean>(false);

  readonly copyClick = output<void>();

  readonly optionFieldsSignal = toSignal(
    this.sectionStore.config$.pipe(
      map((x) => x?.optionFields),
      distinctUntilChanged()
    )
  );

  readonly hasOptionFieldsSignal = computed(() => Boolean(this.optionFieldsSignal()?.length));

  readonly formConfigSignal = computed<FormConfig>(() => {
    const optionFields = this.optionFieldsSignal();
    const fields: FieldDef<unknown>[] = [
      dbxForgeTextAreaField({
        key: DBX_LLM_FLOW_SECTION_RAW_INPUT_FORM_TEXT_KEY,
        label: this.label(),
        rows: this.rows(),
        readonly: this.readonlyText(),
        className: DBX_LLM_FLOW_SECTION_RAW_INPUT_TEXT_FIELD_CLASS,
        addons: [{ type: 'mat-button', slot: 'suffix', icon: 'content_copy', ariaLabel: 'Copy the raw input', disabled: this.copyDisabled, action: () => this.copyClick.emit() }]
      }) as FieldDef<unknown>
    ];

    if (optionFields?.length) {
      fields.push(dbxForgeGroup({ key: DBX_LLM_FLOW_SECTION_RAW_INPUT_FORM_OPTIONS_KEY, fields: [...optionFields] }) as FieldDef<unknown>);
    }

    return { fields } as FormConfig;
  });

  readonly formConfig$: Observable<Maybe<FormConfig>> = toObservable(this.formConfigSignal);

  /**
   * The options group, as a form bindDbxLlmFlowSectionForm() binds to the section. Its writes keep the raw input text.
   */
  readonly optionsForm: DbxLlmFlowSectionBindableForm<unknown> = {
    currentValue: () => this.context.currentValue().pipe(map((x) => x?.options)),
    stream$: this.context.stream$,
    setValue: (options) => this._write(this.sectionStore.section?.draft.rawInput ?? '', options),
    setDisabled: (key, disabled) => this.context.setDisabled(key, disabled)
  };

  constructor() {
    super();
    let lastConfig: Maybe<FormConfig>;

    // write the store's text when the textarea shows other text, or when the form is rebuilt
    cleanSubscription(
      combineLatest([this.sectionStore.rawInput$, this.formConfig$]).subscribe(([text, config]) => {
        const configChanged = config !== lastConfig;
        lastConfig = config;

        if (configChanged || this.textareaElement()?.value !== text) {
          this._write(text, this.sectionStore.section?.draft.formValue);
        }
      })
    );

    // bind the options group to the section while the section has option fields
    let binding: Maybe<Destroyable>;

    effect(() => {
      const hasOptionFields = this.hasOptionFieldsSignal();

      untracked(() => {
        if (hasOptionFields && binding == null) {
          binding = bindDbxLlmFlowSectionForm({ form: this.optionsForm, target: this.sectionStore });
        } else if (!hasOptionFields && binding != null) {
          binding.destroy();
          binding = undefined;
        }
      });
    });

    inject(DestroyRef).onDestroy(() => binding?.destroy());
  }

  /**
   * The rendered raw input textarea. Undefined until forge renders the field.
   *
   * @returns The textarea, if rendered.
   */
  textareaElement(): Maybe<HTMLTextAreaElement> {
    const element = this._elementRef.nativeElement as HTMLElement;
    return element.querySelector(`.${DBX_LLM_FLOW_SECTION_RAW_INPUT_TEXT_FIELD_CLASS} textarea`) ?? element.querySelector('textarea');
  }

  /**
   * Whether the event target is the raw input textarea, not an option field.
   *
   * @param target - The event target.
   * @returns True for the raw input textarea.
   */
  isTextareaTarget(target: Maybe<EventTarget>): target is HTMLTextAreaElement {
    return target != null && target === this.textareaElement();
  }

  /**
   * Writes the store's text (and options) back into the form, discarding text the textarea took that the store did not accept.
   */
  restoreText(): void {
    this._write(this.sectionStore.section?.draft.rawInput ?? '', this.sectionStore.section?.draft.formValue);
  }

  private _write(rawInput: string, options: unknown): void {
    const value: DbxLlmFlowSectionRawInputFormValue = this.hasOptionFieldsSignal() ? { rawInput, options: (options ?? {}) as object } : { rawInput };
    this.setValue(value);
  }
}
