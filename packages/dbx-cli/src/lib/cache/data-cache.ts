import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { DEFAULT_JSON_FILE_CACHE_MODE, createMemoizedJsonFileAsyncKeyedValueCache, readJsonFile, removeFile } from '@dereekb/nestjs';
import { type ArrayOrValue, type AsyncKeyedValueCache, type Maybe, type Milliseconds, asArray, expirationDetails } from '@dereekb/util';
import { fromCliCacheJson, toCliCacheJson } from './data-cache.codec';
import { cliCacheFingerprint, cliDataCacheKey, cliDataCachePathSegment, normalizeCliCacheFilter } from './data-cache.fingerprint';
import { type CliDataCacheOptions, DEFAULT_CLI_DATA_CACHE_OPTIONS } from './data-cache.options';

/**
 * Version of the on-disk index and payload envelopes.
 *
 * Bumped when the envelope shape itself changes. A payload written under a different schema version
 * is a miss, not an error — see {@link CliDataCache.loadData}.
 */
export const CLI_DATA_CACHE_SCHEMA_VERSION = 1;

/**
 * Name of the index file inside the cache directory.
 */
export const CLI_DATA_CACHE_INDEX_FILE_NAME = 'index.json';

/**
 * One recorded build of one dataset, as held in the index.
 *
 * The payload lives in its own file (see {@link file}) so listing the cache never has to read the
 * data — mirroring the lint cache's per-project files plus an index roll-up.
 */
export interface CliDataCacheEntry {
  /**
   * Identifier of the cached pipeline stage, e.g. `worker.lineDetails`.
   */
  readonly dataset: string;
  /**
   * The stage version this build was produced by. An entry whose version no longer matches the
   * caller's is a miss.
   */
  readonly datasetVersion: number;
  /**
   * The env the data was read from.
   */
  readonly env: string;
  readonly fingerprint: string;
  /**
   * The NORMALIZED filter this build covers, stored verbatim so `cache list` can show what an entry
   * is a build OF rather than just its digest.
   */
  readonly filter: unknown;
  /**
   * When the build was recorded, as an ISO string.
   */
  readonly builtAt: string;
  /**
   * Number of rows, when the cached value was an array. Absent for a non-array payload.
   */
  readonly itemCount?: Maybe<number>;
  /**
   * Size of the payload file in bytes.
   */
  readonly bytes: number;
  /**
   * Absolute path of the payload file.
   */
  readonly file: string;
  /**
   * The CLI build that produced the entry, when known.
   *
   * Recorded but deliberately NOT part of the fingerprint: fingerprinting on it would invalidate the
   * whole cache on every rebuild of the CLI, which is exactly the workflow this feature is meant to
   * speed up. `cache list` surfaces it so an entry from a different build is visible.
   */
  readonly cliBuildStamp?: Maybe<string>;
}

/**
 * The persisted payload envelope.
 */
export interface CliDataCachePayloadFile {
  readonly schemaVersion: number;
  readonly dataset: string;
  readonly datasetVersion: number;
  readonly env: string;
  readonly fingerprint: string;
  readonly builtAt: string;
  /**
   * The cached value, encoded by the entry's codec.
   */
  readonly payload: unknown;
}

/**
 * How a cached value is converted to and from the JSON written on disk.
 *
 * Defaults to the tagged structured codec, which needs no per-dataset work. A dataset whose value
 * holds something the tagged codec cannot represent — a class instance whose identity matters —
 * supplies its own.
 */
export interface CliDataCacheCodec<T> {
  readonly toJson: (data: T) => unknown;
  readonly fromJson: (raw: unknown) => T;
}

/**
 * The default codec: the tagged structured JSON walk.
 */
export const DEFAULT_CLI_DATA_CACHE_CODEC: CliDataCacheCodec<any> = {
  toJson: (data) => toCliCacheJson(data),
  fromJson: (raw) => fromCliCacheJson(raw)
};

