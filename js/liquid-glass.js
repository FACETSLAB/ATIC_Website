/* ============================================================
   ATIC Website — draggable liquid glass lens (yujung branch)

   A pane of glass that sits over the hero and refracts whatever is
   underneath it — headline, illustration, buttons — and follows the
   pointer when dragged.

   Technique adapted from liquid-glass-studio (iyinchao): a signed
   distance field defines the rounded shape, its gradient near the edge
   gives the refraction direction, and the result is sampled with a
   slight per-channel offset for dispersion.

   That project is a React + WebGL2 demo app rather than a library, and
   WebGL cannot read the live page behind it without rasterising the DOM
   first. So the same maths is baked into a displacement map and handed
   to an SVG filter, which the browser applies to the real backdrop.
   Live text stays live text, and there is no build step.

   Degrades in three stages:
     1. displacement filter      true refraction
     2. backdrop-filter only     frosted blur, no bending
     3. neither                  a translucent tinted pane
   ============================================================ */

(function () {
  'use strict';

  const SIZE = 148; // CSS px, the lens is square
  const RADIUS = 38; // corner radius
  const MAP = 192; // displacement map resolution
  const BEZEL = 0.52; // how much of the half-width is bevelled glass
  const STRENGTH = 92; // displacement scale, in px at the filter level

  const hero = document.querySelector('.hero-home');
  if (!hero) return;

  /* ── the displacement map ──────────────────────────────────
     Signed distance to a rounded square, turned into a lens profile:
     flat through the middle, curving away through the bezel. The
     gradient of that profile is the surface normal, and the normal is
     what tells each pixel where to pull its colour from.
     Encoded as red = x shift, green = y shift, 128 meaning no shift. */
  function buildDisplacementMap() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = MAP;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(MAP, MAP);
    const half = MAP / 2;
    const r = (RADIUS / SIZE) * MAP;

    // Signed distance to a rounded box, negative inside
    const sdf = (x, y) => {
      const qx = Math.abs(x - half) - (half - r);
      const qy = Math.abs(y - half) - (half - r);
      const ox = Math.max(qx, 0);
      const oy = Math.max(qy, 0);
      return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
    };

    // Lens height: 1 in the flat centre, easing to 0 at the rim
    const height = d => {
      const band = half * BEZEL;
      if (d >= 0) return 0;
      const t = Math.min(1, -d / band);
      // smoothstep, so the bezel has no crease where it meets the flat
      return t * t * (3 - 2 * t);
    };

    for (let y = 0; y < MAP; y++) {
      for (let x = 0; x < MAP; x++) {
        const i = (y * MAP + x) * 4;
        const d = sdf(x, y);

        if (d >= 0) {
          // Outside the shape: no displacement, fully transparent
          img.data[i] = 128;
          img.data[i + 1] = 128;
          img.data[i + 2] = 128;
          img.data[i + 3] = 0;
          continue;
        }

        // Central difference of the height field gives the slope
        const gx = height(sdf(x + 1, y)) - height(sdf(x - 1, y));
        const gy = height(sdf(x, y + 1)) - height(sdf(x, y - 1));

        img.data[i] = Math.max(0, Math.min(255, 128 + gx * 128 * 6));
        img.data[i + 1] = Math.max(0, Math.min(255, 128 + gy * 128 * 6));
        img.data[i + 2] = 128;
        img.data[i + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
    return canvas.toDataURL();
  }

  /* ── the filter ────────────────────────────────────────────
     Three displacement passes at slightly different strengths, one per
     colour channel, recombined. That difference is the dispersion —
     the faint colour fringe real glass shows at its edges. */
  function buildFilter(mapUrl) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';

    svg.innerHTML =
      '<defs>' +
      '<filter id="atic-liquid-glass" x="-25%" y="-25%" width="150%" height="150%" ' +
      'color-interpolation-filters="sRGB">' +
      '<feImage href="' + mapUrl + '" preserveAspectRatio="none" result="map"/>' +
      // red, shifted most
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + STRENGTH * 1.08 +
      '" xChannelSelector="R" yChannelSelector="G" result="dR"/>' +
      '<feColorMatrix in="dR" type="matrix" result="cR" values="' +
      '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"/>' +
      // green
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + STRENGTH +
      '" xChannelSelector="R" yChannelSelector="G" result="dG"/>' +
      '<feColorMatrix in="dG" type="matrix" result="cG" values="' +
      '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"/>' +
      // blue, shifted least
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="' + STRENGTH * 0.92 +
      '" xChannelSelector="R" yChannelSelector="G" result="dB"/>' +
      '<feColorMatrix in="dB" type="matrix" result="cB" values="' +
      '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"/>' +
      '<feBlend in="cR" in2="cG" mode="screen" result="rg"/>' +
      '<feBlend in="rg" in2="cB" mode="screen"/>' +
      '</filter>' +
      '</defs>';

    document.body.appendChild(svg);
  }

  /* ── support probe ─────────────────────────────────────────
     Chrome takes an SVG filter in backdrop-filter; most others do not.
     Ask the browser rather than sniffing it. */
  function supportsFilteredBackdrop() {
    const probe = document.createElement('div');
    for (const prop of ['backdrop-filter', '-webkit-backdrop-filter']) {
      probe.style.setProperty(prop, 'url(#x) blur(1px)');
      if (probe.style.getPropertyValue(prop)) return true;
    }
    return false;
  }

  function supportsBackdrop() {
    return (
      CSS.supports('backdrop-filter', 'blur(1px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(1px)')
    );
  }

  /* ── build ─────────────────────────────────────────────────── */

  const lens = document.createElement('div');
  lens.className = 'liquid-lens';
  lens.tabIndex = 0;
  lens.setAttribute('role', 'application');
  // Drag-only would shut out anyone not using a mouse, so the lens is
  // focusable and the arrow keys move it.
  lens.setAttribute(
    'aria-label',
    'Decorative glass lens. Drag it, or use the arrow keys to move it.'
  );
  lens.innerHTML = '<span class="liquid-lens-sheen" aria-hidden="true"></span>';

  const refracts = supportsFilteredBackdrop();
  if (refracts) {
    buildFilter(buildDisplacementMap());
    lens.classList.add('refracts');
  } else if (supportsBackdrop()) {
    lens.classList.add('frosted');
  } else {
    lens.classList.add('plain');
  }

  hero.appendChild(lens);

  /* ── placement ─────────────────────────────────────────────
     Starts over the illustration, where there is something worth
     bending, and never over the headline. Position is kept as a
     fraction of the hero so it survives a resize. */
  let fx = 0.66;
  let fy = 0.52;

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  function place() {
    const box = hero.getBoundingClientRect();
    const maxX = Math.max(0, box.width - SIZE);
    const maxY = Math.max(0, box.height - SIZE);
    fx = clamp(fx, 0, 1);
    fy = clamp(fy, 0, 1);
    lens.style.transform =
      'translate3d(' + Math.round(fx * maxX) + 'px,' + Math.round(fy * maxY) + 'px,0)';
  }

  place();
  window.addEventListener('resize', place, { passive: true });

  /* ── dragging ──────────────────────────────────────────────
     Pointer events, so mouse, pen and touch all take the same path.
     Capture means the drag keeps following even when the pointer runs
     off the lens, which is most of the time once it gets moving. */
  let dragging = false;
  let grabX = 0;
  let grabY = 0;

  lens.addEventListener('pointerdown', e => {
    dragging = true;
    const box = hero.getBoundingClientRect();
    const maxX = Math.max(0, box.width - SIZE);
    const maxY = Math.max(0, box.height - SIZE);
    grabX = e.clientX - (box.left + fx * maxX);
    grabY = e.clientY - (box.top + fy * maxY);
    lens.setPointerCapture(e.pointerId);
    lens.classList.add('held');
    e.preventDefault();
  });

  lens.addEventListener('pointermove', e => {
    if (!dragging) return;
    const box = hero.getBoundingClientRect();
    const maxX = Math.max(1, box.width - SIZE);
    const maxY = Math.max(1, box.height - SIZE);
    fx = clamp((e.clientX - grabX - box.left) / maxX, 0, 1);
    fy = clamp((e.clientY - grabY - box.top) / maxY, 0, 1);
    place();
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    lens.classList.remove('held');
    if (e.pointerId !== undefined && lens.hasPointerCapture(e.pointerId)) {
      lens.releasePointerCapture(e.pointerId);
    }
  }
  lens.addEventListener('pointerup', endDrag);
  lens.addEventListener('pointercancel', endDrag);

  /* Arrow keys, with shift for a coarser step. */
  lens.addEventListener('keydown', e => {
    const step = e.shiftKey ? 0.1 : 0.025;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': fx -= step; break;
      case 'ArrowRight': fx += step; break;
      case 'ArrowUp': fy -= step; break;
      case 'ArrowDown': fy += step; break;
      case 'Home': fx = 0.66; fy = 0.52; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    place();
  });
})();
