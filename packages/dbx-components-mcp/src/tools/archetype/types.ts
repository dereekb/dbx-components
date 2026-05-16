/**
 * Shared questionnaire / scoring types for the `dbx_model_archetype_*` tool cluster.
 *
 * The questionnaire shape lives here so the input parser
 * (`recommend.tool`), the scorer (`score.ts`), the axes derivation
 * (`axes.ts`), and the markdown formatter (`format.ts`) all read from one
 * source of truth.
 */

import type { ModelArchetypeDocIdSource, ModelArchetypeMutability, ModelArchetypeParentRelation, ModelArchetypeSyncMode, ModelArchetypeUserRelation } from '../../registry/archetypes.js';

/**
 * Filled questionnaire — the recommender's primary input. Mirrors the schema
 * documented in the planning doc (`§4.1`); fields are optional so the caller
 * can pass an incomplete answer set and still get a best-effort scoring.
 *
 * The `syncMode = 'unsure'` variant from the planning doc collapses to
 * `undefined` here — callers can pass `undefined` to skip the dimension.
 */
export interface ArchetypeQuestionnaire {
  // === Section A: Identity ===
  readonly candidateName?: string;
  readonly candidateGroup?: string;
  readonly domainDescription?: string;

  // === Section B: Doc id + parent relation ===
  readonly docIdSource?: ModelArchetypeDocIdSource;
  readonly parentRelation?: ModelArchetypeParentRelation;
  readonly parentModelType?: string;
  readonly instancesPerParent?: 'one' | 'many';

  // === Section C: User relation ===
  readonly userRelation?: ModelArchetypeUserRelation;

  // === Section D: Data character ===
  readonly isDenormalization?: boolean;
  readonly denormalizesFrom?: readonly string[];
  readonly aggregatesFrom?: readonly string[];
  readonly isSiblingAggregate?: boolean;
  readonly hasInheritance?: boolean;
  readonly isExternalMirror?: boolean;
  readonly externalSystemName?: string;
  readonly isEventLog?: boolean;

  // === Section E: Sync ===
  readonly syncMode?: ModelArchetypeSyncMode;
  readonly hasSyncFlag?: boolean;

  // === Section F: Lifecycle ===
  readonly hasLifecycleStates?: boolean;
  readonly lifecycleStateExamples?: readonly string[];
  readonly mutability?: ModelArchetypeMutability;
  readonly hasArchiveCounterpart?: boolean;
  readonly archiveCounterpartName?: string;

  // === Section G: Access ===
  readonly actors?: readonly string[];
  readonly hasSensitiveFields?: boolean;
  readonly needsFineGrainedPermissions?: boolean;

  // === Section H: Group context ===
  readonly isGroupRoot?: boolean;
  readonly hasMembers?: boolean;
  readonly needsMemberSummary?: boolean;

  // === Section I: Extension-cluster signals ===
  readonly involvesFileUpload?: boolean;
  readonly sendsMessageToUser?: boolean;
  readonly isMultiCheckpointWorkflow?: boolean;
  readonly isSubsystemSingleton?: boolean;

  // === Section J: Embedding hint ===
  readonly estimatedItemsPerParent?: '0-50' | '50-500' | '500+' | 'unknown';
  readonly alwaysReadWithParent?: boolean;
}
