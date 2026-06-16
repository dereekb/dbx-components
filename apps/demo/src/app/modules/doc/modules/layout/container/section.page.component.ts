import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LOREM } from '../../shared';
import { DbxButtonComponent, DbxSectionPageComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './section.page.component.html',
  standalone: true,
  imports: [DbxButtonComponent, DbxSectionPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocLayoutSectionPageComponent {
  lorem = LOREM;
}
