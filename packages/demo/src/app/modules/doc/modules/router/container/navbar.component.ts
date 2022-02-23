import { Component } from '@angular/core';
import { DOC_ROUTER_ROUTES } from '../doc.router';

@Component({
  templateUrl: './navbar.component.html'
})
export class DocRouterNavbarComponent {

  anchors = DOC_ROUTER_ROUTES;

}