/**
 * Narrowing filter accepted by {@link CliDataCache.listEntries} and {@link CliDataCache.removeEntries}.
 */
export interface CliDataCacheEntryFilter {
  readonly env?: Maybe<string>;
  readonly dataset?: Maybe<string>;
  readonly fingerprint?: Maybe<string>;
  /**
   * Keep only entries built longer ago than this. Used by `cache prune`.
   */
  readonly olderThanMs?: Maybe<Milliseconds>;
}

/**
 * Input for {@link CliDataCache.saveData}.
 */
export interface SaveCliDataCacheInput<T> {
  readonly dataset: string;
  readonly datasetVersion: number;
  readonly env: string;
  readonly filter?: Maybe<unknown>;
  readonly data: T;
  readonly codec?: Maybe<CliDataCacheCodec<T>>;
}

/**
 * Input for {@link CliDataCache.loadData}.
 */
export interface LoadCliDataCacheInput<T> {
  readonly dataset: string;
  readonly datasetVersion: number;
  readonly env: string;
  readonly filter?: Maybe<unknown>;
  readonly codec?: Maybe<CliDataCacheCodec<T>>;
  /**
   * Reject an entry built longer ago than this. Omit for no age limit.
   */
  readonly maxAgeMs?: Maybe<Milliseconds>;
}

/**
 * A hit returned by {@link CliDataCache.loadData}.
 */
export interface CliDataCacheHit<T> {
  readonly data: T;
  readonly entry: CliDataCacheEntry;
}

/**
 * On-disk store of recorded dataset builds.
 */
export interface CliDataCache {
  /**
   * The directory holding the index and every payload file.
   */
  readonly dataCacheDir: string;
  /**
   * Returns every recorded entry matching `filter`, newest build first.
   */
  listEntries(filter?: Maybe<CliDataCacheEntryFilter>): Promise<CliDataCacheEntry[]>;
  /**
   * Reads a recorded build, or `undefined` when there is no usable one.
   *
   * Any reason the entry cannot be used — absent, wrong `datasetVersion`, wrong schema version, past
   * `maxAgeMs`, payload file missing, payload unparsable — is reported the same way: a miss, so the
   * caller rebuilds. A cache is never allowed to turn into a failure.
   */
  loadData<T>(input: LoadCliDataCacheInput<T>): Promise<Maybe<CliDataCacheHit<T>>>;
  /**
   * Records a build, replacing any previous build of the same dataset + filter.
   */
  saveData<T>(input: SaveCliDataCacheInput<T>): Promise<CliDataCacheEntry>;
  /**
   * Removes every entry matching `filter` (and its payload file). Returns what was removed.
   */
  removeEntries(filter?: Maybe<CliDataCacheEntryFilter>): Promise<CliDataCacheEntry[]>;
}

export interface CreateCliDataCacheInput {
  /**
   * Directory holding the index and payload files, e.g. `~/.<cliName>/cache`.
   */
  readonly dataCacheDir: string;
  /**
   * Optional stamp identifying the CLI build, recorded on every entry it writes.
   */
  readonly cliBuildStamp?: Maybe<string>;
}

/**
 * Whether an entry passes a narrowing filter.
 *
 * @param entry - The entry to test.
 * @param filter - The filter to apply. An absent filter matches everything.
 * @param nowMs - The current time, for the `olderThanMs` comparison.
 * @returns Whether the entry matches.
 *
 * @__NO_SIDE_EFFECTS__
 */
function matchesFilter(entry: CliDataCacheEntry, filter: Maybe<CliDataCacheEntryFilter>, nowMs: number): boolean {
  let result = true;

  if (filter != null) {
    const builtAtMs = Date.parse(entry.builtAt);
    const tooYoung = filter.olderThanMs != null && (!Number.isFinite(builtAtMs) || nowMs - builtAtMs < filter.olderThanMs);
    result = (filter.env == null || filter.env === entry.env) && (filter.dataset == null || filter.dataset === entry.dataset) && (filter.fingerprint == null || filter.fingerprint === entry.fingerprint) && !tooYoung;
  }

  return result;
}

