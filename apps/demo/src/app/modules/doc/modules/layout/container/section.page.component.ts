import { Component } from '@angular/core';
import { LOREM } from '../../shared';
import { DbxButtonComponent, DbxSectionPageComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './section.page.component.html',
  imports: [DbxButtonComponent, DbxSectionPageComponent]
})
export class DocLayoutSectionPageComponent {
  lorem = LOREM;
}
