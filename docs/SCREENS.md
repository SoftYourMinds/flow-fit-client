# FlowFit — Screen Map & Navigation

## Navigation Architecture

```mermaid
graph TD
    A[App Start] --> B{Has Token?}
    B -->|No| C[/auth/login]
    B -->|Yes| D[/tabs]
    C --> E[/auth/register]
    E --> C
    C --> D
    D --> F[/tabs/scheduler]
    D --> G[/tabs/clients]
    D --> H[/tabs/reports]
    D --> I[/tabs/settings]
    F --> J[/sessions/new]
    F --> K[/sessions/:id]
    G --> L[/clients/:id]
    L --> M["Client Tabs: Інфо | Прогрес | Нотатки | Історія"]
    I --> N[/locations]
```

---

## Screen Descriptions

### S1: Login (`/auth/login`)
- Logo + app name
- Email input
- Password input
- "Увійти" button
- "Зареєструватися" link → `/auth/register`

### S2: Register (`/auth/register`)
- Ім'я input
- Прізвище input
- Email input
- Пароль input
- Підтвердження паролю input
- "Зареєструватися" button
- "Вже є акаунт?" link → `/auth/login`

### S3: Scheduler Dashboard (`/tabs/scheduler`)
**Primary screen.** Two view modes toggled by `ion-segment`.

#### List View
- Segment: Сьогодні | Тиждень | Місяць
- Session cards:
  - Time range (10:00 — 11:00)
  - Location name
  - Session type badge (Індивід. / Груп.)
  - Status badge (colored)
  - Participant count + total price
  - Quick action: change status
- FAB button: "+" → create new session
- Pull-to-refresh

#### Calendar View
- Weekly/monthly calendar grid
- Dots on days with sessions
- Tap day → show sessions list below
- Filter bar: тип, статус, локація

### S4: Client List (`/tabs/clients`)
- Search bar (by ПІБ / phone)
- Segment: Активні | Архівні
- Client cards:
  - Avatar placeholder (initials)
  - Full name
  - Goal tag
  - Last session date
- FAB button: "+" → create client modal
- Pull-to-refresh

### S5: Client Detail (`/clients/:id`)
- Header: client name + back button
- Tabs (ion-segment):

#### Tab: Інфо
- Full name, phone, goal
- Personal info, current weight
- Comments
- Google Drive link (if set)
- Edit button → edit modal

#### Tab: Прогрес
- Weight chart (line graph)
- Metrics history list (date, weight, note)
- "Додати запис" button

#### Tab: Нотатки
- Notes list (newest first)
- Each note: text + clickable link cards
- "Додати нотатку" button → modal

#### Tab: Історія
- Past sessions list
- Upcoming sessions list
- Each with: date, location, status badge

### S6: Create/Edit Session (`/sessions/new` or `/sessions/:id`)
- Session type selector (INDIVIDUAL / GROUP)
- Location picker (from locations list)
- Date picker (ion-datetime)
- Start time / End time
- Price per person input
- Participants section:
  - Client search (autocomplete)
  - Custom name text input
  - Participant list with remove button
  - Total: price × count
- Save button

### S7: Reports (`/tabs/reports`)
- Period selector: Тиждень | Місяць | Обрати дати
- Income card: загальний дохід
- Breakdown: Індивідуальні | Групові
- Stats cards:
  - Проведено годин
  - Кількість тренувань
  - Пропущено (%)
  - Активних клієнтів

### S8: Settings (`/tabs/settings`)
- Profile section: ім'я, email (editable)
- Telegram section:
  - Status: підключено / не підключено
  - Instructions for linking
- Notifications section:
  - Toggle: нагадування за 3 години
  - Toggle: нагадування за 1 годину
- Locations management link → `/locations`
- Logout button

### S9: Locations (`/locations`)
- Location list with edit/delete
- "Додати локацію" button → modal
- Each: name, type badge, address

---

## UI Components Inventory

| Component            | Usage                                     |
| -------------------- | ----------------------------------------- |
| Status Badge         | Session status colored pill               |
| Session Card         | Scheduler list item                       |
| Client Card          | Client list item                          |
| Note Card            | Client notes with links                   |
| Metrics Row          | Metrics history list item                 |
| Stats Card           | Reports page summary card                 |
| Participant Chip     | Session participant name chip             |
| Empty State          | "Немає тренувань" / "Немає клієнтів"      |
| Loading Skeleton     | Shimmer placeholder during loading        |
| Period Selector      | Date range picker component               |
