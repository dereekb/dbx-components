/**
 * `@dereekb/llm/craft` — craft notes: the note model and its markdown parser, the site registry, selection, the judge
 * and the craft prompt contributor. OPT-IN: the root entry does not re-export it, so a host without craft never loads
 * it. Browser-safe like the root. A child of this family imports craft from this subpath (the only path).
 */
export * from './lib/craft';
