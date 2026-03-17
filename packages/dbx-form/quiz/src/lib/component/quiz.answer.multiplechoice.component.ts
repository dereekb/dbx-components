import { Component, computed, inject, model } from '@angular/core';
import { DbxButtonModule, DbxWindowKeyDownListenerDirective } from '@dereekb/dbx-web';
import { type Maybe, range } from '@dereekb/util';
import { QuizQuestionAccessor } from '../store/quiz.accessor';
import { toSignal } from '@angular/core/rxjs-interop';

const MULTIPLE_CHOICE_LETTERS = `abcdefghijklmnopqrstuvwxyz`;

/**
 * Upper-case letter label for a multiple choice option (e.g. "A", "B").
 */
export type MultipleChoiceLetter = string;

/**
 * Display text for a single multiple choice option.
 */
export type MultipleChoiceText = string;

/**
 * Answer data stored when a multiple choice option is selected.
 */
export interface MultipleChoiceAnswer {
  readonly isCorrectAnswer: boolean;
  readonly letter: MultipleChoiceLetter;
  readonly text: MultipleChoiceText;
}

/**
 * Configuration for the multiple choice answer component.
 */
export interface QuizAnswerMultipleChoiceComponentConfig {
  /**
   * Ordered list of answer option texts. Letters are auto-assigned A, B, C, etc.
   */
  readonly answerText: readonly MultipleChoiceText[];
  /**
   * Zero-based index of the correct answer, used to set `isCorrectAnswer` on the stored answer.
   */
  readonly correctAnswerIndex?: number;
}

interface QuizAnswerMultipleChoice extends MultipleChoiceAnswer {
  readonly selected?: boolean;
}

/**
 * Answer component that displays multiple choice letter-labeled buttons.
 *
 * @usage
 * Used as an answer component in a QuizQuestion's answerComponentConfig.
 * Supports keyboard shortcuts (pressing the letter key selects that answer).
 *
 * ```typescript
 * answerComponentConfig: {
 *   componentClass: QuizAnswerMultipleChoiceComponent,
 *   init: (instance: QuizAnswerMultipleChoiceComponent) => {
 *     instance.config.set({
 *       answerText: ['Option A', 'Option B', 'Option C'],
 *       correctAnswerIndex: 1
 *     });
 *   }
 * }
 * ```
 */
@Component({
  templateUrl: './quiz.answer.multiplechoice.component.html',
  imports: [DbxButtonModule, DbxWindowKeyDownListenerDirective],
  standalone: true
})
export class QuizAnswerMultipleChoiceComponent {
  readonly questionAccessor = inject<QuizQuestionAccessor<QuizAnswerMultipleChoice>>(QuizQuestionAccessor);

  readonly config = model<Maybe<QuizAnswerMultipleChoiceComponentConfig>>();

  readonly currentAnswerSignal = toSignal(this.questionAccessor.answer$);
  readonly currentAnswerValueSignal = computed(() => this.currentAnswerSignal()?.data);

  readonly choicesSignal = computed(() => {
    const config = this.config();

    const currentAnswer = this.currentAnswerValueSignal();
    const answers = config?.answerText ?? [];
    const correctAnswerIndex = config?.correctAnswerIndex;

    const choices: QuizAnswerMultipleChoice[] = answers.map((text, i) => {
      const letter = MULTIPLE_CHOICE_LETTERS[i];

      return {
        letter: MULTIPLE_CHOICE_LETTERS[i].toUpperCase(),
        text,
        selected: currentAnswer?.letter === letter,
        isCorrectAnswer: correctAnswerIndex === i
      };
    });

    return choices;
  });

  readonly relevantKeysSignal = computed<string[]>(() => {
    const answersCount = this.config()?.answerText.length ?? 0;
    const relevantKeys = [];

    const numbersRange = answersCount > 0 ? range(1, answersCount + 1) : [];

    for (const number of numbersRange) {
      const answerLetter = MULTIPLE_CHOICE_LETTERS[number - 1];
      relevantKeys.push(answerLetter);
    }

    return relevantKeys;
  });

  clickedAnswer(answer: QuizAnswerMultipleChoice) {
    this.questionAccessor.setAnswer(answer);
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key.length === 1) {
      const choices = this.choicesSignal();
      const selectedLetter = event.key.toUpperCase();
      const choice = choices.find((x) => x.letter === selectedLetter);

      if (choice) {
        this.clickedAnswer(choice);
      }
    }
  }
}
