import { ChangeDetectionStrategy, Component, computed, effect, inject, input, type OnDestroy, type OnInit } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { Editor, NgxEditorModule } from '@bobbyquantum/ngx-editor';
import { debounceTime, filter } from 'rxjs';
import { SubscriptionObject, filterMaybe } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { CompactContextStore, mapCompactModeObs } from '@dereekb/dbx-web';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';
import { type FieldTree } from '@angular/forms/signals';
import { type DynamicText, type FieldMeta, type ValidationMessages, type BaseValueField } from '@ng-forge/dynamic-forms';

// MARK: Forge Text Editor Field Props
/**
 * Props interface for the forge text editor field.
 *
 * Passed via the `props` property on the forge field definition.
 */
export interface ForgeTextEditorFieldProps {
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
 * Forge field definition interface for the text editor field.
 */
export interface ForgeTextEditorFieldDef extends BaseValueField<ForgeTextEditorFieldProps, string> {
  readonly type: 'dbx-texteditor';
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

  // ng-forge ValueFieldComponent inputs
  readonly field = input.required<FieldTree<string>>();
  readonly key = input.required<string>();
  readonly label = input<DynamicText | undefined>();
  readonly placeholder = input<DynamicText | undefined>();
  readonly className = input<string>('');
  readonly tabIndex = input<number | undefined>();
  readonly props = input<ForgeTextEditorFieldProps | undefined>();
  readonly meta = input<FieldMeta | undefined>();
  readonly validationMessages = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages = input<ValidationMessages | undefined>();

  private _editor!: Editor;
  private readonly _editorValueSub = new SubscriptionObject();
  private readonly _syncFromFieldSub = new SubscriptionObject();

  readonly editorFormControl = new FormControl<string>('', { nonNullable: true });

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

  get editor(): Editor {
    return this._editor;
  }

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

    this._editorValueSub.destroy();
    this._syncFromFieldSub.destroy();
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
