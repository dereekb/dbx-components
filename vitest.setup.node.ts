/**
 * Must be imported here so the Reflect functionality is available in the Vitest instance.
 */
import 'reflect-metadata';

/**
 * Extend Vitest with our custom matchers and functionality.
 */
import './packages/vitest/src/extend';
