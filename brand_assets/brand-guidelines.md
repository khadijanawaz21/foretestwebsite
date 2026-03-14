# FORE Brand Guidelines
**Fair Opportunity Real Estate — Dubai**
*Last updated: March 2025*

---

## Brand Essence

**Mission:** Make Dubai real estate investment accessible to everyone — not just the ultra-wealthy.

**Positioning:** Education-first. Investor-accessible. Democratising.

**Tone of voice:** Direct, knowledgeable, warm. Never intimidating. Never corporate. Speaks to a first-time international investor the way a trusted friend with expertise would.

**Tagline:** *Anyone can be an investor. Any amount can be an investment.*

---

## Logo

- The wordmark is **FORE** in Cormorant Garamond, weight 600, letter-spacing 5px
- Always render in gold `#C9A96E` on dark backgrounds
- On light backgrounds (rare use): render in `#0A0A0A`
- Minimum size: 20px height
- Clear space: equal to the height of the letter "F" on all sides
- Never stretch, rotate, recolour, or add effects to the logo
- Logo files live in `brand_assets/`

---

## Colour Palette

### Primary

| Name | Hex | Usage |
|---|---|---|
| Gold | `#C9A96E` | Primary accent, CTAs, highlights, logo |
| Gold Light | `#E2C99A` | Hover states, italic text, soft accents |
| Gold Dark | `#9A7A48` | Active states, borders on light backgrounds |

### Backgrounds

| Name | Hex | Usage |
|---|---|---|
| Black | `#0A0A0A` | Primary page background |
| Dark | `#111111` | Secondary background layer |
| Dark 2 | `#161616` | Cards, section alternates |
| Dark 3 | `#1C1C1C` | Elevated cards, hover states |

### Text

| Name | Value | Usage |
|---|---|---|
| White | `#FFFFFF` | Primary headings |
| White 70 | `rgba(255,255,255,0.7)` | Nav links, secondary text |
| White 50 | `rgba(255,255,255,0.5)` | Body copy, descriptions |
| White 35 | `rgba(255,255,255,0.35)` | Captions, labels, metadata |
| White 20 | `rgba(255,255,255,0.2)` | Dividers, faint UI elements |

### Borders

| Name | Value | Usage |
|---|---|---|
| Gold Border | `rgba(201,169,110,0.22)` | Card borders, nav border, section dividers |
| Subtle Border | `rgba(255,255,255,0.06)` | Dark card borders |

### Semantic colours (use sparingly)

| Purpose | Colour |
|---|---|
| Success / positive | `#4CAF50` |
| Warning | `#FF9800` |
| Error | `#F44336` |

---

## Typography

### Typefaces

**Display / Headings — Cormorant Garamond**
- Google Fonts: `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600`
- Used for: page titles, section headings, property names, pull quotes, the logo
- Character: editorial, refined, high-end without being cold

**Body / UI — Montserrat**
- Google Fonts: `https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600`
- Used for: body copy, nav links, labels, buttons, metadata, captions
- Character: clean, modern, legible at small sizes

### Type Scale

| Element | Font | Size | Weight | Other |
|---|---|---|---|---|
| Hero title | Cormorant Garamond | clamp(50px, 6.5vw, 88px) | 300 | Line-height 1.03 |
| Section title | Cormorant Garamond | clamp(32px, 4vw, 54px) | 300 | Line-height 1.08 |
| Card title | Cormorant Garamond | 20–26px | 400 | |
| Pull quote | Cormorant Garamond | 16–18px | 300 | Italic |
| Body copy | Montserrat | 12–13px | 300 | Line-height 1.8 |
| Nav links | Montserrat | 9.5–10px | 500 | Letter-spacing 2.5px, uppercase |
| Labels / tags | Montserrat | 8–9px | 500–600 | Letter-spacing 3px, uppercase |
| Buttons | Montserrat | 9.5–10px | 600 | Letter-spacing 2.5–3px, uppercase |

### Typography Rules

- Hero and section titles: use `font-weight: 300` (light) — the elegance comes from the serif, not the weight
- Italic gold (`#E2C99A`) on key words in headings is a brand signature — use it consistently
- Never use the same font for headings and body
- Tracking on large headings: `-0.02em` to `-0.03em`
- Body line-height: always `1.7` or `1.8`
- Never bold body copy — use a lighter weight variant instead

