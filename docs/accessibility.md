# Accessibility

## Contrast

Every pair of text colour and background in `src/ui/styles.css`, with the contrast ratio of WCAG 2 computed from the colour values. Normal text needs 4.5 : 1 for level AA and 7 : 1 for level AAA.

| Use | Colours | Ratio | Passes |
| --- | --- | --- | --- |
| Body text on a panel | `#2b1a0a` on `#f6e6bd` | 13.5 : 1 | AA and AAA |
| Hints on a panel | `#5b4526` on `#f6e6bd` | 7.3 : 1 | AA and AAA |
| Error messages on a panel | `#a11d1d` on `#f6e6bd` | 6.3 : 1 | AA |
| Links on a panel | `#4f2e12` on `#f6e6bd` | 9.8 : 1 | AA and AAA |
| Text on a notice or on the own row of the ranking | `#2b1a0a` on `#e2c98f` | 10.3 : 1 | AA and AAA |
| Hints on a notice | `#5b4526` on `#e2c98f` | 5.6 : 1 | AA |
| Button label | `#f6e6bd` on `#7a4a21` | 6.0 : 1 | AA |
| Button label, hovered | `#f6e6bd` on `#4f2e12` | 9.8 : 1 | AA and AAA |
| Primary button, selected tab and pressed toggle | `#2b1a0a` on `#ffcf4a` | 11.4 : 1 | AA and AAA |
| Text in a field | `#2b1a0a` on `#fffaf0` | 16.1 : 1 | AA and AAA |
| HUD on the match bar | `#f6e6bd` on `#4f2e12` | 9.8 : 1 | AA and AAA |
| Hints under the arena | `#f6e6bd` on `#123f63` | 8.9 : 1 | AA and AAA |

Not covered by the table: disabled buttons, which the criterion exempts; the focus outline, a gold line inside a dark ring, so that one of the two always stands out; the labels of the touch buttons, drawn over the moving arena; the native `meter` and `progress` elements, coloured by the browser; and the content of the canvas, where health is also given as text in the HUD.

## What else is in place

- Every menu, tab, form field and button is reached and operated with the keyboard, with a visible focus outline.
- Dialogs are native `dialog` elements opened as modals: the focus stays inside, Escape resumes a paused match, and the focus returns when they close.
- Form fields have labels, a described hint and an error message announced as an alert.
- Score, time and health are text in the HUD; only the phase of the match is announced, once per change, never per frame.
- The keys of the game are captured only while a match is running.
- Sound can be switched off in the match, and the choice is remembered.

## Not done

- No pass with a screen reader and no automated accessibility scan.
- The tabs of the menu are reached with Tab, not with the arrow keys of the tab pattern.
