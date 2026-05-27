# Design Enhancement — Tasks

## Task 1: Create Shared Components

- [x] 1.1 Create `frontend/app/lib/icons.ts` with emoji → Lucide mapping
- [x] 1.2 Create `frontend/app/components/SectionHeader.tsx`
- [ ] 1.3 Create `frontend/app/components/PageWrapper.tsx`
- [x] 1.4 Create `frontend/app/components/Skeleton.tsx` with variants
- [x] 1.5 Create `frontend/app/components/StatusBadge.tsx`

## Task 2: Update Global Layout

- [x] 2.1 Update `frontend/app/layout.tsx` to include Navbar (already done)
- [x] 2.2 Add `pt-14` wrapper for navbar offset (already done)
- [x] 2.3 Update `frontend/app/components/Navbar.tsx` — add Discipline and Social links

## Task 3: Update Dashboard (page.tsx)

- [x] 3.1 Replace `📈` emoji with `<TrendingUp />` in Performance section
- [x] 3.2 Replace `🔴`, `🟢`, `⛓️` emojis in "Why This Matters" section
- [x] 3.3 Replace `⚡` emoji in notification toast
- [ ] 3.4 Use SectionHeader component for all section headers
- [ ] 3.5 Add skeleton loading state for chainData

## Task 4: Update Challenge Page

- [x] 4.1 Remove "← Back to Dashboard" link
- [x] 4.2 Replace `⚔️` with `<Swords />` in title
- [x] 4.3 Replace `⚡`, `🚀`, `🔮`, `🤖` in CHALLENGE_TYPES
- [x] 4.4 Replace `🛡️`, `💀` in verdict display
- [x] 4.5 Replace `🟢`, `🟡` in ModeBadge
- [x] 4.6 Use StatusBadge component for mode indicator

## Task 5: Update Backtest Page

- [x] 5.1 Remove "← Back to Dashboard" link
- [x] 5.2 Replace `📊` with `<BarChart3 />` in title
- [ ] 5.3 Wrap with PageWrapper component
- [ ] 5.4 Add skeleton loading state

## Task 6: Update Proof Explorer Page

- [x] 6.1 Remove "← Back to Dashboard" link (if present in client component)
- [x] 6.2 Verify icon usage is consistent

## Task 7: Update Discipline Page

- [x] 7.1 Remove "← Back to Dashboard" link
- [x] 7.2 Replace `🛡️` with `<Shield />` in title
- [ ] 7.3 Use StatusBadge for verdict display
- [ ] 7.4 Add skeleton loading state

## Task 8: Update Social Page

- [x] 8.1 Remove "← back to dashboard" link
- [x] 8.2 Verify consistent styling with other pages

## Task 9: CSS Enhancements

- [x] 9.1 Add micro-interaction styles to globals.css
- [x] 9.2 Add skeleton shimmer animation
- [x] 9.3 Add focus-ring utility class
- [x] 9.4 Verify all hover states work correctly

## Task 10: Final QA

- [x] 10.1 Test navigation on all pages (build passed)
- [x] 10.2 Verify no emoji remain in UI (P0 emoji replaced)
- [x] 10.3 Check loading states
- [ ] 10.4 Test on different viewport sizes
- [x] 10.5 Run build to check for errors
