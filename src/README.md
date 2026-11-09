# src

`main.ts` starts the app. Everything else lives in `modules/`, one folder per module.

```
shared  <-  lexicon  <-  parser  <-+
   ^                               +<-  ui  <-  main.ts
   +-----  scene  <-  render  <-  stage  <-+
```

text -> `parser` -> `SceneState` -> `scene` -> layers -> `render` (SVG text) / `stage` (live page).

Each folder has its own README. Dependencies only point left or down; `test/constraints.test.ts` enforces it. Full walkthrough: `docs/ARCHITECTURE.md`.