/**
 * Creates the on-disk dataset cache.
 *
 * Layout, mirroring the lint cache's per-key files plus a versioned index roll-up:
 *
 * ```
 * <dataCacheDir>/index.json                            the CliDataCacheEntry roll-up
 * <dataCacheDir>/<env>/<dataset>/<fingerprint>.json    one CliDataCachePayloadFile per build
 * ```
 *
 * Everything is written mode 0600. A cached export holds production rows — worker names, emails,
 * billing lines — so the files are readable by the owning user only, the same posture as the token
 * and Firestore-session caches next to them.
 *
 * @param input - The cache inputs.
 * @param input.dataCacheDir - Directory holding the index and payload files.
 * @param input.cliBuildStamp - Optional stamp identifying the CLI build, recorded on written entries.
 * @returns The cache.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createCliDataCache(input: CreateCliDataCacheInput): CliDataCache {
  const { dataCacheDir, cliBuildStamp } = input;
  const index: AsyncKeyedValueCache<CliDataCacheEntry> = createMemoizedJsonFileAsyncKeyedValueCache<CliDataCacheEntry>({
    filePath: join(dataCacheDir, CLI_DATA_CACHE_INDEX_FILE_NAME)
  });

  function payloadFilePath(env: string, dataset: string, fingerprint: string): string {
    return join(dataCacheDir, cliDataCachePathSegment(env), cliDataCachePathSegment(dataset), `${fingerprint}.json`);
  }

  async function removeEntryAt(key: string, entry: Maybe<CliDataCacheEntry>): Promise<void> {
    await index.remove(key);

    if (entry != null) {
      await removeFile(entry.file);
    }
  }

  const cache: CliDataCache = {
    dataCacheDir,
    listEntries: async (filter) => {
      const nowMs = Date.now();
      const entries = Object.values(await index.load()).filter((entry) => matchesFilter(entry, filter, nowMs));
      return entries.sort((a, b) => Date.parse(b.builtAt) - Date.parse(a.builtAt));
    },
    loadData: async <T>(loadInput: LoadCliDataCacheInput<T>) => {
      const { dataset, datasetVersion, env, filter, maxAgeMs } = loadInput;
      const fingerprint = cliCacheFingerprint({ dataset, datasetVersion, env, filter });
      const key = cliDataCacheKey({ env, dataset, fingerprint });
      const entry = await index.get(key);
      let result: Maybe<CliDataCacheHit<T>>;

      // the version is re-checked against the ENTRY as well as being folded into the fingerprint: a
      // bumped version already produces a different fingerprint, and this catches an index that was
      // hand-edited or written by an older schema
      if (entry != null && entry.datasetVersion === datasetVersion && !isEntryExpired(entry, maxAgeMs)) {
        const file = await readJsonFile<CliDataCachePayloadFile>(entry.file);

        if (file == null || file.schemaVersion !== CLI_DATA_CACHE_SCHEMA_VERSION || file.fingerprint !== fingerprint) {
          // an index entry whose payload is gone, unparsable, or from another schema is worse than
          // no entry — it would keep showing up in `cache list` as if the data were there. Drop it
          // and report a miss, so the caller rebuilds and the cache self-heals.
          await removeEntryAt(key, entry);
        } else {
          const codec = loadInput.codec ?? (DEFAULT_CLI_DATA_CACHE_CODEC as CliDataCacheCodec<T>);
          result = { data: codec.fromJson(file.payload), entry };
        }
      }

      return result;
    },
    saveData: async <T>(saveInput: SaveCliDataCacheInput<T>) => {
      const { dataset, datasetVersion, env, filter, data } = saveInput;
      const fingerprint = cliCacheFingerprint({ dataset, datasetVersion, env, filter });
      const codec = saveInput.codec ?? (DEFAULT_CLI_DATA_CACHE_CODEC as CliDataCacheCodec<T>);
      const file = payloadFilePath(env, dataset, fingerprint);
      const builtAt = new Date().toISOString();
      const payloadFile: CliDataCachePayloadFile = {
        schemaVersion: CLI_DATA_CACHE_SCHEMA_VERSION,
        dataset,
        datasetVersion,
        env,
        fingerprint,
        builtAt,
        payload: codec.toJson(data)
      };

      const bytes = await writeCliDataCachePayloadFile(file, payloadFile);

      const entry: CliDataCacheEntry = {
        dataset,
        datasetVersion,
        env,
        fingerprint,
        filter: normalizeCliCacheFilter(filter) ?? {},
        builtAt,
        ...(Array.isArray(data) ? { itemCount: data.length } : {}),
        bytes,
        file,
        ...(cliBuildStamp == null ? {} : { cliBuildStamp })
      };

      await index.set(cliDataCacheKey({ env, dataset, fingerprint }), entry);
      return entry;
    },
    removeEntries: async (filter) => {
      const nowMs = Date.now();
      const all = await index.load();
      const removed: CliDataCacheEntry[] = [];

      for (const [key, entry] of Object.entries(all)) {
        if (matchesFilter(entry, filter, nowMs)) {
          await removeEntryAt(key, entry);
          removed.push(entry);
        }
      }

      return removed;
    }
  };

  return cache;
}

/**
 * Writes a payload envelope to disk COMPACTLY and returns its size.
 *
 * Deliberately not `writeJsonFile`, which pretty-prints: an index of entry metadata benefits from
 * being diffable by eye, but a payload is a 20k-row dataset, and two-space indentation on one of
 * those costs multiples of the file size and the parse time this cache exists to save.
 *
 * The mode is applied on the write AND re-applied via the file handle, because `writeFile`'s `mode`
 * is ignored when the file already exists — a re-recorded build would otherwise keep whatever
 * permissions it was first created with.
 *
 * @param filePath - Absolute path of the payload file.
 * @param payloadFile - The envelope to write.
 * @returns The number of bytes written.
 */
