import mapboxgl from 'mapbox-gl';
import { type Maybe } from '@dereekb/util';

/**
 * Relative url the mapbox-gl CSP web worker asset is expected to be served from.
 *
 * The asset itself is copied out of `node_modules/mapbox-gl/dist/mapbox-gl-csp-worker.js`
 * by the consuming app's build configuration, which keeps it in version lockstep with the
 * `mapbox-gl` the app actually bundles.
 */
export const DEFAULT_DBX_MAPBOX_WORKER_URL = 'assets/mapbox-gl/mapbox-gl-csp-worker.js';

/**
 * Configuration for {@link configureDbxMapboxWorker}.
 */
export interface DbxMapboxWorkerConfig {
  /**
   * Whether or not to load mapbox-gl's web worker from a self-hosted asset instead of the
   * default blob url.
   *
   * True by default. Set to false only to restore mapbox-gl's stock blob worker, which is
   * broken in Angular/esbuild apps on mapbox-gl 3.26.0 and up.
   */
  readonly enabled?: Maybe<boolean>;
  /**
   * Url the mapbox-gl CSP web worker asset is served from.
   *
   * Defaults to {@link DEFAULT_DBX_MAPBOX_WORKER_URL}.
   */
  readonly workerUrl?: Maybe<string>;
}

/**
 * Result of {@link configureDbxMapboxWorker}.
 */
export interface DbxMapboxWorkerConfigurationResult {
  /**
   * Whether or not the self-hosted worker was configured on mapbox-gl.
   */
  readonly configured: boolean;
  /**
   * Url that was configured, if any.
   */
  readonly workerUrl: Maybe<string>;
  /**
   * Whether or not the configured worker asset could be retrieved.
   *
   * Null when no check was performed.
   */
  readonly available: Maybe<boolean>;
}

/**
 * Checks whether the mapbox-gl web worker asset is actually served from the given url.
 *
 * @param workerUrl - Url the worker asset is expected at.
 * @returns True when the asset responds successfully.
 */
export async function isDbxMapboxWorkerAssetAvailable(workerUrl: string): Promise<boolean> {
  let available: boolean;

  try {
    const response = await fetch(workerUrl, { method: 'HEAD' });
    available = response.ok;
  } catch {
    available = false;
  }

  return available;
}

/**
 * Configures mapbox-gl to load its web worker from a self-hosted copy of mapbox's prebuilt
 * CSP worker rather than from the blob url it generates itself.
 *
 * mapbox-gl's default worker is built by stringifying two of its own functions into a blob.
 * Only those function bodies are serialized, so any helper the bundler hoists to module
 * scope is missing at runtime. `@angular/build` unconditionally disables esbuild's
 * `object-rest-spread` support, which rewrites every object spread in mapbox-gl 3.26.0+ into
 * exactly such a hoisted helper, and the worker then dies with a `ReferenceError` while
 * loading tiles. Pointing `workerUrl` at a real file — mapbox's own documented CSP escape
 * hatch — sidesteps the bug entirely, at any mapbox-gl version.
 *
 * Must be applied before the first `Map` is constructed.
 *
 * @param inputConfig - Configuration. Optional.
 * @returns The applied configuration.
 */
export async function configureDbxMapboxWorker(inputConfig?: Maybe<DbxMapboxWorkerConfig>): Promise<DbxMapboxWorkerConfigurationResult> {
  const config = inputConfig ?? {};
  let result: DbxMapboxWorkerConfigurationResult;

  if (config.enabled === false || typeof window === 'undefined') {
    result = { configured: false, workerUrl: null, available: null };
  } else {
    const workerUrl = config.workerUrl || DEFAULT_DBX_MAPBOX_WORKER_URL;

    mapboxgl.workerUrl = workerUrl;

    const available = await isDbxMapboxWorkerAssetAvailable(workerUrl);

    if (!available) {
      console.error(
        `dbx-web/mapbox: the mapbox-gl web worker asset was not found at "${workerUrl}", so the map will fail to load tiles. Copy it into your app's assets by adding this entry to the build target's "assets" in project.json: { "input": "node_modules/mapbox-gl/dist", "glob": "mapbox-gl-csp-worker.js", "output": "assets/mapbox-gl" }`
      );
    }

    result = { configured: true, workerUrl, available };
  }

  return result;
}