---

## Spacing System

Use multiples of 8px as the base unit.

| Token | Value | Usage |
|---|---|---|
| xs | 8px | Tight gaps, inline spacing |
| sm | 16px | Component internal padding |
| md | 24px | Between related elements |
| lg | 32px | Section sub-elements |
| xl | 48px | Section padding top/bottom |
| 2xl | 64px | Large section padding |
| 3xl | 96px | Full section padding |

Section horizontal padding: always `10%` of viewport width on desktop, `6%` on mobile.

---

## Navigation

- Position: fixed, `top: 24px`, centered, `width: 82%`
- Background: `rgba(8,8,8,0.78)` with `backdrop-filter: blur(20px)`
- Border: `0.5px solid rgba(201,169,110,0.22)`
- Border radius: `3px`
- Height: `62px`
- On mobile: collapses to logo + hamburger icon. Full-screen dark overlay menu on open.

---

## UI Components

### Buttons

**Primary (gold fill)**
- Background: `#C9A96E`
- Text: `#0A0A0A`, Montserrat, 9.5px, weight 600, letter-spacing 3px, uppercase
- Padding: `14px 30px`
- Border radius: `2px`
- Hover: background `#E2C99A`

**Ghost (outline)**
- Background: transparent
- Text: `rgba(255,255,255,0.7)`
- Border-bottom: `0.5px solid rgba(255,255,255,0.25)`
- Hover: text colour gold, border gold
- No box border — only underline style

### Cards

- Background: `#1C1C1C`
- Border: `0.5px solid rgba(255,255,255,0.06)`
- Border radius: `3px`
- Hover: `transform: translateY(-5px)`, border-color `rgba(201,169,110,0.3)`
- Transition: `0.3s ease`

### Section Tags (eyebrow labels)

- Displayed above section titles
- Font: Montserrat, 9px, weight 500, letter-spacing 3.5px, uppercase
- Colour: `#C9A96E`
- Preceded by a short gold line: `width: 24px, height: 1px, background: #C9A96E`
- Format: `——— SECTION NAME`

### Dividers

- Use `0.5px solid rgba(201,169,110,0.22)` for gold-tinted dividers between major sections
- Use `0.5px solid rgba(255,255,255,0.05)` for subtle internal dividers

---

## Imagery & Video

- All photography should feel cinematic — Dubai skyline, architecture, aspirational lifestyle
- Colour grade: slightly cool/desaturated with warm highlights (match the black + gold palette)
- Always apply a dark gradient overlay on images used behind text: `linear-gradient(to right, rgba(0,0,0,0.72) 30%, rgba(0,0,0,0.2) 80%)`
- Hero videos: three videos rotating on a 5.5-second loop, with swipe/drag support
- Placeholder images (dev only): `https://placehold.co/WIDTHxHEIGHT`
- Never use stock photography that looks generic — Dubai-specific, aspirational, real

---

## Tone of Voice

| Do | Don't |
|---|---|
| Direct and confident | Salesy or pushy |
| Warm and approachable | Cold or corporate |
| Specific and honest | Vague or hype-driven |
| Educate first, sell second | Lead with price or urgency |
| "Here's what you need to know" | "Amazing investment opportunity!!!" |
| Short sentences | Long winding paragraphs |

**Key messages to use consistently:**
- "Anyone can be an investor"
- "Any amount can be an investment"
- Dubai as a global investment destination, not just a luxury market
- The Golden Visa as a life-changing benefit, not just a financial product
- Education as the entry point — FORE teaches before it sells

---

## What Makes FORE Different

Always lean into these in copy and design decisions:

1. **Education-first** — the Dubai Investor Academy concept, 7-day free course
2. **Golden Visa** — one of the few agencies that leads with this in the nav
3. **Founder credibility** — Canadian software engineer, built a real portfolio, not a salesperson
4. **Accessible entry point** — off-plan, flexible payment plans, any budget
5. **International perspective** — speaks to overseas investors, not just residents

---

## What to Avoid

- Anything that looks or sounds like a generic luxury agency
- Purple gradients, blue accents, white backgrounds — this is a dark brand
- Pushy sales language or countdown timers
- Stock photos of people shaking hands in suits
- Claiming things that can't be backed up (avoid made-up stats until real ones are confirmed)
- Emojis in professional documents, website copy, or formal communications
