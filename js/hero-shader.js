/* ============================================================
   ATIC Website — Dynamic hero backdrop (yujung branch)

   Mounts a ShaderGradient (react-three-fiber / three.js) canvas
   behind the home hero. Everything is loaded from the esm.sh CDN
   as ES modules, so the site keeps its no-build, static-hosting
   setup — there is no package.json step to run before deploying.

   Progressive enhancement. The module bails out and leaves the
   static CSS gradient in place when any of these are true:
     - the visitor prefers reduced motion
     - the viewport is under 768px (battery and bandwidth)
     - WebGL is unavailable
     - the CDN modules fail to load
   ============================================================ */

const REACT = 'https://esm.sh/react@18.3.1';
const REACT_DOM = 'https://esm.sh/react-dom@18.3.1/client';
// Pin React on the dependency so esm.sh hands back the same instance we
// imported above — two copies of React in one page break hooks.
const SHADERGRADIENT =
  'https://esm.sh/@shadergradient/react@2?deps=react@18.3.1,react-dom@18.3.1';

const mount = document.getElementById('hero-shader');
const hero = document.querySelector('.hero-home');

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch (err) {
    return false;
  }
}

function shouldRun() {
  if (!mount) return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (!window.matchMedia('(min-width: 768px)').matches) return false;
  return webglAvailable();
}

async function start() {
  const [react, reactDom, shaderGradient] = await Promise.all([
    import(REACT),
    import(REACT_DOM),
    import(SHADERGRADIENT)
  ]);

  const React = react.default || react;
  const { createRoot } = reactDom;
  const { ShaderGradientCanvas, ShaderGradient } = shaderGradient;
  const h = React.createElement;

  /* Palette stays inside the brand's light lavender range so the
     near-black hero copy keeps its contrast ratio. Nothing here is
     dark enough to sink the text. */
  const gradient = {
    control: 'props',
    type: 'waterPlane',
    color1: '#FFFFFF',
    color2: '#E7D7FF',
    color3: '#C8A9F2',
    brightness: 1.2,
    grain: 'on',
    uSpeed: 0.14,          // slow drift, not a distraction beside body copy
    uStrength: 1.3,
    uDensity: 1.2,
    uFrequency: 5.5,
    uAmplitude: 0,
    cDistance: 3.6,
    cPolarAngle: 115,
    cAzimuthAngle: 180,
    cameraZoom: 1,
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationX: 50,
    rotationY: 0,
    rotationZ: -60,
    lightType: '3d',
    envPreset: 'city',
    reflection: 0.1,
    animate: 'on'
  };

  const root = createRoot(mount);
  let inView = true;

  function render() {
    root.render(
      h(
        ShaderGradientCanvas,
        {
          style: { position: 'absolute', inset: 0, pointerEvents: 'none' },
          // Cap the device pixel ratio: a full-bleed shader at 3x on a
          // retina display costs far more paint than it looks better.
          pixelDensity: Math.min(window.devicePixelRatio || 1, 1.5),
          // Stop rendering frames while the hero is scrolled away.
          frameloop: inView ? 'always' : 'never'
        },
        h(ShaderGradient, gradient)
      )
    );
  }

  render();
  requestAnimationFrame(() => mount.classList.add('is-live'));

  if (hero && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        const next = entries[0].isIntersecting;
        if (next === inView) return;
        inView = next;
        render();
      },
      { threshold: 0 }
    );
    observer.observe(hero);
  }
}

if (shouldRun()) {
  start().catch(err => {
    // Leave the static gradient exactly as it is on main.
    console.warn('[hero] dynamic backdrop unavailable:', err);
    if (mount) mount.remove();
  });
}
