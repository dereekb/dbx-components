import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { DbxAnchorComponent, DbxContentLayoutModule } from '@dereekb/dbx-web';

@Component({
  templateUrl: './home.component.html',
  imports: [DbxContentLayoutModule, DbxAnchorComponent, MatButtonModule],
  standalone: true
})
export class DemoAppHomeComponent {}
