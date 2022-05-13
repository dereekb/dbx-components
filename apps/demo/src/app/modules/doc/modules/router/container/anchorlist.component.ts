import { DOC_LAYOUT_ROOT_ROUTE } from './../../layout/doc.layout';
import { Component } from '@angular/core';
import { ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DOC_ROUTER_ROOT_ROUTE } from '../doc.router';

@Component({
  templateUrl: './anchorlist.component.html'
})
export class DocRouterAnchorListComponent {

  anchors: ClickableAnchorLinkTree[] = [
    DOC_LAYOUT_ROOT_ROUTE,
    DOC_ROUTER_ROOT_ROUTE,
    {
      icon: 'code',
      title: 'Other Examples',
      children: [
        {
          icon: 'touch_app',
          title: 'Route With Click',
          onClick: () => console.log('Clicked.')
        },
        {
          icon: 'link_off',
          title: 'Disabled Route',
          disabled: true
        },
        {
          icon: 'link',
          title: 'Github',
          target: '_blank',
          url: 'https://github.com/dereekb/dbx-components'
        },
        {
          icon: 'link',
          title: 'CircleCI',
          target: '_blank',
          url: 'https://app.circleci.com/pipelines/github/dereekb/dbx-components'
        }
      ]
    }
  ];

}
