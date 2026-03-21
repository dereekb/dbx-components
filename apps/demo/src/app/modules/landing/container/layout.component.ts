import { type ClickableAnchorLink, DbxAppContextStateDirective } from '@dereekb/dbx-core';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import packageInfo from '../../../../../../../package.json';
import { DbxSpacerDirective, DbxContentContainerDirective, DbxAnchorComponent, DbxButtonSpacerDirective, DbxAnchorContentComponent, DbxColorDirective } from '@dereekb/dbx-web';
import { FlexModule } from '@ngbracket/ngx-layout/flex';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';

export interface LandingItem {
  readonly name: string;
  readonly description: string;
  readonly packages: ClickableAnchorLink[];
  readonly children?: LandingItemChild[];
}

export interface LandingItemChild {
  readonly name: string;
  readonly description: string;
}

@Component({
  templateUrl: './layout.component.html',
  styleUrls: ['../landing.scss'],
  standalone: true,
  imports: [DbxAppContextStateDirective, FlexModule, DbxSpacerDirective, DbxContentContainerDirective, DbxAnchorComponent, MatButton, DbxButtonSpacerDirective, MatDivider, DbxAnchorContentComponent, DbxColorDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
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

  readonly circleciAnchor: ClickableAnchorLink = {
    title: 'CircleCI',
    url: 'https://circleci.com/gh/dereekb/dbx-components/tree/main'
  };

  readonly packages: LandingItem[] = [
    {
      name: '@dereekb/dbx-form',
      description: 'Forms extension for @dereekb/dbx-web to make composing and consuming forms easy.',
      packages: [
        {
          title: '@ngx-formly/schematics',
          url: 'https://formly.dev/',
          target: '_blank'
        }
      ],
      children: [
        {
          name: '@dereekb/dbx-form/calendar',
          description: 'Calendar date input components'
        },
        {
          name: '@dereekb/dbx-form/mapbox',
          description: 'Mapbox geolocation input components'
        },
        {
          name: '@dereekb/dbx-form/quiz',
          description: 'Quiz and assessment components'
        }
      ]
    },
    {
      name: '@dereekb/dbx-web',
      description: 'Full set of components for Angular in the browser. Built on top of @angular/material.',
      packages: [
        {
          title: '@angular/material',
          url: 'https://material.angular.io/',
          target: '_blank'
        },
        {
          title: 'ngx-mapbox-gl',
          url: 'https://github.com/Wykks/ngx-mapbox-gl',
          target: '_blank'
        }
      ],
      children: [
        {
          name: '@dereekb/dbx-web/mapbox',
          description: 'Mapbox integration'
        },
        {
          name: '@dereekb/dbx-web/calendar',
          description: 'Calendar components built on angular-calendar'
        },
        {
          name: '@dereekb/dbx-web/table',
          description: 'Data table components'
        }
      ]
    },
    {
      name: '@dereekb/dbx-analytics',
      description: 'Angular integration for analytics providers with reactive streaming and component-level analytics events.',
      packages: [
        {
          title: 'Segment',
          url: 'https://segment.com/',
          target: '_blank'
        }
      ]
    },
    {
      name: '@dereekb/dbx-firebase',
      description: 'Angular + Firebase integration with reactive components for Firestore, auth, and storage.',
      packages: [
        {
          title: 'firebase',
          url: 'https://firebase.google.com/',
          target: '_blank'
        }
      ],
      children: [
        {
          name: '@dereekb/dbx-firebase/oidc',
          description: 'OIDC authentication provider integration'
        }
      ]
    },
    {
      name: '@dereekb/dbx-core',
      description: 'Set of directives and utilities for any Angular project.',
      packages: [
        {
          title: 'Angular',
          url: 'https://angular.dev/',
          target: '_blank'
        }
      ]
    },
    {
      name: '@dereekb/firebase-server',
      description: 'Extension of @dereekb/firebase for firebase server projects. Provides patterns and tooling for using NestJS in Firebase.',
      packages: [
        {
          title: 'firebase',
          url: 'https://firebase.google.com/',
          target: '_blank'
        },
        {
          title: 'nestjs',
          url: 'https://nestjs.com/',
          target: '_blank'
        }
      ],
      children: [
        {
          name: '@dereekb/firebase-server/model',
          description: 'Data model utilities for Firebase Functions'
        },
        {
          name: '@dereekb/firebase-server/mailgun',
          description: 'Mailgun email integration'
        },
        {
          name: '@dereekb/firebase-server/oidc',
          description: 'OIDC provider implementation'
        },
        {
          name: '@dereekb/firebase-server/zoho',
          description: 'Zoho CRM integration'
        },
        {
          name: '@dereekb/firebase-server/test',
          description: 'Firebase emulator testing utilities'
        }
      ]
    },
    {
      name: '@dereekb/firebase',
      description: 'Set of firebase patterns and utilities for the web.',
      packages: [
        {
          title: 'firebase',
          url: 'https://firebase.google.com/',
          target: '_blank'
        }
      ]
    },
    {
      name: '@dereekb/nestjs',
      description: 'Set of NestJS utilities and modules, primarily webhooks and external API support.',
      packages: [
        {
          title: 'nestjs',
          url: 'https://nestjs.com/',
          target: '_blank'
        },
        {
          title: 'mailgun.js',
          url: 'https://github.com/mailgun/mailgun.js',
          target: '_blank'
        },
        {
          title: 'stripe-node',
          url: 'https://github.com/stripe/stripe-node',
          target: '_blank'
        }
      ],
      children: [
        {
          name: '@dereekb/nestjs/stripe',
          description: 'Stripe webhooks'
        },
        {
          name: '@dereekb/nestjs/mailgun',
          description: 'Mailgun API'
        },
        {
          name: '@dereekb/nestjs/openai',
          description: 'OpenAI API integration'
        },
        {
          name: '@dereekb/nestjs/vapiai',
          description: 'Vapi AI voice integration'
        },
        {
          name: '@dereekb/nestjs/typeform',
          description: 'Typeform form submission handling'
        },
        {
          name: '@dereekb/nestjs/discord',
          description: 'Discord bot and webhook support'
        }
      ]
    },
    {
      name: '@dereekb/analytics',
      description: 'Analytics event system with Segment integration for backend analytics tracking.',
      packages: [
        {
          title: 'Segment',
          url: 'https://segment.com/',
          target: '_blank'
        }
      ],
      children: [
        {
          name: '@dereekb/analytics/nestjs',
          description: 'NestJS analytics module'
        }
      ]
    },
    {
      name: '@dereekb/zoho',
      description: 'Zoho CRM, Recruit, Accounts, and Sign integrations with full REST API support.',
      packages: [
        {
          title: 'Zoho',
          url: 'https://www.zoho.com/',
          target: '_blank'
        }
      ],
      children: [
        {
          name: '@dereekb/zoho/nestjs',
          description: 'NestJS Zoho module'
        }
      ]
    },
    {
      name: '@dereekb/zoom',
      description: 'Zoom OAuth and API integration for video conferencing and user management.',
      packages: [
        {
          title: 'Zoom',
          url: 'https://developers.zoom.us/',
          target: '_blank'
        }
      ],
      children: [
        {
          name: '@dereekb/zoom/nestjs',
          description: 'NestJS Zoom module'
        }
      ]
    },
    {
      name: '@dereekb/calcom',
      description: 'Cal.com integration providing OAuth and API access to calendar scheduling.',
      packages: [
        {
          title: 'Cal.com',
          url: 'https://cal.com/',
          target: '_blank'
        }
      ],
      children: [
        {
          name: '@dereekb/calcom/nestjs',
          description: 'NestJS Cal.com module'
        }
      ]
    },
    {
      name: '@dereekb/date',
      description: 'Set of date utilities, including RRule expansion and date formatting.',
      packages: [
        {
          title: 'rrule',
          url: 'https://github.com/jakubroztocil/rrule',
          target: '_blank'
        },
        {
          title: 'date-fns',
          url: 'https://date-fns.org/',
          target: '_blank'
        }
      ]
    },
    {
      name: '@dereekb/rxjs',
      description: 'Set of rxjs utilities, including filters, loading states, rxjs operators, and async iterators.',
      packages: [
        {
          title: 'rxjs',
          url: 'https://rxjs.dev/',
          target: '_blank'
        },
        {
          title: 'ngrx',
          url: 'https://ngrx.io/',
          target: '_blank'
        }
      ]
    },
    {
      name: '@dereekb/model',
      description: 'Utilities for dealing with models, data transformation, and runtime validation using ArkType.',
      packages: [
        {
          title: 'arktype',
          url: 'https://arktype.io',
          target: '_blank'
        }
      ]
    },
    {
      name: '@dereekb/util',
      description: 'Set of general utilities, data models and patterns that are consumed by other @dereekb packages.',
      packages: [],
      children: [
        {
          name: '@dereekb/util/fetch',
          description: 'HTTP fetch utilities with error handling and pagination'
        },
        {
          name: '@dereekb/util/test',
          description: 'Testing utilities and assertions'
        }
      ]
    },
    {
      name: '@dereekb/vitest',
      description: 'Vitest testing utilities with custom date matchers.',
      packages: [
        {
          title: 'vitest',
          url: 'https://vitest.dev/',
          target: '_blank'
        }
      ]
    },
    {
      name: '@dereekb/browser',
      description: 'Set of browser related utilities.',
      packages: []
    }
  ];

  readonly otherPackages: ClickableAnchorLink[] = [
    {
      title: 'Nx',
      url: 'https://nx.dev/',
      target: '_blank'
    },
    {
      title: 'Docker',
      url: 'https://www.docker.com/',
      target: '_blank'
    },
    {
      title: 'CircleCI',
      url: 'https://circleci.com/',
      target: '_blank'
    }
  ];

  readonly latestVersion = packageInfo.version;
}
