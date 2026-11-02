# Requirements Document

## Introduction

This feature upgrades the HOD (Head of Department) Quality Assurance dashboard within the Pula school app. The upgrade replaces the existing plain code-count table in the "Class performance" tab with a richer visual layout: a stacked horizontal bar chart per class row, colour-coded by assessment code, with tooltips on hover for narrow segments. It also adds a redesigned header pill, a "Worth a look" insight panel, and flag badges that use the existing navy/lavender/peach palette with no yellow. All changes are scoped to the `hodTab === 'Class performance'` branch inside `Dashboards.jsx` and companion CSS. Other tabs (CAPS tracker, Teacher logs, Interventions, Action items) are not modified.

## Glossary

- **Dashboard**: The HOD role screen rendered by `Dashboards.jsx` when `profile.role === 'HOD'`.
- **Class performance tab**: The content panel rendered when `hodTab === 'Class performance'`.
- **Assessment code**: An integer from 1 to 7 assigned to each learner in `dashboardData.js`, indicating performance band. Codes 1–2 are the Support Tier.
- **Support Tier**: Learners with `code <= 2`; the at-risk cohort requiring intervention.
- **Support Tier share**: The percentage of learners in a class whose assessment code is 1 or 2, rounded to the nearest integer.
- **Stacked bar**: A single horizontal bar divided into up to seven proportional colour segments, one per assessment code, representing the distribution of learners across codes 1–7 for a given class.
- **Segment**: One colour block within a stacked bar, representing all learners of a single assessment code in one class.
- **Tooltip**: A floating label that appears when the pointer hovers over a segment, showing the code number and learner count for that segment.
- **Flag badge**: A small inline label attached to a class row indicating a quality concern.
- **Steady flag**: A flag badge indicating no current concern for a class row.
- **Warning flag**: A flag badge indicating that the Support Tier share exceeds the warning threshold (25%).
- **Danger flag**: A flag badge indicating that the current class mean WPM has fallen compared to the previous class average.
- **Worth a look panel**: A highlighted insight block rendered below the class table, surfacing the most notable class-level concern.
- **mean(cl)**: The function exported from `dashboardData.js` that computes the arithmetic mean of the latest WPM score (`history.at(-1)`) across all learners in a class, rounded to the nearest integer.
- **previousAverage**: A numeric property on each class object in `dashboardData.js` representing the prior-term class mean WPM.
- **Palette**: The set of CSS custom properties defined in `dashboards.css`: `--pula-cream`, `--pula-navy`, `--pula-sand`, `--pula-sage`, `--pula-lavender`, `--pula-blue`, `--pula-peach`.
- **Code colour map**: A fixed mapping from each assessment code (1–7) to a palette-derived colour, containing no yellow.
- **HOD Dashboard**: The full-page HOD view rendered by `Dashboards.jsx`.

---

## Requirements

### Requirement 1 — Header and pill badge

**User Story:** As a Foundation Phase HOD, I want a clear header with a contextual sign-off reminder, so that I can orient myself immediately upon opening the dashboard.

#### Acceptance Criteria

1. THE HOD Dashboard SHALL render a heading section containing the title "Quality assurance", a subtitle reading "Foundation Phase HOD · Grades R to 3 · Term 4, 2026", and a pill badge reading "Term 4 sign-off due".
2. THE HOD Dashboard SHALL style the pill badge using colours from the Palette, with no yellow colour applied to any element of the pill badge.
3. WHEN the viewport width is 800 px or fewer, THE HOD Dashboard SHALL stack the heading text and pill badge vertically so that neither element overflows its container.

---

### Requirement 2 — Stat cards

**User Story:** As a Foundation Phase HOD, I want four at-a-glance stat cards, so that I can see the headline numbers for my phase without scrolling.

#### Acceptance Criteria

1. THE HOD Dashboard SHALL render exactly four stat cards labelled "Classes monitored", "Support Tier learners", "CAPS areas behind", and "Open action items".
2. THE HOD Dashboard SHALL derive the "Classes monitored" value from the count of class objects in `data.classes`.
3. THE HOD Dashboard SHALL derive the "Support Tier learners" value from the count of learners across all classes whose assessment code is 1 or 2.
4. THE HOD Dashboard SHALL derive the "CAPS areas behind" value from the count of `false` entries summed across the `logs` arrays of all classes.
5. THE HOD Dashboard SHALL derive the "Open action items" value from the count of directives in `data.directives` whose `status` property is not equal to "Done".
6. WHEN the viewport width is 800 px or fewer, THE HOD Dashboard SHALL arrange the four stat cards in a two-column grid.

