/* ============================================================
   ATIC Website — 3D bubble field (yujung branch)

   Replaces the flat SVG orbit illustration in the home hero with a
   three.js scene: iridescent soap bubbles drifting at different
   depths, each carrying one of the Center's research areas as text.

   Why text and not photos:
   a flat photo mapped onto a sphere stretches at the silhouette —
   the wide-angle look. Two ways out, both kept below:
     SHOW_PHOTOS = false  bubbles carry words (default, lighter)
     SHOW_PHOTOS = true   photos ride as FLAT discs inside the glass,
                          billboarded at the camera, so they stay round
                          and undistorted instead of being wrapped
   Flip the constant to switch; nothing else needs changing.

   Built on react-three-fiber + drei, loaded as ES modules from the
   esm.sh CDN, so the site keeps its no-build static hosting.

   Progressive enhancement. The original SVG stays on screen and this
   module never runs when:
     - the visitor prefers reduced motion
     - the viewport is under 768px
     - WebGL is unavailable
     - the CDN modules or textures fail to load
   ============================================================ */

const SHOW_PHOTOS = false;

/* Every dependency is pinned so esm.sh hands back ONE instance of react,
   three and @react-three/fiber across all modules on the page.
   Left unpinned, drei resolves "@react-three/fiber@>=8.0" by itself and a
   second fiber copy lands on the page, which breaks drei's hooks: its
   components would look for a renderer context our <Canvas> never provided. */
const PINS = 'deps=react@18.3.1,react-dom@18.3.1,three@0.170.0';
const PINS_R3F = `${PINS},@react-three/fiber@8.17.10`;
const REACT = 'https://esm.sh/react@18.3.1';
const REACT_DOM = 'https://esm.sh/react-dom@18.3.1/client';
const THREE_URL = 'https://esm.sh/three@0.170.0';
const FIBER = `https://esm.sh/@react-three/fiber@8.17.10?${PINS}`;
const DREI = `https://esm.sh/@react-three/drei@9.114.3?${PINS_R3F}`;

/* The Center's research areas, laid out as a loose cloud rather than a ring.
   z varies so the field reads as depth, not as a flat circle of discs.
   These words are decorative here — the same terms appear as real text in
   the About section below, so nothing is WebGL-only. */
const BUBBLES = [
  { label: 'AI',                    pos: [ 0.15,  1.95,  0.35], r: 0.70, float: 1.05, tint: '#EAD9FF' },
  { label: 'Assistive\nTechnology', pos: [-2.35,  0.60, -0.25], r: 0.82, float: 1.35, tint: '#DCC7FB' },
  { label: 'XR',                    pos: [ 2.45,  0.75,  0.15], r: 0.58, float: 0.95, tint: '#D8E6FF' },
  { label: 'Neurodiversity',        pos: [-1.55, -1.70,  0.45], r: 0.78, float: 1.20, tint: '#E6D6FF' },
  { label: 'Adaptive\nLearning',    pos: [ 2.05, -1.55, -0.30], r: 0.72, float: 1.10, tint: '#D7F2EF' },
  { label: 'Mental\nHealth',        pos: [-2.55, -0.85, -1.15], r: 0.52, float: 1.55, tint: '#E9DCFF' },
  { label: 'Accessibility',         pos: [ 1.35,  1.85, -1.25], r: 0.50, float: 1.45, tint: '#DDE9FF' }
];

/* Empty bubbles — no label, pure glass. They carry the depth. */
const PLAIN_BUBBLES = [
  { pos: [-0.95,  1.05, -1.45], r: 0.30, float: 1.8 },
  { pos: [ 1.60, -0.55, -1.05], r: 0.22, float: 2.1 },
  { pos: [-1.70, -0.30, -1.70], r: 0.26, float: 1.7 },
  { pos: [ 0.85,  1.35,  0.95], r: 0.17, float: 2.3 },
  { pos: [-0.55, -1.95, -0.85], r: 0.20, float: 1.95 },
  { pos: [ 2.85, -0.35,  0.55], r: 0.15, float: 2.4 },
  { pos: [-2.95,  1.45, -0.45], r: 0.19, float: 2.0 }
];

