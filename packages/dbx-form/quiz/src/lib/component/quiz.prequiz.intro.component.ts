import { Component, computed, inject, model } from '@angular/core';
import { QuizStore } from '../store/quiz.store';
import { DbxButtonModule } from '@dereekb/dbx-web';
import { type Maybe, type MaybeMap } from '@dereekb/util';
import { toSignal } from '@angular/core/rxjs-interop';
import { type QuizTitleDetails } from '../store/quiz';

/**
 * Config for the pre-quiz intro component.
 *
 * Overrides the title details.
 */
export type QuizPreQuizIntroConfig = Partial<MaybeMap<QuizTitleDetails>>;

/**
 * Pre-quiz intro component that displays the quiz title, subtitle, description, and a start button.
 *
 * @usage
 * Used as a preQuizComponentConfig in a Quiz definition.
 * Inherits title details from the quiz unless overridden via config.
 *
 * ```typescript
 * preQuizComponentConfig: {
 *   componentClass: QuizPreQuizIntroComponent,
 *   init: (instance: QuizPreQuizIntroComponent) => {
 *     instance.config.set({ subtitle: 'Custom subtitle' });
 *   }
 * }
 * ```
 */
@Component({
  templateUrl: './quiz.prequiz.intro.component.html',
  imports: [DbxButtonModule],
  standalone: true
})
export class QuizPreQuizIntroComponent {
  readonly quizStore = inject(QuizStore);

  readonly config = model<Maybe<QuizPreQuizIntroConfig>>();
  readonly quizTitleDetailsSignal = toSignal(this.quizStore.titleDetails$);

  readonly configSignal = computed(() => {
    const config = this.config();
    const titleDetails = this.quizTitleDetailsSignal();

    return {
      title: config?.title ?? titleDetails?.title,
      subtitle: config?.subtitle ?? titleDetails?.subtitle,
      description: config?.description ?? titleDetails?.description
    };
  });

  readonly titleSignal = computed(() => this.configSignal()?.title);
  readonly subtitleSignal = computed(() => this.configSignal()?.subtitle);
  readonly descriptionSignal = computed(() => this.configSignal()?.description);
}
