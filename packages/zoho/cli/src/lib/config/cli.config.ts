import { filterUndefinedValues, type Maybe } from '@dereekb/util';
import { CLI_CONFIG_FILE_MODE, type CliCommandOutputConfig, type CliOutputConfig, mergeOutputConfig as dbxMergeOutputConfig } from '@dereekb/dbx-cli';
import { readJsonFile, removeFile, writeJsonFile } from '@dereekb/nestjs';
import { type ZohoAccountsApiUrlKey, type ZohoProduct } from '@dereekb/zoho';
import { join } from 'node:path';
import { homedir } from 'node:os';

/**
 * A Zoho product the CLI has commands for (the {@link ZohoProduct}s of `@dereekb/zoho`).
 */
export type ZohoCliProduct = ZohoProduct;

export const ZOHO_CLI_PRODUCTS: ZohoCliProduct[] = ['recruit', 'crm', 'desk', 'sign', 'analytics'];

/**
 * Products that use a dedicated OAuth client and therefore must be configured with their own
 * credentials — they never fall back to the {@link ZohoCliConfig.shared} client. Zoho Sign is
 * authorized under a separate `client_id` (its scopes cannot be granted alongside recruit/crm/desk),
 * so a shared-credential fallback would produce a client that lacks Sign access.
 */
export const ZOHO_CLI_DEDICATED_CLIENT_PRODUCTS: ReadonlySet<ZohoCliProduct> = new Set<ZohoCliProduct>(['sign', 'analytics']);

/**
 * Products whose API calls are scoped by an organization id, and for which `auth setup --org-id`
 * therefore has to be persisted. Desk requires one for every request; Analytics requires one for
 * every request except `GET /orgs`, which is how the id is discovered in the first place.
 */
export const ZOHO_CLI_ORG_ID_PRODUCTS: ReadonlySet<ZohoCliProduct> = new Set<ZohoCliProduct>(['desk', 'analytics']);

/**
 * Credentials for a single OAuth client.
 */
export interface ZohoCliCredentials {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly refreshToken: string;
}

/**
 * Per-product configuration.
 */
export interface ZohoCliProductConfig extends Partial<ZohoCliCredentials> {
  readonly apiUrl?: string;
  readonly orgId?: string;
  /**
   * Accounts datacenter the product's own OAuth client lives in. Falls back to the shared region, so it
   * only needs setting for a dedicated-client product authorized in a different datacenter.
   */
  readonly region?: string;
  /**
   * Redirect URI the product's OAuth client was last authorized with by `auth login`, reused by the next one.
   */
  readonly redirectUri?: string;
}

/**
 * The shared OAuth client block, used by every product without credentials of its own (except
 * {@link ZOHO_CLI_DEDICATED_CLIENT_PRODUCTS}).
 */
export interface ZohoCliSharedConfig extends ZohoCliCredentials {
  readonly region?: string;
  readonly apiMode?: string;
  /**
   * Redirect URI the shared OAuth client was last authorized with by `auth login`, reused by the next one.
   */
  readonly redirectUri?: string;
}

/**
 * Per-command output settings (alias of dbx-cli's {@link CliCommandOutputConfig}).
 */
export type ZohoCliCommandOutputConfig = CliCommandOutputConfig;

/**
 * Output configuration with global defaults and optional per-command overrides
 * (alias of dbx-cli's {@link CliOutputConfig}).
 */
export type ZohoCliOutputConfig = CliOutputConfig;

/**
 * A saved token source: a command that prints a short-lived Zoho access token bundle when run as a
 * dbx-cli credential process (e.g. `demo-cli external-token zoho_admin`).
 *
 * Holds no secret itself. The bundle it prints is captured in-process and never echoed.
 */
export interface ZohoCliTokenSourceConfig {
  /**
   * Shell command to run, e.g. `demo-cli external-token zoho_admin`.
   */
  readonly command: string;
}

/**
 * Full CLI config file structure.
 *
 * Shared credentials are used as fallback when a product doesn't have its own, except for
 * {@link ZOHO_CLI_DEDICATED_CLIENT_PRODUCTS} (e.g. `sign`) which always require their own credentials.
 * Per-product overrides live under `recruit`, `crm`, `desk`, `sign`, `analytics`.
 *
 * `tokenSource` is a separate block: when a token source is active, it overrides the credentials of
 * every product its token's scopes cover, and the credential blocks are left untouched underneath.
 */
