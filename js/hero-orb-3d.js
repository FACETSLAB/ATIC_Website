/* ============================================================
   ATIC Website — hero flow scene (yujung branch)

   A three.js scene in the shape of the reference: glass cards on the
   left feeding streams of light into a glowing particle sphere, and a
   single stream leaving it on the right.

   Read as the Center's own story:
     left cards   research, community, assistive technology — the inputs
     sphere       ATIC, where the work is done
     right card   accessible technology reaching people

   Built on react-three-fiber + drei, loaded as ES modules from the
   esm.sh CDN, so the site keeps its no-build static hosting.

   Progressive enhancement. The original SVG stays on screen and this
   module never runs when:
     - the visitor prefers reduced motion
     - the viewport is under 768px
     - WebGL is unavailable
     - the CDN modules fail to load
   ============================================================ */

const PINS = 'deps=react@18.3.1,react-dom@18.3.1,three@0.170.0';
const PINS_R3F = `${PINS},@react-three/fiber@8.17.10`;
const REACT = 'https://esm.sh/react@18.3.1';
const REACT_DOM = 'https://esm.sh/react-dom@18.3.1/client';
const THREE_URL = 'https://esm.sh/three@0.170.0';
const FIBER = `https://esm.sh/@react-three/fiber@8.17.10?${PINS}`;
const DREI = `https://esm.sh/@react-three/drei@9.114.3?${PINS_R3F}`;

/* Palette — the site's own tokens, kept pale so hero copy stays dominant */
const PURPLE = '#46166B';
const VIOLET = '#8A5CD6';
const LILAC = '#C8A9F2';
const MIST = '#EDE3FA';

const SPHERE = { x: 0.45, y: 0.1, r: 1.85 };

/* Input cards, left. Two carry the site's own icons, the rest are the
   small blank tiles of the reference. */
const CARDS = [
  { src: 'assets/images/circle/atic_research_testing 1.svg',      pos: [-3.05,  0.95, 0.35], s: 0.62, float: 1.1 },
  { src: 'assets/images/circle/atic_community_partnership 1.svg', pos: [-2.55, -0.35, 0.15], s: 0.56, float: 1.35 },
  { src: 'assets/images/circle/atic_assistive_technology 1.svg',  pos: [-3.15, -1.35, 0.30], s: 0.58, float: 1.2 },
  { src: null, pos: [-2.15,  1.75, -0.35], s: 0.32, float: 1.6 },
  { src: null, pos: [-1.85,  0.45, -0.55], s: 0.26, float: 1.9 },
  { src: null, pos: [-2.30, -1.85, -0.30], s: 0.30, float: 1.75 }
];

const OUTPUT_CARD = { pos: [3.15, 0.1, 0.2], s: 0.66, float: 0.9 };

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

/* ── canvas-drawn art ──────────────────────────────────────── */

/* Resolves null rather than rejecting: one missing file must never stall
   the scene, which is what happened when this threw. */
function imageToCanvas(url, size, inset) {
  return new Promise(resolve => {
    let settled = false;
    const done = v => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const timer = setTimeout(() => {
      console.warn('[hero] timed out:', url);
      done(null);
    }, 6000);

    const img = new Image();
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext('2d');
        const iw = img.naturalWidth || img.width || size;
        const ih = img.naturalHeight || img.height || size;
        const scale = Math.min(size / iw, size / ih) * inset;
        const w = iw * scale;
        const hh = ih * scale;
        ctx.drawImage(img, (size - w) / 2, (size - hh) / 2, w, hh);
        done(canvas);
      } catch (err) {
        console.warn('[hero] draw failed:', url, err);
        done(null);
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      console.warn('[hero] failed to load:', url);
      done(null);
    };
    img.src = encodeURI(url);
  });
}

/* A rounded glass tile, with the icon already composited into it so the
   card is a single quad rather than a stack. */
function cardCanvas(iconCanvas, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const pad = size * 0.06;
  const r = size * 0.19;
  const box = size - pad * 2;

  const round = (x, y, w, hh, rad) => {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + hh, rad);
    ctx.arcTo(x + w, y + hh, x, y + hh, rad);
    ctx.arcTo(x, y + hh, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  };

  // Body: a pale vertical wash, brighter at the top like frosted glass.
  const g = ctx.createLinearGradient(0, pad, 0, size - pad);
  g.addColorStop(0, 'rgba(255,255,255,0.96)');
  g.addColorStop(1, 'rgba(244,238,253,0.88)');
  ctx.shadowColor = 'rgba(88, 48, 140, 0.16)';
  ctx.shadowBlur = size * 0.07;
  ctx.shadowOffsetY = size * 0.025;
  round(pad, pad, box, box, r);
  ctx.fillStyle = g;
  ctx.fill();

  // Hairline rim
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = size * 0.008;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  round(pad, pad, box, box, r);
  ctx.stroke();

  if (iconCanvas) {
    const inner = box * 0.56;
    ctx.drawImage(iconCanvas, (size - inner) / 2, (size - inner) / 2, inner, inner);
  }
  return canvas;
}

