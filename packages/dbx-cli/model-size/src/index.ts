/**
 * `@dereekb/dbx-cli-model-size` — a design-time calculator that round-trips a
 * sized sample model through a Firestore snapshot converter's `to` conversion
 * and measures the stored document against the 1 MB limit.
 *
 * Run via the `size` nx target (vitest harness); the engine is also exported
 * here for programmatic use.
 */
export * from './lib/model-size.profile';
export * from './lib/model-size.kind';
export * from './lib/model-size.sample';
export * from './lib/model-size.measure';
export * from './lib/model-size.solve';
export * from './lib/model-size.resolve';
export * from './lib/model-size.run';
export * from './lib/model-size.report';
export * from './lib/model-size.entry';
