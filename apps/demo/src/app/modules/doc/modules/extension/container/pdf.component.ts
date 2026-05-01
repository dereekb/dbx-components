import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxContentContainerDirective, DbxContentLayoutModule, DbxPdfMergeEditorComponent, DbxPdfMergeEditorStore } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { distinctUntilChanged, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  templateUrl: './pdf.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DbxContentLayoutModule, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxPdfMergeEditorComponent],
  providers: [DbxPdfMergeEditorStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocExtensionPdfComponent {
  readonly store = inject(DbxPdfMergeEditorStore);

  readonly mergedBlobSize$ = this.store.mergeOutput$.pipe(
    map((blob) => blob.size),
    distinctUntilChanged()
  );
  readonly lastBlobSizeSignal = toSignal(this.mergedBlobSize$, { initialValue: undefined });
}
