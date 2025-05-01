import { Component } from '@angular/core';
import { takeLast } from '@dereekb/util';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxContentBorderDirective } from '@dereekb/dbx-web';
import { UIView } from '@uirouter/angular';
import { DbxNavbarComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './navbar.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxContentBorderDirective, UIView, DbxNavbarComponent]
})
export class DocRouterNavbarComponent {
  anchors = [
    {
      icon: 'route',
      title: 'Nav Bar',
      detail: 'dbx-anchor',
      ref: 'doc.router.navbar'
    },
    {
      icon: 'circle',
      title: 'Nav Bar A',
      detail: 'A Content',
      ref: 'doc.router.navbar.a'
    },
    {
      icon: 'home',
      title: 'Nav Bar B',
      detail: 'B Content',
      ref: 'doc.router.navbar.b'
    }
  ];

  iconButtonAnchors = takeLast(this.anchors, 2);
}
