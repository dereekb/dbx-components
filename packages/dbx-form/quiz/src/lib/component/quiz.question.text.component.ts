import { Component, computed, model } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Configuration for the text-based question display. Used with `quizAgreementPrompt()` and
 * `quizFrequencyPrompt()` helpers for Likert-scale questions.
 */
export interface QuizQuestionTextComponentConfig {
  /**
   * Instructional prompt displayed above the main text (e.g. "Rate how much you agree:").
   */
  readonly prompt?: string;
  /**
   * The primary question or statement text.
   */
  readonly text: string;
  /**
   * Scale guidance displayed below the text (e.g. "1 = Strongly Disagree, 5 = Strongly Agree").
   */
  readonly guidance?: string;
}

/**
 * Question component that displays text with optional prompt and guidance.
 *
 * @usage
 * Used as a questionComponentConfig in a QuizQuestion definition.
 *
 * ```typescript
 * questionComponentConfig: {
 *   componentClass: QuizQuestionTextComponent,
 *   init: (instance: QuizQuestionTextComponent) => {
 *     instance.config.set({ text: 'How do you handle ambiguity?', prompt: 'Rate yourself:', guidance: '1=Never, 5=Always' });
 *   }
 * }
 * ```
 */
@Component({
  templateUrl: './quiz.question.text.component.html',
  standalone: true
})
export class QuizQuestionTextComponent {
  readonly config = model<Maybe<QuizQuestionTextComponentConfig>>();

  readonly promptSignal = computed(() => this.config()?.prompt);
  readonly textSignal = computed(() => this.config()?.text);
  readonly guidanceSignal = computed(() => this.config()?.guidance);
}