async function writeCliDataCachePayloadFile(filePath: string, payloadFile: CliDataCachePayloadFile): Promise<number> {
  const serialized = JSON.stringify(payloadFile);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, serialized, { mode: DEFAULT_JSON_FILE_CACHE_MODE, encoding: 'utf8' });
  await chmod(filePath, DEFAULT_JSON_FILE_CACHE_MODE);
  return Buffer.byteLength(serialized, 'utf8');
}

/**
 * Whether a recorded build is too old to satisfy a read.
 *
 * @param entry - The entry to test.
 * @param maxAgeMs - The age limit. `null`/`undefined` means no limit.
 * @returns Whether the entry is past the limit.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isEntryExpired(entry: CliDataCacheEntry, maxAgeMs: Maybe<Milliseconds>): boolean {
  let result = false;

  if (maxAgeMs != null) {
    const builtAtMs = Date.parse(entry.builtAt);
    // an unparsable builtAt is treated as expired rather than as "infinitely fresh"
    result = !Number.isFinite(builtAtMs) || expirationDetails({ expiresFromDate: builtAtMs, expiresIn: maxAgeMs }).hasExpired();
  }

  return result;
}

/**
 * The outcome of {@link loadOrBuildCliCachedData}.
 */
export interface CliCachedDataResult<T> {
  readonly data: T;
  /**
   * Whether `data` came off disk rather than from `build()`.
   */
  readonly fromCache: boolean;
  readonly dataset: string;
  readonly fingerprint: string;
  readonly builtAt: Date;
  /**
   * How old the data is. Zero for a fresh build.
   */
  readonly ageMs: Milliseconds;
  readonly itemCount?: Maybe<number>;
}

/**
 * Input for {@link loadOrBuildCliCachedData}.
 */
