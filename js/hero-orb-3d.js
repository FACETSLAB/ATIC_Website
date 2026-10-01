/* ============================================================
   ATIC Website — hero glass scene (yujung branch)

   A softly deforming glass orb at the centre, with accessibility icon
   cards feeding quiet connector flows into it.

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
const ORB = { x: 0.28, y: 0.05, r: 2.08 };

/* Slow cycles, 11 to 15 seconds, as angular speeds. */
const CYCLE = t => (Math.PI * 2) / t;


/* Accessibility icon cards, left. Three carry the site's own icons. */
/* x is bounded by the frustum AT EACH CARD'S DEPTH, not at z = 0. These sit
   at positive z, nearer the camera, where the visible half-width is smaller
   — which is why the left column was being clipped. At z = 8.2 and fov 42
   over a 686x623 box the half-width is 3.47 at z = 0 but only 3.34 at
   z = 0.30 and 3.23 at z = 0.55. Each card keeps 0.25 units clear of its own
   limit, which covers the float drift and the pointer parallax swing. */
const CARDS = [
  { src: 'assets/images/circle/atic_research_testing 1.svg',      pos: [-2.46,  1.42, 0.55], s: 1.04, cycle: 12, phase: 0.4 },
  { src: 'assets/images/circle/atic_community_partnership 1.svg', pos: [-2.66, -0.18, 0.30], s: 0.86, cycle: 15, phase: 1.9 },
  { src: 'assets/images/circle/atic_assistive_technology 1.svg',  pos: [-2.51, -1.68, 0.55], s: 0.94, cycle: 13, phase: 3.3 }
];

