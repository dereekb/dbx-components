import { ClickableAnchor, ClickableAnchorLink, ClickableIconAnchorLink } from './../../../../../../dbx-core/src/lib/router/anchor/anchor';
import { Component } from '@angular/core';
import packageInfo from '../../../../../../../package.json';

export interface LandingItem {
  name: string;
  description: string;
  packages: ClickableAnchorLink[]
}

@Component({
  templateUrl: './layout.component.html',
  styleUrls: ['../landing.scss']
})
export class LandingLayoutComponent {

  readonly docsAnchor: ClickableAnchorLink = {
    title: 'Docs',
    ref: 'doc'
  };

  readonly demoAnchor: ClickableAnchorLink = {
    title: 'Demo',
    ref: 'demo'
  };

  readonly packages: LandingItem[] = [{
    name: '@dereekb/dbx-web',
    description: 'Full set of components for Angular in the browser. Built on top of @angular/material.',
    packages: [{
      title: '@angular/material',
      url: 'https://material.angular.io/',
      target: '_blank'
    }]
  }, {
    name: '@dereekb/dbx-form',
    description: 'Forms extension for @dereekb/dbx-web to make composing and consuming form easy.',
    packages: [{
      title: '@ngx-formly/schematics',
      url: 'https://formly.dev/',
      target: '_blank'
    }]
  }, {
    name: '@dereekb/dbx-core',
    description: 'Set of directives and utilities for Angular.',
    packages: [{
      title: 'Angular',
      url: 'https://angular.io/',
      target: '_blank'
    }]
  }, {
    name: '@dereekb/firebase',
    description: 'Set of firebase utilities for the firebase for the web.',
    packages: [{
      title: 'firebase',
      url: 'https://firebase.google.com/',
      target: '_blank'
    }]
  }, {
    name: '@dereekb/date',
    description: 'Set of date utilities, including RRule expansion and date formatting.',
    packages: [{
      title: 'rrule',
      url: 'https://github.com/jakubroztocil/rrule',
      target: '_blank'
    }, {
      title: 'date-fns',
      url: 'https://date-fns.org/',
      target: '_blank'
    }]
  }, {
    name: '@dereekb/rxjs',
    description: 'Set of rxjs utilities, including loading states and iterators.',
    packages: [{
      title: 'rxjs',
      url: 'https://rxjs.dev/',
      target: '_blank'
    }, {
      title: 'ngrx',
      url: 'https://ngrx.io/',
      target: '_blank'
    }]
  }, {
    name: '@dereekb/util',
    description: 'Set of general utilities, consumed by other @dereekb packages.',
    packages: []
  }, {
    name: '@dereekb/browser',
    description: 'Set of browser related utilities.',
    packages: []
  }];

  readonly otherPackages: ClickableAnchorLink[] = [{
    title: 'Nx',
    url: 'https://nx.dev/',
    target: '_blank'
  }, {
    title: 'Docker',
    url: 'https://www.docker.com/',
    target: '_blank'
  }];

  readonly latestVersion = packageInfo.version;

}
