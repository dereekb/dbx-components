import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { type Maybe, buildRankedSearchEntries, rankSearchEntries, RANKED_SEARCH_NAME_WEIGHTS, RANKED_SEARCH_SLUG_WEIGHTS, RANKED_SEARCH_TAG_WEIGHTS, RANKED_SEARCH_TEXT_WEIGHTS, type RankedSearchEntry } from '@dereekb/util';
import { type OidcScopeTerm } from '@dereekb/firebase';
import { notFoundError, unauthenticatedError } from '../../../function/error';
import { assertEndpointOidcScope, oidcScopesFromRequestAuth } from '../api.scope';
import { type FirebaseServerAuthData } from '../auth.context.server';
import { resolveSecureAssetPath } from '../download/download.api.config';
import { DEFAULT_DOCS_MAX_READ_LENGTH, DOCS_API_PATH, DOCS_AUDIENCE_ANY, DOCS_AUDIENCE_READER, DocsApiModuleConfig, type DocsAudience, type DocsAudienceReader } from './docs.api.config';
import { readDocsManifestJson, splitDocsMarkdownSections, type DocsManifestEntry, type DocsManifestSection, type DocsMarkdownSplit } from './docs.api.manifest';

// MARK: Errors
/**
 * Error code for a doc that does not exist OR that the caller may not see. Both cases share one 404 so a caller
 * cannot probe for hidden doc ids.
 */
export const DOCS_NOT_FOUND_ERROR_CODE = 'DOCS_NOT_FOUND';

/**
 * Error code for a section id that a visible doc does not have.
 */
export const DOCS_SECTION_NOT_FOUND_ERROR_CODE = 'DOCS_SECTION_NOT_FOUND';

/**
 * Default number of search results.
 */
export const DEFAULT_DOCS_SEARCH_LIMIT = 8;

/**
 * Maximum number of search results.
 */
export const MAX_DOCS_SEARCH_LIMIT = 50;

// MARK: Results
/**
 * A section heading as returned by the docs API.
 */
export type DocsSectionSummary = Pick<DocsManifestSection, 'id' | 'title'>;

/**
 * One doc in a {@link DocsListResult}.
 */
export interface DocsListEntry {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly sections: readonly DocsManifestSection[];
}

/**
 * Result of {@link DocsApiService.listDocs}: the docs visible to the caller.
 */
export interface DocsListResult {
  readonly docs: readonly DocsListEntry[];
}

/**
 * Input for {@link DocsApiService.searchDocs}.
 */
export interface DocsSearchParams {
  readonly query: string;
  readonly limit?: Maybe<number>;
}

/**
 * One search hit: a doc's intro (no `section`) or one of its sections.
 */
export interface DocsSearchResultEntry {
  readonly id: string;
  readonly title: string;
  readonly section?: DocsSectionSummary;
  readonly snippet: string;
}

/**
 * Result of {@link DocsApiService.searchDocs}.
 */
export interface DocsSearchResult {
  readonly total: number;
  readonly results: readonly DocsSearchResultEntry[];
}

/**
 * Input for {@link DocsApiService.readDoc}.
 */
export interface DocsReadParams {
  readonly id: string;
  /**
   * A section id from the doc's `sections`. Reads the whole doc when unset.
   */
  readonly section?: Maybe<string>;
}

/**
 * Result of {@link DocsApiService.readDoc}.
 */
export interface DocsReadResult {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly section?: DocsSectionSummary;
  /**
   * The doc's sections. Present when the whole doc was read.
   */
  readonly sections?: readonly DocsSectionSummary[];
  /**
   * The markdown (frontmatter removed).
   */
  readonly content: string;
  /**
   * True when the content was cut at the configured maximum read length.
   */
  readonly truncated?: boolean;
}

// MARK: State
interface DocsLoadedDoc {
  readonly entry: DocsManifestEntry;
  readonly split: DocsMarkdownSplit;
}

interface DocsSearchCandidate {
  readonly doc: DocsLoadedDoc;
  readonly section?: DocsManifestSection;
  readonly text: string;
}

interface DocsLoadedState {
  readonly docs: ReadonlyMap<string, DocsLoadedDoc>;
  readonly audiences: ReadonlySet<DocsAudience>;
  readonly searchEntries: readonly RankedSearchEntry<DocsSearchCandidate>[];
}

const SNIPPET_LENGTH = 240;