export interface ZohoCliConfig {
  readonly shared: ZohoCliSharedConfig;
  readonly recruit?: ZohoCliProductConfig;
  readonly crm?: ZohoCliProductConfig;
  readonly desk?: ZohoCliProductConfig;
  readonly sign?: ZohoCliProductConfig;
  readonly analytics?: ZohoCliProductConfig;
  readonly output?: ZohoCliOutputConfig;
  /**
   * The token source. In a config returned by {@link loadCliConfig} this is the ACTIVE source
   * ({@link ZOHO_CLI_TOKEN_COMMAND_ENV_VAR} over the saved block); in the file it is the saved block.
   */
  readonly tokenSource?: ZohoCliTokenSourceConfig;
}

/**
 * Resolved credentials for a single product — guaranteed to have all required fields.
 */
export interface ZohoCliResolvedProductCredentials extends ZohoCliCredentials {
  readonly region: string;
  readonly apiMode: string;
  readonly apiUrl?: string;
  readonly orgId?: string;
  readonly redirectUri?: string;
}

/**
 * Returns the absolute path to the per-user zoho-cli config directory under the user's home.
 *
 * @returns Absolute filesystem path of the `~/.zoho-cli` directory.
 */
export function getConfigDir(): string {
  return join(homedir(), '.zoho-cli');
}

/**
 * Returns the absolute path to the persisted CLI config JSON file.
 *
 * @returns Absolute filesystem path of `~/.zoho-cli/config.json`.
 */
export function getConfigFilePath(): string {
  return join(getConfigDir(), 'config.json');
}

/**
 * Returns the absolute path to the on-disk OAuth access-token cache used by the CLI.
 *
 * @returns Absolute filesystem path of `~/.zoho-cli/.tokens.json`.
 */
export function getTokenCachePath(): string {
  return join(getConfigDir(), '.tokens.json');
}

/**
 * Reads a config value from environment variables using the NestJS convention:
 * service-specific first (ZOHO_{SERVICE}_{KEY}), then shared fallback (ZOHO_{KEY}).
 *
 * @param key - Suffix portion of the env var name following the `ZOHO_` (or `ZOHO_{SERVICE}_`) prefix.
 * @param servicePrefix - Optional uppercased product prefix (e.g. `RECRUIT`, `CRM`, `DESK`); when provided, the service-specific variable is checked before the shared one.
 * @returns The first matching env var value, or `undefined` when neither is set.
 */
function envVar(key: string, servicePrefix?: string): Maybe<string> {
  const serviceSpecific = servicePrefix ? process.env[`ZOHO_${servicePrefix}_${key}`] : undefined;
  const result: Maybe<string> = serviceSpecific ?? process.env[`ZOHO_${key}`];
  return result;
}

// MARK: Token Source
/**
 * Environment variable that sets the token source command for one run, winning over the saved
 * `tokenSource` block.
 */
export const ZOHO_CLI_TOKEN_COMMAND_ENV_VAR = 'ZOHO_CLI_TOKEN_COMMAND';

/**
 * Where the active token source came from: the {@link ZOHO_CLI_TOKEN_COMMAND_ENV_VAR} override or the saved block.
 */
export type ZohoCliTokenSourceOrigin = 'env' | 'config';

/**
 * The token source in effect for a run, and where it came from.
 */
export interface ZohoCliActiveTokenSource extends ZohoCliTokenSourceConfig {
  readonly origin: ZohoCliTokenSourceOrigin;
}

/**
 * Returns the command set by the {@link ZOHO_CLI_TOKEN_COMMAND_ENV_VAR} override, if any.
 *
 * @returns The trimmed command, or undefined when the variable is unset or blank.
 */
export function zohoCliTokenCommandFromEnv(): Maybe<string> {
  return process.env[ZOHO_CLI_TOKEN_COMMAND_ENV_VAR]?.trim() || undefined;
}

