/* ============================================================
   ATIC Website — hero glass scene (yujung branch)

   A softly deforming glass orb at the centre, accessibility icon
   cards feeding quiet connector flows into it, and a few smaller
   droplets floating at different depths.

   Techniques taken from the reference projects:
     - glslrefractblob        surface deformation driving the optics
     - r3f-effects-3d-glass   MeshTransmissionMaterial + lightformer rig
     - apple-liquid-glass     restrained refraction of what sits behind

   Built on react-three-fiber + drei, loaded as ES modules from the
   esm.sh CDN, so the site keeps its no-build static hosting.

   Progressive enhancement. The original SVG illustration stays on
   screen and this module never runs when:
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

/* Palette — the site's own purple, plus the blush, cyan and cream the
   references reflect. Kept pale so the hero copy stays dominant. */
const LILAC = '#C8A9F2';
const BLUSH = '#FBE4EF';
const CYAN = '#DDF3F6';
const CREAM = '#FFF6E9';

/* The frustum is 7.27 x 6.6 world units at z = 0, and the illustration box
   is 686px wide, so one world unit is about 94px on screen. Float distances
   below are written against that: 0.10 is roughly 9px, 0.17 roughly 16px. */
const ORB = { x: 0.35, y: 0.05, r: 1.7 };

/* Slow cycles, 11 to 15 seconds, as angular speeds. */
const CYCLE = t => (Math.PI * 2) / t;

const DROPLETS = [
  { pos: [-1.55, 1.62, 0.95], r: 0.34, cycle: 11, phase: 0.0, rise: 0.15 },
  { pos: [1.95, 1.28, -0.85], r: 0.26, cycle: 14, phase: 2.1, rise: 0.12 },
  { pos: [1.35, -1.72, 0.55], r: 0.30, cycle: 13, phase: 4.2, rise: 0.16 }
];

/* Accessibility icon cards, left. Three carry the site's own icons. */
const CARDS = [
  { src: 'assets/images/circle/atic_research_testing 1.svg',      pos: [-3.00,  0.95, 0.35], s: 0.62, cycle: 12, phase: 0.4 },
  { src: 'assets/images/circle/atic_community_partnership 1.svg', pos: [-2.50, -0.35, 0.15], s: 0.56, cycle: 15, phase: 1.9 },
  { src: 'assets/images/circle/atic_assistive_technology 1.svg',  pos: [-3.10, -1.40, 0.30], s: 0.58, cycle: 13, phase: 3.3 }
];

const OUTPUT_CARD = { pos: [3.10, 0.05, 0.2], s: 0.64, cycle: 14, phase: 5.0 };

