# DESIGN.md: Dinkes Data Tools (Civic Health Analytics)

## 1. Design Read & Liveliness Dials

> Reading this as: Civic Public Health Analytics & Spreadsheet Pipeline Workspace for Provincial and District Health Supervisors (Dinas Kesehatan Provinsi Jawa Tengah & 35 Kabupaten/Kota), in a high-clarity editorial data visualization style, dial `ENERGY 2 / RHYTHM 2 / MOTION 1`.

- **Dial**: `ENERGY 2 / RHYTHM 2 / MOTION 1`
  - **ENERGY 2 (Balanced)**: Confident typographic hierarchy, crisp tabular numbers, and purposeful status accents without decorative clutter.
  - **RHYTHM 2 (Consistent with Focal Breaks)**: Structured analytical layouts where the primary visualization canvas (SVG map or comparative bar chart) commands focal priority, flanked by scannable KPI summaries and docked inspection panels.
  - **MOTION 1 (Calm & Functional)**: Instant reactive updates via Angular Signals, subtle hover/focus transitions (`150ms-200ms`), and zero perpetual pulsing loops on decorative elements.

---

## 2. Core Visual Identity & Purpose Statements (R-31)

Every visual and structural decision serves a documented analytical or ergonomic goal:

- **Palette**:
  - **Surface Base (`#F8FAFD` & `#FFFFFF`)**: High-luminance neutral ground so multi-series SVG charts, choropleth map polygons, and tabular heatmaps remain legible in bright office lighting.
  - **Primary Accent (`#525AFF` Indigo, hover `#4348E6`)**: Reserved for active navigation states, primary calls-to-action, and keyboard focus rings (`#FFFFFF` on `#525AFF` = `4.92:1` WCAG AA PASS; `#FFFFFF` on `#4348E6` = `6.35:1` PASS).
  - **Secondary Brand Accent (`#0F766E` Deep Teal)**: Used for positive/verified completion actions and secondary brand anchoring (`#FFFFFF` on `#0F766E` = `5.47:1` WCAG AA PASS).
  - **Ink Hierarchy (`#0F172A` Slate 900 primary, `#334155` Slate 700 body, `#475569` Slate 600 secondary metadata)**: Eliminates low-contrast grey-on-grey text (`#475569` on `#FFFFFF` = `7.58:1` WCAG AA PASS).
- **Semantic Evaluation Tokens (Always paired with text/icon, never color-only)**:
  - **Achieved / On Track**: Text `#065F46` (Emerald 800) on `#ECFDF5` (Emerald 50) with border `#A7F3D0`.
  - **Attention / Perlu Perhatian**: Text `#92400E` (Amber 800) on `#FFFBEB` (Amber 50) with border `#FDE68A`.
  - **Critical / Perlu Percepatan**: Text `#9F1239` (Rose 800) on `#FFF1F2` (Rose 50) with border `#FECDD3`.
- **Typography**:
  - **System Sans + Tabular Numerals (`font-variant-numeric: tabular-nums`)**: Ensures district rankings, percentages (`%`), numerator/denominator counts, and target deltas align vertically down every column and chart label.
  - **Minimum Legible Scale**: `12px` (`text-xs`) floor for secondary labels and table headers; `14px` (`text-sm`) for interactive controls and body data.
- **Layout & Composition**:
  - **One Focal Point per View**: Each workspace view centers on one primary analytical artifact (the 35-district SVG map, the comparative indicator chart, the joined preview table, or the regional scorecard matrix).
  - **Docked Context over Floating Overlays**: District inspection and ranking panels dock cleanly beside the map or slide out as structured drawers, preventing viewport collision on `1366px` laptops.
  - **Identity Motif**: Top 4px civic spectrum accent bar (`#8FD9FB` -> `#0F766E` -> `#525AFF`) anchoring the application shell and primary analytical workspace headers.
- **Glassmorphism & Elevation Dose Caps (R-10, R-12, R-13)**:
  - Solid crisp surfaces (`bg-white`) with 1px structural borders (`border-slate-200`) for all cards, sidebars, and tables.
  - `backdrop-blur` is capped at a maximum of 1 floating/sticky overlay per screen.
