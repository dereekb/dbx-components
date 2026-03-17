import { type DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { type IndexNumber } from '@dereekb/util';

/**
 * Unique identifier for a quiz instance.
 */
export type QuizId = string;

/**
 * Unique identifier for a question within a quiz.
 */
export type QuizQuestionId = string;

/**
 * Zero-based index of the currently selected question.
 */
export type QuestionIndex = IndexNumber;

/**
 * Full quiz definition including metadata, questions, and injection configs for pre/post views.
 *
 * @example
 * ```ts
 * const quiz: Quiz = {
 *   id: 'onboarding',
 *   titleDetails: { title: 'Onboarding Quiz' },
 *   questions: [{ id: 'q1', questionComponentConfig: { ... }, answerComponentConfig: { ... } }],
 *   resultsComponentConfig: { componentClass: MyResultsComponent }
 * };
 * ```
 */
export interface Quiz {
  readonly id: QuizId;
  /**
   * Title details for the quiz.
   */
  readonly titleDetails: QuizTitleDetails;
  /**
   * Questions to display. The questions are displayed in order.
   */
  readonly questions: QuizQuestion[];
  /**
   * Component config for the pre-quiz view.
   */
  readonly preQuizComponentConfig?: DbxInjectionComponentConfig<any>;
  /**
   * Component config for the results view.
   */
  readonly resultsComponentConfig: DbxInjectionComponentConfig<any>;
}

/**
 * Display metadata for a quiz header area.
 */
export interface QuizTitleDetails {
  /**
   * Name/title of the quiz
   */
  readonly title: string;
  /**
   * Subtitle of the quiz
   */
  readonly subtitle?: string;
  /**
   * Description of the quiz
   */
  readonly description?: string;
}

/**
 * Pairs a question id with the user's typed answer data.
 */
export interface QuizAnswer<T = unknown> {
  /**
   * Id of the question this answer belongs to.
   */
  readonly id: QuizQuestionId;
  /**
   * The answer payload, typed per-question component.
   */
  readonly data: T;
}

/**
 * Lightweight pair linking a question id to its positional index in the quiz.
 */
export interface QuizQuestionIdIndexPair {
  readonly id: QuizQuestionId;
  readonly index: QuestionIndex;
}

/**
 * Single question definition within a quiz, pairing a display component with an answer component.
 */
export interface QuizQuestion {
  /**
   * Question id. Should be unique in the quiz.
   */
  readonly id: QuizQuestionId;
  /**
   * Question component config
   */
  readonly questionComponentConfig: DbxInjectionComponentConfig<any>;
  /**
   * Answer component config
   */
  readonly answerComponentConfig: DbxInjectionComponentConfig<any>;
}

/**
 * A QuizQuestion enriched with its positional index, used by the store to track the current question.
 */
export interface QuizQuestionWithIndex extends QuizQuestion, QuizQuestionIdIndexPair {}
