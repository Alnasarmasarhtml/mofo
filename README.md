# MOFO site

mind over fear of missing out. $MOFO.

One WebGL canvas, no page scroll. The wheel moves a page index from 0 to 4 and a spring carries the camera there along a path, the same setup as loanmeme.io (study in `Plumbob Cat Project/fuckyeah/loanmeme-scrollworld-study`).

Pages: M · MIND, O · OVER, F · FEAR, O · OF, then the pull-back to the whole word in front of the eclipse.

## run

```
npm install
npm run dev      # http://127.0.0.1:5188  (add ?debug=1 to skip the intro)
npm run build    # static site in dist/, deploys anywhere (GitHub Pages works, base is relative)
```

## what to change at launch

`src/config.js`: contract address, buy link, X, Telegram. The CA box shows "soon" until `ca` is set.

`public/mofo-extension.zip` is what "get the extension" downloads. It's built from `~/Downloads/fomo-copilot`.

## where things are

- `src/engine/`: scroller (page gravity), camera rig (path + parallax + shake), animator, post (bloom, anamorphic streaks, eclipse rays, scrim, dither, letterbox, grain), black studio env for the chrome
- `src/world/`: letters (Archivo Expanded Black, extruded), the orb, space (sky, stars, warp dust, eclipse), page sets (chart + gaussian channel behind the O, the pump into the F, holders orbiting the orb), the wall-smash intro, camera paths (landscape and portrait)
- `src/ui/ui.js` + `index.html` + `src/style.css`: loader canvas, copy, the M O F O rail, heat readout, crosshair cursor
- `tools/`: Playwright captures (`shot.py` pages, `mid.py` in-between frames, `run.py` full video, `fps.py`)

Fonts are Archivo and Martian Mono (OFL), self-hosted in `public/fonts`.
