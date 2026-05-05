import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { DbxContentBorderDirective, DbxContentContainerDirective, DbxContentLayoutModule, DbxPdfMergeEditorComponent, DbxPdfMergeEditorFileUploadComponent, type DbxPdfMergeEditorFileUploadConfig, DbxPdfMergeEditorFileUploadHasStateDirective, DbxPdfMergeEditorStore, DbxPdfMergeEditorFileUploadValidatorDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { distinctUntilChanged, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'doc-pdf-merge-editor-default-example',
  template: `
    <dbx-content-border>
      <dbx-pdf-merge-editor [showPreviewButton]="true" [showDownloadButton]="true"></dbx-pdf-merge-editor>
    </dbx-content-border>
    @if (lastBlobSizeSignal(); as size) {
      <p class="dbx-hint">Last merged blob size: {{ size }} bytes</p>
    }
  `,
  standalone: true,
  imports: [DbxContentBorderDirective, DbxPdfMergeEditorComponent],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeEditorDefaultExampleComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly mergedBlobSize$ = this.store.mergeOutput$.pipe(
    map((blob) => blob.size),
    distinctUntilChanged()
  );
  readonly lastBlobSizeSignal = toSignal(this.mergedBlobSize$, { initialValue: undefined });
}

@Component({
  selector: 'doc-pdf-merge-editor-slots-example',
  template: `
    <dbx-content-border>
      <dbx-pdf-merge-editor [showAddFiles]="false" [showFileList]="false" [showPreviewButton]="true" [showDownloadButton]="true">
        <div dbxPdfMergeEditorFileUploadValidator>
          <dbx-pdf-merge-editor-file-upload slotId="license" [config]="licenseConfig">
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'no_file'">radio_button_unchecked</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'valid'">check_circle</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'invalid'">error</mat-icon>
            <span class="dbx-hint dbx-small" *dbxPdfMergeEditorFileUploadHasState="'no_file'">Required</span>
          </dbx-pdf-merge-editor-file-upload>
          <dbx-pdf-merge-editor-file-upload slotId="insurance" [config]="insuranceConfig">
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'no_file'">radio_button_unchecked</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'valid'">check_circle</mat-icon>
            <mat-icon *dbxPdfMergeEditorFileUploadHasState="'invalid'">error</mat-icon>
            <span class="dbx-hint dbx-small" *dbxPdfMergeEditorFileUploadHasState="'no_file'">Optional</span>
          </dbx-pdf-merge-editor-file-upload>
        </div>
      </dbx-pdf-merge-editor>
    </dbx-content-border>
    @if (slotsBlobSizeSignal(); as size) {
      <p class="dbx-hint">Slots merged blob size: {{ size }} bytes</p>
    }
  `,
  standalone: true,
  imports: [MatIconModule, DbxContentBorderDirective, DbxPdfMergeEditorComponent, DbxPdfMergeEditorFileUploadComponent, DbxPdfMergeEditorFileUploadValidatorDirective, DbxPdfMergeEditorFileUploadHasStateDirective],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeEditorSlotsExampleComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly licenseConfig: DbxPdfMergeEditorFileUploadConfig = { label: 'Driver’s License', accept: ['application/pdf', 'image/png', 'image/jpeg'] };
  readonly insuranceConfig: DbxPdfMergeEditorFileUploadConfig = { label: 'Insurance Card', accept: ['application/pdf', 'image/png', 'image/jpeg'], required: false };

  readonly mergedBlobSize$ = this.store.mergeOutput$.pipe(
    map((blob) => blob.size),
    distinctUntilChanged()
  );
  readonly slotsBlobSizeSignal = toSignal(this.mergedBlobSize$, { initialValue: undefined });
}

@Component({
  selector: 'doc-pdf-merge-editor-max-files-example',
  template: `
    <dbx-content-border>
      <dbx-pdf-merge-editor [showAddFiles]="false" [showFileList]="false" [showPreviewButton]="true" [showDownloadButton]="true">
        <div dbxPdfMergeEditorFileUploadValidator>
          <dbx-pdf-merge-editor-file-upload slotId="receipts" [config]="receiptsConfig"></dbx-pdf-merge-editor-file-upload>
        </div>
      </dbx-pdf-merge-editor>
    </dbx-content-border>
    @if (maxFilesBlobSizeSignal(); as size) {
      <p class="dbx-hint">Max-files merged blob size: {{ size }} bytes</p>
    }
  `,
  standalone: true,
  imports: [DbxContentBorderDirective, DbxPdfMergeEditorComponent, DbxPdfMergeEditorFileUploadComponent, DbxPdfMergeEditorFileUploadValidatorDirective],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocPdfMergeEditorMaxFilesExampleComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly receiptsConfig: DbxPdfMergeEditorFileUploadConfig = {
    label: 'Receipts (up to 3)',
    accept: ['application/pdf', 'image/png', 'image/jpeg'],
    multiple: true,
    minFiles: 1,
    maxFiles: 3,
    hint: 'Drop up to three receipt PDFs or images. The uploader hides once you reach 3.'
  };

  readonly mergedBlobSize$ = this.store.mergeOutput$.pipe(
    map((blob) => blob.size),
    distinctUntilChanged()
  );
  readonly maxFilesBlobSizeSignal = toSignal(this.mergedBlobSize$, { initialValue: undefined });
}

@Component({
  templateUrl: './pdf.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxContentLayoutModule, DocFeatureLayoutComponent, DocFeatureExampleComponent, DocPdfMergeEditorDefaultExampleComponent, DocPdfMergeEditorSlotsExampleComponent, DocPdfMergeEditorMaxFilesExampleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionPdfComponent {}
