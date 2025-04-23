import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  imports: [DbxContentContainerDirective, UIView],
  standalone: true
})
export class DemoProfileLayoutComponent {}
