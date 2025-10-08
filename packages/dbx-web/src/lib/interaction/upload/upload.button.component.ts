import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, viewChild } from '@angular/core';
import { fileAcceptString, FileArrayAcceptMatchConfig, fileArrayAcceptMatchFunction, FileArrayAcceptMatchResult } from './upload.accept';
import { DbxButtonComponent, DbxButtonStyle } from '../../button/button.component';
import { Maybe } from '@dereekb/util';

export interface DbxFileUploadButtonFilesChangedEvent {
  readonly allFiles: File[];
  readonly matchResult: FileArrayAcceptMatchResult;
}

@Component({
  selector: 'dbx-file-upload-button',
  template: `
    <dbx-button [style]="buttonStyle()" [text]="text()" [icon]="icon()" (buttonClick)="openInput()">
      <ng-content></ng-content>
    </dbx-button>
    <input #fileInput hidden type="file" [attr.accept]="acceptSignal() ?? null" [attr.multiple]="multiple()" (change)="fileInputChanged()" />
  `,
  imports: [DbxButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFileUploadButtonComponent {
  readonly fileInput = viewChild.required<string, ElementRef<HTMLInputElement>>('fileInput', { read: ElementRef });

  readonly text = input<Maybe<string>>();
  readonly icon = input<Maybe<string>>();
  readonly buttonStyle = input<DbxButtonStyle>();

  readonly multiple = input<boolean, Maybe<boolean | ''>>(false, { transform: (x) => x === '' || Boolean(x) });
  readonly accept = input<FileArrayAcceptMatchConfig['accept']>([]);
  readonly filesChanged = output<DbxFileUploadButtonFilesChangedEvent>();

  readonly acceptSignal = computed(() => {
    const accept = this.accept();
    return typeof accept === 'function' ? undefined : fileAcceptString(accept);
  });

  readonly filesAcceptedFunctionSignal = computed(() => {
    const accept = this.accept();
    const multiple = this.multiple();
    return typeof accept === 'function' ? fileArrayAcceptMatchFunction({ multiple, accept }) : undefined;
  });

  openInput() {
    const inputRef = this.fileInput();
    const input = inputRef.nativeElement;
    input.click();
  }

  fileInputChanged() {
    const inputRef = this.fileInput();
    const input = inputRef.nativeElement;

    const allFiles = input.files ? Array.from(input.files) : [];

    const fileAcceptFunction = this.filesAcceptedFunctionSignal();

    if (fileAcceptFunction) {
      const matchResult = fileAcceptFunction(allFiles);
      this.filesChanged.emit({ allFiles, matchResult });
    } else {
      // if not using a filesAcceptedFunction, then accept all files as the input should have filtered them
      this.filesChanged.emit({ allFiles, matchResult: { multiple: this.multiple(), input: allFiles, accepted: allFiles, rejected: [], acceptedType: allFiles, rejectedType: [] } });
    }

    // reset the input value
    if (input.value) {
      input.value = '';
    }
  }
}