/**
 * Resolves the active token source: the {@link ZOHO_CLI_TOKEN_COMMAND_ENV_VAR} override, else the
 * saved `tokenSource` block — the same "one selected source wins" rule dbx-cli applies to envs.
 *
 * @param fileConfig - The raw config file, from {@link loadCliConfigFile}.
 * @returns The active source with its origin, or undefined when neither is set.
 */
export function resolveZohoCliActiveTokenSource(fileConfig: Maybe<Pick<ZohoCliConfig, 'tokenSource'>>): Maybe<ZohoCliActiveTokenSource> {
  const envCommand = zohoCliTokenCommandFromEnv();
  const savedCommand = fileConfig?.tokenSource?.command?.trim();
  let result: Maybe<ZohoCliActiveTokenSource>;

  if (envCommand) {
    result = { command: envCommand, origin: 'env' };
  } else if (savedCommand) {
    result = { command: savedCommand, origin: 'config' };
  }

  return result;
}

/**
 * What an active token source covers, resolved from the token it produced.
 */
export interface ZohoCliTokenSourceCoverage {
  /**
   * Products the token's scopes cover. These use the token source instead of their own credentials.
   */
  readonly products: readonly ZohoCliProduct[];
  /**
   * Datacenter the token was issued by, which the covered products' API urls are built for.
   */
  readonly datacenter: ZohoAccountsApiUrlKey;
  /**
   * Static, non-secret values the app that minted the token declared for it (e.g. org ids).
   */
  readonly hints?: Maybe<Readonly<Record<string, string>>>;
}

/**
 * The token-source hint that carries each org-scoped product's org id.
 */
export const ZOHO_CLI_TOKEN_SOURCE_ORG_ID_HINTS: Readonly<Partial<Record<ZohoCliProduct, string>>> = {
  desk: 'zohoDeskOrgId',
  analytics: 'zohoAnalyticsOrgId'
};

/**
 * Input for {@link zohoCliProductOrgId}.
 */
export interface ZohoCliProductOrgIdInput {
  readonly config: ZohoCliConfig;
  readonly product: ZohoCliProduct;
  /**
   * The active token source's coverage, when one is active.
   */
  readonly tokenSource?: Maybe<ZohoCliTokenSourceCoverage>;
}

/**
 * Resolves the org id a product's API is created with.
 *
 * Order: the config/env org id, then — only for a product the token source covers — the token
 * source's org id hint ({@link ZOHO_CLI_TOKEN_SOURCE_ORG_ID_HINTS}). Without either, the id has to be
 * supplied on demand (e.g. discovered with `analytics orgs list`).
 *
 * @param input - The loaded config, the product, and the token source coverage.
 * @returns The org id, or undefined when the product is not org-scoped or none is known.
 */
export function zohoCliProductOrgId(input: ZohoCliProductOrgIdInput): Maybe<string> {
  const { config, product, tokenSource } = input;
  let result: Maybe<string>;

  if (ZOHO_CLI_ORG_ID_PRODUCTS.has(product)) {
    const hintKey = ZOHO_CLI_TOKEN_SOURCE_ORG_ID_HINTS[product];
    const hintOrgId = hintKey != null && tokenSource?.products.includes(product) ? tokenSource.hints?.[hintKey] : undefined;
    result = config[product]?.orgId || hintOrgId || undefined;
  }

  return result;
}

/**
 * A credential-carrying block of the config: `shared`, or one of the {@link ZOHO_CLI_PRODUCTS}.
 */
export type ZohoCliCredentialBlockKey = 'shared' | ZohoCliProduct;

/**
 * Every {@link ZohoCliCredentialBlockKey}, shared first.
 */
export const ZOHO_CLI_CREDENTIAL_BLOCK_KEYS: readonly ZohoCliCredentialBlockKey[] = ['shared', ...ZOHO_CLI_PRODUCTS];

/**
 * Where a block's credentials were resolved from by {@link loadCliConfig}.
 *
 * - `config`: the config file holds a refresh token for the block, so it wins over any env vars.
 * - `env`: the file has none, and the block's `ZOHO_*_ACCOUNTS_REFRESH_TOKEN` env var supplied it.
 * - `none`: neither holds a refresh token. A product block in this state may still inherit the shared client.
 */
