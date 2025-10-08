import { ChangeDetectionStrategy, Component, computed, input, output, viewChild } from '@angular/core';
import { FileArrayAcceptMatchConfig, FileArrayAcceptMatchResult } from './upload.accept';
import { DbxButtonStyle } from '../../button/button.component';
import { Maybe } from '@dereekb/util';
import { DbxFileUploadButtonComponent, DbxFileUploadButtonFilesChangedEvent } from './upload.button.component';
import { DbxFileUploadAreaComponent, DbxFileUploadAreaFilesChangedEvent } from './upload.area.component';

export interface DbxFileUploadFilesChangedEvent {
  readonly allFiles: File[];
  readonly matchResult: FileArrayAcceptMatchResult;
}

export interface DbxFileUploadComponentConfig {
  readonly accept?: Maybe<FileArrayAcceptMatchConfig['accept']>;
  readonly multiple?: Maybe<boolean>;

  /**
   * If true, the area will be clickable to open the file picker.
   */
  readonly clickAreaToUpload?: Maybe<boolean>;

  readonly area?: Maybe<{
    readonly icon?: Maybe<string>;
    readonly text?: Maybe<string>;
    readonly hint?: Maybe<string | boolean>;
  }>;

  readonly button?: Maybe<{
    readonly icon?: Maybe<string>;
    readonly text?: Maybe<string>;
    readonly style?: DbxButtonStyle;
  }>;
}

/**
 * Combines both the file upload area and button into a single component.
 */
@Component({
  selector: 'dbx-file-upload',
  template: `
    <dbx-file-upload-area #area [hint]="areaHintSignal()" [text]="areaTextSignal()" [icon]="areaIconSignal()" [accept]="acceptSignal()" [multiple]="multipleSignal()" (filesChanged)="areaFilesChanged($event)" (areaClicked)="areaClicked()">
      <ng-content></ng-content>
      <dbx-file-upload-button #button [text]="buttonTextSignal()" [icon]="buttonIconSignal()" [accept]="acceptSignal()" [multiple]="multipleSignal()" (filesChanged)="buttonFilesChanged($event)"></dbx-file-upload-button>
    </dbx-file-upload-area>
  `,
  imports: [DbxFileUploadAreaComponent, DbxFileUploadButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxFileUploadComponent {
  readonly config = input<Maybe<DbxFileUploadComponentConfig>>();

  readonly area = viewChild.required<string, DbxFileUploadAreaComponent>('area', { read: DbxFileUploadAreaComponent });
  readonly button = viewChild.required<string, DbxFileUploadButtonComponent>('button', { read: DbxFileUploadButtonComponent });

  readonly text = input<Maybe<string>>(); // button text
  readonly icon = input<Maybe<string>>(); // button icon
  readonly hint = input<Maybe<string | boolean>>(); // area hint

  readonly multiple = input<Maybe<boolean | ''>>();
  readonly accept = input<FileArrayAcceptMatchConfig['accept']>([]);

  readonly clickAreaToUpload = input<Maybe<boolean>>();
  readonly clickAreaToUploadSignal = computed(() => {
    const config = this.config();
    const clickAreaToUpload = this.clickAreaToUpload();
    return config?.clickAreaToUpload ?? clickAreaToUpload;
  });

  readonly buttonTextSignal = computed(() => {
    const config = this.config();
    const text = this.text();
    return config?.button?.text ?? text;
  });

  readonly buttonIconSignal = computed(() => {
    const config = this.config();
    const icon = this.icon();
    return config?.button?.icon ?? icon;
  });

  readonly areaTextSignal = computed(() => this.config()?.area?.text);
  readonly areaIconSignal = computed(() => this.config()?.area?.icon);
  readonly areaHintSignal = computed(() => {
    const config = this.config();
    const hint = this.hint();
    return config?.area?.hint ?? hint;
  });

  readonly multipleSignal = computed(() => {
    const config = this.config();
    const multiple = this.multiple();
    return config?.multiple ?? multiple;
  });

  readonly acceptSignal = computed(() => {
    const config = this.config();
    const accept = this.accept();
    return config?.accept ?? accept;
  });

  readonly filesChanged = output<DbxFileUploadFilesChangedEvent>();

  areaClicked() {
    const clickAreaToUpload = this.clickAreaToUploadSignal();

    if (clickAreaToUpload) {
      const button = this.button();
      button.openInput();
    }
  }

  areaFilesChanged(event: DbxFileUploadAreaFilesChangedEvent) {
    this.filesChanged.emit(event);
  }

  buttonFilesChanged(event: DbxFileUploadButtonFilesChangedEvent) {
    this.filesChanged.emit(event);
  }
}
