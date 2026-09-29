/* ============================================================
   ATIC Website — 3D orbit bubbles (yujung branch)

   Replaces the flat SVG orbit illustration in the home hero with a
   real three.js scene: each node becomes a glossy sphere that floats
   and drifts around a slowly rotating orbit, with soap-bubble glass
   accents between them.

   Built on react-three-fiber + drei, loaded as ES modules from the
   esm.sh CDN, so the site keeps its no-build static hosting.

   Progressive enhancement. The original SVG stays on screen and this
   module never runs when:
     - the visitor prefers reduced motion
     - the viewport is under 768px
     - WebGL is unavailable
     - the CDN modules or textures fail to load
   ============================================================ */

const REACT = 'https://esm.sh/react@18.3.1';
const REACT_DOM = 'https://esm.sh/react-dom@18.3.1/client';
/* Every dependency is pinned so esm.sh hands back ONE instance of react,
   three and @react-three/fiber across all three modules on the page.
   Left unpinned, drei resolves "@react-three/fiber@>=8.0" by itself and a
   second fiber copy lands on the page, which breaks drei's hooks: its
   components would look for a renderer context our <Canvas> never provided. */
const PINS = 'deps=react@18.3.1,react-dom@18.3.1,three@0.170.0';
const PINS_R3F = `${PINS},@react-three/fiber@8.17.10`;
const THREE_URL = 'https://esm.sh/three@0.170.0';
const FIBER = `https://esm.sh/@react-three/fiber@8.17.10?${PINS}`;
const DREI = `https://esm.sh/@react-three/drei@9.114.3?${PINS_R3F}`;

/* Node layout mirrors the composition of the original SVG: one node top
   centre, two at mid height, two low, with the icons pulled inward. */
const PHOTO_NODES = [
  { tex: 'assets/images/orb/node-ai.jpg', pos: [0.05, 1.95, 0.15], r: 0.62, ring: '#2BB7B1', float: 1.1 },
  { tex: 'assets/images/orb/node-lab.jpg', pos: [-2.45, 0.55, -0.35], r: 0.58, ring: '#9D4CDB', float: 1.4 },
  { tex: 'assets/images/orb/node-xr.jpg', pos: [2.5, 0.3, 0.1], r: 0.6, ring: '#2D77E5', float: 0.9 },
  { tex: 'assets/images/orb/node-community.jpg', pos: [-1.9, -1.8, 0.4], r: 0.54, ring: '#2D77E5', float: 1.25 },
  { tex: 'assets/images/orb/node-learning.jpg', pos: [2.0, -1.85, -0.2], r: 0.56, ring: '#2D77E5', float: 1.0 }
];

const ICON_NODES = [
  { src: 'assets/images/circle/atic_research_testing 1.svg', pos: [-1.3, -0.2, 0.85], r: 0.36, float: 1.6 },
  { src: 'assets/images/circle/atic_community_partnership 1.svg', pos: [1.2, 0.95, 0.75], r: 0.36, float: 1.35 },
  { src: 'assets/images/circle/atic_assistive_technology 1.svg', pos: [0.2, -1.4, 0.9], r: 0.36, float: 1.5 }
];

/* Pure glass bubbles — no content, they just give the scene depth. */
const GLASS_BUBBLES = [
  { pos: [-0.9, 1.15, -1.3], r: 0.3, float: 1.8 },
  { pos: [1.55, -0.75, -1.1], r: 0.22, float: 2.1 },
  { pos: [-1.6, -0.95, -1.5], r: 0.26, float: 1.7 },
  { pos: [0.95, 1.75, -1.4], r: 0.18, float: 2.3 }
];

const orb = document.querySelector('.hero-orb');

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (err) {
    return false;
  }
}

function shouldRun() {
  if (!orb) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (!window.matchMedia('(min-width: 768px)').matches) return false;
  return webglAvailable();
}

/* Rasterise a same-origin vector icon into a texture. These SVGs are plain
   paths with no <image> or <foreignObject>, so the canvas stays untainted. */
function svgToCanvas(url, size = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.min(size / img.width, size / img.height) * 0.78;
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = encodeURI(url);
  });
}

/* The centre mark is drawn rather than loaded, so it always matches the
   page's own font and brand purple. */
function wordmarkCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#46166B';
  ctx.font = '600 128px "IBM Plex Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ATIC', canvas.width / 2, canvas.height / 2);
  return canvas;
}