---

### Requirement 3 — Tab navigation

**User Story:** As a Foundation Phase HOD, I want tab navigation across five sections, so that I can move between monitoring views without leaving the dashboard.

#### Acceptance Criteria

1. THE HOD Dashboard SHALL render tab navigation with exactly five labels: "Class performance", "CAPS tracker", "Teacher logs", "Interventions", and "Action items".
2. THE HOD Dashboard SHALL display the open action item count as a numeric badge appended to the "Action items" tab label.
3. WHEN a tab label is activated, THE HOD Dashboard SHALL display only the content panel associated with that tab and hide the content panels of all other tabs.
4. THE HOD Dashboard SHALL set the "Class performance" tab as the initially active tab on first render.

---

### Requirement 4 — Class performance section heading and legend

**User Story:** As a Foundation Phase HOD, I want a labelled colour legend for assessment codes, so that I can interpret the stacked bars without guessing what each colour means.

#### Acceptance Criteria

1. THE Class performance tab SHALL render the section heading "Class performance and variance".
2. THE Class performance tab SHALL render a legend containing exactly seven entries, one for each assessment code from 1 to 7.
3. EACH legend entry SHALL display a colour swatch and a label reading "Code N" where N is the code number.
4. THE Class performance tab SHALL assign a unique colour to each assessment code using the Code colour map derived from the Palette, with no yellow used for any code's colour.
5. THE Class performance tab SHALL render the legend before the class table.

---

### Requirement 5 — Class performance table structure

**User Story:** As a Foundation Phase HOD, I want a table with one row per class, so that I can compare performance across all Foundation Phase classes at a glance.

#### Acceptance Criteria

1. THE Class performance tab SHALL render a table with exactly four columns: "Class", "Codes 1 to 7", "Average", and "Flag".
2. THE Class performance tab SHALL render one data row per class in `data.classes`.
3. EACH class row SHALL display the class room identifier and teacher name in the "Class" column.
4. EACH class row SHALL display the current mean WPM as computed by `mean(cl)` in the "Average" column.
5. EACH class row SHALL display the previous average value from `cl.previousAverage` as a secondary label beneath the current mean in the "Average" column.
6. THE Class performance tab SHALL NOT render individual code-count columns (Code 1, Code 2, … Code 7 as separate numeric columns).

---

### Requirement 6 — Stacked horizontal bar chart

**User Story:** As a Foundation Phase HOD, I want a stacked horizontal bar in each class row, so that I can see the proportional distribution of learners across assessment codes at a glance.

#### Acceptance Criteria

1. EACH class row SHALL render exactly one Stacked bar in the "Codes 1 to 7" column.
2. THE Stacked bar SHALL contain one Segment per assessment code that has at least one learner in that class; codes with zero learners SHALL NOT produce a segment.
3. EACH Segment width SHALL be proportional to the count of learners with that code divided by the total learner count in the class, such that all segments together fill 100% of the bar width.
4. EACH Segment SHALL be filled with the colour assigned to its code in the Code colour map.
5. WHEN the pointer enters a Segment, THE Class performance tab SHALL display a Tooltip showing the assessment code number and the learner count for that segment.
6. WHEN the pointer leaves a Segment, THE Class performance tab SHALL hide the Tooltip.
7. THE Stacked bar SHALL render left-to-right in ascending code order (code 1 leftmost, code 7 rightmost).
8. IF a Segment is wide enough to display text legibly (segment width ≥ 28 px), THEN THE Stacked bar MAY display the learner count as text inside the segment; narrow segments SHALL rely on the Tooltip for count display.
9. THE Stacked bar SHALL have a minimum height of 32 px.

---

### Requirement 7 — Flag badges

**User Story:** As a Foundation Phase HOD, I want each class row to carry a flag badge reflecting its quality status, so that I can immediately identify classes that need attention.

#### Acceptance Criteria