const OUTPUT_CARD = { pos: [2.60, 0.08, 0.4], s: 0.90, cycle: 14, phase: 5.0 };

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
  // styles.css hides .hero-illustration below 901px, so anything under that
  // would download three.js and render into a display:none box. Match it.
  if (!window.matchMedia('(min-width: 901px)').matches) return false;
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
  g.addColorStop(0, 'rgba(255,255,255,0.98)');
  g.addColorStop(0.55, 'rgba(250,245,255,0.94)');
  g.addColorStop(1, 'rgba(238,228,251,0.92)');
  ctx.shadowColor = 'rgba(70, 22, 107, 0.22)';
  ctx.shadowBlur = size * 0.1;
  ctx.shadowOffsetY = size * 0.04;
  round(pad, pad, box, box, r);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.shadowColor = 'transparent';
  // Bright rim along the top, a faint brand edge elsewhere
  ctx.lineWidth = size * 0.008;
  ctx.strokeStyle = 'rgba(255,255,255,0.98)';
  round(pad, pad, box, box, r);
  ctx.stroke();
  ctx.lineWidth = size * 0.004;
  ctx.strokeStyle = 'rgba(122, 78, 178, 0.18)';
  round(pad, pad, box, box, r);
  ctx.stroke();

  if (iconCanvas) {
    const inner = box * 0.64;
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

  blob(c, c, size * 0.5, 'rgba(255,255,255,0.9)');
  blob(size * 0.34, size * 0.32, size * 0.34, 'rgba(190,150,248,0.95)');
  blob(size * 0.68, size * 0.38, size * 0.3, 'rgba(252,182,218,0.95)');
  blob(size * 0.58, size * 0.70, size * 0.32, 'rgba(160,224,240,0.95)');
  blob(size * 0.32, size * 0.68, size * 0.28, 'rgba(255,236,199,0.85)');

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
        ior: 1.45,
        chromaticAberration: 0.07,
        anisotropy: 0.12,
        distortion: 0.16,
        distortionScale: 0.35,
        temporalDistortion: 0.05,
        roughness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0,
        attenuationDistance: 12,
        attenuationColor: '#FFFFFF',
        envMapIntensity: 1.5,
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

  /* The colour lives INSIDE the shell.

     Clear glass in front of a backdrop a couple of units away averages that
     backdrop out to grey, however saturated it is — which is what kept
     happening. A tinted core sitting just inside the surface is what every
     liquid-glass render actually does: the shell refracts and distorts
     something coloured that is right up against it.

     It wobbles on its own cycle, so the colour inside shifts against the
     silhouette instead of moving with it. */
  const coreVertex = `
    varying vec3 vPos;
    void main() {
      vPos = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const coreFragment = `
    uniform float uTime;
    uniform vec3 uA;
    uniform vec3 uB;
    uniform vec3 uC;
    uniform vec3 uD;
    varying vec3 vPos;

    void main() {
      // Bilinear blend across the surface, drifting slowly
      float x = clamp(vPos.x * 0.5 + 0.5 + sin(uTime * 0.31 + vPos.y * 1.7) * 0.12, 0.0, 1.0);
      float y = clamp(vPos.y * 0.5 + 0.5 + cos(uTime * 0.24 + vPos.z * 1.5) * 0.12, 0.0, 1.0);
      vec3 col = mix(mix(uA, uB, x), mix(uC, uD, x), y);
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  function InnerCore() {
    const [ref, geo] = useBlob(ORB.r * 0.76, 48, CYCLE(17), 1.7);
    const mat = useRef();
    const uniforms = useMemo(
      () => ({
        uTime: { value: 0 },
        uA: { value: new THREE.Color('#BC90F5') }, // lavender
        uB: { value: new THREE.Color('#FBA6D3') }, // blush
        uC: { value: new THREE.Color('#93E2F4') }, // pale cyan
        uD: { value: new THREE.Color('#FFE9C6') } // pearlescent cream
      }),
      []
    );

    useFrame(state => {
      if (mat.current) mat.current.uniforms.uTime.value = state.clock.getElapsedTime();
    });

    return h(
      'mesh',
      { ref, geometry: geo, renderOrder: 1 },
      h('shaderMaterial', {
        ref: mat,
        uniforms,
        vertexShader: coreVertex,
        fragmentShader: coreFragment
      })
    );
  }

  function GlassOrb() {
    const [ref, geo] = useBlob(ORB.r, 72, CYCLE(13), 0);
    return h(
      'group',
      { position: [ORB.x, ORB.y, 0] },
      h(InnerCore, null),
      h(
        'mesh',
        { ref, geometry: geo, renderOrder: 2 },
        h(MeshTransmissionMaterial, glass(ORB.r * 0.4, { resolution: 256, samples: 4 }))
      ),
      h(Rim, { geometry: geo, strength: 0.5 })
    );
  }

  /* Contact shadow. The orb had no weight without one: a pale mass on a
     pale page with nothing beneath it reads as a sticker. */
  function GroundShadow() {
    return h(
      'mesh',
      { position: [ORB.x + 0.1, ORB.y - ORB.r * 1.02, -0.4], rotation: [0, 0, 0], renderOrder: 0 },
      h('planeGeometry', { args: [ORB.r * 2.1, ORB.r * 0.55] }),
      h('meshBasicMaterial', {
        map: backdropTexture,
        color: '#8E6BC4',
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        toneMapped: false
      })
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
        opacity: 0.6,
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
      h(Lightformer, { form: 'rect', intensity: 3.0, color: '#F7B7D8', position: [-6, 1, 1], scale: [10, 10, 1], rotation: [0, Math.PI / 2, 0] }),
      h(Lightformer, { form: 'rect', intensity: 2.8, color: '#9FE4F2', position: [6, -1, 1], scale: [10, 10, 1], rotation: [0, -Math.PI / 2, 0] }),
      h(Lightformer, { form: 'circle', intensity: 3.0, color: '#FFE7BE', position: [3, 4, 4], scale: 6 }),
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
      float pulse = pow(max(0.0, 1.0 - abs(p - 0.5) * 2.0), 7.0);
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
        uColor: { value: new THREE.Color('#A87BE8') }
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
          base: 0.16,
          radius: 0.0075
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
        base: 0.18,
        radius: 0.008
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
      h(GroundShadow, null),
      streams.map((s, i) => h(Stream, Object.assign({ key: `s${i}` }, s))),
      h(GlassOrb, null),
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
          camera: { position: [0, 0, 8.2], fov: 42 },
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
