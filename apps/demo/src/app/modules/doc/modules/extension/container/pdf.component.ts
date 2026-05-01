import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxContentContainerDirective, DbxContentLayoutModule, DbxPdfMergeEditorComponent, DbxPdfMergeEditorStore } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';

@Component({
  templateUrl: './pdf.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxContentLayoutModule, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxPdfMergeEditorComponent],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionPdfComponent {
  readonly lastBlobSizeSignal = signal<Maybe<number>>(undefined);

  onMerged(blob: Blob): void {
    this.lastBlobSizeSignal.set(blob.size);
  }
}
