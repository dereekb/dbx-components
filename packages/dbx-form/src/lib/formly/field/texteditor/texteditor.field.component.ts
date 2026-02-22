import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CompactContextStore, mapCompactModeObs } from '@dereekb/dbx-web';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { FieldType } from '@ngx-formly/material';
import { Editor, NgxEditorModule } from '@bobbyquantum/ngx-editor';
import { debounceTime, filter } from 'rxjs';
import { filterMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgClass } from '@angular/common';

export type TextEditorComponentFieldProps = FormlyFieldProps;

@Component({
  template: `
    <div class="dbx-texteditor-field" [ngClass]="compactClassSignal()" [formGroup]="formGroup">
      @if (label) {
        <span class="dbx-label">{{ label }}</span>
      }
      <div class="dbx-texteditor-field-input">
        <ngx-editor [editor]="editor" outputFormat="html" [placeholder]="placeholder" [formControlName]="formGroupName"></ngx-editor>
      </div>
      <div class="dbx-texteditor-field-menu">
        <ngx-editor-menu [editor]="editor"></ngx-editor-menu>
      </div>
      @if (description) {
        <div class="dbx-form-description">{{ description }}</div>
      }
    </div>
  `,
  imports: [NgClass, NgxEditorModule, FormsModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxTextEditorFieldComponent<T extends TextEditorComponentFieldProps = TextEditorComponentFieldProps> extends FieldType<FieldTypeConfig<T>> implements OnInit, OnDestroy {
  private readonly _compactContextStore = inject(CompactContextStore, { optional: true });

  private _editor!: Editor;
  private readonly _sub = new SubscriptionObject();

  readonly compactClass$ = mapCompactModeObs(this._compactContextStore?.mode$, {
    compact: 'dbx-texteditor-field-compact'
  }).pipe(filterMaybe());

  readonly compactClassSignal = toSignal(this.compactClass$, { initialValue: '' });

  get formGroupName(): string {
    return this.field.key as string;
  }

  get formGroup(): FormGroup {
    return this.form as FormGroup;
  }

  get editor(): Editor {
    return this._editor;
  }

  get label(): Maybe<string> {
    return this.field.props?.label;
  }

  get description(): Maybe<string> {
    return this.props.description;
  }

  ngOnInit(): void {
    this._editor = new Editor({});

    // TODO: Sync disabled state too

    // TODO: Sync the value periodically while not focused too

    // Watch for value changes every second and update the pristine level.
    this._sub.subscription = this.editor.valueChanges
      .pipe(
        debounceTime(50),
        filter(() => this.editor.view.hasFocus())
      )
      .subscribe(() => {
        this.formControl.updateValueAndValidity();
        this.formControl.markAsDirty();
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();

    if (this._editor != null) {
      this._editor.destroy();
    }

    this._sub.destroy();
  }
}
