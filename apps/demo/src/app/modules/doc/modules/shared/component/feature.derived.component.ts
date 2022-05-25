import { Component, Input } from '@angular/core';

@Component({
  selector: 'doc-feature-derived',
  template: `
  <div class="doc-feature-derived">
    <dbx-content-box class="doc-feature-derived-content" style="margin-left: 0">
      <mat-icon class="dbx-icon-spacer">star</mat-icon><span>Derived and integrated from <a [href]="url" target="_blank">{{ from }}</a></span>
    </dbx-content-box>
  </div>
  `
})
export class DocFeatureDerivedComponent {

  @Input()
  from!: string;

  @Input()
  url!: string;

}
