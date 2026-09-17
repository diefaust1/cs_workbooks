The largest tiles are about 54×54 CSS pixels, so I recommend:
- SVG: square viewBox, such as 0 0 64 64
- PNG/WebP alternative: transparent 128×128 px
- Visible artwork: roughly 36–42 px, with 8–12 px of transparent padding
- Aspect ratio: 1:1
- Avoid JPEG because it lacks transparency

Then render an image instead of assigning an emoji to tile.textContent, with styling such as:

.tile img {
  width: 72%;
  height: 72%;
  object-fit: contain;
  pointer-events: none;
}


For pixel-art icons, use a transparent 32×32 or 64×64 PNG and add:

image-rendering: pixelated;