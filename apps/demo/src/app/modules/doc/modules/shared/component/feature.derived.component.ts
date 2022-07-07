import { Component, Input } from '@angular/core';

export type DocFeatureDerviedType = 'integrated' | 'uses';

@Component({
  selector: 'doc-feature-derived',
  template: `
    <div class="doc-feature-derived">
      <dbx-content-box class="doc-feature-derived-content" style="margin-left: 0">
        <mat-icon class="dbx-icon-spacer">star</mat-icon>
        <ng-container [ngSwitch]="type">
          <span *ngSwitchCase="'integrated'">
            Derived and integrated from
            <a [href]="url" target="_blank">{{ from }}</a>
          </span>
          <span *ngSwitchCase="'uses'">
            Uses
            <a [href]="url" target="_blank">{{ from }}</a>
          </span>
        </ng-container>
        <div>
          <ng-content></ng-content>
        </div>
      </dbx-content-box>
    </div>
  `
})
export class DocFeatureDerivedComponent {
  @Input()
  type: DocFeatureDerviedType = 'integrated';

  @Input()
  from!: string;

  @Input()
  url!: string;
}
