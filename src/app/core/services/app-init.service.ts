import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from './sessions.service';

export type InitStep =
  | 'connecting'
  | 'waking'
  | 'server_ready'
  | 'loading_data'
  | 'ready'
  | 'error';

@Injectable({
  providedIn: 'root'
})
export class AppInitService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly sessionsService = inject(SessionsService);

  private wakeUpTimer: ReturnType<typeof setTimeout> | null = null;
  private isInitializedOnce = false;

  // ─── State Signals ─────────────────────────────────────────────

  readonly isInitializing = signal<boolean>(true);
  readonly isFadingOut = signal<boolean>(false);
  readonly currentStep = signal<InitStep>('connecting');
  readonly stepTitle = signal<string>('Підключення до сервера...');
  readonly stepDescription = signal<string>('Встановлюємо зв’язок із хмарним сервісом');
  readonly progress = signal<number>(15);
  readonly canRetry = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  // ─── Public Methods ─────────────────────────────────────────────

  /**
   * Starts the initial warm-up sequence for serverless backend.
   */
  async startAppInitialization(): Promise<void> {
    if (this.isInitializedOnce) {
      this.isInitializing.set(false);
      return;
    }

    return this.runInitializationSequence();
  }

  /**
   * Retries connection sequence in case of a timeout or network glitch.
   */
  async retry(): Promise<void> {
    this.canRetry.set(false);
    this.errorMessage.set(null);
    this.isFadingOut.set(false);
    this.isInitializing.set(true);

    return this.runInitializationSequence();
  }

  /**
   * Allows the user to skip the splash screen and enter the app directly.
   */
  skipToApp(): void {
    this.clearWakeTimer();
    this.finishAndExit();
  }

  // ─── Business Logic ─────────────────────────────────────────────

  private async runInitializationSequence(): Promise<void> {
    this.setStep('connecting', 'Підключення до сервера...', 'Встановлюємо зв’язок із хмарним сервісом', 20);
    this.scheduleWakeUpNotice();

    try {
      await this.pingBackend();
      this.clearWakeTimer();

      this.setStep('server_ready', 'Сервер на зв’язку!', 'Перевірка статусу та синхронізація', 65);
      await this.delay(300);

      const token = localStorage.getItem('access_token');
      await this.handleDataPreloadPhase(token);

      this.setStep('ready', 'Майже готово!', 'Ласкаво просимо до FlowFit', 100);
      await this.delay(350);

      this.isInitializedOnce = true;
      this.finishAndExit();
    } catch (err) {
      this.clearWakeTimer();
      this.handleInitError(err);
    }
  }

  private async handleDataPreloadPhase(token: string | null): Promise<void> {
    if (!token) {
      this.setStep('ready', 'Майже готово...', 'Підготовка робочого простору', 90);
      await this.delay(250);
      return;
    }

    this.setStep('loading_data', 'Завантаження ваших тренувань...', 'Синхронізація розкладу та записів', 85);
    await this.preloadUserData();
  }

  private async pingBackend(): Promise<void> {
    const ping$ = this.http
      .get(environment.apiUrl, {
        responseType: 'text',
        headers: {
          'x-silent-request': 'true',
          'x-silent-error': 'true'
        }
      })
      .pipe(
        timeout(25000),
        catchError((err) => {
          // If 404 or other HTTP status returned, server is still alive
          if (err?.status && err.status !== 0) {
            return of('OK');
          }
          throw err;
        })
      );

    await firstValueFrom(ping$);
  }

  private async preloadUserData(): Promise<void> {
    try {
      // Warm up user data and scheduler list simultaneously
      const sessions$ = this.sessionsService.getAll().pipe(
        timeout(8000),
        catchError(() => of([]))
      );

      await firstValueFrom(sessions$);
    } catch {
      // Soft failure: we proceed anyway so user isn't blocked
    }
  }

  private finishAndExit(): void {
    this.isFadingOut.set(true);
    setTimeout(() => {
      this.isInitializing.set(false);
      this.isFadingOut.set(false);
    }, 450);
  }

  // ─── Private Helpers ────────────────────────────────────────────

  private setStep(step: InitStep, title: string, description: string, progressValue: number): void {
    this.currentStep.set(step);
    this.stepTitle.set(title);
    this.stepDescription.set(description);
    this.progress.set(progressValue);
  }

  private scheduleWakeUpNotice(): void {
    this.clearWakeTimer();
    this.wakeUpTimer = setTimeout(() => {
      if (this.currentStep() === 'connecting') {
        this.setStep(
          'waking',
          'Сервер прокидається...',
          'Хмарна інфраструктура активується після паузи — це займе кілька секунд ☕',
          45
        );
      }
    }, 2400);
  }

  private clearWakeTimer(): void {
    if (!this.wakeUpTimer) return;
    clearTimeout(this.wakeUpTimer);
    this.wakeUpTimer = null;
  }

  private handleInitError(error: unknown): void {
    this.currentStep.set('error');
    this.canRetry.set(true);
    this.stepTitle.set('Сервер потребує трохи більше часу');
    this.stepDescription.set('Можливо, повільне інтернет-з’єднання або сервер ще запускається. Спробуйте оновити.');
    this.errorMessage.set(error instanceof Error ? error.message : 'Connection timeout');
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
