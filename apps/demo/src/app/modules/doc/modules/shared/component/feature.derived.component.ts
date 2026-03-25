import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DbxContentBoxDirective } from '@dereekb/dbx-web';
import { MatIcon } from '@angular/material/icon';

export type DocFeatureDerviedType = 'integrated' | 'uses';

@Component({
  selector: 'doc-feature-derived',
  template: `
    <div class="doc-feature-derived">
      <dbx-content-box class="doc-feature-derived-content" style="margin-left: 0">
        <div class="dbx-flex-bar">
          <mat-icon class="dbx-icon-spacer">star</mat-icon>
          @switch (type()) {
            @case ('integrated') {
              <span>
                Derived and integrated from
                <a [href]="url()" target="_blank">{{ from() }}</a>
              </span>
            }
            @case ('uses') {
              <span>
                Uses
                <a [href]="url()" target="_blank">{{ from() }}</a>
              </span>
            }
          }
          <div>
            <ng-content></ng-content>
          </div>
        </div>
      </dbx-content-box>
    </div>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, MatIcon],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFeatureDerivedComponent {
  readonly type = input<DocFeatureDerviedType>('integrated');

  readonly from = input.required<string>();

  readonly url = input.required<string>();
}