export type ZohoCliCredentialSource = 'config' | 'env' | 'none';

/**
 * Credentials (and the datacenter they belong to) read for one block from either the file or the env.
 */
interface ZohoCliCredentialBlock extends Partial<ZohoCliCredentials> {
  readonly region?: Maybe<string>;
}

/**
 * Returns the env var prefix of a block's OAuth credentials: `ZOHO_ACCOUNTS_` for shared, and the
 * product-specific `ZOHO_{PRODUCT}_ACCOUNTS_` otherwise.
 *
 * @param block - The credential block.
 * @returns The env var name prefix, ending in `_`.
 */
function zohoCliEnvCredentialPrefix(block: ZohoCliCredentialBlockKey): string {
  return block === 'shared' ? 'ZOHO_ACCOUNTS_' : `ZOHO_${block.toUpperCase()}_ACCOUNTS_`;
}

/**
 * Returns the name of the env var holding a block's refresh token.
 *
 * @param block - The credential block.
 * @returns E.g. `ZOHO_ACCOUNTS_REFRESH_TOKEN` or `ZOHO_SIGN_ACCOUNTS_REFRESH_TOKEN`.
 */
export function zohoCliRefreshTokenEnvVarName(block: ZohoCliCredentialBlockKey): string {
  return `${zohoCliEnvCredentialPrefix(block)}REFRESH_TOKEN`;
}

/**
 * Reads a block's credentials from its own env vars only — a product block never picks up the shared
 * `ZOHO_ACCOUNTS_*` vars here, since the shared fallback is applied later by {@link resolveProductCredentials}.
 *
 * @param block - The credential block.
 * @returns The env-sourced credentials; every field is `undefined` when its var is unset or empty.
 */
function readZohoCliEnvCredentials(block: ZohoCliCredentialBlockKey): ZohoCliCredentialBlock {
  const prefix = zohoCliEnvCredentialPrefix(block);
  const read = (key: string) => process.env[`${prefix}${key}`] || undefined;

  return {
    clientId: read('CLIENT_ID'),
    clientSecret: read('CLIENT_SECRET'),
    refreshToken: read('REFRESH_TOKEN'),
    region: read('URL')
  };
}

/**
 * Decides where a block's credentials come from. The stored file block wins whenever it holds a
 * refresh token — an `auth login` result must not be shadowed by a stale exported env var — and the
 * env vars are the fallback.
 *
 * @param fileBlock - The block as stored in the config file.
 * @param envBlock - The block's credentials read from its env vars.
 * @returns The winning source.
 */
function zohoCliCredentialBlockSource(fileBlock: Maybe<ZohoCliCredentialBlock>, envBlock: ZohoCliCredentialBlock): ZohoCliCredentialSource {
  let result: ZohoCliCredentialSource;

  if (fileBlock?.refreshToken) {
    result = 'config';
  } else if (envBlock.refreshToken) {
    result = 'env';
  } else {
    result = 'none';
  }

  return result;
}

/**
 * Resolves a block's credentials AS A UNIT from whichever source wins.
 *
 * Never mixes the two: a file client id paired with an env refresh token is a grant Zoho rejects, so
 * the env triple replaces the file's partial values outright. A file block without a refresh token —
 * which is what step 1 of `auth setup` writes — counts as not logged in.
 *
 * @param fileBlock - The block as stored in the config file.
 * @param envBlock - The block's credentials read from its env vars.
 * @returns The resolved credentials and region.
 */
function resolveZohoCliCredentialBlock(fileBlock: Maybe<ZohoCliCredentialBlock>, envBlock: ZohoCliCredentialBlock): ZohoCliCredentialBlock {
  let result: ZohoCliCredentialBlock;

  if (zohoCliCredentialBlockSource(fileBlock, envBlock) === 'env') {
    result = { ...envBlock, region: envBlock.region ?? fileBlock?.region };
  } else {
    result = { clientId: fileBlock?.clientId, clientSecret: fileBlock?.clientSecret, refreshToken: fileBlock?.refreshToken, region: fileBlock?.region };
  }

  return result;
}

