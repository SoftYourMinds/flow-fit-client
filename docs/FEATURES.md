# FlowFit — Feature List (Detailed)

## Feature Matrix

| #  | Feature                | Priority | Phase | Status  |
| -- | ---------------------- | -------- | ----- | ------- |
| F1 | Auth (Register/Login)  | Critical | 1     | Planned |
| F2 | Client CRUD            | Critical | 1     | Planned |
| F3 | Location CRUD          | High     | 1     | Planned |
| F4 | Workout Sessions CRUD  | Critical | 2     | Planned |
| F5 | Scheduler (List View)  | Critical | 2     | Planned |
| F6 | Scheduler (Calendar)   | High     | 2     | Planned |
| F7 | Participants           | Critical | 2     | Planned |
| F8 | Client Notes           | Medium   | 3     | Planned |
| F9 | Metrics History        | Medium   | 3     | Planned |
| F10| Client Session History | Medium   | 3     | Planned |
| F11| Income Reports         | Medium   | 4     | Planned |
| F12| Statistics             | Low      | 4     | Planned |
| F13| Telegram Bot           | Medium   | 5     | Planned |
| F14| Auto Status Cron       | Medium   | 6     | Planned |
| F15| Telegram Reminders     | Medium   | 6     | Planned |

---

## Detailed Feature Descriptions

### F1: Authentication

**User Story:** Як тренер, я хочу зареєструватися та увійти в систему, щоб мій розклад та клієнти були захищені.

**Screens:** Login Page, Register Page
**API:** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`

**Acceptance Criteria:**
- Форма реєстрації: email, пароль, ім'я, прізвище
- Форма логіну: email, пароль
- JWT зберігається в localStorage/Capacitor Storage
- HttpInterceptor автоматично додає Bearer token
- При 401 — автоматичний refresh або redirect на логін

### F2: Client Management

**User Story:** Як тренер, я хочу вести базу своїх клієнтів з контактами та цілями.

**Screens:** Client List, Client Detail (tabs), Client Create/Edit Modal
**API:** `GET /clients`, `POST /clients`, `PATCH /clients/:id`, `DELETE /clients/:id`

**Acceptance Criteria:**
- Пошук по ПІБ та телефону
- Фільтр по активних/архівних
- Профіль з 4 вкладками (Інфо, Прогрес, Нотатки, Історія)
- Кнопка "Додати клієнта" → модальне вікно

### F4: Workout Session Management

**User Story:** Як тренер, я хочу створювати тренування (індивідуальні та групові) та бачити їх в розкладі.

**Screens:** Session Create/Edit, Scheduler Dashboard
**API:** `POST /workout-sessions`, `GET /scheduler`, `PATCH /workout-sessions/:id/status`

**Acceptance Criteria:**
- Вибір типу (індивідуальне/групове)
- Вибір локації з існуючих
- Вибір дати/часу через ion-datetime
- Ввід ціни за особу
- Додавання учасників (існуючий клієнт або текстове ім'я)
- Автоматичний підрахунок суми
- Зміна статусу одним тапом

### F5: Scheduler — List View

**User Story:** Як тренер, я хочу бачити хронологічний список тренувань на сьогодні/завтра/тиждень.

**UI Elements:**
- Сегментований перемикач: Сьогодні | Тиждень | Місяць
- Картки тренувань з: час, локація, тип, учасники, статус-бейдж
- Pull-to-refresh
- FAB кнопка "+" для швидкого створення

### F6: Scheduler — Calendar View

**User Story:** Як тренер, я хочу бачити тренування на календарній сітці.

**UI Elements:**
- Тижневий/місячний вид
- Точки/іконки на днях з тренуваннями
- Клік по дню → список тренувань цього дня
- Фільтри: тип, локація, статус

### F7: Session Participants

**User Story:** Як тренер, я хочу додавати людей на тренування — як існуючих клієнтів, так і разових гостей.

**UI Elements:**
- Autocomplete пошук по існуючих клієнтах
- Поле для введення текстового імені
- Список учасників сесії з можливістю видалення
- Сума за заняття = ціна × кількість учасників

### F8: Client Notes

**User Story:** Як тренер, я хочу залишати нотатки про клієнта та прикріплювати посилання.

**UI Elements:**
- Список нотаток (newest first)
- Кнопка "Додати нотатку" → модальне вікно
- Текстове поле + поля для URL
- Посилання відображаються як клікабельні картки