/**
 * Serves an app's audience-gated docs: the markdown in {@link DocsApiModuleConfig.docsRoot}, described by the
 * `docs.manifest.json` that `dbx-cli-generate-docs-manifest` writes.
 *
 * Every check lives here so the REST controller and the MCP docs tools share them:
 * - the caller must be authenticated (401) and hold {@link DocsApiModuleConfig.requiredScope} when it is an OIDC caller (403);
 * - the caller sees a doc only when it holds one of the doc's audiences ({@link DOCS_AUDIENCE_ANY} plus whatever the
 *   {@link DocsAudienceReader} returns);
 * - a hidden doc and a missing doc return the same 404;
 * - docs are read by manifest id only, and each read re-checks that the file is contained in the docs folder and still
 *   matches the manifest's hash.
 *
 * The manifest is loaded lazily on first use. A doc whose file escapes the folder, is missing, or no longer matches
 * its hash is excluded with a log line.
 */
@Injectable()
export class DocsApiService {
  private readonly _logger = new Logger(DocsApiService.name);
  private readonly _config: Maybe<DocsApiModuleConfig>;
  private readonly _audienceReader: Maybe<DocsAudienceReader>;
  private readonly _warnedAudiences = new Set<string>();
  private _state: Maybe<DocsLoadedState>;

  constructor(@Optional() @Inject(DocsApiModuleConfig) config?: DocsApiModuleConfig, @Optional() @Inject(DOCS_AUDIENCE_READER) audienceReader?: DocsAudienceReader) {
    this._config = config;
    this._audienceReader = audienceReader;

    if (!audienceReader) {
      this._logger.warn(`No ${DOCS_AUDIENCE_READER} provided — every docs caller holds only the "${DOCS_AUDIENCE_ANY}" audience. Provide one (see docsAudienceReaderForRoles) from the docs module's dependency module.`);
    }
  }

  /**
   * The OIDC scope the docs API requires, copied into the MCP docs tools' scope terms.
   *
   * @returns The configured scope term, if any.
   */
  get requiredScope(): Maybe<OidcScopeTerm> {
    return this._config?.requiredScope;
  }

  /**
   * The number of docs loaded from the manifest (across all audiences).
   *
   * @returns The doc count.
   */
  get docCount(): number {
    return this._loadState().docs.size;
  }

  /**
   * Counts the docs an authenticated caller may see, without enforcing the scope. Returns 0 for an anonymous caller.
   *
   * @param auth - The caller's auth data.
   * @returns The number of visible docs.
   */
  countVisibleDocs(auth: Maybe<FirebaseServerAuthData>): number {
    let result = 0;

    if (auth?.uid) {
      const audiences = this._audiencesFor(auth);
      result = Array.from(this._loadState().docs.values()).filter((doc) => isDocsEntryVisible(doc.entry, audiences)).length;
    }

    return result;
  }

  /**
   * Lists the docs visible to the caller.
   *
   * @param auth - The caller's auth data.
   * @returns The visible docs, sorted by id.
   * @throws {HttpsError} A `401` for an anonymous caller, or a `403` when an OIDC caller lacks the required scope.
   */
  listDocs(auth: Maybe<FirebaseServerAuthData>): DocsListResult {
    const audiences = this._authorize(auth, DOCS_API_PATH);
    const docs = Array.from(this._loadState().docs.values())
      .filter((doc) => isDocsEntryVisible(doc.entry, audiences))
      .map(({ entry }) => ({
        id: entry.id,
        title: entry.title,
        ...(entry.description == null ? undefined : { description: entry.description }),
        ...(entry.tags == null ? undefined : { tags: entry.tags }),
        sections: entry.sections
      }));

    return { docs };
  }

  /**
   * Searches the visible docs' titles, tags, headings and section text.
   *
   * @param auth - The caller's auth data.
   * @param params - The query and an optional limit (default {@link DEFAULT_DOCS_SEARCH_LIMIT}, max {@link MAX_DOCS_SEARCH_LIMIT}).
   * @returns The ranked hits. Matches every query word when possible, otherwise any word.
   * @throws {HttpsError} A `401` for an anonymous caller, or a `403` when an OIDC caller lacks the required scope.
   */
  searchDocs(auth: Maybe<FirebaseServerAuthData>, params: DocsSearchParams): DocsSearchResult {
    const audiences = this._authorize(auth, `${DOCS_API_PATH}/search`);
    const limit = Math.min(Math.max(1, Math.floor(params.limit ?? DEFAULT_DOCS_SEARCH_LIMIT)), MAX_DOCS_SEARCH_LIMIT);
    const entries = this._loadState().searchEntries;
    const filter = (candidate: DocsSearchCandidate) => isDocsEntryVisible(candidate.doc.entry, audiences);
    let ranked = rankSearchEntries({ entries, query: params.query, mode: 'all', filter });

    if (ranked.length === 0) {
      ranked = rankSearchEntries({ entries, query: params.query, mode: 'any', filter });
    }

    const results = ranked.slice(0, limit).map(({ value }) => ({
      id: value.doc.entry.id,
      title: value.doc.entry.title,
      ...(value.section == null ? undefined : { section: { id: value.section.id, title: value.section.title } }),
      snippet: toDocsSnippet(value.text)
    }));

    return { total: ranked.length, results };
  }