/**
 * Reports, per block, whether {@link loadCliConfig} sources its credentials from the config file or the env.
 *
 * @param fileConfig - The raw config file, from {@link loadCliConfigFile}.
 * @returns The source of every {@link ZohoCliCredentialBlockKey}.
 */
export function zohoCliCredentialSources(fileConfig: Maybe<ZohoCliConfig>): Record<ZohoCliCredentialBlockKey, ZohoCliCredentialSource> {
  return Object.fromEntries(ZOHO_CLI_CREDENTIAL_BLOCK_KEYS.map((block) => [block, zohoCliCredentialBlockSource(fileConfig?.[block], readZohoCliEnvCredentials(block))])) as Record<ZohoCliCredentialBlockKey, ZohoCliCredentialSource>;
}

/**
 * Returns the blocks whose stored refresh token is shadowing a DIFFERENT one exported in the env.
 *
 * Since a stored login wins, an env var that disagrees with it is silently ignored; `doctor` warns
 * about these so a stale export is not mistaken for the active credential.
 *
 * @param fileConfig - The raw config file, from {@link loadCliConfigFile}.
 * @returns The shadowing blocks, in {@link ZOHO_CLI_CREDENTIAL_BLOCK_KEYS} order.
 */
export function zohoCliShadowedEnvCredentialBlocks(fileConfig: Maybe<ZohoCliConfig>): ZohoCliCredentialBlockKey[] {
  return ZOHO_CLI_CREDENTIAL_BLOCK_KEYS.filter((block) => {
    const storedRefreshToken = fileConfig?.[block]?.refreshToken;
    const envRefreshToken = readZohoCliEnvCredentials(block).refreshToken;
    return storedRefreshToken != null && storedRefreshToken !== '' && envRefreshToken != null && envRefreshToken !== storedRefreshToken;
  });
}

/**
 * Reads the config file as stored, with no env vars layered over it.
 *
 * What every write merges onto, so an env-sourced secret is never copied into the file — with stored
 * credentials winning over env, a leaked env value would otherwise shadow the env forever.
 *
 * @returns The stored {@link ZohoCliConfig}, or `undefined` when no config file exists.
 */
export function loadCliConfigFile(): Promise<Maybe<ZohoCliConfig>> {
  return readJsonFile<ZohoCliConfig>(getConfigFilePath());
}

/**
 * Loads the full CLI config: the config file with environment variables as the fallback.
 *
 * Credentials resolve per block as a unit — a block whose stored refresh token is set uses the stored
 * client and region, and only otherwise the env triple (see {@link resolveZohoCliCredentialBlock}).
 * The remaining settings (`apiMode`, `apiUrl`, `orgId`) likewise prefer the file and fall back to env.
 * `tokenSource` is the ACTIVE token source ({@link resolveZohoCliActiveTokenSource}); its token is
 * not loaded here.
 *
 * @returns The resolved {@link ZohoCliConfig}, or `undefined` when no config file exists and neither a credential env var nor {@link ZOHO_CLI_TOKEN_COMMAND_ENV_VAR} is set.
 */
