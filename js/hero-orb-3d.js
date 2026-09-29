/* ============================================================
   ATIC Website — 3D orbit (yujung branch)

   The original hero illustration, rebuilt in three.js: the same five
   photo nodes, the same three icon nodes and the same ATIC centre,
   sitting where the SVG put them, but as glass bubbles that float and
   drift in real space.

   Positions are the SVG's own coordinates (viewBox 0 0 686 623)
   mapped into world units, so the composition is unchanged.

   Photos and icons ride as FLAT discs billboarded at the camera
   inside each bubble — never wrapped onto the sphere, which is what
   produced the wide-angle stretch in an earlier pass.

   Built on react-three-fiber + drei, loaded as ES modules from the
   esm.sh CDN, so the site keeps its no-build static hosting.

   Progressive enhancement. The original SVG stays on screen and this
   module never runs when:
     - the visitor prefers reduced motion
     - the viewport is under 768px
     - WebGL is unavailable
     - the CDN modules fail to load
   ============================================================ */

/* Centre mark drawn with @paper-design/shaders-react (the liquid-logo
   project) instead of the plain wordmark. Off by default so the centre
   matches the original; flip to true to see the liquid metal version. */
const USE_LIQUID_LOGO = false;

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
const PAPER = 'https://esm.sh/@paper-design/shaders-react@0.0.81?deps=react@18.3.1,react-dom@18.3.1';

/* Word bubbles, standing where the photo nodes stand in the SVG so the
   composition is the familiar one. z is the only value invented here — the
   flat artwork had no depth, and staggering it is what turns the ring into
   an orbit. */
const BUBBLES = [
  { label: 'AI',                    pos: [-0.07,  2.33,  0.30], r: 0.68, float: 1.05 },
  { label: 'Assistive\nTechnology', pos: [-2.63,  0.70, -0.25], r: 0.80, float: 1.35 },
  { label: 'XR',                    pos: [ 2.50,  0.53,  0.22], r: 0.60, float: 0.95 },
  { label: 'Neurodiversity',        pos: [-2.06, -2.21,  0.36], r: 0.78, float: 1.20 },
  { label: 'Mental\nHealth',        pos: [ 2.05, -2.13, -0.30], r: 0.70, float: 1.10 }
];

/* The three icon nodes, inside the photo ring exactly as in the SVG. */
const ICON_NODES = [
  { src: 'assets/images/circle/atic_research_testing 1.svg',      pos: [-1.28, -0.36, 0.85], r: 0.40, float: 1.55 },
  { src: 'assets/images/circle/atic_community_partnership 1.svg', pos: [ 0.92,  0.84, 0.80], r: 0.40, float: 1.40 },
  { src: 'assets/images/circle/atic_assistive_technology 1.svg',  pos: [-0.05, -1.77, 0.90], r: 0.40, float: 1.65 }
];

/* Centre of the composition, where the ATIC mark sits in the SVG. */
const CENTRE = { pos: [-0.08, -0.43, 0], r: 0.72 };

/* A few empty bubbles for depth. Nothing in the flat artwork corresponds
   to these; they exist so the scene has something between the nodes. */
const PLAIN_BUBBLES = [
  { pos: [-1.35,  1.45, -1.30], r: 0.24, float: 1.8 },
  { pos: [ 1.55, -0.95, -1.15], r: 0.20, float: 2.1 }
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

/* ── image loading ─────────────────────────────────────────── */

/* Draw any same-origin image — photo or icon SVG — into a square canvas.
   Resolves null instead of rejecting: one missing file must never stall
   the scene, which is what happened when this threw. */
function imageToCanvas(url, size, inset) {
  return new Promise(resolve => {
    let settled = false;
    const done = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => {
      console.warn('[hero-orb] timed out:', url);
      done(null);
    }, 6000);

    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        // Some SVGs report no intrinsic size; fall back to the square box.
        const iw = img.naturalWidth || img.width || size;
        const ih = img.naturalHeight || img.height || size;
        const scale = Math.max(size / iw, size / ih) * inset;
        const w = iw * scale;
        const hh = ih * scale;
        ctx.drawImage(img, (size - w) / 2, (size - hh) / 2, w, hh);
        done(canvas);
      } catch (err) {
        console.warn('[hero-orb] draw failed:', url, err);
        done(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      console.warn('[hero-orb] failed to load:', url);
      done(null);
    };
    img.src = encodeURI(url);
  });
}