  /**
   * Reads a visible doc, or one of its sections, by manifest id.
   *
   * @param auth - The caller's auth data.
   * @param params - The doc id and an optional section id.
   * @returns The doc (or section) markdown.
   * @throws {HttpsError} A `401` / `403` like {@link listDocs}; a `404` ({@link DOCS_NOT_FOUND_ERROR_CODE}) for a missing
   *   OR hidden doc, or when the file no longer passes the containment / hash checks; a `404`
   *   ({@link DOCS_SECTION_NOT_FOUND_ERROR_CODE}) for an unknown section of a visible doc.
   */
  readDoc(auth: Maybe<FirebaseServerAuthData>, params: DocsReadParams): DocsReadResult {
    const audiences = this._authorize(auth, `${DOCS_API_PATH}/read`);
    const { id, section: sectionId } = params;
    const doc = this._loadState().docs.get(id);
    const content = doc != null && isDocsEntryVisible(doc.entry, audiences) ? this._readDocContent(doc.entry) : undefined;

    if (doc == null || content == null) {
      throw notFoundError({ code: DOCS_NOT_FOUND_ERROR_CODE, message: `No doc with id "${id}". Search or list the docs for valid ids.` });
    }

    const { entry } = doc;
    const split = splitDocsMarkdownSections(content, entry.sections);
    const maxLength = this._config?.maxReadLength ?? DEFAULT_DOCS_MAX_READ_LENGTH;
    let text = split.body;
    let sectionResult: Maybe<{ readonly section: DocsSectionSummary }>;

    if (sectionId) {
      const match = split.sections.find((x) => x.section.id === sectionId);

      if (match == null) {
        throw notFoundError({ code: DOCS_SECTION_NOT_FOUND_ERROR_CODE, message: `Doc "${id}" has no section "${sectionId}". Its sections: ${entry.sections.map((x) => x.id).join(', ') || '(none)'}.` });
      }

      text = match.content;
      sectionResult = { section: { id: match.section.id, title: match.section.title } };
    }

    const truncated = text.length > maxLength;

    return {
      id: entry.id,
      title: entry.title,
      ...(entry.description == null ? undefined : { description: entry.description }),
      ...(sectionResult ?? { sections: entry.sections.map((x) => ({ id: x.id, title: x.title })) }),
      content: truncated ? text.slice(0, maxLength) : text,
      ...(truncated ? { truncated } : undefined)
    };
  }

  // MARK: Internal
  private _authorize(auth: Maybe<FirebaseServerAuthData>, endpoint: string): ReadonlySet<DocsAudience> {
    if (!auth?.uid) {
      throw unauthenticatedError({ message: 'The docs API requires an authenticated caller.' });
    }

    assertEndpointOidcScope({ requiredScope: this._config?.requiredScope, grantedScopes: oidcScopesFromRequestAuth(auth), endpoint: `/api${endpoint}` });
    return this._audiencesFor(auth);
  }

  private _audiencesFor(auth: FirebaseServerAuthData): ReadonlySet<DocsAudience> {
    let audiences = new Set<DocsAudience>([DOCS_AUDIENCE_ANY]);

    if (this._audienceReader != null) {
      try {
        const known = this._loadState().audiences;

        for (const audience of this._audienceReader(auth)) {
          audiences.add(audience);

          if (audience !== DOCS_AUDIENCE_ANY && !known.has(audience) && !this._warnedAudiences.has(audience)) {
            this._warnedAudiences.add(audience);
            this._logger.warn(`The docs audience reader returned "${audience}", which is not in the docs manifest's audiences (${Array.from(known).join(', ') || 'none'}).`);
          }
        }
      } catch (error) {
        this._logger.warn(`The docs audience reader threw; the caller only holds the "${DOCS_AUDIENCE_ANY}" audience.`, error);
        audiences = new Set([DOCS_AUDIENCE_ANY]);
      }
    }

    return audiences;
  }

  private _loadState(): DocsLoadedState {
    let state = this._state;

    if (state == null) {
      state = this._buildState();
      this._state = state;
    }

    return state;
  }

