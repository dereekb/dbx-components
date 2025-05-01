import { Component, Directive, Input, OnInit, inject, signal, computed, ChangeDetectionStrategy, model } from '@angular/core';
import { WorkUsingContext } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '../service/firebase.auth.service';
import { FirebaseLoginMethodType } from './login';
import { DbxFirebaseAuthLoginService } from './login.service';
import { DbxFirebaseLoginContext } from './login.context';
import { MatIconModule } from '@angular/material/icon';
import { DbxActionModule, DbxButtonModule } from '@dereekb/dbx-web';
import { Maybe } from '@dereekb/util';

export interface DbxFirebaseLoginButtonConfig {
  text: string;
  iconUrl?: string;
  icon?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  handleLogin: () => Promise<unknown>;
}

/**
 * Login button and action.
 */
@Component({
  selector: 'dbx-firebase-login-button',
  template: `
    <ng-container dbxAction [dbxActionHandler]="handleAction" dbxActionValue [dbxActionSuccessHandler]="onActionSuccess">
      <dbx-button dbxActionButton [customTextColor]="buttonTextColorSignal()" [customButtonColor]="buttonColorSignal()" [raised]="true">
        <div class="dbx-firebase-login-button-content">
          <span class="dbx-firebase-login-button-icon dbx-icon-spacer">
            @if (iconUrlSignal()) {
              <img [src]="iconUrlSignal()" />
            }
            @if (iconSignal()) {
              <mat-icon>{{ iconSignal() }}</mat-icon>
            }
          </span>
          <span class="dbx-firebase-login-button-text">{{ textSignal() }}</span>
        </div>
      </dbx-button>
    </ng-container>
  `,
  host: {
    class: 'dbx-firebase-login-button'
  },
  standalone: true,
  imports: [MatIconModule, DbxActionModule, DbxButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseLoginButtonComponent {
  readonly config = model<Maybe<DbxFirebaseLoginButtonConfig>>(null);

  readonly iconUrlSignal = computed(() => this.config()?.iconUrl);
  readonly iconSignal = computed(() => this.config()?.icon);
  readonly textSignal = computed(() => this.config()?.text ?? '');
  readonly buttonColorSignal = computed(() => this.config()?.buttonColor ?? 'transparent');
  readonly buttonTextColorSignal = computed(() => this.config()?.buttonTextColor);

  setConfig(config: Maybe<DbxFirebaseLoginButtonConfig>) {
    this.config.set(config);
  }

  readonly handleAction: WorkUsingContext = (_, context) => {
    const config = this.config();

    if (config != null) {
      const loginPromise = config.handleLogin();
      context.startWorkingWithPromise(loginPromise);
    } else {
      context.reject();
    }
  };

  onActionSuccess = () => {
    // todo: show checkmark on success?
  };
}

@Component({
  selector: 'dbx-firebase-login-button-container',
  template: `
    <div class="dbx-firebase-login-button-container">
      <ng-content></ng-content>
    </div>
  `,
  standalone: true
})
export class DbxFirebaseLoginButtonContainerComponent {}

export const DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE = `
  <dbx-firebase-login-button-container>
    <dbx-firebase-login-button [config]="configSignal()"></dbx-firebase-login-button>
  </dbx-firebase-login-button-container>
`;

export const DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_CONFIGURATION: Pick<Component, 'template' | 'imports' | 'changeDetection'> = {
  template: DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE,
  imports: [DbxFirebaseLoginButtonComponent, DbxFirebaseLoginButtonContainerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
};

@Directive()
export abstract class AbstractConfiguredDbxFirebaseLoginButtonDirective implements OnInit {
  abstract readonly loginProvider: FirebaseLoginMethodType;

  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly dbxFirebaseAuthLoginService = inject(DbxFirebaseAuthLoginService);
  readonly dbxFirebaseLoginContext = inject(DbxFirebaseLoginContext);

  // TODO: Consider updating these signals, etc.

  private readonly _config = signal<DbxFirebaseLoginButtonConfig | null>(null);
  readonly configSignal = computed(() => this._config());

  ngOnInit(): void {
    const assets = this.assetConfig;

    this._config.set({
      text: assets.loginText ?? `<loginText not configured>`,
      icon: assets.loginIcon,
      iconUrl: assets.logoUrl,
      buttonColor: assets.backgroundColor,
      buttonTextColor: assets.textColor,
      handleLogin: () => this.handleLogin()
    });
  }

  abstract handleLogin(): Promise<unknown>;

  get providerConfig() {
    return this.dbxFirebaseAuthLoginService.getLoginProvider(this.loginProvider);
  }

  get assetConfig() {
    return this.dbxFirebaseAuthLoginService.getProviderAssets(this.loginProvider) ?? {};
  }

  get config() {
    return this._config() as DbxFirebaseLoginButtonConfig;
  }
}