export interface LoadOrBuildCliCachedDataInput<T> {
  readonly cache: CliDataCache;
  readonly dataset: string;
  readonly datasetVersion: number;
  readonly env: string;
  /**
   * The inputs this stage's contents depend on — and ONLY those. Anything applied after the stage
   * (output format, export flavour, a row filter the pipeline applies downstream) must be left out,
   * or changing it will needlessly miss.
   */
  readonly filter?: Maybe<unknown>;
  /**
   * The invocation's cache policy. Defaults to {@link DEFAULT_CLI_DATA_CACHE_OPTIONS} (record only).
   */
  readonly options?: Maybe<CliDataCacheOptions>;
  readonly codec?: Maybe<CliDataCacheCodec<T>>;
  /**
   * Produces the data when no recorded build satisfies the run. Only called on a miss, which is what
   * makes nesting these calls resolve a stage chain back-to-front: a hit on a late stage never runs
   * the earlier stages at all.
   */
  readonly build: () => Promise<T>;
}

/**
 * Reads a recorded build of a dataset, or produces and records one.
 *
 * @param input - The lookup + build inputs.
 * @returns The data plus where it came from.
 */
export async function loadOrBuildCliCachedData<T>(input: LoadOrBuildCliCachedDataInput<T>): Promise<CliCachedDataResult<T>> {
  const { cache, dataset, datasetVersion, env, filter, build } = input;
  const options = input.options ?? DEFAULT_CLI_DATA_CACHE_OPTIONS;
  const codec = input.codec;
  const hit = options.read ? await cache.loadData<T>({ dataset, datasetVersion, env, filter, codec, maxAgeMs: options.maxAgeMs }) : undefined;
  let result: CliCachedDataResult<T>;

  if (hit == null) {
    const data = await build();
    const itemCount: Maybe<number> = Array.isArray(data) ? data.length : undefined;
    // `--no-cache` still reports the fingerprint and build time, so a run that opts out of recording
    // reads the same as one that recorded — only `fromCache` ever differs
    const built: { readonly fingerprint: string; readonly builtAt: string } = options.write ? await cache.saveData<T>({ dataset, datasetVersion, env, filter, data, codec }) : { fingerprint: cliCacheFingerprint({ dataset, datasetVersion, env, filter }), builtAt: new Date().toISOString() };

    result = {
      data,
      fromCache: false,
      dataset,
      fingerprint: built.fingerprint,
      builtAt: new Date(built.builtAt),
      ageMs: 0,
      ...(itemCount == null ? {} : { itemCount })
    };
  } else {
    const builtAt = new Date(hit.entry.builtAt);
    result = {
      data: hit.data,
      fromCache: true,
      dataset,
      fingerprint: hit.entry.fingerprint,
      builtAt,
      ageMs: Math.max(0, Date.now() - builtAt.getTime()),
      ...(hit.entry.itemCount == null ? {} : { itemCount: hit.entry.itemCount })
    };
  }

  return result;
}

/**
 * Builds the `cache` provenance block for an output envelope's `meta`.
 *
 * Emitting it on every cached command is what lets a reader tell whether the bytes in front of them
 * came off disk, and how old they are, without re-running anything.
 *
 * @param results - One result, or the per-stage results of a pipeline.
 * @returns The meta block: one object for a single result, an array for several.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliDataCacheMeta(results: ArrayOrValue<CliCachedDataResult<unknown>>): Record<string, unknown> {
  const asMeta = (result: CliCachedDataResult<unknown>) => ({
    dataset: result.dataset,
    fingerprint: result.fingerprint,
    fromCache: result.fromCache,
    builtAt: result.builtAt.toISOString(),
    ageMs: result.ageMs,
    ...(result.itemCount == null ? {} : { itemCount: result.itemCount })
  });

  return { cache: Array.isArray(results) ? asArray(results).map(asMeta) : asMeta(results) };
}
