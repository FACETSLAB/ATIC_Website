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

/* Centre mark rendered with @paper-design/shaders-react (the liquid-logo
   project) instead of flat canvas text. Set to false to go back to the
   plain wordmark if the metal reads too cold against the purple. */
const USE_LIQUID_LOGO = true;

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

/* The Center's research areas, laid out as a loose cloud rather than a ring.
   z varies so the field reads as depth, not as a flat circle of discs.
   These words are decorative here — the same terms appear as real text in
   the About section below, so nothing is WebGL-only. */
const BUBBLES = [
  { label: 'AI',                    pos: [ 0.20,  2.00,  0.45], r: 0.70, float: 1.05, tint: '#FFFFFF' },
  { label: 'Assistive\nTechnology', pos: [-2.35,  0.70, -0.20], r: 0.84, float: 1.35, tint: '#FFFFFF' },
  { label: 'Neurodiversity',        pos: [-1.45, -1.80,  0.50], r: 0.78, float: 1.20, tint: '#FCFAFF' },
  { label: 'Adaptive\nLearning',    pos: [ 2.15, -1.45, -0.25], r: 0.72, float: 1.10, tint: '#FFFFFF' },
  { label: 'Mental\nHealth',        pos: [-2.60, -0.95, -1.10], r: 0.52, float: 1.55, tint: '#FDFBFF' }
];

/* The three flat icons from the original illustration, kept as they are and
   floated inside their own bubbles. */
const ICON_BUBBLES = [
  { src: 'assets/images/circle/atic_research_testing 1.svg',       pos: [ 2.40,  0.85,  0.25], r: 0.60, float: 0.95 },
  { src: 'assets/images/circle/atic_community_partnership 1.svg',  pos: [ 1.15,  1.25, -1.15], r: 0.46, float: 1.45 },
  { src: 'assets/images/circle/atic_assistive_technology 1.svg',   pos: [-0.35, -1.95, -0.95], r: 0.50, float: 1.30 }
];

/* Empty bubbles — no label, pure glass. They carry the depth. */
const PLAIN_BUBBLES = [
  { pos: [-0.95,  1.10, -1.45], r: 0.30, float: 1.8 },
  { pos: [ 1.70, -0.60, -1.05], r: 0.23, float: 2.1 },
  { pos: [-1.75, -0.30, -1.70], r: 0.26, float: 1.7 },
  { pos: [ 1.50,  1.95, -1.25], r: 0.19, float: 2.3 }
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

/* The icon SVGs are used exactly as they ship — drawn once, unmodified,
   into a canvas so three can take them as a texture. They are plain paths
   with no <image> or <foreignObject>, so the canvas stays untainted. */
function svgToCanvas(url, size = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      const scale = Math.min(size / img.width, size / img.height) * 0.82;
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error(`icon failed: ${url}`));
    img.src = encodeURI(url);
  });
}

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
  const [react, reactDom, THREE, fiber, drei, paper] = await Promise.all([
    import(REACT),
    import(REACT_DOM),
    import(THREE_URL),
    import(FIBER),
    import(DREI),
    USE_LIQUID_LOGO ? import(PAPER).catch(() => null) : Promise.resolve(null)
  ]);

  const React = react.default || react;
  const { useRef, useMemo } = React;
  const { createRoot } = reactDom;
  const { Canvas, useFrame } = fiber;
  const { Float, Billboard, MeshTransmissionMaterial, Environment, Lightformer } = drei;
  const LiquidMetal = paper && paper.LiquidMetal;
  const liquidLogoOn = USE_LIQUID_LOGO && !!LiquidMetal;
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
  const iconTextures = await Promise.all(
    ICON_BUBBLES.map(b => svgToCanvas(b.src).then(makeTexture))
  );

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
     Real refraction. An earlier pass used a plain translucent material to
     save the render cost, and the bubbles came out flat — refraction is
     exactly what makes glass read as a volume rather than a tinted circle.

     transmissionSampler shares three's own transmission buffer across every
     bubble, so the scene is rendered once per frame instead of once per
     material, which is what made a dozen transmissive spheres too expensive
     before. chromaticAberration splits the light at the rim, distortion
     makes the refraction crawl, and the two together are the Apple-style
     liquid glass look. */
  function Shell({ r, tint = '#FFFFFF' }) {
    return h(
      'mesh',
      { renderOrder: 1 },
      h('sphereGeometry', { args: [r, 64, 64] }),
      h(MeshTransmissionMaterial, {
        transmissionSampler: true,
        backside: false,
        samples: 4,
        resolution: 256,
        transmission: 1,
        thickness: r * 1.6,
        ior: 1.42,
        chromaticAberration: 0.2,
        anisotropy: 0.2,
        distortion: 0.3,
        distortionScale: 0.4,
        temporalDistortion: 0.1,
        roughness: 0.02,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        // Attenuation is what tints the light passing through. Pushed far out
        // so the glass stays white rather than picking up a purple cast.
        attenuationDistance: r * 14,
        attenuationColor: tint,
        color: '#FFFFFF'
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

  /* The original flat icon, billboarded inside the glass so it never
     distorts — same treatment the labels get. */
  function IconBubble({ cfg, map }) {
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
            { position: [0, 0, cfg.r * 0.45], renderOrder: 2 },
            h('planeGeometry', { args: [cfg.r * 1.15, cfg.r * 1.15] }),
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

  function PlainBubble({ cfg }) {
    return h(
      Float,
      { speed: cfg.float, rotationIntensity: 0.35, floatIntensity: 1.5, floatingRange: [-0.22, 0.22] },
      h('group', { position: cfg.pos }, h(Shell, { r: cfg.r }), h(Glint, { r: cfg.r }))
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
      // The coloured panels stay, but barely tinted — enough to keep the
      // glass from looking grey, not enough to read as purple.
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
      h(Studio, null),
      h('ambientLight', { intensity: 0.85 }),
      h('directionalLight', { position: [4, 5, 6], intensity: 1.2 }),
      h('pointLight', { position: [0, 1, 4], intensity: 16, distance: 14, color: '#FFFFFF' }),

      // The orbit rings are gone: as tubes they read as hard strokes drawn
      // over the glass, which is the flat look we are getting away from.
      h(
        'group',
        { ref: spin },
        content,
        ICON_BUBBLES.map((cfg, i) => h(IconBubble, { key: `ic${i}`, cfg, map: iconTextures[i] })),
        PLAIN_BUBBLES.map((cfg, i) => h(PlainBubble, { key: `g${i}`, cfg }))
      ),

      // Centre mark stays out of the spin so the wordmark never turns away.
      h(
        Float,
        { speed: 0.8, rotationIntensity: 0.1, floatIntensity: 0.5, floatingRange: [-0.08, 0.08] },
        h(Shell, { r: 0.86, tint: '#FFFFFF' }),
        // With the liquid-metal mark on, the wordmark is drawn by
        // @paper-design/shaders-react in its own layer above this canvas.
        liquidLogoOn
          ? null
          : h(
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

  /* Liquid-metal centre mark. It is a DOM canvas of its own rather than a
     three.js material, so it rides above the bubble canvas at the centre of
     the field. The ATIC logo SVG is the mask the shader flows through. */
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
