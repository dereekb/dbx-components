import { DOC_LAYOUT_ROOT_ROUTE } from './../../layout/doc.layout';
import { Component } from '@angular/core';
import { ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DOC_ROUTER_ROOT_ROUTE } from '../doc.router';
import { DocRouterCustomAnchorContentComponent } from '../component/anchor.content';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { DbxAnchorListComponent } from '@dereekb/dbx-web';

@Component({
  templateUrl: './anchorlist.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxAnchorListComponent]
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

  customAnchors: ClickableAnchorLinkTree[] = [
    {
      icon: 'link',
      title: 'CircleCI',
      target: '_blank',
      hint: 'This is a custom hint. This link goes to CircleCI.',
      url: 'https://app.circleci.com/pipelines/github/dereekb/dbx-components'
    },
    {
      icon: 'person',
      title: 'Account',
      target: '_blank',
      hint: 'Manage your account information.'
    },
    {
      icon: 'settings',
      title: 'Settings',
      target: '_blank',
      hint: 'View other settings here.'
    },
    {
      icon: 'shuffle',
      title: 'Random',
      hint: 'This content is injected using dbx-injection.',
      content: {
        componentClass: DocRouterCustomAnchorContentComponent
      }
    }
  ];
}