const orb = document.querySelector('.hero-orb');

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (err) {
    return false;
  }
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function shouldRun() {
  if (!orb) return false;
  if (prefersReducedMotion()) return false;
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

/* A frosted tile, with the icon composited in so each card is one quad. */
function cardCanvas(iconCanvas, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const pad = size * 0.06;
  const r = size * 0.2;
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

  const g = ctx.createLinearGradient(0, pad, 0, size - pad);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(246,240,253,0.86)');
  ctx.shadowColor = 'rgba(88, 48, 140, 0.15)';
  ctx.shadowBlur = size * 0.07;
  ctx.shadowOffsetY = size * 0.025;
  round(pad, pad, box, box, r);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.lineWidth = size * 0.007;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  round(pad, pad, box, box, r);
  ctx.stroke();

  if (iconCanvas) {
    const inner = box * 0.56;
    ctx.drawImage(iconCanvas, (size - inner) / 2, (size - inner) / 2, inner, inner);
  }
  return canvas;
}

function checkCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  ctx.strokeStyle = '#46166B';
  ctx.lineWidth = size * 0.042;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.arc(c, c, size * 0.29, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(c - size * 0.13, c);
  ctx.lineTo(c - size * 0.03, c + size * 0.1);
  ctx.lineTo(c + size * 0.14, c - size * 0.11);
  ctx.stroke();
  return canvas;
}

/* The pastel field that sits behind the orb.

   It does two jobs. It is the soft glow the orb sits in, and it is the thing
   the glass refracts — clear glass in front of a flat colour has nothing to
   bend, which is why the orb was reading as a solid white blob. Giving it
   blush, lavender and cyan to distort is what turns it into glass.

   Alpha falls to nothing well inside the edges: a wash that reaches the
   canvas bounds shows up as a rectangle over the hero. */
function backdropCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;

  const blob = (x, y, r, color) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  };

  blob(c, c, size * 0.46, 'rgba(255,255,255,0.95)');
  blob(size * 0.36, size * 0.34, size * 0.3, 'rgba(214,186,250,0.92)');
  blob(size * 0.66, size * 0.4, size * 0.26, 'rgba(252,206,230,0.9)');
  blob(size * 0.58, size * 0.68, size * 0.28, 'rgba(191,233,243,0.9)');
  blob(size * 0.34, size * 0.66, size * 0.24, 'rgba(255,243,225,0.7)');

  // Circular mask so nothing reaches the corners
  ctx.globalCompositeOperation = 'destination-in';
  const mask = ctx.createRadialGradient(c, c, 0, c, c, c);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(0.55, 'rgba(0,0,0,0.9)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = mask;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'source-over';
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
  const { MeshTransmissionMaterial, Environment, Lightformer } = drei;
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
  const backdropTexture = makeTexture(backdropCanvas());

  console.info(`[hero] cards ${cardTextures.length}, icons ${iconCanvases.filter(Boolean).length}/3`);

  /* What each glass surface refracts when there is nothing behind it. The
     canvas is transparent, so without this the buffer is empty, the glass
     refracts black and every surface reads grey. */
  const REFRACT_BG = new THREE.Color('#FBF7FF');

  /* ── the deforming glass ─────────────────────────────────── */

  /* Sum of sines rather than simplex noise: it is a few multiplies per
     vertex, it never leaves the rounded silhouette the brief asks for, and
     its period is something we choose rather than something we measure. */
  function displace(x, y, z, t) {
    return (
      0.052 * Math.sin(x * 1.7 + t * 1.00) +
      0.044 * Math.sin(y * 2.1 - t * 0.86) +
      0.038 * Math.sin(z * 1.9 + t * 0.74) +
      0.026 * Math.sin((x + y) * 2.6 - t * 0.63) +
      0.018 * Math.sin((y - z) * 3.1 + t * 0.52)
    );
  }

  /* A sphere, not an icosahedron. IcosahedronGeometry ships non-indexed, so
     computeVertexNormals gives every triangle its own face normal and the
     surface shades flat — that is what made the orb look like a cut gem.
     SphereGeometry is indexed, so neighbouring faces share normals and the
     deformed surface stays smooth. */
  function useBlob(radius, segments, speed, phase) {
    const ref = useRef();
    const geo = useMemo(
      () => new THREE.SphereGeometry(radius, segments, Math.round(segments * 0.75)),
      [radius, segments]
    );
    const base = useMemo(() => geo.attributes.position.array.slice(), [geo]);

    useFrame(state => {
      // Driven by absolute elapsed time, so the shape is identical at a
      // given second whatever frame rate the machine is running.
      const t = state.clock.getElapsedTime() * speed + phase;
      const pos = geo.attributes.position;
      const arr = pos.array;
      for (let i = 0; i < arr.length; i += 3) {
        const x = base[i];
        const y = base[i + 1];
        const z = base[i + 2];
        const k = 1 + displace(x, y, z, t);
        arr[i] = x * k;
        arr[i + 1] = y * k;
        arr[i + 2] = z * k;
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    });

    return [ref, geo];
  }

  /* One glass recipe, shared by the orb and the droplets. Refraction is
     deliberately restrained: chromatic aberration and distortion are the
     two dials that turned the earlier version into rainbow banding. */
  function glass(thickness, extra) {
    return Object.assign(
      {
        transmissionSampler: false,
        background: REFRACT_BG,
        backside: false,
        samples: 3,
        resolution: 192,
        transmission: 1,
        thickness,
        ior: 1.36,
        chromaticAberration: 0.045,
        anisotropy: 0.08,
        distortion: 0.08,
        distortionScale: 0.2,
        temporalDistortion: 0.03,
        roughness: 0.04,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        attenuationDistance: 3.0,
        attenuationColor: '#E3D2FF',
        envMapIntensity: 2.1,
        color: '#FFFFFF'
      },
      extra
    );
  }

  /* A thin lit rim. Fresnel only, no interference bands — the banding was
     what produced the repeated rainbow outlines. */
  const rimVertex = `
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `;

  const rimFragment = `
    uniform vec3 uColor;
    uniform float uStrength;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      float facing = clamp(dot(normalize(vNormal), normalize(vView)), 0.0, 1.0);
      // Narrow band hugging the silhouette
      float rim = pow(1.0 - facing, 7.0);
      gl_FragColor = vec4(uColor, rim * uStrength);
    }
  `;

  function Rim({ geometry, color = '#FFFFFF', strength = 0.85 }) {
    const uniforms = useMemo(
      () => ({ uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } }),
      [color, strength]
    );
    return h(
      'mesh',
      { geometry, renderOrder: 3, scale: 1.006 },
      h('shaderMaterial', {
        uniforms,
        vertexShader: rimVertex,
        fragmentShader: rimFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
  }

  function GlassOrb() {
    const [ref, geo] = useBlob(ORB.r, 72, CYCLE(13), 0);
    return h(
      'group',
      { position: [ORB.x, ORB.y, 0] },
      h(
        'mesh',
        { ref, geometry: geo, renderOrder: 2 },
        h(MeshTransmissionMaterial, glass(ORB.r * 0.7, { resolution: 256, samples: 4 }))
      ),
      h(Rim, { geometry: geo, strength: 0.5 })
    );
  }

  function Droplet({ cfg }) {
    const group = useRef();
    const [ref, geo] = useBlob(cfg.r, 32, CYCLE(cfg.cycle), cfg.phase);

    useFrame(state => {
      const t = state.clock.getElapsedTime();
      if (group.current) {
        // 0.15 world units is about 14px at this scale.
        group.current.position.y =
          cfg.pos[1] + Math.sin(t * CYCLE(cfg.cycle) + cfg.phase) * cfg.rise;
        group.current.position.x =
          cfg.pos[0] + Math.sin(t * CYCLE(cfg.cycle * 1.4) + cfg.phase) * cfg.rise * 0.45;
      }
    });

    return h(
      'group',
      { ref: group, position: cfg.pos },
      h(
        'mesh',
        { ref, geometry: geo, renderOrder: 2 },
        h(MeshTransmissionMaterial, glass(cfg.r * 0.8, { resolution: 128, samples: 2 }))
      ),
      h(Rim, { geometry: geo, strength: 0.4 })
    );
  }

  function Backdrop() {
    return h(
      'mesh',
      { position: [ORB.x, ORB.y, -1.35], renderOrder: 0 },
      h('planeGeometry', { args: [ORB.r * 3.5, ORB.r * 3.5] }),
      h('meshBasicMaterial', {
        map: backdropTexture,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        toneMapped: false
      })
    );
  }

  /* Broad, softly curved sources. These are what the glass reflects, so the
     highlights are wide sweeps rather than hot points. */
  function Studio() {
    return h(
      Environment,
      { resolution: 256, frames: 1 },
      h(Lightformer, { form: 'rect', intensity: 3.4, color: '#FFFFFF', position: [0, 5, -4], scale: [14, 8, 1] }),
      h(Lightformer, { form: 'rect', intensity: 2.2, color: BLUSH, position: [-6, 1, 1], scale: [10, 10, 1], rotation: [0, Math.PI / 2, 0] }),
      h(Lightformer, { form: 'rect', intensity: 2.0, color: CYAN, position: [6, -1, 1], scale: [10, 10, 1], rotation: [0, -Math.PI / 2, 0] }),
      h(Lightformer, { form: 'circle', intensity: 2.6, color: CREAM, position: [3, 4, 4], scale: 6 }),
      h(Lightformer, { form: 'rect', intensity: 1.5, color: '#FFFFFF', position: [0, -5, 2], scale: [10, 6, 1], rotation: [Math.PI / 2, 0, 0] })
    );
  }

  /* ── connector flows ─────────────────────────────────────── */

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
    uniform float uBase;
    uniform vec3 uColor;
    varying float vT;

    void main() {
      float p = fract(vT - uTime * uSpeed + uSeed);
      float pulse = pow(max(0.0, 1.0 - abs(p - 0.5) * 2.0), 12.0);
      float ends = smoothstep(0.0, 0.2, vT) * smoothstep(1.0, 0.8, vT);
      gl_FragColor = vec4(uColor, (uBase + pulse * 0.4) * ends);
    }
  `;

  function Stream({ curve, seed, speed, base, radius }) {
    const mat = useRef();
    const geo = useMemo(() => new THREE.TubeGeometry(curve, 64, radius, 4, false), [curve, radius]);
    const uniforms = useMemo(
      () => ({
        uTime: { value: 0 },
        uSeed: { value: seed },
        uSpeed: { value: speed },
        uBase: { value: base },
        uColor: { value: new THREE.Color(LILAC) }
      }),
      [seed, speed, base]
    );

    useFrame(state => {
      if (mat.current) mat.current.uniforms.uTime.value = state.clock.getElapsedTime();
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

  /* Far fewer lines than before, and fainter: the glass is the subject. */
  function buildStreams() {
    const list = [];
    CARDS.forEach((card, i) => {
      for (let k = 0; k < 2; k++) {
        const jitter = (k - 0.5) * 0.28;
        const start = new THREE.Vector3(card.pos[0] + 0.34, card.pos[1] + jitter, card.pos[2]);
        const mid = new THREE.Vector3(-1.3, card.pos[1] * 0.45 + jitter, 0.2);
        const end = new THREE.Vector3(ORB.x - ORB.r * 0.8, ORB.y + jitter * 0.4, 0);
        list.push({
          curve: new THREE.CatmullRomCurve3([start, mid, end]),
          seed: Math.random(),
          speed: 0.09 + Math.random() * 0.04,
          base: 0.07,
          radius: 0.0055
        });
      }
    });

    for (let k = 0; k < 3; k++) {
      const jitter = (k - 1) * 0.2;
      const start = new THREE.Vector3(ORB.x + ORB.r * 0.8, ORB.y + jitter * 0.4, 0);
      const mid = new THREE.Vector3(2.1, ORB.y + jitter, 0.1);
      const end = new THREE.Vector3(OUTPUT_CARD.pos[0] - 0.4, OUTPUT_CARD.pos[1] + jitter, 0);
      list.push({
        curve: new THREE.CatmullRomCurve3([start, mid, end]),
        seed: Math.random(),
        speed: 0.1 + Math.random() * 0.03,
        base: 0.08,
        radius: 0.006
      });
    }
    return list;
  }

  /* ── cards ───────────────────────────────────────────────── */

  function Card({ cfg, map }) {
    const ref = useRef();
    useFrame(state => {
      const t = state.clock.getElapsedTime();
      if (ref.current) {
        // About 10px of travel, each card on its own phase.
        ref.current.position.y = cfg.pos[1] + Math.sin(t * CYCLE(cfg.cycle) + cfg.phase) * 0.11;
      }
    });

    return h(
      'mesh',
      { ref, position: cfg.pos, renderOrder: 4 },
      h('planeGeometry', { args: [cfg.s, cfg.s] }),
      h('meshBasicMaterial', { map, transparent: true, depthWrite: false, toneMapped: false })
    );
  }

  function Scene() {
    const root = useRef();
    const streams = useMemo(buildStreams, []);

    useFrame((state, delta) => {
      if (!root.current) return;
      // Exponential damping, so the ease is the same at any frame rate.
      const k = 1 - Math.exp(-2.2 * delta);
      root.current.rotation.y += (state.pointer.x * 0.09 - root.current.rotation.y) * k;
      root.current.rotation.x += (-state.pointer.y * 0.05 - root.current.rotation.x) * k;
    });

    return h(
      'group',
      { ref: root },
      h(Studio, null),
      h('ambientLight', { intensity: 0.9 }),
      h(Backdrop, null),
      streams.map((s, i) => h(Stream, Object.assign({ key: `s${i}` }, s))),
      h(GlassOrb, null),
      DROPLETS.map((cfg, i) => h(Droplet, { key: `d${i}`, cfg })),
      CARDS.map((cfg, i) => h(Card, { key: `c${i}`, cfg, map: cardTextures[i] })),
      h(Card, { cfg: OUTPUT_CARD, map: outputTexture })
    );
  }

  /* ── mount ───────────────────────────────────────────────── */
  const mount = document.createElement('div');
  mount.id = 'hero-orb-3d';
  mount.setAttribute('aria-hidden', 'true');
  orb.appendChild(mount);

  /* The ATIC mark is an HTML overlay, not a texture in the scene: it stays
     pin sharp at any zoom, never swims with the glass, and it is selectable
     text rather than pixels. */
  const label = document.createElement('span');
  label.className = 'orb-mark';
  label.setAttribute('aria-hidden', 'true'); // the navbar already names the site
  label.textContent = 'ATIC';
  orb.appendChild(label);

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
          onCreated: ({ gl }) => gl.setClearColor(0x000000, 0),
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

  /* Someone can turn reduced motion on after the page has loaded. */
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotionChange = () => {
    if (!motionQuery.matches) return;
    orb.classList.remove('is-3d');
    mount.remove();
    label.remove();
  };
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
}

if (shouldRun()) {
  start().catch(err => {
    // Fall back to the original SVG illustration, untouched.
    console.warn('[hero] 3D illustration unavailable:', err);
    if (orb) orb.classList.remove('is-3d');
    const mount = document.getElementById('hero-orb-3d');
    if (mount) mount.remove();
    const label = document.querySelector('.hero-orb .orb-mark');
    if (label) label.remove();
  });
}
