import { type ModuleMetadata } from '@nestjs/common';
import { type ClassType } from '@dereekb/util';
import { SessionApiController } from './session.api.controller';
import { FirestoreSessionApiService } from './session.api.service';

// MARK: Config
/**
 * Configuration for {@link sessionApiModuleMetadata}.
 */
export interface SessionApiModuleMetadataConfig extends Pick<ModuleMetadata, 'imports' | 'exports' | 'providers'> {
  /**
   * Module that exports the session endpoint's dependencies.
   *
   * Should provide:
   * - `FIRESTORE_SESSION_ADMIN_PREDICATE` — the app's admin check. Without it the endpoint rejects
   *   EVERY caller (fail-closed), and logs a warning at boot.
   * - {@link SessionApiModuleConfig} — the registered web app's `appId` to mint App Check tokens for,
   *   plus optional TTL / scope overrides. Without it sessions carry no App Check attestation.
   *
   * `FIREBASE_APP_TOKEN` is not listed because `nestServerInstance` provides it globally.
   */
  readonly dependencyModule: ClassType;
}

// MARK: Module Metadata
/**
 * Generates NestJS module metadata for the direct-Firestore session API.
 *
 * Mirrors the convention used by `modelApiModuleMetadata` and `mcpModuleMetadata`: the consumer
 * provides a dependency module exposing the required tokens, and this factory wires the controller +
 * service.
 *
 * Remember to add `FIREBASE_SERVER_SESSION_API_PROTECTED_PATH` (`'/api/session'`) to the OIDC module's
 * `protectedPaths` — the controller relies on the bearer middleware having populated `req.auth`.
 *
 * @param metadataConfig - Configuration including the dependency module.
 * @returns NestJS module metadata exposing the session controller + service.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [DemoApiAuthModule],
 *   providers: [
 *     { provide: SessionApiModuleConfig, useValue: { appCheckAppId: environment.firebase.appId } },
 *     { provide: FIRESTORE_SESSION_ADMIN_PREDICATE, useValue: (auth) => DEMO_AUTH_CLAIMS_SERVICE.toRoles(auth?.token ?? {}).has('admin') }
 *   ],
 *   exports: [SessionApiModuleConfig, FIRESTORE_SESSION_ADMIN_PREDICATE]
 * })
 * export class DemoSessionApiDependencyModule {}
 *
 * @Module(sessionApiModuleMetadata({ dependencyModule: DemoSessionApiDependencyModule }))
 * export class DemoSessionApiModule {}
 * ```
 */
export function sessionApiModuleMetadata(metadataConfig: SessionApiModuleMetadataConfig): ModuleMetadata {
  const { dependencyModule, imports, exports, providers } = metadataConfig;

  return {
    imports: [dependencyModule, ...(imports ?? [])],
    controllers: [SessionApiController],
    exports: [FirestoreSessionApiService, ...(exports ?? [])],
    providers: [FirestoreSessionApiService, ...(providers ?? [])]
  };
}