/* Label text, drawn with the page's own font so it matches the site. A soft
   white halo sits under the glyphs: the bubble behind them is transparent,
   and the halo keeps the purple readable whatever drifts past underneath. */
function labelCanvas(text, size = 640) {
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
  ctx.shadowBlur = size * 0.05;
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
  ctx.font = '600 128px "IBM Plex Sans", system-ui, sans-serif';
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
  const [react, reactDom, THREE, fiber, drei, paper] = await Promise.all([
    import(REACT),
    import(REACT_DOM),
    import(THREE_URL),
    import(FIBER),
    import(DREI),
    USE_LIQUID_LOGO ? import(PAPER).catch(() => null) : Promise.resolve(null)
  ]);

  const React = react.default || react;
  const { useRef } = React;
  const { createRoot } = reactDom;
  const { Canvas, useFrame } = fiber;
  const { Float, Billboard, MeshTransmissionMaterial, Environment, Lightformer } = drei;
  const LiquidMetal = paper && paper.LiquidMetal;
  const liquidLogoOn = USE_LIQUID_LOGO && !!LiquidMetal;
  const h = React.createElement;

  /* What each bubble's refraction falls back to. Built once and shared, so
     the materials are not allocating a colour every frame. */
  const REFRACT_BG = new THREE.Color('#FFFFFF');

  const makeTexture = canvas => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };

  // 640px keeps the icons crisp: at 320 they were being magnified on screen,
  // which is what made them look broken.
  const iconCanvases = await Promise.all(ICON_NODES.map(n => imageToCanvas(n.src, 640, 0.78)));

  const labelTextures = BUBBLES.map(b => makeTexture(labelCanvas(b.label)));
  const iconTextures = iconCanvases.map(c => (c ? makeTexture(c) : null));
  const highlightTexture = makeTexture(highlightCanvas());
  const wordmarkTexture = makeTexture(wordmarkCanvas());

  console.info(
    `[hero-orb] labels ${labelTextures.length}, ` +
      `icons ${iconTextures.filter(Boolean).length}/${ICON_NODES.length}`
  );

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

  /* ── the glass ───────────────────────────────────────────── */

  /* Body plus rim. The body is clear so the contents and the background
     read through it; the rim is a back-facing shell blended additively,
     which lights up exactly where the surface turns away from the camera.
     That bright pearl edge is what makes a transparent circle read as a
     sphere — without it, the clearer the glass, the more it disappears. */
  function Shell({ r, tint = '#FFFFFF' }) {
    return h(
      'group',
      null,
      h(
        'mesh',
        { renderOrder: 1 },
        h('sphereGeometry', { args: [r, 64, 64] }),
        h(MeshTransmissionMaterial, {
          // transmissionSampler would refract whatever three has in its own
          // scene buffer. On a transparent canvas with nothing behind the
          // bubbles that buffer is empty — the glass refracts black and the
          // whole thing reads grey. Rendering each bubble's own small buffer
          // over an explicit white background is what keeps the glass white.
          transmissionSampler: false,
          background: REFRACT_BG,
          backside: false,
          samples: 2,
          resolution: 128,
          transmission: 1,
          // Thin glass: a thick wall soaks up light and greys the bubble.
          thickness: r * 0.45,
          ior: 1.32,
          chromaticAberration: 0.14,
          anisotropy: 0.1,
          distortion: 0.2,
          distortionScale: 0.28,
          temporalDistortion: 0.05,
          roughness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0,
          attenuationDistance: r * 24,
          attenuationColor: tint,
          color: '#FFFFFF'
        })
      ),
      h(
        'mesh',
        { renderOrder: 2, scale: 1.012 },
        h('sphereGeometry', { args: [r, 48, 48] }),
        h('meshPhysicalMaterial', {
          color: '#FFFFFF',
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          roughness: 0,
          metalness: 0,
          clearcoat: 1,
          // Iridescence tinted the rim, which is part of what looked grey
          // against a light page. Weakened and narrowed to a paler band.
          iridescence: 0.5,
          iridescenceIOR: 1.25,
          iridescenceThicknessRange: [300, 620],
          envMapIntensity: 2.6
        })
      )
    );
  }

  /* Soft bloom around each bubble, faked with one sprite so we never have
     to run a postprocessing pass. */
  function Halo({ r }) {
    return h(
      Billboard,
      null,
      h(
        'mesh',
        { position: [0, 0, -r * 0.25], renderOrder: 0 },
        h('planeGeometry', { args: [r * 3.2, r * 3.2] }),
        h('meshBasicMaterial', {
          map: highlightTexture,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false
        })
      )
    );
  }

  function Glint({ r }) {
    return h(
      Billboard,
      null,
      h(
        'mesh',
        { position: [-r * 0.32, r * 0.4, r * 0.66], renderOrder: 4 },
        h('planeGeometry', { args: [r * 0.78, r * 0.78] }),
        h('meshBasicMaterial', {
          map: highlightTexture,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false
        })
      )
    );
  }

  /* Whatever a bubble carries — a word or an icon — rides at the FRONT of
     the glass, not inside it.

     Sitting the content inside the sphere put it behind a refracting
     surface, so the distortion chewed it up and the artwork looked broken.
     Parked just past the silhouette it stays perfectly crisp, and because
     it is billboarded it still reads as being held by the bubble. */
  function Contents({ r, map, scale, opaque }) {
    return h(
      Billboard,
      null,
      h(
        'mesh',
        { position: [0, 0, r * 1.02], renderOrder: 3 },
        h('planeGeometry', { args: [r * scale, r * scale] }),
        h('meshBasicMaterial', {
          map,
          transparent: !opaque,
          depthWrite: false,
          toneMapped: false
        })
      )
    );
  }

  function LabelNode({ cfg, map }) {
    return h(
      Float,
      { speed: cfg.float, rotationIntensity: 0.16, floatIntensity: 0.9, floatingRange: [-0.14, 0.14] },
      h(
        'group',
        { position: cfg.pos },
        h(Halo, { r: cfg.r }),
        h(Shell, { r: cfg.r }),
        h(Contents, { r: cfg.r, map, scale: 1.72 }),
        h(Glint, { r: cfg.r })
      )
    );
  }

  function IconNode({ cfg, map }) {
    return h(
      Float,
      { speed: cfg.float, rotationIntensity: 0.2, floatIntensity: 1.1, floatingRange: [-0.16, 0.16] },
      h(
        'group',
        { position: cfg.pos },
        h(Halo, { r: cfg.r }),
        h(Shell, { r: cfg.r }),
        h(Contents, { r: cfg.r, map, scale: 1.35 }),
        h(Glint, { r: cfg.r })
      )
    );
  }

  function PlainBubble({ cfg }) {
    return h(
      Float,
      { speed: cfg.float, rotationIntensity: 0.35, floatIntensity: 1.5, floatingRange: [-0.22, 0.22] },
      h(
        'group',
        { position: cfg.pos },
        h(Halo, { r: cfg.r }),
        h(Shell, { r: cfg.r }),
        h(Glint, { r: cfg.r })
      )
    );
  }

  /* Reflections come from a small environment built right here out of
     lightformers — no HDR file is fetched. Glass with nothing to reflect
     looks dead, and this is the cheapest way to give it something. */
  function Studio() {
    return h(
      Environment,
      { resolution: 256, frames: 1 },
      h(Lightformer, {
        form: 'rect', intensity: 4, color: '#FFFFFF',
        position: [0, 4, -6], scale: [14, 7, 1]
      }),
      h(Lightformer, {
        form: 'rect', intensity: 2, color: '#F4EDFF',
        position: [-6, 1, -2], scale: [8, 8, 1], rotation: [0, Math.PI / 2, 0]
      }),
      h(Lightformer, {
        form: 'rect', intensity: 1.8, color: '#EFFAF8',
        position: [6, -2, -2], scale: [8, 8, 1], rotation: [0, -Math.PI / 2, 0]
      }),
      h(Lightformer, {
        form: 'circle', intensity: 3, color: '#FFFFFF',
        position: [2, 5, 3], scale: 5
      }),
      h(Lightformer, {
        form: 'rect', intensity: 1.6, color: '#FFFFFF',
        position: [0, -5, 2], scale: [10, 5, 1], rotation: [Math.PI / 2, 0, 0]
      })
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
        root.current.rotation.y += (pointer.x * 0.14 - root.current.rotation.y) * 0.04;
        root.current.rotation.x += (pointer.y * 0.09 - root.current.rotation.x) * 0.04;
      }
    });

    return h(
      'group',
      { ref: root },
      h(Studio, null),
      h('ambientLight', { intensity: 0.9 }),
      h('directionalLight', { position: [4, 5, 6], intensity: 1.2 }),
      h('pointLight', { position: [0, 1, 4], intensity: 16, distance: 14, color: '#FFFFFF' }),

      h(
        'group',
        { ref: spin },
        BUBBLES.map((cfg, i) => h(LabelNode, { key: `l${i}`, cfg, map: labelTextures[i] })),
        ICON_NODES.map((cfg, i) =>
          iconTextures[i] ? h(IconNode, { key: `i${i}`, cfg, map: iconTextures[i] }) : null
        ),
        PLAIN_BUBBLES.map((cfg, i) => h(PlainBubble, { key: `g${i}`, cfg }))
      ),

      // Centre mark stays out of the spin so the wordmark never turns away.
      h(
        Float,
        { speed: 0.8, rotationIntensity: 0.1, floatIntensity: 0.5, floatingRange: [-0.08, 0.08] },
        h(
          'group',
          { position: CENTRE.pos },
          h(Halo, { r: CENTRE.r }),
          h(Shell, { r: CENTRE.r }),
          liquidLogoOn
            ? null
            : h(
                Billboard,
                null,
                h(
                  'mesh',
                  { position: [0, 0, CENTRE.r * 1.02], renderOrder: 3 },
                  h('planeGeometry', { args: [1.02, 0.51] }),
                  h('meshBasicMaterial', {
                    map: wordmarkTexture,
                    transparent: true,
                    depthWrite: false,
                    toneMapped: false
                  })
                )
              ),
          h(Glint, { r: CENTRE.r })
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

  /* Liquid-metal centre mark, when switched on. It is a DOM canvas of its
     own rather than a three.js material, so it rides above the bubble
     canvas. The ATIC logo SVG is the mask the shader flows through. */
  if (liquidLogoOn) {
    const logoMount = document.createElement('div');
    logoMount.id = 'hero-liquid-logo';
    logoMount.setAttribute('aria-hidden', 'true');
    orb.appendChild(logoMount);

    createRoot(logoMount).render(
      h(LiquidMetal, {
        image: 'assets/images/atic-logo.svg',
        colorBack: '#00000000',
        colorTint: '#EDE3FA',
        speed: 0.7,
        softness: 0.3,
        repetition: 2.4,
        shiftRed: 0.25,
        shiftBlue: 0.3,
        distortion: 0.12,
        contour: 0.5,
        angle: 60,
        scale: 0.58,
        style: { width: '100%', height: '100%' }
      })
    );
  }

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
  // Wait for IBM Plex Sans so the wordmark texture is not baked in the
  // fallback font, but never let a slow font block the scene.
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise(r => setTimeout(r, 2500))])
    .then(start)
    .catch(err => {
      // Fall back to the original SVG illustration, untouched.
      console.warn('[hero-orb] 3D illustration unavailable:', err);
      if (orb) orb.classList.remove('is-3d');
      const mount = document.getElementById('hero-orb-3d');
      if (mount) mount.remove();
    });
}