export async function loadCliConfig(): Promise<Maybe<ZohoCliConfig>> {
  const fileConfig = await loadCliConfigFile();
  const envCredentials = Object.fromEntries(ZOHO_CLI_CREDENTIAL_BLOCK_KEYS.map((block) => [block, readZohoCliEnvCredentials(block)])) as Record<ZohoCliCredentialBlockKey, ZohoCliCredentialBlock>;
  const hasEnvCredentials = Object.values(envCredentials).some((x) => x.clientId != null || x.clientSecret != null || x.refreshToken != null);
  const activeTokenSource = resolveZohoCliActiveTokenSource(fileConfig);
  let result: Maybe<ZohoCliConfig>;

  if (!fileConfig && !hasEnvCredentials && !activeTokenSource) {
    result = undefined;
  } else {
    const sharedCredentials = resolveZohoCliCredentialBlock(fileConfig?.shared, envCredentials.shared);
    const shared: ZohoCliSharedConfig = {
      ...fileConfig?.shared,
      clientId: sharedCredentials.clientId ?? '',
      clientSecret: sharedCredentials.clientSecret ?? '',
      refreshToken: sharedCredentials.refreshToken ?? '',
      region: sharedCredentials.region ?? undefined,
      apiMode: fileConfig?.shared?.apiMode ?? envVar('API_URL') ?? undefined
    };

    const productConfig = (product: ZohoCliProduct): ZohoCliProductConfig | undefined => {
      const prefix = product.toUpperCase();
      const fileProduct = fileConfig?.[product];
      const envProduct = envCredentials[product];
      // only the service-specific var: the shared ZOHO_API_URL already reaches every product through shared.apiMode
      const envApiUrl = process.env[`ZOHO_${prefix}_API_URL`];
      const envOrgId = ZOHO_CLI_ORG_ID_PRODUCTS.has(product) ? envVar('ORG_ID', prefix) : undefined;
      const hasEnvProduct = envProduct.clientId != null || envProduct.clientSecret != null || envProduct.refreshToken != null || envProduct.region != null || envApiUrl != null || envOrgId != null;
      let productResult: ZohoCliProductConfig | undefined;

      if (!fileProduct && !hasEnvProduct) {
        productResult = undefined;
      } else {
        const credentials = resolveZohoCliCredentialBlock(fileProduct, envProduct);

        productResult = {
          ...fileProduct,
          clientId: credentials.clientId,
          clientSecret: credentials.clientSecret,
          refreshToken: credentials.refreshToken,
          region: credentials.region ?? undefined,
          apiUrl: fileProduct?.apiUrl ?? envApiUrl,
          orgId: fileProduct?.orgId ?? envOrgId ?? undefined
        };
      }

      return productResult;
    };

    // every product in ZOHO_CLI_PRODUCTS must be listed here — one left out is dropped from the loaded
    // config entirely, and the CLI then reports it as unconfigured no matter what is on disk
    result = {
      shared,
      recruit: productConfig('recruit'),
      crm: productConfig('crm'),
      desk: productConfig('desk'),
      sign: productConfig('sign'),
      analytics: productConfig('analytics'),
      output: fileConfig?.output,
      tokenSource: activeTokenSource ? { command: activeTokenSource.command } : undefined
    };
  }

  return result;
}

/**
 * Resolves credentials for a specific product.
 * Uses product-specific credentials if available, otherwise falls back to shared — except for
 * {@link ZOHO_CLI_DEDICATED_CLIENT_PRODUCTS} (e.g. `sign`), whose `clientId`/`clientSecret`/`refreshToken`
 * must come from the product's own config. `region`/`apiMode` may still inherit from shared for all products,
 * with a product's own `region` taking precedence.
 *
 * @param config - Loaded CLI configuration containing the shared block and any per-product overrides.
 * @param product - Target Zoho product whose credentials should be resolved.
 * @returns Fully populated {@link ZohoCliResolvedProductCredentials}, or `undefined` if any of `clientId`, `clientSecret`, or `refreshToken` cannot be sourced (for dedicated-client products, from the product config alone; otherwise from product or shared config).
 */
export function resolveProductCredentials(config: ZohoCliConfig, product: ZohoCliProduct): Maybe<ZohoCliResolvedProductCredentials> {
  const productConfig = config[product];
  const shared = config.shared;
  const allowSharedFallback = !ZOHO_CLI_DEDICATED_CLIENT_PRODUCTS.has(product);

  const clientId = productConfig?.clientId ?? (allowSharedFallback ? shared.clientId : undefined);
  const clientSecret = productConfig?.clientSecret ?? (allowSharedFallback ? shared.clientSecret : undefined);
  const refreshToken = productConfig?.refreshToken ?? (allowSharedFallback ? shared.refreshToken : undefined);

  let result: Maybe<ZohoCliResolvedProductCredentials>;

  if (!clientId || !clientSecret || !refreshToken) {
    result = undefined;
  } else {
    result = {
      clientId,
      clientSecret,
      refreshToken,
      region: productConfig?.region ?? shared.region ?? 'us',
      apiMode: productConfig?.apiUrl ?? shared.apiMode ?? 'production',
      orgId: productConfig?.orgId,
      redirectUri: productConfig?.redirectUri ?? (allowSharedFallback ? shared.redirectUri : undefined)
    };
  }

  return result;
}

