import { CompactContextStore, mapCompactModeObs } from '@dereekb/dbx-web';
import {
  Component, OnDestroy, OnInit, Optional} from '@angular/core';
import { FieldType, FormlyFieldConfig } from '@ngx-formly/core';
import { Editor } from 'ngx-editor';
import { debounceTime, filter } from 'rxjs/operators';
import { SubscriptionObject } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';

export interface TextEditorComponentFieldConfig extends FormlyFieldConfig {
  // TODO: Add button that can retrieve trimmed content and inject it into the editor as a quoted value.
}

@Component({
  template: `
    <div class="dbx-texteditor-field NgxEditor__Wrapper" [ngClass]="compactClass$ | async" [formGroup]="form">
      <dbx-label *ngIf="label">{{ label }}</dbx-label>
      <div class="dbx-texteditor-field-input">
        <ngx-editor [editor]="editor" outputFormat="html" [placeholder]="placeholder" [formControlName]="field.key"></ngx-editor>
      </div>
      <div class="dbx-texteditor-field-menu">
        <ngx-editor-menu [editor]="editor"></ngx-editor-menu>
      </div>
    </div>
  `,
  // TODO: styleUrls: ['./texteditor.scss']
})
export class TextEditorFieldComponent<T extends TextEditorComponentFieldConfig = TextEditorComponentFieldConfig> extends FieldType<T> implements OnInit, OnDestroy {

  private _editor?: Editor;
  private _sub = new SubscriptionObject();

  readonly compactClass$ = mapCompactModeObs(this.compact?.mode$, {
    compact: 'dbx-texteditor-field-compact'
  });

  constructor(@Optional() readonly compact: CompactContextStore) {
    super();
  }

  get editor(): Editor {
    return this._editor!;
  }

  get label(): Maybe<string> {
    return this.field.templateOptions?.label;
  }

  get placeholder(): Maybe<string> {
    return this.field.templateOptions?.placeholder;
  }

  ngOnInit(): void {
    this._editor = new Editor({});

    // Watch for value changes every second and update the pristine level.
    this._sub.subscription = this.editor.valueChanges.pipe(
      debounceTime(800),
      filter(_ => this.editor.view.hasFocus())
    ).subscribe(() => {
      this.formControl.updateValueAndValidity();
      this.formControl.markAsDirty();
    });
  }

  ngOnDestroy(): void {
    if (this.editor) {
      this.editor.destroy();
      delete this._editor;
    }
    this._sub.destroy();
  }

}
