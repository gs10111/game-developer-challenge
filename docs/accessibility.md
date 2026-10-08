# Accessibility

## Contrast

Every pair of text colour and background of the interface, with the contrast ratio of WCAG 2 computed from the colour values of `src/ui/styles.css`. Normal text needs 4.5 : 1 for level AA and 7 : 1 for level AAA. Buttons and the menu frame are drawn with the sprites of the asset pack; for those the background is the colour of the face of the sprite, estimated by eye and not sampled.

| Use | Colours | Ratio | Passes |
| --- | --- | --- | --- |
| Body text in the menu frame and in dialogs | `#f6e6bd` on `#1c2940` | 11.8 : 1 | AA and AAA |
| Hints | `#c9d3e6` on `#1c2940` | 9.7 : 1 | AA and AAA |
| Error messages | `#ffb3a7` on `#1c2940` | 8.5 : 1 | AA and AAA |
| Links | `#ffcf4a` on `#1c2940` | 9.9 : 1 | AA and AAA |
| Text on a notice or on the own row of the ranking | `#f6e6bd` on `#2a3a57` | 9.2 : 1 | AA and AAA |
| Label of a dark button | `#ffffff` on `#26344d`, face colour estimated from the supplied sprite | 12.5 : 1 | AA and AAA |
| Label of a gold button, a selected tab or a pressed toggle | `#2b1a0a` on `#e2a431`, face colour estimated from the supplied sprite | 7.6 : 1 | AA and AAA |
| Text in a field | `#2b1a0a` on `#fffaf0` | 16.1 : 1 | AA and AAA |
| HUD on the match bar | `#f6e6bd` on `#4f2e12` | 9.8 : 1 | AA and AAA |
| Low health in the HUD | `#ffb3a7` on `#4f2e12` | 7.1 : 1 | AA and AAA |
| Hints under the arena | `#f6e6bd` on `#123f63` | 8.9 : 1 | AA and AAA |

Not covered by the table: disabled buttons, which the criterion exempts; the labels of the touch buttons, drawn over the moving arena; the native `meter` and `progress` elements, coloured by the browser; and the content of the canvas, where health is also given as text in the HUD.

## What else is in place

- Every menu, tab, form field and button is reached and operated with the keyboard, with a visible focus outline. The tabs of the menu follow the tab pattern: one tab stop, and the arrow keys, Home and End move between them.
- Dialogs are native `dialog` elements opened as modals: the focus stays inside, Escape resumes a paused match, and the focus returns when they close.
- Form fields have labels, a described hint and an error message announced as an alert.
- Score, time and health are text in the HUD; only the phase of the match is announced, once per change, never per frame.
- The keys of the game are captured only while a match is running.
- Damage taken is shown three ways: the ship flashes, the arena is veiled in red for a moment and shakes slightly, and the health in the HUD turns red and pulses in its last third. With "reduce motion" set in the system, the shake and the pulse are off.
- Sound can be switched off in the match, and the choice is remembered.
- On phones the layout follows the visible height of the browser and the safe areas of the screen, and a notice asks for landscape when the phone is upright.

## Not done

- No pass with a screen reader and no automated accessibility scan.