  private _buildState(): DocsLoadedState {
    const docsRoot = this._config?.docsRoot;
    const manifestPath = this._config?.docsManifestPath;
    const docs = new Map<string, DocsLoadedDoc>();
    let audiences: readonly DocsAudience[] = [];

    if (!docsRoot || !manifestPath) {
      this._logger.warn('DocsApiModuleConfig has no docsRoot / docsManifestPath; the docs API serves no docs.');
    } else if (existsSync(manifestPath)) {
      let manifestJson: unknown;

      try {
        manifestJson = JSON.parse(readFileSync(manifestPath, 'utf8'));
      } catch (error) {
        this._logger.error(`Failed to read the docs manifest at ${manifestPath}; the docs API serves no docs.`, error);
      }

      const manifest = readDocsManifestJson(manifestJson);

      if (manifest == null) {
        this._logger.error(`${manifestPath} is not a docs manifest this server can read; the docs API serves no docs. Regenerate it with dbx-cli-generate-docs-manifest.`);
      } else {
        audiences = manifest.audiences;

        for (const entry of manifest.docs) {
          const content = this._readDocContent(entry);

          if (content != null) {
            docs.set(entry.id, { entry, split: splitDocsMarkdownSections(content, entry.sections) });
          }
        }

        this._logger.log(`Loaded ${docs.size} of ${manifest.docs.length} doc(s) from ${manifestPath}.`);
      }
    } else {
      this._logger.warn(`No docs manifest at ${manifestPath}; the docs API serves no docs. Run the app's generate-docs-manifest target.`);
    }

    return { docs, audiences: new Set(audiences), searchEntries: buildDocsSearchEntries(docs.values()) };
  }

  /**
   * Reads a manifest entry's file after the containment and hash checks.
   *
   * @param entry - The manifest entry.
   * @returns The content, or `undefined` (logged) when the file is not contained, missing, or does not match the manifest.
   */
  private _readDocContent(entry: DocsManifestEntry): Maybe<string> {
    const filePath = resolveSecureAssetPath(this._config?.docsRoot, entry.path);
    let result: Maybe<string>;

    if (filePath == null) {
      this._logger.warn(`Doc "${entry.id}" (${entry.path}) is missing or resolves outside the docs folder; excluded.`);
    } else {
      const bytes = readFileSync(filePath);
      const verify = this._config?.verifyContentHashes !== false;

      if (verify && (bytes.byteLength !== entry.size || createHash('sha256').update(bytes).digest('hex') !== entry.sha256)) {
        this._logger.warn(`Doc "${entry.id}" (${entry.path}) no longer matches the docs manifest; excluded. Regenerate the manifest.`);
      } else {
        result = bytes.toString('utf8');
      }
    }

    return result;
  }
}

// MARK: Utility
/**
 * Whether a caller holding the given audiences may see a doc.
 *
 * @param entry - The manifest entry.
 * @param audiences - The caller's audiences.
 * @returns True when the caller holds at least one of the doc's audiences.
 */
export function isDocsEntryVisible(entry: Pick<DocsManifestEntry, 'audience'>, audiences: ReadonlySet<DocsAudience>): boolean {
  return entry.audience.some((audience) => audiences.has(audience));
}

function buildDocsSearchEntries(docs: Iterable<DocsLoadedDoc>): RankedSearchEntry<DocsSearchCandidate>[] {
  const candidates: DocsSearchCandidate[] = [];

  for (const doc of docs) {
    candidates.push({ doc, text: doc.split.intro }, ...doc.split.sections.map((x) => ({ doc, section: x.section, text: x.ownText })));
  }

  return buildRankedSearchEntries(candidates, [
    { read: (x) => (x.section == null ? x.doc.entry.title : undefined), weights: RANKED_SEARCH_NAME_WEIGHTS },
    { read: (x) => x.section?.title, weights: RANKED_SEARCH_SLUG_WEIGHTS },
    { read: (x) => (x.section == null ? x.doc.entry.tags : undefined), weights: RANKED_SEARCH_TAG_WEIGHTS },
    { read: (x) => [x.section == null ? x.doc.entry.description : x.doc.entry.title, x.text], weights: RANKED_SEARCH_TEXT_WEIGHTS }
  ]);
}

function toDocsSnippet(text: string): string {
  const collapsed = text.replaceAll(/\s+/g, ' ').trim();
  return collapsed.length > SNIPPET_LENGTH ? `${collapsed.slice(0, SNIPPET_LENGTH - 1)}…` : collapsed;
}