async function start() {
  const [react, reactDom, THREE, fiber, drei] = await Promise.all([
    import(REACT),
    import(REACT_DOM),
    import(THREE_URL),
    import(FIBER),
    import(DREI)
  ]);

  const React = react.default || react;
  const { useState, useEffect, useRef } = React;
  const { createRoot } = reactDom;
  const { Canvas, useFrame } = fiber;
  const { Float, Billboard } = drei;
  const h = React.createElement;

  /* ── texture loading ─────────────────────────────────────── */
  const loader = new THREE.TextureLoader();
  const loadPhoto = url =>
    new Promise((resolve, reject) =>
      loader.load(
        url,
        tex => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          resolve(tex);
        },
        undefined,
        reject
      )
    );

  const [photos, icons] = await Promise.all([
    Promise.all(PHOTO_NODES.map(n => loadPhoto(n.tex))),
    Promise.all(
      ICON_NODES.map(n =>
        svgToCanvas(n.src).then(canvas => {
          const tex = new THREE.CanvasTexture(canvas);
          tex.colorSpace = THREE.SRGBColorSpace;
          return tex;
        })
      )
    )
  ]);

  const wordmark = new THREE.CanvasTexture(wordmarkCanvas());
  wordmark.colorSpace = THREE.SRGBColorSpace;

  /* ── pointer parallax ────────────────────────────────────── */
  const pointer = { x: 0, y: 0 };
  window.addEventListener(
    'pointermove',
    e => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    },
    { passive: true }
  );

  /* ── pieces ──────────────────────────────────────────────── */

  // A photo node: glossy sphere plus the brand-coloured rim of the 2D design.
  function PhotoBubble({ cfg, map }) {
    return h(
      Float,
      { speed: cfg.float, rotationIntensity: 0.25, floatIntensity: 0.9, floatingRange: [-0.14, 0.14] },
      h(
        'group',
        { position: cfg.pos },
        h(
          'mesh',
          null,
          h('sphereGeometry', { args: [cfg.r, 48, 48] }),
          h('meshPhysicalMaterial', {
            map,
            roughness: 0.2,
            metalness: 0,
            clearcoat: 1,
            clearcoatRoughness: 0.12
          })
        ),
        // Ring sits just outside the sphere silhouette, always facing camera.
        h(
          Billboard,
          null,
          h(
            'mesh',
            null,
            h('ringGeometry', { args: [cfg.r * 1.04, cfg.r * 1.1, 64] }),
            h('meshBasicMaterial', {
              color: cfg.ring,
              transparent: true,
              opacity: 0.95,
              side: THREE.DoubleSide,
              toneMapped: false
            })
          )
        )
      )
    );
  }

  // An icon node: small frosted bubble with the flat icon billboarded inside.
  function IconBubble({ cfg, map }) {
    return h(
      Float,
      { speed: cfg.float, rotationIntensity: 0.2, floatIntensity: 1.1, floatingRange: [-0.16, 0.16] },
      h(
        'group',
        { position: cfg.pos },
        h(
          'mesh',
          null,
          h('sphereGeometry', { args: [cfg.r, 36, 36] }),
          h('meshPhysicalMaterial', {
            color: '#FFFFFF',
            transparent: true,
            opacity: 0.55,
            roughness: 0.08,
            metalness: 0,
            clearcoat: 1,
            transmission: 0.55,
            thickness: 0.35,
            ior: 1.3
          })
        ),
        h(
          Billboard,
          null,
          h(
            'mesh',
            { position: [0, 0, cfg.r * 0.55] },
            h('planeGeometry', { args: [cfg.r * 1.15, cfg.r * 1.15] }),
            h('meshBasicMaterial', { map, transparent: true, toneMapped: false })
          )
        )
      )
    );
  }

  // Empty soap bubble: iridescent shell, nothing inside.
  function GlassBubble({ cfg }) {
    return h(
      Float,
      { speed: cfg.float, rotationIntensity: 0.4, floatIntensity: 1.4, floatingRange: [-0.2, 0.2] },
      h(
        'mesh',
        { position: cfg.pos },
        h('sphereGeometry', { args: [cfg.r, 36, 36] }),
        h('meshPhysicalMaterial', {
          color: '#FFFFFF',
          transparent: true,
          opacity: 0.38,
          roughness: 0,
          metalness: 0,
          clearcoat: 1,
          iridescence: 1,
          iridescenceIOR: 1.3,
          iridescenceThicknessRange: [100, 760]
        })
      )
    );
  }

  // The faint orbit paths of the original illustration, now tilted in space.
  function OrbitRing({ radius, tilt, color, opacity }) {
    return h(
      'mesh',
      { rotation: tilt },
      h('torusGeometry', { args: [radius, 0.008, 8, 160] }),
      h('meshBasicMaterial', { color, transparent: true, opacity, toneMapped: false })
    );
  }

  function Scene() {
    const root = useRef();
    const spin = useRef();

    useFrame((state, delta) => {
      // One slow revolution takes about 80 seconds — movement, not motion sickness.
      if (spin.current) spin.current.rotation.y += delta * 0.078;
      if (root.current) {
        // Ease toward the pointer instead of snapping to it.
        root.current.rotation.y += (pointer.x * 0.16 - root.current.rotation.y) * 0.04;
        root.current.rotation.x += (pointer.y * 0.1 - root.current.rotation.x) * 0.04;
      }
    });

    return h(
      'group',
      { ref: root },
      h('ambientLight', { intensity: 1.1 }),
      h('directionalLight', { position: [4, 5, 6], intensity: 1.7 }),
      h('directionalLight', { position: [-5, -2, 3], intensity: 0.5, color: '#C8A9F2' }),
      h('pointLight', { position: [0, 0, 4], intensity: 18, distance: 12, color: '#FFFFFF' }),

      h(
        'group',
        { ref: spin },
        h(OrbitRing, { radius: 2.62, tilt: [1.32, 0, 0.12], color: '#D9D9D9', opacity: 0.55 }),
        h(OrbitRing, { radius: 1.92, tilt: [1.18, 0.25, -0.2], color: '#CFBAFF', opacity: 0.7 }),
        h(OrbitRing, { radius: 1.35, tilt: [1.45, -0.2, 0.3], color: '#D9D9D9', opacity: 0.4 }),
        PHOTO_NODES.map((cfg, i) => h(PhotoBubble, { key: `p${i}`, cfg, map: photos[i] })),
        ICON_NODES.map((cfg, i) => h(IconBubble, { key: `i${i}`, cfg, map: icons[i] })),
        GLASS_BUBBLES.map((cfg, i) => h(GlassBubble, { key: `g${i}`, cfg }))
      ),

      // Centre mark stays upright so the wordmark is always readable.
      h(
        'group',
        null,
        h(
          'mesh',
          null,
          h('sphereGeometry', { args: [0.78, 48, 48] }),
          h('meshPhysicalMaterial', {
            color: '#FFFFFF',
            transparent: true,
            opacity: 0.72,
            roughness: 0.05,
            metalness: 0,
            clearcoat: 1,
            transmission: 0.4,
            thickness: 0.6,
            ior: 1.35
          })
        ),
        h(
          Billboard,
          null,
          h(
            'mesh',
            { position: [0, 0, 0.8] },
            h('planeGeometry', { args: [1.08, 0.54] }),
            h('meshBasicMaterial', { map: wordmark, transparent: true, toneMapped: false })
          )
        )
      )
    );
  }

  /* ── mount ───────────────────────────────────────────────── */
  const mount = document.createElement('div');
  mount.id = 'hero-orb-3d';
  mount.setAttribute('aria-hidden', 'true');
  orb.appendChild(mount);

  const root = createRoot(mount);
  let inView = true;

  function render() {
    root.render(
      h(
        Canvas,
        {
          camera: { position: [0, 0, 7.2], fov: 45 },
          dpr: [1, 1.5],
          gl: { antialias: true, alpha: true },
          frameloop: inView ? 'always' : 'never',
          style: { position: 'absolute', inset: 0, pointerEvents: 'none' }
        },
        h(Scene, null)
      )
    );
  }

  render();
  orb.classList.add('is-3d');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        const next = entries[0].isIntersecting;
        if (next === inView) return;
        inView = next;
        render();
      },
      { threshold: 0 }
    );
    observer.observe(orb);
  }
}

if (shouldRun()) {
  start().catch(err => {
    // Fall back to the original SVG illustration, untouched.
    console.warn('[hero-orb] 3D illustration unavailable:', err);
    if (orb) orb.classList.remove('is-3d');
    const mount = document.getElementById('hero-orb-3d');
    if (mount) mount.remove();
  });
}
