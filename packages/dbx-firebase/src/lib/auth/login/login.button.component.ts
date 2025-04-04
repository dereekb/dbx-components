import { Component, Directive, Input, OnInit, inject, signal, computed, ChangeDetectionStrategy } from '@angular/core';
import { WorkUsingContext } from '@dereekb/rxjs';
import { DbxFirebaseAuthService } from '../service/firebase.auth.service';
import { FirebaseLoginMethodType } from './login';
import { DbxFirebaseAuthLoginService } from './login.service';
import { DbxFirebaseLoginContext } from './login.context';
import { MatIcon } from '@angular/material/icon';
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
  imports: [MatIcon, DbxActionModule, DbxButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxFirebaseLoginButtonComponent {
  private readonly _config = signal<Maybe<DbxFirebaseLoginButtonConfig>>(null);

  readonly iconUrlSignal = computed(() => this._config()?.iconUrl);
  readonly iconSignal = computed(() => this._config()?.icon);
  readonly textSignal = computed(() => this._config()?.text ?? '');
  readonly buttonColorSignal = computed(() => this._config()?.buttonColor ?? 'transparent');
  readonly buttonTextColorSignal = computed(() => this._config()?.buttonTextColor);

  @Input()
  set config(config: Maybe<DbxFirebaseLoginButtonConfig>) {
    this._config.set(config);
  }

  get config(): Maybe<DbxFirebaseLoginButtonConfig> {
    return this._config();
  }

  readonly handleAction: WorkUsingContext = (_, context) => {
    if (this.config != null) {
      const loginPromise = this.config?.handleLogin();
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

export const DBX_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_COMPONENT_TEMPLATE: Pick<Component, 'template' | 'imports' | 'changeDetection'> = {
  imports: [DbxFirebaseLoginButtonComponent, DbxFirebaseLoginButtonContainerComponent],
  template: DEFAULT_CONFIGURED_DBX_FIREBASE_LOGIN_BUTTON_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush
};

@Directive()
export abstract class AbstractConfiguredDbxFirebaseLoginButtonDirective implements OnInit {
  readonly dbxFirebaseAuthService = inject(DbxFirebaseAuthService);
  readonly dbxFirebaseAuthLoginService = inject(DbxFirebaseAuthLoginService);
  readonly dbxFirebaseLoginContext = inject(DbxFirebaseLoginContext);

  private readonly _config = signal<DbxFirebaseLoginButtonConfig | null>(null);
  readonly configSignal = computed(() => this._config());

  abstract readonly loginProvider: FirebaseLoginMethodType;

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
