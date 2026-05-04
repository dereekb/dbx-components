import { ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, type OnDestroy, type OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Editor, NgxEditorModule } from '@bobbyquantum/ngx-editor';
import { debounceTime } from 'rxjs';
import { filterMaybe } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { CompactContextStore, mapCompactModeObs } from '@dereekb/dbx-web';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { type FieldTree } from '@angular/forms/signals';
import { type DynamicText, type FieldMeta, type ValidationMessages, type BaseValueField } from '@ng-forge/dynamic-forms';
import { createResolvedErrorsSignal, setupMetaTracking, shouldShowErrors } from '@ng-forge/dynamic-forms/integration';
import { dbxForgeFieldDisabled } from '../field.util';
import { toggleDisableFormControl } from '../../../form/form';
import { cleanSubscription } from '@dereekb/dbx-core';

// MARK: Forge Text Editor Field Props
/**
 * Props interface for the forge text editor field.
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface DbxForgeTextEditorFieldProps {
  /**
   * Minimum text length.
   */
  readonly minLength?: number;
  /**
   * Maximum text length.
   */
  readonly maxLength?: number;
  /**
   * Hint text shown below the editor.
   */
  readonly hint?: string;
}

/**
 * The custom forge field type name for the text editor field.
 */
export const FORGE_TEXT_EDITOR_FIELD_TYPE = 'dbx-texteditor' as const;

/**
 * Forge field definition interface for the text editor field.
 */
export interface DbxForgeTextEditorFieldDef extends BaseValueField<DbxForgeTextEditorFieldProps, string> {
  readonly type: typeof FORGE_TEXT_EDITOR_FIELD_TYPE;
}

/**
 * Forge ValueFieldComponent for rich text editing powered by ngx-editor.
 *
 * Wraps the existing ngx-editor integration from the formly text editor component
 * as a standalone ng-forge dynamic forms component. Outputs HTML format.
 * Supports compact mode via {@link CompactContextStore}.
 */
@Component({
  selector: 'dbx-forge-texteditor-field',
  templateUrl: './texteditor.field.component.html',
  imports: [NgClass, NgxEditorModule, FormsModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeTextEditorFieldComponent implements OnInit, OnDestroy {
  private readonly _compactContextStore = inject(CompactContextStore, { optional: true });
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<string>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<DbxForgeTextEditorFieldProps | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  private _editor!: Editor;
  private readonly _editorValueSub = cleanSubscription();
  private readonly _syncFromFieldSub = cleanSubscription();

  readonly editorFormControl = new FormControl<string>('', { nonNullable: true });

  // Disabled state
  readonly isDisabled = dbxForgeFieldDisabled();

  readonly compactClass$ = mapCompactModeObs(this._compactContextStore?.mode$, {
    compact: 'dbx-texteditor-field-compact'
  }).pipe(filterMaybe());

  readonly compactClassSignal = toSignal(this.compactClass$, { initialValue: '' });

  readonly labelSignal = computed(() => {
    const l = this.label();
    return typeof l === 'string' ? l : undefined;
  });

  readonly placeholderSignal = computed(() => {
    const p = this.placeholder();
    return typeof p === 'string' ? p : '';
  });

  readonly descriptionSignal = computed(() => this.props()?.hint);

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field as any, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field as any);
  readonly errorsToDisplay = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  // ARIA
  protected readonly hintId = computed(() => `${this.key()}-hint`);
  protected readonly errorId = computed(() => `${this.key()}-error`);
  protected readonly ariaInvalid = computed(() => (this.showErrors() ? 'true' : null));
  protected readonly ariaDescribedBy = computed(() => {
    if (this.errorsToDisplay().length > 0) return this.errorId();
    if (this.props()?.hint) return this.hintId();
    return null;
  });

  constructor() {
    setupMetaTracking(this.elementRef, this.meta as any, { selector: 'ngx-editor' });
  }

  get editor(): Editor {
    return this._editor;
  }

  // Disabled state propagation
  private readonly _disabledEffect = effect(() => {
    const disabled = this.isDisabled();
    toggleDisableFormControl(this.editorFormControl, disabled);
  });

  private readonly _syncFieldToEditor = effect(() => {
    const fieldSignal = this.field();
    const node = fieldSignal ? (fieldSignal as any)() : undefined;
    const fieldValue = node?.value?.() as Maybe<string>;

    if (fieldValue !== undefined && fieldValue !== this.editorFormControl.value) {
      this.editorFormControl.setValue(fieldValue ?? '', { emitEvent: false });
    }
  });

  ngOnInit(): void {
    this._editor = new Editor({});

    // Watch for FormControl value changes (updated by ngx-editor's formControl binding)
    // and push to FieldTree. Use debounceTime to batch rapid changes.
    this._editorValueSub.subscription = this.editorFormControl.valueChanges.pipe(debounceTime(50)).subscribe((value) => {
      this._setFieldValue(value);
    });
  }

  ngOnDestroy(): void {
    if (this._editor != null) {
      this._editor.destroy();
    }
  }

  private _setFieldValue(value: string): void {
    const fieldSignal = this.field();

    if (!fieldSignal) {
      return;
    }

    // field() returns a signal wrapper; calling it returns the FieldNode
    const node = (fieldSignal as any)();

    if (node?.value?.set) {
      node.value.set(value);
    }
  }
}
