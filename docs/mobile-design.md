# Booking Broom Manager — Mobile Design

Native Expo manager app identity (independent from the web green dashboard).

## Palette

| Token | Light | Dark |
|-------|-------|------|
| Primary | `#1E40AF` | `#60A5FA` |
| Accent | `#EA580C` | `#FB923C` |
| Background | `#F5F7FB` | `#0B0F17` |
| Surface | `#FFFFFF` | `#141A24` |
| Foreground | `#0F172A` | `#F1F5F9` |
| Muted text | `#64748B` | `#94A3B8` |
| Border | `#E2E8F0` | `#1E293B` |
| Success | `#059669` | `#34D399` |
| Destructive | `#DC2626` | `#F87171` |

## Typography

- **Headings:** Poppins 600/700
- **Body:** Open Sans 400/600

## Chrome

- **Phone:** Liquid-glass floating tab bar (`expo-blur` on iOS; solid fallback when reduce-transparency / Android cost path).
- **Tablet (≥768):** Persistent left sidebar; no bottom tabs. Messages/Email use split panes.

## Performance notes

- Blur is restricted to the tab bar only.
- Lists use FlashList.
- Inactive tabs freeze; chat hides the tab bar to avoid dual chrome cost.
