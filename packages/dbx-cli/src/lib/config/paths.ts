import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Path configuration for a CLI's on-disk config and token cache files.
 */
export interface CliPaths {
  readonly configDir: string;
  readonly configFilePath: string;
  readonly tokenCachePath: string;
}

export interface CliPathsConfig {
  /**
   * The CLI name. Used as the directory suffix (e.g. `demo-cli` → `~/.demo-cli`).
   */
  readonly cliName: string;
  /**
   * Optional override for the config directory. When set, this is used verbatim instead of `~/.<cliName>`.
   *
   * Useful for tests that want to point at a temp dir.
   */
  readonly configDirOverride?: string;
}

/**
 * Builds the on-disk path layout for a CLI's config directory.
 *
 * Layout:
 *   - `<configDir>/config.json` — the persistent CLI config (envs, output settings)
 *   - `<configDir>/.tokens.json` — per-env access/refresh token cache (mode 0600)
 */
export function buildCliPaths(config: CliPathsConfig): CliPaths {
  const configDir = config.configDirOverride ?? join(homedir(), `.${config.cliName}`);

  return {
    configDir,
    configFilePath: join(configDir, 'config.json'),
    tokenCachePath: join(configDir, '.tokens.json')
  };
}