/**
 * Saves the full CLI config to disk.
 *
 * Creates the config directory recursively if missing, then writes the JSON-serialized config to
 * {@link getConfigFilePath} with owner-only (`0600`) permissions, since it holds client secrets and
 * refresh tokens.
 *
 * @param config - Complete config object to persist; written verbatim with 2-space indentation.
 * @returns Resolves once the file is written.
 */
export function saveCliConfig(config: ZohoCliConfig): Promise<void> {
  return writeJsonFile({ filePath: getConfigFilePath(), dirPath: getConfigDir(), data: config, mode: CLI_CONFIG_FILE_MODE });
}

/**
 * Shallow-merges an update block over the existing one, ignoring keys whose update value is `undefined`.
 *
 * A caller assembles its update positionally rather than key-by-key — `auth setup --product analytics`
 * always emits an `orgId` key, for instance, whether or not `--org-id` was passed — so a plain spread
 * lets an omitted flag clobber a stored value. Losing an org id that way silently breaks every
 * org-scoped call for that product, and the same hazard applies to every other optional field.
 *
 * No path clears a credential/product field by writing `undefined`: `auth clear` removes the whole
 * file and output config clears through {@link dbxMergeOutputConfig} (which is intentionally
 * `undefined`-sensitive and is NOT routed through here), so ignoring undefined is safe.
 *
 * @param existing - Block currently on disk, when any.
 * @param updates - Patch to apply; `undefined` values are treated as "not provided".
 * @returns The merged block, or `existing` untouched when `updates` is absent.
 */
function mergeConfigBlock<T extends object>(existing: Maybe<T>, updates: Maybe<T>): T | undefined {
  return updates == null ? (existing ?? undefined) : { ...existing, ...filterUndefinedValues(updates) };
}

/**
 * Patch accepted by {@link mergeCliConfig}. Every block is optional, and the shared block may be
 * partial — a step-1 `auth setup` stores the client without touching the stored refresh token.
 */
export type ZohoCliConfigUpdate = Partial<Omit<ZohoCliConfig, 'shared'>> & {
  readonly shared?: Partial<ZohoCliSharedConfig>;
};

/**
 * Merges new values into the stored config file, preserving unmodified fields.
 *
 * Merges onto the RAW file ({@link loadCliConfigFile}), never onto the env-layered config, so an
 * env-sourced credential is not written to disk. `shared` may be omitted or partial, which leaves the
 * stored values untouched (empty credentials are written when none are stored yet).
 *
 * Per-product blocks are shallow-merged via {@link mergeConfigBlock} when provided, so a key the
 * update carries as `undefined` leaves the stored value alone; output config is deep-merged via
 * dbx-cli's {@link dbxMergeOutputConfig} so explicit `undefined` keys in `updates.output` clear
 * existing values.
 *
 * Every product in {@link ZOHO_CLI_PRODUCTS} MUST appear below. A product missing from this literal
 * is not merely left unmerged — it is absent from `merged` and therefore erased from the config file
 * by the save, so its credentials can never be stored.
 *
 * @param updates - Partial config patch; only keys present in this object are touched.
 * @returns The fully merged config that was written to disk.
 */
export async function mergeCliConfig(updates: ZohoCliConfigUpdate): Promise<ZohoCliConfig> {
  const existing = await loadCliConfigFile();
  const merged: ZohoCliConfig = {
    shared: { clientId: '', clientSecret: '', refreshToken: '', ...mergeConfigBlock<Partial<ZohoCliSharedConfig>>(existing?.shared, updates.shared) },
    recruit: mergeConfigBlock(existing?.recruit, updates.recruit),
    crm: mergeConfigBlock(existing?.crm, updates.crm),
    desk: mergeConfigBlock(existing?.desk, updates.desk),
    sign: mergeConfigBlock(existing?.sign, updates.sign),
    analytics: mergeConfigBlock(existing?.analytics, updates.analytics),
    output: updates.output === undefined ? existing?.output : dbxMergeOutputConfig(existing?.output, updates.output),
    // carried over verbatim: only saveCliTokenSourceConfig() writes the token source block
    tokenSource: existing?.tokenSource
  };

  await saveCliConfig(merged);
  return merged;
}

