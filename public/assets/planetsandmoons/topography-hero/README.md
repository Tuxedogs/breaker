# Location Profile hero terrain and orbital backdrops

30 site-optimized WebP hero crops (1200×460):
- **20 enhanced-detail maps** converted from finished images in `E:\Moonbreaker Artwork\Out\Planets\Topography_Detail` (16 Stanton, Pyro VI, Nyx I/II/III).
- **10 assembled Pyro map fallbacks** converted from `E:\Moonbreaker Artwork\Out\Planets\pyro_1.png` through `pyro_5f.png` (Pyro I-IV, including Monox and Bloom, plus six Pyro V moons). These **have not been through the enhanced-detail pass**; they are interim matching terrain until enhanced exports are ready.

The master images remain untouched in the artwork workspace. All maps are decorative surface references, not resource heatmaps, location/GPS data, or spawn probabilities.

The authoritative association table is `src/features/mining/topographyAssets.ts`. It uses **verified exact body names and known CIG aliases**; the public mining entry type does not expose reliable parent-body fields. Orbital regions with no actual surface map use matching existing location art (where available), otherwise a neutral starfield instead of unrelated planetary terrain.
