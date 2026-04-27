/**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   GALZURA PREMIUM 3D ENGINE · RENDERER SETUP MODULE
 *   File: premium-renderer-setup.js
 *   Source: Synthesis of Lusion / Active Theory analysis (Gemini 3.1 Pro)
 *           + Galzura-specific tuning for client work
 *   Version: 0.1
 *
 *   This module sets up the "expensive look" infrastructure ONCE.
 *   You write your scene logic on top of it. Drop-in for any client project.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   WHAT THIS GIVES YOU (the "%80 of premium feel"):
 *
 *   ✓ ACES Filmic tone mapping        → highlights compress like real film
 *   ✓ sRGB output color space          → colors actually look correct
 *   ✓ Post-processing pipeline         → bloom + chromatic + vignette + grain
 *   ✓ Lenis smooth scroll              → physical momentum, not OS scroll
 *   ✓ Pointer parallax with lerp       → "heavy" mouse-follow inertia
 *   ✓ Resize handler                   → DPR-aware, perf-tuned
 *   ✓ Auto-pause when tab hidden       → battery / GPU friendly
 *
 *   WHAT YOU STILL NEED TO BUILD:
 *
 *   ✗ Your scene contents (geometry, materials, lights)
 *   ✗ Scroll-driven camera path (CatmullRomCurve3 — Phase 2)
 *   ✗ Asset loading (GLTF, HDRI, KTX2 — Phase 3)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   USAGE:
 *
 *   import { createPremiumRenderer } from './premium-renderer-setup.js';
 *
 *   const { scene, camera, render, lenis, pointer } = createPremiumRenderer({
 *     canvas: document.querySelector('#hero-canvas'),
 *     bloom: { strength: 0.6, threshold: 0.2, radius: 0.8 },
 *     chromaticAberration: 0.0015,
 *     grain: 0.05
 *   });
 *
 *   // Build your scene
 *   scene.add( yourMesh );
 *
 *   // Per-frame logic
 *   function tick(t) {
 *     yourMesh.material.uniforms.uTime.value = t;
 *     yourMesh.rotation.y = pointer.smooth.x * 0.3;  // lerp'd pointer
 *     render(t);
 *     requestAnimationFrame(tick);
 *   }
 *   requestAnimationFrame(tick);
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import Lenis from 'lenis';


// ─────────────────────────────────────────────────────────────────────
// FILM LOOK SHADER — Chromatic Aberration + Vignette + Grain
// (Combined into one pass for performance — saves 2 framebuffer copies)
// ─────────────────────────────────────────────────────────────────────

const FilmLookShader = {
  uniforms: {
    tDiffuse:        { value: null },
    uTime:           { value: 0 },
    uChromaticAmt:   { value: 0.0015 },
    uVignetteAmt:    { value: 0.4 },
    uGrainAmt:       { value: 0.05 },
    uResolution:     { value: new THREE.Vector2(1, 1) }
  },

  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uChromaticAmt;
    uniform float uVignetteAmt;
    uniform float uGrainAmt;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // Pseudo-random for grain
    float random(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
    }

    void main() {
      // Chromatic aberration — split RGB at edges
      vec2 fromCenter = vUv - 0.5;
      float distFromCenter = length(fromCenter);
      vec2 caOffset = fromCenter * uChromaticAmt * distFromCenter * 4.0;

      float r = texture2D(tDiffuse, vUv - caOffset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv + caOffset).b;
      vec3 color = vec3(r, g, b);

      // Vignette — soft darkening at corners
      float vignette = smoothstep(0.8, 0.2, distFromCenter);
      color *= mix(1.0 - uVignetteAmt, 1.0, vignette);

      // Grain — high-frequency dither (kills color banding)
      float grain = random(vUv * uResolution) - 0.5;
      color += grain * uGrainAmt;

      gl_FragColor = vec4(color, 1.0);
    }
  `
};


// ─────────────────────────────────────────────────────────────────────
// MAIN FACTORY FUNCTION
// ─────────────────────────────────────────────────────────────────────

export function createPremiumRenderer({
  canvas,
  bloom = { strength: 0.6, threshold: 0.2, radius: 0.8 },
  chromaticAberration = 0.0015,
  vignette = 0.4,
  grain = 0.05,
  cameraFov = 40,            // Premium sites use 35-45° (telephoto feel)
  cameraNear = 0.1,
  cameraFar = 200,
  enableLenis = true,
  pointerLerp = 0.05         // Lower = heavier inertia. 0.05 = Lusion-style
} = {}) {

  // ─── RENDERER ─────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
    stencil: false,
    depth: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // THE CRITICAL TWO LINES — 50% of "premium feel" lives here
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // ─── SCENE & CAMERA ───────────────────────────────────────────────
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    cameraFov,
    window.innerWidth / window.innerHeight,
    cameraNear,
    cameraFar
  );
  camera.position.set(0, 0, 8);


  // ─── POST-PROCESSING ──────────────────────────────────────────────
  const composer = new EffectComposer(renderer);

  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    bloom.strength,
    bloom.radius,
    bloom.threshold
  );
  composer.addPass(bloomPass);

  const filmLookPass = new ShaderPass(FilmLookShader);
  filmLookPass.uniforms.uChromaticAmt.value = chromaticAberration;
  filmLookPass.uniforms.uVignetteAmt.value = vignette;
  filmLookPass.uniforms.uGrainAmt.value = grain;
  filmLookPass.uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  composer.addPass(filmLookPass);


  // ─── LENIS SMOOTH SCROLL ──────────────────────────────────────────
  let lenis = null;
  if (enableLenis) {
    lenis = new Lenis({
      duration: 1.4,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
      touchMultiplier: 1.4
    });

    function lenisRaf(time) {
      lenis.raf(time);
      requestAnimationFrame(lenisRaf);
    }
    requestAnimationFrame(lenisRaf);
  }


  // ─── POINTER WITH INERTIA ─────────────────────────────────────────
  // pointer.target = raw mouse position (-1 to 1)
  // pointer.smooth = lerp'd version — use this for visual effects
  const pointer = {
    target: new THREE.Vector2(0, 0),
    smooth: new THREE.Vector2(0, 0)
  };

  window.addEventListener('pointermove', (e) => {
    pointer.target.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.target.y = -((e.clientY / window.innerHeight) * 2 - 1);
  });


  // ─── RESIZE ───────────────────────────────────────────────────────
  function handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    filmLookPass.uniforms.uResolution.value.set(w, h);
  }
  window.addEventListener('resize', handleResize);


  // ─── VISIBILITY (pause when tab hidden) ───────────────────────────
  let isVisible = true;
  document.addEventListener('visibilitychange', () => {
    isVisible = !document.hidden;
  });


  // ─── RENDER FUNCTION ──────────────────────────────────────────────
  function render(time) {
    if (!isVisible) return;

    // Lerp pointer to smooth (the "heavy" feeling)
    pointer.smooth.x += (pointer.target.x - pointer.smooth.x) * pointerLerp;
    pointer.smooth.y += (pointer.target.y - pointer.smooth.y) * pointerLerp;

    // Update film look time
    filmLookPass.uniforms.uTime.value = time * 0.001;

    composer.render();
  }


  // ─── PUBLIC API ───────────────────────────────────────────────────
  return {
    renderer,
    scene,
    camera,
    composer,
    render,
    lenis,
    pointer,
    passes: { bloom: bloomPass, filmLook: filmLookPass }
  };
}


/**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   PRESET CONFIGURATIONS — Use these instead of guessing parameters
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const PRESETS = {

  // For dental clinics, medical, clean SaaS
  CLEAN_LUXURY: {
    bloom: { strength: 0.4, threshold: 0.4, radius: 0.6 },
    chromaticAberration: 0.0008,
    vignette: 0.25,
    grain: 0.025,
    cameraFov: 38,
    pointerLerp: 0.06
  },

  // For construction (CM-Bau), industrial, architecture
  ATELIER_INDUSTRIAL: {
    bloom: { strength: 0.55, threshold: 0.25, radius: 0.8 },
    chromaticAberration: 0.0015,
    vignette: 0.4,
    grain: 0.05,
    cameraFov: 40,
    pointerLerp: 0.05
  },

  // For luxury hotels, fashion, agencies
  HERITAGE_GOLD: {
    bloom: { strength: 0.7, threshold: 0.18, radius: 0.9 },
    chromaticAberration: 0.002,
    vignette: 0.5,
    grain: 0.06,
    cameraFov: 35,
    pointerLerp: 0.04
  },

  // For showreel / portfolio / Active Theory style demo
  SHOWREEL_MAX: {
    bloom: { strength: 0.9, threshold: 0.15, radius: 1.0 },
    chromaticAberration: 0.0028,
    vignette: 0.55,
    grain: 0.08,
    cameraFov: 32,
    pointerLerp: 0.035
  }

};
