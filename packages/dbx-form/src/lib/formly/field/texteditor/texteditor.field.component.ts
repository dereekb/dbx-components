import { FormGroup } from '@angular/forms';
import { CompactContextStore, mapCompactModeObs } from '@dereekb/dbx-web';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FieldTypeConfig, FormlyFieldProps } from '@ngx-formly/core';
import { FieldType } from '@ngx-formly/material';
import { Editor } from 'ngx-editor';
import { debounceTime, filter } from 'rxjs';
import { SubscriptionObject } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';

export type TextEditorComponentFieldProps = FormlyFieldProps;

@Component({
  template: `
    <div class="dbx-texteditor-field" [ngClass]="(compactClass$ | async) ?? ''" [formGroup]="formGroup">
      <span class="dbx-label" *ngIf="label">{{ label }}</span>
      <div class="dbx-texteditor-field-input">
        <ngx-editor [editor]="editor" outputFormat="html" [placeholder]="placeholder" [formControlName]="formGroupName"></ngx-editor>
      </div>
      <div class="dbx-texteditor-field-menu">
        <ngx-editor-menu [editor]="editor"></ngx-editor-menu>
      </div>
      <div class="dbx-form-description" *ngIf="description">{{ description }}</div>
    </div>
  `
})
export class DbxTextEditorFieldComponent<T extends TextEditorComponentFieldProps = TextEditorComponentFieldProps> extends FieldType<FieldTypeConfig<T>> implements OnInit, OnDestroy {
  private readonly _compactContextStore = inject(CompactContextStore, { optional: true });

  private _editor?: Editor;
  private _sub = new SubscriptionObject();

  readonly compactClass$ = mapCompactModeObs(this._compactContextStore?.mode$, {
    compact: 'dbx-texteditor-field-compact'
  });

  get formGroupName(): string {
    return this.field.key as string;
  }

  get formGroup(): FormGroup {
    return this.form as FormGroup;
  }

  get editor(): Editor {
    return this._editor as Editor;
  }

  get label(): Maybe<string> {
    return this.field.props?.label;
  }

  get description(): Maybe<string> {
    return this.props.description;
  }

  ngOnInit(): void {
    this._editor = new Editor({});

    // Watch for value changes every second and update the pristine level.
    this._sub.subscription = this.editor.valueChanges
      .pipe(
        debounceTime(100),
        filter(() => this.editor.view.hasFocus())
      )
      .subscribe(() => {
        this.formControl.updateValueAndValidity();
        this.formControl.markAsDirty();
      });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();

    if (this.editor) {
      this.editor.destroy();
      delete this._editor;
    }
    this._sub.destroy();
  }
}
