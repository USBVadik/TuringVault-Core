# Design Enhancement Requirements

> **Цель**: Поднять визуальный уровень TuringVault до топовых DeFi/AI продуктов (dYdX, Linear, Vercel, Uniswap, Aave) без нарушения существующего UX и функциональности.

## Контекст

### Текущее состояние

- **Stack**: Next.js 14 + Tailwind CSS + Lucide-react icons
- **Design system**: Частично реализован (glass-card, orb-bg, animations)
- **Стиль**: Linear/Vercel/dYdX aesthetic — тёмная тема, glassmorphism, градиенты
- **Страницы**: Dashboard, Challenge, Backtest, Proof Explorer, Discipline, Social

### Сильные стороны (сохранить)

- ✅ Glassmorphism карточки с hover-эффектами
- ✅ Animated orb background
- ✅ Live terminal component
- ✅ Честные статус-бейджи (LIVE/IDLE/OFFLINE)
- ✅ Responsive grid layouts
- ✅ Consistent color palette (purple/green)

### Проблемы (исправить)

#### P0 — Критические (влияют на восприятие качества)

1. **Emoji вместо иконок** — `📈`, `🔴`, `🟢`, `⛓️`, `⚡`, `🛡️`, `💀`, `📊` используются в заголовках секций
2. **Inconsistent icon usage** — Lucide icons в Navbar, но emoji в контенте
3. **Отсутствует Navbar на внутренних страницах** — только "← Back to Dashboard" ссылка
4. **Нет единого layout** — каждая страница имеет свой padding/max-width

#### P1 — Важные (улучшают профессионализм)

5. **Нет loading states** — skeleton screens отсутствуют на большинстве страниц
6. **Нет error boundaries** — ошибки показываются как plain text
7. **Inconsistent spacing** — разные gap/padding между секциями
8. **Нет micro-interactions** — кнопки без feedback при клике
9. **Таблицы без сортировки/фильтрации** — Decision Log статичен

#### P2 — Nice-to-have (выделяют среди конкурентов)

10. **Нет dark/light mode toggle** — только dark mode
11. **Нет keyboard shortcuts** — нет hotkeys для навигации
12. **Нет onboarding tour** — новый пользователь не понимает что делать
13. **Нет data visualization** — только текст и числа, нет графиков

---

## Requirements

### R1: Icon System Unification

- **ID**: R1
- **Priority**: P0
- **Description**: Заменить все emoji на Lucide-react иконки для консистентности
- **Acceptance Criteria**:
  - [ ] Все emoji в заголовках секций заменены на Lucide icons
  - [ ] Создан mapping emoji → icon для переиспользования
  - [ ] Иконки имеют consistent sizing (w-4 h-4 для inline, w-5 h-5 для headers)
  - [ ] Цвета иконок соответствуют семантике (green=success, red=error, purple=brand)

### R2: Global Layout with Navbar

- **ID**: R2
- **Priority**: P0
- **Description**: Добавить Navbar на все страницы через layout.tsx
- **Acceptance Criteria**:
  - [ ] Navbar отображается на всех страницах
  - [ ] Active state показывает текущую страницу
  - [ ] Добавлены ссылки на Discipline и Social страницы
  - [ ] Убраны "← Back to Dashboard" ссылки (Navbar заменяет их)
  - [ ] Navbar sticky с backdrop-blur

### R3: Consistent Page Structure

- **ID**: R3
- **Priority**: P1
- **Description**: Унифицировать структуру всех страниц
- **Acceptance Criteria**:
  - [ ] Все страницы используют max-w-[1200px] mx-auto
  - [ ] Consistent padding: px-6 py-8
  - [ ] Page header pattern: title + description + optional badge
  - [ ] Consistent section spacing: mb-8 между секциями

### R4: Loading States

- **ID**: R4
- **Priority**: P1
- **Description**: Добавить skeleton loading states
- **Acceptance Criteria**:
  - [ ] Создан компонент Skeleton для переиспользования
  - [ ] Dashboard показывает skeleton при загрузке данных
  - [ ] Таблицы показывают skeleton rows
  - [ ] Cards показывают skeleton content

### R5: Enhanced Tables

- **ID**: R5
- **Priority**: P1
- **Description**: Улучшить Decision Log и другие таблицы
- **Acceptance Criteria**:
  - [ ] Hover state на строках
  - [ ] Click-to-expand для деталей (как в Discipline)
  - [ ] Sticky header при скролле
  - [ ] Empty state с иллюстрацией

### R6: Micro-interactions

- **ID**: R6
- **Priority**: P1
- **Description**: Добавить feedback на интерактивные элементы
- **Acceptance Criteria**:
  - [ ] Кнопки имеют active state (scale down)
  - [ ] Links имеют underline on hover
  - [ ] Cards имеют subtle lift on hover (уже есть, проверить консистентность)
  - [ ] Form inputs имеют focus ring

### R7: Data Visualization

- **ID**: R7
- **Priority**: P2
- **Description**: Добавить визуализацию данных где уместно
- **Acceptance Criteria**:
  - [ ] Mini sparkline для PnL trend на Dashboard
  - [ ] Donut chart для Win/Loss ratio
  - [ ] Progress bar для Safety Rate
  - [ ] Использовать lightweight library (recharts или custom SVG)

### R8: Status Badges Enhancement

- **ID**: R8
- **Priority**: P1
- **Description**: Улучшить визуальное представление статусов
- **Acceptance Criteria**:
  - [ ] Создан компонент StatusBadge с variants (live, idle, offline, success, error, warning)
  - [ ] Badges имеют consistent styling
  - [ ] Animated pulse для live states
  - [ ] Tooltip с деталями

---

## Constraints

1. **Не ломать существующий UX** — все текущие user flows должны работать
2. **Не добавлять тяжёлые зависимости** — максимум 1 новая библиотека (если нужна)
3. **Сохранить честность** — все статусы и данные должны отражать реальность (per no-lying-about-state.md)
4. **Mobile-first не требуется** — desktop-first для hackathon demo
5. **Accessibility baseline** — semantic HTML, ARIA labels где нужно

---

## Out of Scope

- Dark/Light mode toggle (P2, после hackathon)
- Keyboard shortcuts (P2)
- Onboarding tour (P2)
- i18n/localization
- PWA features

---

## Success Metrics

1. **Visual consistency score**: 0 emoji в production UI
2. **Navigation**: Navbar visible on 100% страниц
3. **Loading UX**: Skeleton states на всех data-dependent секциях
4. **Judge impression**: "Это выглядит как настоящий продукт, не как hackathon проект"
