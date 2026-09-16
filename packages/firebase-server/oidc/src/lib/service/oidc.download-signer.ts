import { type DownloadTokenSignInput, type DownloadTokenSignResult, type DownloadTokenSigner, type DownloadTokenVerifyInput } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';
import { type OidcJwtSigningService } from './oidc.jwt-signing.service';

/**
 * Adapts {@link OidcJwtSigningService} to the `@dereekb/firebase-server` {@link DownloadTokenSigner}
 * interface, so the signed asset-download endpoint can use the OIDC provider's own JWKS without
 * `@dereekb/firebase-server` taking a dependency on this package.
 *
 * Using the provider's JWKS is the point: it is already shared across function instances and already
 * rotates, so a download capability token needs no new secret to distribute. The `typ` + `aud`
 * discriminators the download module passes in are what keep such a token from ever being accepted
 * as an OAuth access token (and vice versa) even though both are signed by the same keys.
 *
 * @param signingService - The provider's JWT signing service.
 * @returns A signer to register under the `DOWNLOAD_TOKEN_SIGNER` injection token.
 * @__NO_SIDE_EFFECTS__
 */
export function oidcDownloadTokenSigner(signingService: OidcJwtSigningService): DownloadTokenSigner {
  return {
    async signToken(input: DownloadTokenSignInput): Promise<DownloadTokenSignResult> {
      const signed = await signingService.signJwt({
        audience: input.audience,
        subject: input.subject,
        typ: input.typ,
        expiresIn: input.expiresIn,
        claims: input.claims
      });

      return { token: signed.token, expiresAt: signed.expiresAt };
    },
    async verifyToken(input: DownloadTokenVerifyInput): Promise<Maybe<Record<string, unknown>>> {
      const payload = await signingService.verifyJwt({ token: input.token, audience: input.audience, typ: input.typ });
      return payload == null ? undefined : (payload as Record<string, unknown>);
    }
  };
}
