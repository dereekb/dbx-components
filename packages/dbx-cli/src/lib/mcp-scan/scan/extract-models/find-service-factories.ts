/**
 * Walks every `@dbxModelServiceFactory <modelType>`-tagged variable export in a ts-morph
 * source file and returns one {@link ExtractedServiceFactory} per tagged binding.
 *
 * The model extractor calls this once per parsed source file; the extractor's post-pass joins
 * the resulting entries onto each {@link FirebaseModel} by `modelType`.
 */

import type { SourceFile } from 'ts-morph';
import { collectTaggedVariables } from '../_jsdoc-tagged-export/extract-base.js';
import { DBX_MODEL_SERVICE_FACTORY_TAG } from './service-factory-constants.js';
import type { ExtractedServiceFactory } from './types.js';

/**
 * camelCase identifier pattern for `@dbxModelServiceFactory <modelType>` values. Mirrors
 * the ESLint rule's check so silently-dropped values here align with what the lint flags.
 */
const MODEL_TYPE_VALUE_PATTERN = /^[a-z][A-Za-z0-9_$]*$/;

/**
 * Collects every `@dbxModelServiceFactory <modelType>` tagged variable export from a source
 * file. Each tagged statement yields one entry per declarator (mirroring the underlying
 * `collectTaggedVariables` shape). Invalid or missing values are silently dropped — the
 * ESLint rule is the user-facing gate.
 *
 * @param sf - The parsed source file to inspect.
 * @returns The tagged factories in source order.
 */
export function findServiceFactories(sf: SourceFile): readonly ExtractedServiceFactory[] {
  const out: ExtractedServiceFactory[] = [];
  for (const candidate of collectTaggedVariables(sf, DBX_MODEL_SERVICE_FACTORY_TAG)) {
    const modelType = readModelTypeValue(candidate.jsDocs);
    if (modelType === undefined) continue;
    out.push({
      modelType,
      exportName: candidate.decl.getName()
    });
  }
  return out;
}

function readModelTypeValue(jsDocs: ReadonlyArray<{ getTags(): { getTagName(): string; getCommentText(): string | undefined }[] }>): string | undefined {
  let result: string | undefined;
  for (const jsDoc of jsDocs) {
    for (const tag of jsDoc.getTags()) {
      if (tag.getTagName() !== DBX_MODEL_SERVICE_FACTORY_TAG) continue;
      if (result !== undefined) continue;
      const raw = tag.getCommentText()?.trim();
      if (raw === undefined || raw.length === 0) continue;
      const firstToken = raw.split(/\s+/)[0];
      if (MODEL_TYPE_VALUE_PATTERN.test(firstToken)) {
        result = firstToken;
      }
    }
  }
  return result;
}
