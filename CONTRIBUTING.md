# Contributing to Presenter Mode

Thanks for stopping by! This project is a **single-file tool** — the entire engine lives in `index.html` (CSS + vanilla JS, no build step, no dependencies). That makes contributing unusually simple.

## Quick start

```bash
git clone https://github.com/jinnyjiinlee/presenter-mode.git
cd presenter-mode
open index.html          # or just double-click it — no build, no server
```

Press `P` to open the presenter window. That's the whole dev loop: edit `index.html`, refresh both windows.

Optional local server (identical behavior):

```bash
node bin/cli.js          # serves the demo at a local port
```

## Ground rules

- **No dependencies, no build step.** The one-file promise is the product. PRs that add npm runtime deps or a bundler will be declined.
- **Two windows must stay in sync.** Anything user-visible you add should work in both the presenter window and the audience screen (see the `BroadcastChannel` + `localStorage` sync code).
- **Every user-facing string goes through `t()`.** Add your key to **both** `I18N_EN` and `I18N_KO` dictionaries. If you can't write the Korean line, add the English one to both and note it in the PR — we'll translate.
- **Keyboard first.** New features should have a shortcut, and it must be registered in the help overlay (`toggleHelp`).
- Match the existing code style: compact vanilla JS, `[vX]`-tagged comments for feature groups.

## Adding a language

The i18n system is dictionary-based and this is a great first contribution:

1. Copy the `I18N_EN` object, translate the ~180 values, name it e.g. `I18N_JA`
2. Extend the `LANG` detection + `t()` lookup + the 🌐 toggle cycle
3. Optionally translate the demo content (`DEMO_KO` shows the pattern)

## Testing checklist before a PR

- [ ] Audience window: arrows, `B`/`W`, `D` draw, `M` magnifier, `Z` zoom
- [ ] Presenter window (`P`): notes, timer, filmstrip, break-screen modal
- [ ] Both windows stay in sync (slides, ink, blackout)
- [ ] Works from `file://` (double-click) — no fetch/XHR to anywhere
- [ ] `?lang=en` and `?lang=ko` both render correctly

## Reporting bugs / ideas

Open an [Issue](https://github.com/jinnyjiinlee/presenter-mode/issues) — screenshots or a short screen recording help a lot. Korean and English are both welcome. 한국어 이슈도 환영해요!
