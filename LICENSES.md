# Sources and licences

## Game assets

Every image and sound of the game comes from the `assets/` folder that the challenge repository supplies ([junglegaming/game-developer-challenge](https://github.com/junglegaming/game-developer-challenge)). Nothing was drawn, recorded, downloaded or generated for this solution, and no file was converted, resized or optimised: the files in `public/assets` are byte-for-byte copies.

That repository states no licence for the assets. They are used here as its statement directs ("Utilize os assets fornecidos como base visual") and for the purpose of the challenge only.

| Used in the game | Copied from |
| --- | --- |
| `ship_1`, `ship_2`, `ship_3`, `ship_7`, `ship_8`, `ship_9`, `ship_13`, `ship_14`, `ship_15` (`.png`) | `assets/png/default/ships/` |
| `cannon_ball.png` | `assets/png/default/ship_parts/` |
| `explosion_1.png`, `explosion_2.png`, `explosion_3.png`, `fire_1.png` | `assets/png/default/effects/` |
| `tile_1`, `tile_2`, `tile_3`, `tile_17`, `tile_18`, `tile_19`, `tile_33`, `tile_34`, `tile_35`, `tile_73` (`.png`) | `assets/png/default/tiles/` |
| `icon_heart.png`, `icon_score.png`, `icon_time.png` | `assets/png/default/ui/hud/` |
| `title_pirate_battle.png`, `panel_menu.png`, `button_primary_normal.png`, `button_primary_pressed.png`, `button_secondary_normal.png`, `button_secondary_pressed.png` | `assets/png/default/ui/menu/` |
| `ui_scene_background.png` | `assets/` |
| `sounds/cannon_fire_1.wav`, `sounds/cannon_broadside.wav`, `sounds/ship_wood_hit_1.wav`, `sounds/ship_explosion_1.wav`, `sounds/game_complete.wav`, `sounds/game_over.wav` | `assets/sounds/` |

## Fonts

No font file is shipped. The interface uses sans-serif fonts of the system (Trebuchet MS, then Segoe UI, then Verdana).

## Libraries

Installed from npm at the versions pinned in `pnpm-lock.yaml`; none of their code is copied into the repository except `public/mockServiceWorker.js`, which MSW generates.

| Library | Licence |
| --- | --- |
| React, React DOM | MIT |
| PixiJS | MIT |
| TanStack Query | MIT |
| Axios | MIT |
| MSW | MIT |
| Zod | MIT |
| Zustand | MIT |
