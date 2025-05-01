import { Component } from '@angular/core';
import { LOREM } from '../../shared';
import { DbxSectionPageComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './section.page.component.html',
  standalone: true,
  imports: [DbxSectionPageComponent]
})
export class DocLayoutSectionPageComponent {
  lorem = LOREM;
}
