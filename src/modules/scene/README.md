# scene

Turns a `SceneState` plus a seed into an ordered list of `Layer`s (back to front). Everything here is pure; the same state and seed give byte-identical layers.

```
model/    types.ts     SceneState, Layer, PathSpec: the shapes of the data
          resolve.ts   fills every "not mentioned" from the seed (all random numbers drawn up front)
layout/   geometry.ts  horizon, water shapes, shared maths (inWater)
          profiles.ts  ridge lines for mountains, hills, dunes...
          placement.ts where things stand: boats only in water, buildings only on land, nothing on roads
style/    palette.ts   colours from time of day, weather, tints, snow
art/      shapes.ts    how each tree, house, boat, balloon... is drawn
layers/   one file per layer: sky, celestial, clouds, terrain, ground, water, scenery, foreground, weather, paper
buildScene.ts          stacks the layers in order
```

Import order inside the module: `model` < `layout` < `style` < `art` < `layers` (a folder may import itself and the ones to its left). Layer ids must be unique and each layer uses its own random stream (`subSeed(seed, 'label')`). May import `shared` only.

To add something to the picture: a field in `model/types.ts`, a word in the lexicon, the drawing in `layers/` or `art/`, a test.
