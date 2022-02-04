import { Component } from '@angular/core';
import { ClickableAnchorLinkTree } from '@dereekb/dbx-core';

@Component({
  templateUrl: './layout.component.html'
})
export class DocLayoutComponent {

  readonly navAnchors: ClickableAnchorLinkTree[] = [{
    icon: 'home',
    title: 'Docs',
    ref: 'doc.home'
  }, {
    title: 'Layout',
    ref: 'doc.layout.home',
    icon: 'view_module',
    children: [{
      icon: 'view_module',
      title: 'Content',
      ref: 'doc.layout.content'
    },{
      icon: 'view_module',
      title: 'Section',
      ref: 'doc.layout.section'
    }]
  }, {
    icon: 'route',
    title: 'Router',
    ref: 'doc.router'
  }, {
    icon: 'text_fields',
    title: 'Text',
    ref: 'doc.text'
  }];

}
