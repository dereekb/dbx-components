import { ChangeDetectionStrategy, Component } from '@angular/core';
import { type ClickableAnchorLinkTree } from '@dereekb/dbx-core';
import { DbxContentContainerDirective, DbxSidenavComponent, DbxSidenavButtonComponent, DbxPagebarComponent, DbxColorDirective, DbxAnchorListComponent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  templateUrl: './sidenav.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxSidenavComponent, DbxSidenavButtonComponent, DbxPagebarComponent, MatButtonModule, MatIconModule, DbxColorDirective, DbxAnchorListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .dbx-sidenav-demo-container {
        height: 300px;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: var(--mat-sys-corner-extra-small);
        overflow: hidden;
        position: relative;
      }

      .dbx-sidenav-demo-header {
        padding: var(--dbx-padding-3) 16px;
        margin: 0;
      }

      .dbx-sidenav-demo-page {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      .dbx-sidenav-demo-page-content {
        flex: 1;
        overflow: auto;
      }

      .dbx-sidenav-demo-user-button {
        display: flex;
        align-items: center;
        gap: 10px;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 24px;
        color: inherit;
      }

      .dbx-sidenav-demo-user-button:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .dbx-sidenav-demo-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
      }

      .dbx-sidenav-demo-user-info {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        line-height: 1.2;
      }

      .dbx-sidenav-demo-user-name {
        font-size: 13px;
        font-weight: 500;
      }

      .dbx-sidenav-demo-user-role {
        font-size: 11px;
        opacity: 0.7;
      }

      .dbx-sidenav-demo-drawer-header {
        display: flex;
        align-items: center;
        gap: var(--dbx-padding-3);
        padding: 20px 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      }

      .dbx-sidenav-demo-drawer-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        object-fit: cover;
      }

      .dbx-sidenav-demo-drawer-user-info {
        display: flex;
        flex-direction: column;
        line-height: 1.3;
      }

      .dbx-sidenav-demo-drawer-user-name {
        font-size: 14px;
        font-weight: 500;
      }

      .dbx-sidenav-demo-drawer-user-email {
        font-size: 12px;
        opacity: 0.7;
      }
    `
  ]
})
export class DocRouterSidenavComponent {
  readonly exampleAnchors: ClickableAnchorLinkTree[] = [
    {
      icon: 'home',
      title: 'Home',
      ref: 'doc.router.sidenav'
    },
    {
      icon: 'settings',
      title: 'Settings',
      ref: 'doc.router.sidenav'
    },
    {
      icon: 'person',
      title: 'Profile',
      ref: 'doc.router.sidenav'
    }
  ];

  // Reproduces how the hellosubs sidenav is assembled from differently-created elements. The `[anchors]`
  // input mixes top-level root items (Pay Stubs, Clients) with a parent item (My Work) whose children
  // (Job Requests, Timesheets, Requirements) are rendered as nested `dbx-anchor-list-child` rows. By
  // default those nested rows pick up a subtle depth-shade background from `_anchorlist.scss`, so a child
  // (Timesheets) presents differently from a root (Pay Stubs). The `dbx-sidenav-flat` example below opts
  // into the unifying treatment so every row reads like the clean root style.
  readonly mixedAnchors: ClickableAnchorLinkTree[] = [
    {
      icon: 'payments',
      title: 'Pay Stubs',
      ref: 'doc.router.sidenav'
    },
    {
      icon: 'dashboard',
      title: 'My Work',
      ref: 'doc.router.sidenav',
      children: [
        {
          icon: 'work_outline',
          title: 'Job Requests',
          ref: 'doc.router.sidenav'
        },
        {
          icon: 'pending_actions',
          title: 'Timesheets',
          ref: 'doc.router.sidenav'
        },
        {
          icon: 'rule',
          title: 'Requirements',
          ref: 'doc.router.sidenav'
        }
      ]
    },
    {
      icon: 'workspaces',
      title: 'Clients',
      ref: 'doc.router.sidenav'
    }
  ];

  // The third element-creation method: a separate `<dbx-anchor-list>` placed in the sidenav's `[bottom]`
  // content slot (Admin / Settings / Logout in hellosubs), independent of the `[anchors]` input above.
  readonly bottomAnchors: ClickableAnchorLinkTree[] = [
    {
      icon: 'admin_panel_settings',
      title: 'Admin',
      ref: 'doc.router.sidenav'
    },
    {
      icon: 'settings',
      title: 'Settings',
      ref: 'doc.router.sidenav'
    },
    {
      icon: 'logout',
      title: 'Logout',
      ref: 'doc.router.sidenav'
    }
  ];
}