/* The outcome tile on the right: a check, drawn rather than loaded. */
function checkCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  ctx.strokeStyle = PURPLE;
  ctx.lineWidth = size * 0.045;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(c, c, size * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - size * 0.14, c);
  ctx.lineTo(c - size * 0.03, c + size * 0.11);
  ctx.lineTo(c + size * 0.15, c - size * 0.12);
  ctx.stroke();
  return canvas;
}

/* Soft round dot used for every particle and every glow. */
function dotCanvas(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
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
  ctx.fillStyle = PURPLE;
  ctx.font = '600 132px "IBM Plex Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(255,255,255,0.95)';
  ctx.shadowBlur = 30;
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

  const iconCanvases = await Promise.all(
    CARDS.map(c => (c.src ? imageToCanvas(c.src, 512, 0.9) : Promise.resolve(null)))
  );

  const cardTextures = CARDS.map((c, i) => makeTexture(cardCanvas(iconCanvases[i])));
  const outputTexture = makeTexture(cardCanvas(checkCanvas()));
  const dotTexture = makeTexture(dotCanvas());
  const wordmarkTexture = makeTexture(wordmarkCanvas());

  console.info(
    `[hero] cards ${cardTextures.length}, icons ${iconCanvases.filter(Boolean).length}/3`
  );

  /* ── the particle sphere ─────────────────────────────────── */

  /* Points scattered through a sphere, thicker on the right the way the
     reference thickens toward its trailing edge. */
  function makeSphereGeometry(count = 2600) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const scale = new Float32Array(count);
    const a = new THREE.Color(LILAC);
    const b = new THREE.Color(PURPLE);

    let i = 0;
    while (i < count) {
      // Uniform direction, cube-root radius for an even fill.
      const u = Math.random() * 2 - 1;
      const th = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const rad = SPHERE.r * Math.cbrt(Math.random());
      const x = s * Math.cos(th) * rad;
      const y = u * rad;
      const z = s * Math.sin(th) * rad;

      // Reject points on the left so density climbs toward +x.
      const keep = 0.18 + 0.82 * ((x / SPHERE.r + 1) / 2) ** 1.7;
      if (Math.random() > keep) continue;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const t = Math.min(1, Math.max(0, (x / SPHERE.r + 1) / 2));
      const c = a.clone().lerp(b, t * 0.85);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
      scale[i] = 0.55 + Math.random() * 0.9;
      i++;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    return geo;
  }

  function ParticleSphere() {
    const ref = useRef();
    const geo = useMemo(() => makeSphereGeometry(), []);

    useFrame((state, delta) => {
      if (ref.current) ref.current.rotation.y += delta * 0.075;
    });

    return h(
      'points',
      { ref, geometry: geo, position: [SPHERE.x, SPHERE.y, 0] },
      h('pointsMaterial', {
        map: dotTexture,
        size: 0.055,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false
      })
    );
  }

  /* A pale halo so the sphere sits in light rather than on the page. */
  function SphereGlow() {
    return h(
      Billboard,
      { position: [SPHERE.x, SPHERE.y, -0.4] },
      h(
        'mesh',
        { renderOrder: 0 },
        h('planeGeometry', { args: [SPHERE.r * 4.2, SPHERE.r * 4.2] }),
        h('meshBasicMaterial', {
          map: dotTexture,
          color: MIST,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          toneMapped: false
        })
      )
    );
  }

  /* ── the light streams ───────────────────────────────────── */

  /* Each stream is a tube. A band of brightness travels along it, which is
     what makes the whole thing read as flow rather than as wiring. */
  const streamVertex = `
    varying float vT;
    void main() {
      vT = uv.x;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const streamFragment = `
    uniform float uTime;
    uniform float uSeed;
    uniform float uSpeed;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform float uBase;
    varying float vT;

    void main() {
      // Travelling highlight
      float p = fract(vT - uTime * uSpeed + uSeed);
      float pulse = pow(max(0.0, 1.0 - abs(p - 0.5) * 2.0), 10.0);

      // Fade both ends so nothing terminates in a hard stub
      float ends = smoothstep(0.0, 0.16, vT) * smoothstep(1.0, 0.82, vT);

      float alpha = (uBase + pulse * 0.75) * ends;
      vec3 col = mix(uColorA, uColorB, vT);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  function Stream({ curve, seed, speed, base, radius }) {
    const mat = useRef();
    const geo = useMemo(
      () => new THREE.TubeGeometry(curve, 72, radius, 4, false),
      [curve, radius]
    );
    const uniforms = useMemo(
      () => ({
        uTime: { value: 0 },
        uSeed: { value: seed },
        uSpeed: { value: speed },
        uBase: { value: base },
        uColorA: { value: new THREE.Color(LILAC) },
        uColorB: { value: new THREE.Color(VIOLET) }
      }),
      [seed, speed, base]
    );

    useFrame((state, delta) => {
      if (mat.current) mat.current.uniforms.uTime.value += delta;
    });

    return h(
      'mesh',
      { geometry: geo, renderOrder: 1 },
      h('shaderMaterial', {
        ref: mat,
        uniforms,
        vertexShader: streamVertex,
        fragmentShader: streamFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
  }

  /* Curves fanning from the left edge into the sphere, then one bundle
     leaving on the right. */
  function buildStreams() {
    const list = [];
    const inCount = 26;
    for (let i = 0; i < inCount; i++) {
      const t = i / (inCount - 1);
      const y0 = -2.3 + t * 4.6;
      const spread = 1 - Math.abs(t - 0.5) * 2;
      const start = new THREE.Vector3(-3.9, y0, -0.5 + Math.random());
      const mid1 = new THREE.Vector3(-2.2, y0 * 0.85, (Math.random() - 0.5) * 0.9);
      const mid2 = new THREE.Vector3(-0.9, y0 * 0.35 + SPHERE.y * 0.4, (Math.random() - 0.5) * 0.6);
      const end = new THREE.Vector3(SPHERE.x - SPHERE.r * 0.72, SPHERE.y, 0);
      list.push({
        curve: new THREE.CatmullRomCurve3([start, mid1, mid2, end]),
        seed: Math.random(),
        speed: 0.16 + Math.random() * 0.12,
        base: 0.1 + spread * 0.14,
        radius: 0.006 + Math.random() * 0.005
      });
    }

    const outCount = 10;
    for (let i = 0; i < outCount; i++) {
      const t = i / (outCount - 1);
      const y1 = OUTPUT_CARD.pos[1] + (t - 0.5) * 0.5;
      const start = new THREE.Vector3(SPHERE.x + SPHERE.r * 0.72, SPHERE.y, 0);
      const mid = new THREE.Vector3(2.1, SPHERE.y * 0.6 + (t - 0.5) * 0.8, (Math.random() - 0.5) * 0.4);
      const end = new THREE.Vector3(OUTPUT_CARD.pos[0] - 0.42, y1, 0);
      list.push({
        curve: new THREE.CatmullRomCurve3([start, mid, end]),
        seed: Math.random(),
        speed: 0.18 + Math.random() * 0.1,
        base: 0.14,
        radius: 0.007
      });
    }
    return list;
  }

  /* ── the cards ───────────────────────────────────────────── */

  function Card({ cfg, map }) {
    return h(
      Float,
      { speed: cfg.float, rotationIntensity: 0.12, floatIntensity: 0.8, floatingRange: [-0.12, 0.12] },
      h(
        Billboard,
        { position: cfg.pos },
        h(
          'mesh',
          { renderOrder: 3 },
          h('planeGeometry', { args: [cfg.s, cfg.s] }),
          h('meshBasicMaterial', {
            map,
            transparent: true,
            depthWrite: false,
            toneMapped: false
          })
        )
      )
    );
  }

  function Scene() {
    const root = useRef();
    const streams = useMemo(buildStreams, []);
    const pointer = useRef({ x: 0, y: 0 });

    useFrame((state, delta) => {
      pointer.current.x = state.pointer.x;
      pointer.current.y = state.pointer.y;
      if (root.current) {
        // Ease toward the pointer instead of snapping to it.
        root.current.rotation.y += (pointer.current.x * 0.1 - root.current.rotation.y) * 0.04;
        root.current.rotation.x += (-pointer.current.y * 0.06 - root.current.rotation.x) * 0.04;
      }
    });

    return h(
      'group',
      { ref: root },
      h('ambientLight', { intensity: 1.2 }),

      h(SphereGlow, null),
      streams.map((s, i) => h(Stream, Object.assign({ key: `s${i}` }, s))),
      h(ParticleSphere, null),

      // The mark sits in front of the particles at the sphere's centre.
      h(
        Billboard,
        { position: [SPHERE.x, SPHERE.y, SPHERE.r * 0.5] },
        h(
          'mesh',
          { renderOrder: 4 },
          h('planeGeometry', { args: [1.15, 0.575] }),
          h('meshBasicMaterial', {
            map: wordmarkTexture,
            transparent: true,
            depthWrite: false,
            toneMapped: false
          })
        )
      ),

      CARDS.map((cfg, i) => h(Card, { key: `c${i}`, cfg, map: cardTextures[i] })),
      h(Card, { cfg: OUTPUT_CARD, map: outputTexture })
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
          camera: { position: [0, 0, 8.6], fov: 42 },
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
  // Wait for IBM Plex Sans so the wordmark is not baked in the fallback
  // font, but never let a slow font block the scene.
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise(r => setTimeout(r, 2500))])
    .then(start)
    .catch(err => {
      // Fall back to the original SVG illustration, untouched.
      console.warn('[hero] 3D illustration unavailable:', err);
      if (orb) orb.classList.remove('is-3d');
      const mount = document.getElementById('hero-orb-3d');
      if (mount) mount.remove();
    });
}