1. EACH class row SHALL display exactly one Flag badge in the "Flag" column.
2. WHEN `mean(cl)` is less than `cl.previousAverage`, THE Class performance tab SHALL display a Danger flag reading "Average down N points" where N is the positive integer difference between `cl.previousAverage` and `mean(cl)`.
3. WHEN the Support Tier share for a class exceeds 25%, THE Class performance tab SHALL display a Warning flag reading "High share in codes 1 and 2".
4. IF both a Danger flag condition and a Warning flag condition are true for the same class, THEN THE Class performance tab SHALL display the Danger flag and SHALL also display the Warning flag for that class row.
5. WHEN neither the Danger flag condition nor the Warning flag condition is true for a class, THE Class performance tab SHALL display a Steady flag reading "Steady".
6. THE Danger flag badge SHALL use a red or coral colour derived from the Palette with no yellow.
7. THE Warning flag badge SHALL use an orange or peach colour derived from the Palette with no yellow.
8. THE Steady flag badge SHALL use a neutral colour derived from the Palette with no yellow.

---

### Requirement 8 — "Worth a look" insight panel

**User Story:** As a Foundation Phase HOD, I want a highlighted insight panel below the table, so that the most notable concern is surfaced without requiring me to scan all rows.

#### Acceptance Criteria

1. THE Class performance tab SHALL render a Worth a look panel below the class table.
2. THE Worth a look panel SHALL identify the class with the highest Support Tier share and display an insight sentence naming that class and its Support Tier share percentage.
3. IF a class exists where `mean(cl)` is less than `cl.previousAverage`, THEN THE Worth a look panel SHALL also display an insight sentence naming the class with the largest absolute drop in average and stating the number of points dropped.
4. THE Worth a look panel SHALL use a background colour and text colour drawn exclusively from the Palette, with no yellow.
5. THE Worth a look panel heading SHALL read "Worth a look".

---

### Requirement 9 — Colour palette constraints

**User Story:** As a Foundation Phase HOD, I want the dashboard to use the existing app palette, so that the visual identity is consistent with all other dashboard screens.

#### Acceptance Criteria

1. THE HOD Dashboard SHALL use only colours defined in the Palette (`--pula-cream`, `--pula-navy`, `--pula-sand`, `--pula-sage`, `--pula-lavender`, `--pula-blue`, `--pula-peach`) or direct derivatives of those colours (tints, shades).
2. THE HOD Dashboard SHALL NOT apply any yellow colour to any element, including code colour swatches, segment fills, flag badges, pill badges, and insight panels.
3. THE Code colour map SHALL assign codes 1–2 to red or coral tones, codes 3–4 to orange or peach tones, codes 5–6 to light blue or lavender tones, and code 7 to a blue or navy tone.

---

### Requirement 10 — Accessibility

**User Story:** As a Foundation Phase HOD using assistive technologies, I want the dashboard to be navigable and interpretable without relying solely on colour, so that all information is accessible.

#### Acceptance Criteria

1. EACH Segment SHALL carry an `aria-label` attribute stating the assessment code and the learner count for that segment (e.g. "Code 3: 5 learners").
2. THE Stacked bar container SHALL carry a `role="img"` attribute and an `aria-label` summarising the code distribution for the class (e.g. "Code distribution for Grade 1A").
3. THE Class performance tab SHALL ensure that all Flag badges are rendered as text visible to screen readers, not solely as icon-only badges.
4. WHEN the viewport uses forced colours (Windows High Contrast mode), THE HOD Dashboard SHALL preserve legibility by relying on text labels rather than colour fills alone.

---

### Requirement 11 — Responsive layout

**User Story:** As a Foundation Phase HOD on a tablet or desktop, I want the class performance table to be horizontally scrollable on smaller viewports, so that wide table content does not break the layout.

#### Acceptance Criteria

1. THE Class performance tab SHALL wrap the table in a horizontally scrollable container so that the full table width is accessible on viewports narrower than the table's natural width.
2. THE Stacked bar SHALL maintain a minimum width of 120 px inside its table cell so that bars remain legible when the table is compressed.
3. WHILE the viewport width is greater than 800 px, THE Class performance tab SHALL render the Worth a look panel at full container width below the table.
