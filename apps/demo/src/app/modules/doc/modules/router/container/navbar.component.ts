import { Component } from '@angular/core';
import { DOC_ROUTER_ROUTES } from '../doc.router';

@Component({
  templateUrl: './navbar.component.html'
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
}
