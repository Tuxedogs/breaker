# Planets and Moons Web Assets

Generated for compact location thumbnails and the selected-location preview panel.

Folders:

- `thumb-64/` - small list thumbnails, transparent WebP
- `thumb-128/` - retina/2x list thumbnails, transparent WebP
- `main-320/` - selected-location image, transparent WebP
- `main-512/` - retina/2x selected-location image, transparent WebP
- `manifest.json` - id, label, source filename, and relative asset paths

Suggested CSS:

```css
.location-thumb img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  display: block;
}

.selected-location-art img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
```