/* Only read when SHOW_PHOTOS is true. */
const PHOTOS = [
  'assets/images/orb/node-ai.jpg',
  'assets/images/orb/node-lab.jpg',
  'assets/images/orb/node-xr.jpg',
  'assets/images/orb/node-community.jpg',
  'assets/images/orb/node-learning.jpg'
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

/* ── canvas-drawn textures ─────────────────────────────────── */

/* Label text, drawn with the page's own font so it matches the site.
   A soft white halo sits under the glyphs: the bubble behind them is
   translucent, and the halo keeps the purple readable whatever drifts
   past underneath. */
function labelCanvas(text, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const lines = text.split('\n');

  let font = size * 0.19;
  const maxWidth = size * 0.74;
  const fit = () => {
    ctx.font = `600 ${font}px "IBM Plex Sans", system-ui, sans-serif`;
    return Math.max(...lines.map(l => ctx.measureText(l).width));
  };
  while (fit() > maxWidth && font > size * 0.06) font -= size * 0.008;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeight = font * 1.16;
  const top = size / 2 - ((lines.length - 1) * lineHeight) / 2;

  ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
  ctx.shadowBlur = size * 0.055;
  ctx.fillStyle = '#46166B';
  // Two passes: the first lays down the halo, the second the crisp glyphs.
  for (let pass = 0; pass < 2; pass++) {
    if (pass === 1) ctx.shadowBlur = 0;
    lines.forEach((line, i) => ctx.fillText(line, size / 2, top + i * lineHeight));
  }
  return canvas;
}

/* The specular glint every real bubble has, up and to the left. */
function highlightCanvas(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function wordmarkCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size / 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#46166B';
  ctx.font = '600 132px "IBM Plex Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,255,255,0.95)';
  ctx.shadowBlur = 26;
  ctx.fillText('ATIC', canvas.width / 2, canvas.height / 2);
  ctx.shadowBlur = 0;
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
  const { useRef, useMemo } = React;
  const { createRoot } = reactDom;
  const { Canvas, useFrame } = fiber;
  const { Float, Billboard } = drei;
  const h = React.createElement;

  const makeTexture = canvas => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  const labelTextures = BUBBLES.map(b => makeTexture(labelCanvas(b.label)));
  const highlightTexture = makeTexture(highlightCanvas());
  const wordmarkTexture = makeTexture(wordmarkCanvas());

  let photoTextures = [];
  if (SHOW_PHOTOS) {
    const loader = new THREE.TextureLoader();
    photoTextures = await Promise.all(
      PHOTOS.map(
        url =>
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
          )
      )
    );
  }

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

  /* ── the glass shell ─────────────────────────────────────────
     No `transmission`: it makes three render the scene into a buffer
     once per material, and a dozen of those would cost more than the
     whole rest of the page. Iridescence plus clearcoat on a translucent
     shell reads as a soap bubble for almost nothing.
     depthWrite stays off so overlapping bubbles blend instead of
     punching holes in each other. */
  function Shell({ r, tint = '#FFFFFF' }) {
    return h(
      'mesh',
      { renderOrder: 1 },
      h('sphereGeometry', { args: [r, 48, 48] }),
      h('meshPhysicalMaterial', {
        color: tint,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        roughness: 0,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0,
        iridescence: 1,
        iridescenceIOR: 1.35,
        iridescenceThicknessRange: [120, 800],
        envMapIntensity: 1.4
      })
    );
  }

  /* The glint, parked up-left on the shell and always camera-facing. */
  function Glint({ r }) {
    return h(
      Billboard,
      null,
      h(
        'mesh',
        { position: [-r * 0.34, r * 0.38, r * 0.62], renderOrder: 3 },
        h('planeGeometry', { args: [r * 0.62, r * 0.62] }),
        h('meshBasicMaterial', {
          map: highlightTexture,
          transparent: true,
          depthWrite: false,
          toneMapped: false
        })
      )
    );
  }

  /* Content sits at +z INSIDE the shell, so it passes the depth test
     against other bubbles normally while the shell never covers it. */
  function LabelBubble({ cfg, map }) {
    return h(
      Float,
      { speed: cfg.float, rotationIntensity: 0.18, floatIntensity: 1.0, floatingRange: [-0.16, 0.16] },
      h(
        'group',
        { position: cfg.pos },
        h(Shell, { r: cfg.r, tint: cfg.tint }),
        h(
          Billboard,
          null,
          h(
            'mesh',
            { position: [0, 0, cfg.r * 0.45], renderOrder: 2 },
            h('planeGeometry', { args: [cfg.r * 1.72, cfg.r * 1.72] }),
            h('meshBasicMaterial', {
              map,
              transparent: true,
              depthWrite: false,
              toneMapped: false
            })
          )
        ),
        h(Glint, { r: cfg.r })
      )
    );
  }

  /* Photo variant: a flat circular disc, billboarded, so the picture keeps
     its own proportions. This is the fix for the wide-angle stretch that
     mapping a photo straight onto the sphere produces. */
  function PhotoBubble({ cfg, map }) {
    return h(
      Float,
      { speed: cfg.float, rotationIntensity: 0.18, floatIntensity: 1.0, floatingRange: [-0.16, 0.16] },
      h(
        'group',
        { position: cfg.pos },
        h(Shell, { r: cfg.r, tint: '#FFFFFF' }),
        h(
          Billboard,
          null,
          h(
            'mesh',
            { position: [0, 0, cfg.r * 0.42], renderOrder: 2 },
            h('circleGeometry', { args: [cfg.r * 0.78, 64] }),
            h('meshBasicMaterial', { map, toneMapped: false })
          )
        ),
        h(Glint, { r: cfg.r })
      )
    );
  }

  function PlainBubble({ cfg }) {
    return h(
      Float,
      { speed: cfg.float, rotationIntensity: 0.35, floatIntensity: 1.5, floatingRange: [-0.22, 0.22] },
      h('group', { position: cfg.pos }, h(Shell, { r: cfg.r }), h(Glint, { r: cfg.r }))
    );
  }

  function OrbitRing({ radius, tilt, color, opacity }) {
    return h(
      'mesh',
      { rotation: tilt },
      h('torusGeometry', { args: [radius, 0.006, 8, 160] }),
      h('meshBasicMaterial', { color, transparent: true, opacity, toneMapped: false, depthWrite: false })
    );
  }

  function Scene() {
    const root = useRef();
    const spin = useRef();

    const content = useMemo(() => {
      if (!SHOW_PHOTOS) {
        return BUBBLES.map((cfg, i) => h(LabelBubble, { key: `l${i}`, cfg, map: labelTextures[i] }));
      }
      return PHOTOS.map((_, i) =>
        h(PhotoBubble, { key: `p${i}`, cfg: BUBBLES[i], map: photoTextures[i] })
      );
    }, []);

    useFrame((state, delta) => {
      // One slow revolution takes about 80 seconds — movement, not motion sickness.
      if (spin.current) spin.current.rotation.y += delta * 0.078;
      if (root.current) {
        // Ease toward the pointer instead of snapping to it.
        root.current.rotation.y += (pointer.x * 0.15 - root.current.rotation.y) * 0.04;
        root.current.rotation.x += (pointer.y * 0.09 - root.current.rotation.x) * 0.04;
      }
    });

    return h(
      'group',
      { ref: root },
      h('ambientLight', { intensity: 1.15 }),
      h('directionalLight', { position: [4, 5, 6], intensity: 1.6 }),
      h('directionalLight', { position: [-5, -2, 3], intensity: 0.55, color: '#C8A9F2' }),
      h('pointLight', { position: [0, 1, 4], intensity: 22, distance: 14, color: '#FFFFFF' }),

      h(
        'group',
        { ref: spin },
        h(OrbitRing, { radius: 2.72, tilt: [1.32, 0, 0.12], color: '#D9D9D9', opacity: 0.4 }),
        h(OrbitRing, { radius: 1.88, tilt: [1.18, 0.25, -0.2], color: '#CFBAFF', opacity: 0.55 }),
        content,
        PLAIN_BUBBLES.map((cfg, i) => h(PlainBubble, { key: `g${i}`, cfg }))
      ),

      // Centre mark stays out of the spin so the wordmark never turns away.
      h(
        Float,
        { speed: 0.8, rotationIntensity: 0.1, floatIntensity: 0.5, floatingRange: [-0.08, 0.08] },
        h(Shell, { r: 0.86, tint: '#FFFFFF' }),
        h(
          Billboard,
          null,
          h(
            'mesh',
            { position: [0, 0, 0.5], renderOrder: 2 },
            h('planeGeometry', { args: [1.18, 0.59] }),
            h('meshBasicMaterial', {
              map: wordmarkTexture,
              transparent: true,
              depthWrite: false,
              toneMapped: false
            })
          )
        ),
        h(Glint, { r: 0.86 })
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
          camera: { position: [0, 0, 7.4], fov: 45 },
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
  // Wait for IBM Plex Sans before drawing labels, otherwise the text
  // textures bake in the fallback font and never repaint.
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready
    .then(start)
    .catch(err => {
      // Fall back to the original SVG illustration, untouched.
      console.warn('[hero-orb] 3D illustration unavailable:', err);
      if (orb) orb.classList.remove('is-3d');
      const mount = document.getElementById('hero-orb-3d');
      if (mount) mount.remove();
    });
}
