import { Inject, Injectable, Logger } from '@nestjs/common';
import { type CalcomAccessToken } from '@dereekb/calcom';
import { CalcomOAuthCallbackService, type CalcomOAuthCallbackActor, type CalcomOAuthState } from '@dereekb/calcom/nestjs';
import { UserExternalConnectionServerActions, type UserExternalConnectionCredentials } from '@dereekb/firebase-server/model';
import { type FirebaseAuthUserId } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { DEMO_CALCOM_EXTERNAL_CONNECTION_PROVIDER_TYPE } from 'demo-firebase';
import { type DemoCalcomOAuthStateCoder } from './calcom.state';
import { DemoApiCalcomOAuthStateCoder } from './calcom.config';

/**
 * Maps an exchanged Cal.com token to the credentials stored on the private connection document.
 *
 * The `refreshToken` written here is the rotated one from the exchange — Cal.com invalidates the
 * token each use, so persisting the one we sent would break the next refresh.
 *
 * @param accessToken - The exchanged Cal.com access token.
 * @returns The credentials to store.
 */
export function demoCalcomUserExternalConnectionCredentials(accessToken: CalcomAccessToken): UserExternalConnectionCredentials {
  const { accessToken: token, refreshToken, expiresAt, scope } = accessToken;
  const scopes = scope ? scope.split(' ').filter((x) => x.length > 0) : undefined;

  return {
    accessToken: token,
    refreshToken,
    tokenType: 'Bearer',
    issuedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    scopes
  };
}

/**
 * Supplies the demo app's half of the Cal.com authorization-code handoff: who is connecting, and
 * where the resulting credentials go.
 */
@Injectable()
export class DemoApiCalcomOAuthService {
  private readonly logger = new Logger('DemoApiCalcomOAuthService');

  constructor(
    @Inject(CalcomOAuthCallbackService) readonly calcomOAuthCallbackService: CalcomOAuthCallbackService,
    @Inject(UserExternalConnectionServerActions) readonly userExternalConnectionActions: UserExternalConnectionServerActions,
    @Inject(DemoApiCalcomOAuthStateCoder) readonly stateCoder: DemoCalcomOAuthStateCoder
  ) {
    calcomOAuthCallbackService.configure({
      verifyCallbackState: async (state) => this.verifyState(state),
      onConnected: async ({ actor, accessToken }) => {
        await this.userExternalConnectionActions.connectUserExternalConnection({
          uid: actor.uid,
          providerType: DEMO_CALCOM_EXTERNAL_CONNECTION_PROVIDER_TYPE,
          credentials: demoCalcomUserExternalConnectionCredentials(accessToken)
        });

        this.logger.log(`Connected Cal.com for uid "${actor.uid}".`);
      },
      onFailure: async ({ actor, error }) => {
        const forUid = actor ? ` for uid "${actor.uid}"` : '';
        this.logger.warn(`Failed connecting Cal.com${forUid}: `, error);

        if (actor != null) {
          await this.userExternalConnectionActions.markUserExternalConnectionError({
            uid: actor.uid,
            providerType: DEMO_CALCOM_EXTERNAL_CONNECTION_PROVIDER_TYPE,
            error: 'provider_error'
          });
        }
      }
    });
  }

  /**
   * Mints the state a client navigates to the authorize endpoint with.
   *
   * @param uid - The signed-in user beginning the handoff.
   * @returns The minted state.
   */
  mintState(uid: FirebaseAuthUserId): CalcomOAuthState {
    return this.stateCoder.mintState(uid);
  }

  /**
   * Resolves the user a returned state belongs to.
   *
   * @param state - The state Cal.com echoed back.
   * @returns The acting user, or null when the state is invalid or expired.
   */
  verifyState(state: Maybe<CalcomOAuthState>): Maybe<CalcomOAuthCallbackActor> {
    return this.stateCoder.verifyState(state);
  }
}
