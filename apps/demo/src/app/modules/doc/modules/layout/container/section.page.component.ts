import { Component } from '@angular/core';
import { LOREM } from '../../shared';
import { DbxSectionPageComponent } from '../../../../../../../../../packages/dbx-web/src/lib/layout/section/section.page.component';

@Component({
    templateUrl: './section.page.component.html',
    standalone: true,
    imports: [DbxSectionPageComponent]
})
export class DocLayoutSectionPageComponent {
  lorem = LOREM;
}