/**
 * Saves (or, with `undefined`, removes) the `tokenSource` block of the stored config file.
 *
 * Writes the raw file back with ONLY that block changed, so the `shared` and per-product credential
 * blocks are never read for credentials nor rewritten — not even padded with the empty credentials
 * {@link mergeCliConfig} writes for a missing shared block. Nothing is written when there is no
 * config file and no block to save.
 *
 * @param tokenSource - The block to save, or `undefined` to remove it.
 * @returns The config file as written, or `undefined` when nothing was written.
 */
export async function saveCliTokenSourceConfig(tokenSource: Maybe<ZohoCliTokenSourceConfig>): Promise<Maybe<ZohoCliConfig>> {
  const existing = await loadCliConfigFile();
  let result: Maybe<ZohoCliConfig>;

  if (existing != null || tokenSource != null) {
    // without an existing file the result holds only the token source; every reader treats `shared` as optional on disk
    result = { ...existing, tokenSource: tokenSource ?? undefined } as ZohoCliConfig;
    await saveCliConfig(result);
  }

  return result;
}

/**
 * Re-export of dbx-cli's `resolveOutputConfig` so existing zoho-cli consumers keep the same
 * module surface. New code can import from `@dereekb/dbx-cli` directly.
 */
// eslint-disable-next-line dereekb-util/no-sister-re-export -- backward-compatible facade for existing zoho-cli consumers
export { resolveOutputConfig } from '@dereekb/dbx-cli';

/**
 * Clears all output config (dumpDir, pick, per-command overrides).
 *
 * Uses explicit `undefined` values so {@link dbxMergeOutputConfig} detects the keys
 * via `'key' in updates` and overwrites rather than falling back to existing values.
 * `JSON.stringify` then strips the undefined properties from the saved config file.
 */
export async function clearOutputConfig(): Promise<void> {
  await mergeCliConfig({ output: { dumpDir: undefined, pick: undefined, commands: undefined } });
}

/**
 * Removes both the persisted CLI config file and the on-disk OAuth token cache.
 *
 * Used by `auth clear` to fully reset CLI authentication state on the local machine.
 */
export async function clearCliConfig(): Promise<void> {
  const configPath = getConfigFilePath();
  const tokenPath = getTokenCachePath();
  await removeFile(configPath);
  await removeFile(tokenPath);
}

/**
 * Returns the list of products that have resolvable credentials.
 *
 * A product is considered configured when {@link resolveProductCredentials} returns a value — or,
 * when a token source is active, when its token covers the product (the token source then replaces
 * the product's own credentials). Desk additionally requires an org id ({@link zohoCliProductOrgId}).
 *
 * The org-id requirement is deliberately desk-only rather than generalized over
 * {@link ZOHO_CLI_ORG_ID_PRODUCTS}: every Desk endpoint is org-scoped, so Desk without an org id can
 * do nothing at all, whereas Analytics still serves `GET /orgs` — the call that discovers the org id
 * in the first place — so gating it here would make the id undiscoverable through the CLI. `doctor`
 * is what reports an org-scoped product that is configured but has no org id.
 *
 * @param config - Loaded CLI configuration to inspect.
 * @param tokenSource - The active token source's coverage, when one is active and its token loaded.
 * @returns Subset of {@link ZOHO_CLI_PRODUCTS} for which the CLI can construct an authenticated API client.
 */
export function configuredProducts(config: ZohoCliConfig, tokenSource?: Maybe<ZohoCliTokenSourceCoverage>): ZohoCliProduct[] {
  return ZOHO_CLI_PRODUCTS.filter((product) => {
    const hasAccess = tokenSource?.products.includes(product) || resolveProductCredentials(config, product) != null;
    return hasAccess && (product !== 'desk' || zohoCliProductOrgId({ config, product, tokenSource }) != null);
  });
}

/**
 * Re-export of dbx-cli's secret-masking helper. Auth/show commands import via this module so the
 * masking pattern stays consistent across CLIs.
 */
// eslint-disable-next-line dereekb-util/no-sister-re-export -- backward-compatible facade for zoho-cli auth/show commands
export { maskSecret } from '@dereekb/dbx-cli';
