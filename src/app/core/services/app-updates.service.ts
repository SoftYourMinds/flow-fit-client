import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ModalController } from '@ionic/angular';
import { Observable, tap, of, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { WhatsNewModalComponent } from '../../components/whats-new-modal/whats-new-modal.component';

export interface AppUpdateGroup {
  category: string;
  items: string[];
}

export interface AppReleaseUpdate {
  version: string;
  title: string;
  releaseDate: string;
  badge?: string;
  highlights: string[];
  groups: AppUpdateGroup[];
}

export const FALLBACK_APP_UPDATES: AppReleaseUpdate[] = [
  {
    version: '0.3.0',
    title: 'Оновлення FlowFit (v0.3.0)',
    releaseDate: '2026-10-23',
    badge: 'Новинка',
    highlights: [
      'Кастомні теми та конструктор палітри',
      '8 готових дизайнерських колірних пресетів',
      'Стилі темного фону: OLED чорний, графіт та відтінковий',
      'Розумна авто-гармонізація кольорів',
    ],
    groups: [
      {
        category: '🎨 Кастомні теми та конструктор',
        items: [
          'Повноцінний конструктор теми: обирайте будь-який колір для інтерфейсу за допомогою інтерактивної палітри або Hex-коду.',
          'Кнопка авто-гармонізації: швидкий інтелектуальний розрахунок додаткового акцентного кольору для гармонійного вигляду.',
          '3 стилі темного фону: абсолютний OLED чорний (#000000) для заощадження заряду, класичний графіт або трендовий відтінковий темний фон.',
          'Живий попередній перегляд: перевіряйте вигляд кнопок, бейджів та карток у реальному часі прямо в налаштуваннях.',
        ],
      },
      {
        category: '🌈 8 готових дизайнерських пресетів',
        items: [
          'Теракота (Оригінал FlowFit) — фірмовий теплий нюдовий преміум-стиль.',
          'Смарагд — свіжий та енергійний фітнес-зелений для балансу та енергії.',
          'Кіберпанк — драйвовий неоновий фіолетовий та індиго.',
          'Океан — спокійний королівський сапфіровий колір.',
          'Багряний — вогняний червоний для максимальної мотивації.',
          'Бурштин — тепле сяйво вечірнього сонця та золота.',
          'Графіт — сучасний стриманий скандинавський мінімалізм.',
          'Півонія — ніжний рожевий люкс.',
        ],
      },
      {
        category: '☀️ Режими відображення',
        items: [
          'Зручний вибір режиму: Світла, Темна або Автоматична (системна) тема, що підлаштовується під налаштування пристрою.',
          'Усі пресети та власна тема бездоганно адаптовані як під світлий, так і під темний інтерфейс.',
        ],
      },
    ],
  },
  {
    version: '0.2.0',
    title: 'Оновлення FlowFit (v0.2.0)',
    releaseDate: '2026-10-02',
    badge: 'Попереднє',
    highlights: [
      'Абонементи клієнтів з авто-списанням',
      'Майстер регулярних тренувань',
      'Гнучкий облік учасників',
      'Підвищення стабільності та швидкодії',
    ],
    groups: [
      {
        category: '🎟 Абонементи клієнтів',
        items: [
          'Додано підтримку абонементів: як на фіксовану кількість занять, так і на діапазон дат.',
          'Автоматичне списання тренувань з активного абонемента та відстеження залишку занять.',
          'Зручне керування абонементами прямо з картки клієнта (перегляд списку занять, відкріплення занять).',
        ],
      },
      {
        category: '🔁 Регулярні тренування та майстер створення',
        items: [
          'Швидке створення серії тренувань за розкладом (наприклад, щопонеділка та щоп’ятниці) на кілька тижнів вперед.',
          'Створення абонемента одразу з регулярним графіком в один клік через оновлений майстер.',
          'Інтелектуальна перевірка перетину часу з існуючими тренуваннями та попередній перегляд дат.',
          'Блискавичне транзакційне створення всієї серії занять без затримок.',
        ],
      },
      {
        category: '👥 Гнучкий облік учасників',
        items: [
          'Можливість задавати ліміт кількості учасників для групових занять.',
          'Підтримка анонімних/разових учасників без обов’язкового створення картки клієнта.',
        ],
      },
      {
        category: '⚡ Стабільність та швидкість',
        items: [
          'Оптимізовано синхронізацію з хмарною базою даних (усунено затримки та таймаути при роботі з графіком).',
          'Коректна обробка часових поясів.',
        ],
      },
    ],
  },
  {
    version: '0.1.0',
    title: 'Реліз FlowFit (v0.1.0)',
    releaseDate: '2026-08-01',
    badge: 'Базова версія',
    highlights: ['Розклад та клієнтська база', 'Telegram-бот сповіщень', 'Звіти та фінанси'],
    groups: [
      {
        category: '📅 Розклад та тренування',
        items: [
          'Зручний календар занять з індивідуальними та груповими тренуваннями.',
          'Керування локаціями та статусами занять.',
        ],
      },
      {
        category: '🤖 Telegram-бот',
        items: [
          'Підключення персонального бота для тренера.',
          'Щоденні дайджести тренувань та нагадування.',
        ],
      },
    ],
  },
];

@Injectable({
  providedIn: 'root'
})
export class AppUpdatesService {
  private readonly http = inject(HttpClient);
  private readonly modalCtrl = inject(ModalController);

  private readonly apiUrl = `${environment.apiUrl}/app-updates`;
  private readonly STORAGE_KEY = 'flowfit_last_seen_version';

  readonly latestUpdate = signal<AppReleaseUpdate | null>(null);
  readonly pendingUpdateToShow = signal<AppReleaseUpdate | null>(null);

  /**
   * Викликається паралельно під час прелоадера (AppInitService)
   */
  checkUpdatesDuringPreload(): Observable<AppReleaseUpdate | null> {
    return this.http.get<AppReleaseUpdate>(`${this.apiUrl}/latest`, {
      headers: { 'x-silent-request': 'true' }
    }).pipe(
      catchError(() => of(FALLBACK_APP_UPDATES[0])),
      tap((update) => {
        if (!update) return;
        this.latestUpdate.set(update);

        const lastSeen = localStorage.getItem(this.STORAGE_KEY);
        if (update.version !== lastSeen) {
          this.pendingUpdateToShow.set(update);
        }
      })
    );
  }

  getAllUpdates(): Observable<AppReleaseUpdate[]> {
    return this.http.get<AppReleaseUpdate[]>(this.apiUrl).pipe(
      catchError(() => of(FALLBACK_APP_UPDATES))
    );
  }

  /**
   * Відкриває модалку оновлень після завершення лоадера
   */
  async triggerPendingModalIfAvailable(): Promise<void> {
    const update = this.pendingUpdateToShow();
    if (!update) return;

    const modal = await this.modalCtrl.create({
      component: WhatsNewModalComponent,
      componentProps: { update },
      breakpoints: [0, 0.85, 1],
      initialBreakpoint: 0.85,
      handle: true,
      cssClass: 'whats-new-modal-sheet'
    });

    await modal.present();
    this.markAsSeen(update.version);
  }

  markAsSeen(version: string): void {
    localStorage.setItem(this.STORAGE_KEY, version);
    this.pendingUpdateToShow.set(null);
  }
}
