import { Component } from '@angular/core';
import { DbxAppContextStateDirective } from '@dereekb/dbx-core';
import { UIView } from '@uirouter/angular';

@Component({
  templateUrl: './layout.component.html',
  imports: [DbxAppContextStateDirective, UIView],
  standalone: true
})
export class DemoAppLayoutComponent {}
