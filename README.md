# Berkeley Campus Walk

A first-person walkthrough of the UC Berkeley campus with a 2D map, pinned
locations, and characters you can talk to. Static site, no backend, no build
step.

## Run it

Any static server works, because there is nothing to compile:

```bash
npx serve -l 4173 .
# open http://localhost:4173
```

It must be served over HTTP. Opening `index.html` from the filesystem will fail:
ES modules and the `.glb` fetch are both blocked under `file://`.

## Deploy

The repo is already static, so all three of these work as-is:

- **GitHub Pages** — push to `main`, then Settings → Pages → deploy from `main` / root.
  A `.nojekyll` file is included so the `public/` folder is not skipped.
- **Vercel** — import the repo, framework preset "Other", leave build empty, output `.`
- **Netlify** — drag the folder into the dashboard, or set publish directory to `.`

## Controls

| Key | Action |
|-----|--------|
| `W` `A` `S` `D` | Walk |
| `Shift` | Run |
| Mouse | Look (click the page first to capture the cursor) |
| `E` | Talk to a nearby character |
| `M` | Open the campus map |
| `Esc` | Release the cursor |

On the map, click any pin to travel there and start that character's dialogue.

## Layout

```
index.html          markup, styling, HUD
src/main.js         scene, controls, map, dialogue
src/audio.js        narration, carillon, ambience, footsteps
src/pois.js         landmarks, characters, dialogue lines
src/geo.js          lat/lon <-> world-metre projection
scripts/gen-audio.mjs   build-time ElevenLabs render (not shipped to users)
public/campus.glb   the campus, Draco-compressed (1.0 MB)
public/campus-meshopt.glb   same scene, meshopt instead (2.9 MB)
public/audio/       29 pre-rendered mp3 files (2.5 MB)
```

## Audio

Every character is voiced, each with a different ElevenLabs voice. There is also
a carillon, campus ambience, and footsteps.

Audio is **pre-rendered at build time** and shipped as static mp3. The running
app never calls ElevenLabs and never needs an API key, so the key stays out of
the repo and off the client.

To regenerate after editing dialogue:

```bash
ELEVENLABS_API_KEY=... node scripts/gen-audio.mjs          # skips existing files
ELEVENLABS_API_KEY=... node scripts/gen-audio.mjs --force  # redo everything
```

Existing files are skipped so re-runs cost no credits. The full set is 29 files
and about 1,900 characters of quota.

The carillon is a `THREE.PositionalAudio` anchored in the belfry at 70 m, so it
carries across campus and dominates underneath the tower. Browsers block audio
until a user gesture, so `resumeAudio()` runs on the same click that captures
the pointer.

## Editing content

Landmarks and dialogue live in `src/pois.js`. Add an entry with a real `lat` /
`lon` and it lands in the right place automatically, in both the 3D world and on
the 2D map, because both derive from `geo.js`.

Characters are placed by `openSpotNear()`, which spiral-samples around the
coordinate and picks the nearest point at street level. That is deliberate:
building coordinates are centroids, and OSM2World buildings have no floor face,
so a naive downward raycast lands on the roof.

## Why the assets look the way they do

The campus was generated from OpenStreetMap data via OSM2World, then compressed.
Two consequences worth knowing before you try to "fix" them:

- **No textures.** OSM2World's glTF export emits zero images; all colour is in
  `COLOR_0` vertex attributes. There is no texture resolution to raise.
- **No terrain.** It was built with `createTerrain=false` so synthetic grey fill
  would not swamp the real grass and paths. That leaves gaps between mapped
  features, so `main.js` adds a base plane at `BASE` to close them.

To rebuild the campus from different map data, see the pipeline in
`../osm2world-040` (`crop.ps1` → OSM2World `--lod 4` → `gltf-transform optimize`
→ `fixmat.ps1`). If you rebuild from an `.osm` with different `<bounds>`, the
projection origin moves and the constants in `src/geo.js` must be re-solved.

## Performance

The scene is ~710k vertices in 2 draw calls. Draco brings 28.7 MB down to 1.0 MB
over the wire. Raycasts for ground and wall collision run against a
[three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) acceleration
structure loaded from a CDN; if that import fails the app logs a warning and
keeps working with flat-ground walking.

The 2D map is rendered once at startup to an offscreen target and reused as a
still image, so opening the map costs nothing at runtime.
