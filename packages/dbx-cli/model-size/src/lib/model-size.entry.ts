import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseModelSizeProfile, type ModelSizeProfile } from './model-size.profile';
import { resolveConverter, resolveSourcePath } from './model-size.resolve';
import { runModelSize, type ModelSizeReport } from './model-size.run';

function loadSampleFile(sampleFile: string, profilePath: string): Record<string, unknown> {
  const resolved = resolveSourcePath(sampleFile, profilePath);
  const parsed = JSON.parse(readFileSync(resolved, 'utf8')) as unknown;

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Sample file '${resolved}' must contain a JSON object.`);
  }

  return parsed as Record<string, unknown>;
}

function applySampleFile(profile: ModelSizeProfile, profilePath: string): ModelSizeProfile {
  let result: ModelSizeProfile;

  if (profile.sampleFile) {
    const fromFile = loadSampleFile(profile.sampleFile, profilePath);
    // Inline `sample` values win over the referenced file.
    result = { ...profile, sample: { ...fromFile, ...profile.sample } };
  } else {
    result = profile;
  }

  return result;
}

/**
 * Computes a {@link ModelSizeReport} from a profile JSON file path: parses and
 * validates the profile, resolves any `sampleFile`, imports the target
 * converter, and runs the sizing pipeline.
 *
 * @param profilePath - Path to the profile JSON file (absolute or relative to
 *   the working directory).
 * @returns The structured run result.
 *
 * @example
 * ```ts
 * const report = await computeModelSizeFromProfileFile('packages/dbx-cli/model-size/example.profile.json');
 * ```
 */
export async function computeModelSizeFromProfileFile(profilePath: string): Promise<ModelSizeReport> {
  const absoluteProfilePath = resolve(process.cwd(), profilePath);
  const raw = JSON.parse(readFileSync(absoluteProfilePath, 'utf8')) as unknown;
  const profile = applySampleFile(parseModelSizeProfile(raw), absoluteProfilePath);
  const resolved = await resolveConverter({ profile, profilePath: absoluteProfilePath });
  return runModelSize({ resolved, profile });
}
