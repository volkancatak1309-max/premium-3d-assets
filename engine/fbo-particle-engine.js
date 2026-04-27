/**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   GALZURA PREMIUM 3D ENGINE · FBO PARTICLE SYSTEM
 *   File: fbo-particle-engine.js
 *   Source: Active Theory vortex reverse-engineering (Gemini 3.1 Pro)
 *           + Galzura production tuning
 *   Version: 0.1
 *
 *   GPU-based particle system. Handles 65K-262K particles at 60fps.
 *   Drop-in module — works alongside premium-renderer-setup.js
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   USAGE — Minimal example:
 *
 *   import * as THREE from 'three';
 *   import { createFBOParticles, FBO_PRESETS } from './fbo-particle-engine.js';
 *
 *   const particleSystem = createFBOParticles({
 *     renderer,                          // Your THREE.WebGLRenderer
 *     scene,                             // Your THREE.Scene
 *     ...FBO_PRESETS.VORTEX_STORM        // Or DUST_ATELIER, QUANTUM_FIELD
 *   });
 *
 *   // In your animation loop:
 *   particleSystem.update({
 *     time: elapsedTime,
 *     mouse: { x: mouseX, y: mouseY },   // -1 to 1 range
 *     scroll: scrollY                     // pixels
 *   });
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *   USAGE — With premium-renderer-setup.js:
 *
 *   import { createPremiumRenderer, PRESETS } from './premium-renderer-setup.js';
 *   import { createFBOParticles, FBO_PRESETS } from './fbo-particle-engine.js';
 *
 *   const { renderer, scene, camera, render, pointer } = createPremiumRenderer({
 *     canvas,
 *     ...PRESETS.ATELIER_INDUSTRIAL
 *   });
 *
 *   const particles = createFBOParticles({
 *     renderer, scene,
 *     ...FBO_PRESETS.DUST_ATELIER
 *   });
 *
 *   function tick(time) {
 *     particles.update({
 *       time: time * 0.001,
 *       mouse: pointer.smooth,
 *       scroll: window.scrollY
 *     });
 *     render(time);
 *     requestAnimationFrame(tick);
 *   }
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as THREE from 'three';


// ─────────────────────────────────────────────────────────────────────
// SHADERS (inline — single source of truth)
// ─────────────────────────────────────────────────────────────────────

const SIM_VERT = /* glsl */`
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SIM_FRAG = /* glsl */`
uniform sampler2D uPositions;
uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
uniform float uSpeed;
uniform float uCurlFrequency;
uniform float uCenterStrength;
uniform float uMouseRadius;
uniform float uMouseStrength;
uniform float uScrollAmount;

varying vec2 vUv;

vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float snoise(vec3 v) {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0);
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.5 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

vec3 curlNoise(vec3 p) {
    const float e = 0.1;
    vec3 dx = vec3(e, 0.0, 0.0);
    vec3 dy = vec3(0.0, e, 0.0);
    vec3 dz = vec3(0.0, 0.0, e);
    vec3 p_x0 = vec3(snoise(p - dx), snoise(p - dx + 7.23), snoise(p - dx + 11.1));
    vec3 p_x1 = vec3(snoise(p + dx), snoise(p + dx + 7.23), snoise(p + dx + 11.1));
    vec3 p_y0 = vec3(snoise(p - dy), snoise(p - dy + 7.23), snoise(p - dy + 11.1));
    vec3 p_y1 = vec3(snoise(p + dy), snoise(p + dy + 7.23), snoise(p + dy + 11.1));
    vec3 p_z0 = vec3(snoise(p - dz), snoise(p - dz + 7.23), snoise(p - dz + 11.1));
    vec3 p_z1 = vec3(snoise(p + dz), snoise(p + dz + 7.23), snoise(p + dz + 11.1));
    float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
    float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
    float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;
    return normalize(vec3(x, y, z) / (2.0 * e));
}

void main() {
    vec4 posData = texture2D(uPositions, vUv);
    vec3 pos = posData.xyz;

    vec3 curlForce = curlNoise(pos * uCurlFrequency + uTime * 0.1);
    vec3 centerForce = -normalize(pos) * uCenterStrength * length(pos);

    vec3 mousePos = vec3(uMouse.x * 5.0, uMouse.y * 5.0, 0.0);
    float distToMouse = distance(pos, mousePos);
    vec3 mouseForce = vec3(0.0);
    if (distToMouse < uMouseRadius) {
        mouseForce = normalize(pos - mousePos) * (uMouseRadius - distToMouse) * uMouseStrength;
    }

    vec3 scrollForce = vec3(0.0, sin(uScroll * 0.01 + pos.x) * uScrollAmount, 0.0);

    vec3 velocity = (curlForce + centerForce + mouseForce + scrollForce) * uSpeed;
    pos += velocity * 0.016;

    gl_FragColor = vec4(pos, posData.a);
}
`;

const RENDER_VERT = /* glsl */`
uniform sampler2D uPositions;
uniform float uPointSize;
varying float vDistance;

void main() {
    vec3 pos = texture2D(uPositions, uv).xyz;
    vDistance = length(pos);
    vec4 mvPosition = viewMatrix * modelMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = (uPointSize / -mvPosition.z);
}
`;

const RENDER_FRAG = /* glsl */`
uniform vec3 uColorBase;
uniform vec3 uColorHighlight;
uniform float uOpacity;
varying float vDistance;

void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    float alpha = smoothstep(0.5, 0.1, dist);
    vec3 finalColor = mix(uColorHighlight, uColorBase, clamp(vDistance * 0.3, 0.0, 1.0));
    gl_FragColor = vec4(finalColor, alpha * uOpacity);
}
`;


// ─────────────────────────────────────────────────────────────────────
// MAIN FACTORY FUNCTION
// ─────────────────────────────────────────────────────────────────────

export function createFBOParticles({
  renderer,
  scene,
  textureSize = 256,            // 256 = 65k particles, 512 = 262k
  initialRadius = 2.0,
  // Simulation params
  speed = 1.5,
  curlFrequency = 0.4,
  centerStrength = 0.5,
  mouseRadius = 2.0,
  mouseStrength = 2.0,
  scrollAmount = 0.5,
  // Render params
  pointSize = 10.0,
  colorBase = 0x0c0914,
  colorHighlight = 0xd47c3b,
  opacity = 0.6
} = {}) {

  const SIZE = textureSize;

  // ─── INITIAL DATA — particles in a sphere ────────────────────
  const data = new Float32Array(SIZE * SIZE * 4);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const stride = i * 4;
    const r = initialRadius * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const phi = Math.acos(2 * Math.random() - 1);
    data[stride]     = r * Math.sin(phi) * Math.cos(theta);
    data[stride + 1] = r * Math.sin(phi) * Math.sin(theta);
    data[stride + 2] = r * Math.cos(phi);
    data[stride + 3] = Math.random();
  }

  const dataTexture = new THREE.DataTexture(
    data, SIZE, SIZE, THREE.RGBAFormat, THREE.FloatType
  );
  dataTexture.needsUpdate = true;

  // ─── PING-PONG RENDER TARGETS ────────────────────────────────
  const rtOptions = {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,        // Mobile-safe
    depthBuffer: false,
    stencilBuffer: false
  };

  let rtA = new THREE.WebGLRenderTarget(SIZE, SIZE, rtOptions);
  let rtB = new THREE.WebGLRenderTarget(SIZE, SIZE, rtOptions);

  // ─── SIMULATION SCENE ────────────────────────────────────────
  const simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  simCamera.position.z = 1;
  const simScene = new THREE.Scene();

  const simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uPositions:      { value: dataTexture },
      uTime:           { value: 0 },
      uMouse:          { value: new THREE.Vector2(0, 0) },
      uScroll:         { value: 0 },
      uSpeed:          { value: speed },
      uCurlFrequency:  { value: curlFrequency },
      uCenterStrength: { value: centerStrength },
      uMouseRadius:    { value: mouseRadius },
      uMouseStrength:  { value: mouseStrength },
      uScrollAmount:   { value: scrollAmount }
    },
    vertexShader: SIM_VERT,
    fragmentShader: SIM_FRAG
  });

  const simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial);
  simScene.add(simQuad);

  // ─── PARTICLE GEOMETRY (UV grid) ─────────────────────────────
  const particleGeo = new THREE.BufferGeometry();
  const uvs = new Float32Array(SIZE * SIZE * 2);
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const idx = (i * SIZE + j) * 2;
      uvs[idx]     = j / (SIZE - 1);
      uvs[idx + 1] = i / (SIZE - 1);
    }
  }
  particleGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  particleGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(SIZE * SIZE * 3), 3)
  );

  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uPositions:      { value: null },
      uPointSize:      { value: pointSize },
      uColorBase:      { value: new THREE.Color(colorBase) },
      uColorHighlight: { value: new THREE.Color(colorHighlight) },
      uOpacity:        { value: opacity }
    },
    vertexShader: RENDER_VERT,
    fragmentShader: RENDER_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const particles = new THREE.Points(particleGeo, particleMaterial);
  scene.add(particles);

  // ─── INITIALIZE FBOs ─────────────────────────────────────────
  renderer.setRenderTarget(rtA);
  renderer.render(simScene, simCamera);
  renderer.setRenderTarget(rtB);
  renderer.render(simScene, simCamera);
  renderer.setRenderTarget(null);

  // ─── UPDATE FUNCTION (call every frame) ──────────────────────
  function update({ time = 0, mouse = { x: 0, y: 0 }, scroll = 0 } = {}) {
    simMaterial.uniforms.uTime.value = time;
    simMaterial.uniforms.uMouse.value.set(mouse.x, mouse.y);
    simMaterial.uniforms.uScroll.value = scroll;

    // Ping-pong: read from A, write to B
    simMaterial.uniforms.uPositions.value = rtA.texture;
    renderer.setRenderTarget(rtB);
    renderer.render(simScene, simCamera);
    renderer.setRenderTarget(null);

    // Pass new positions to particle renderer
    particleMaterial.uniforms.uPositions.value = rtB.texture;

    // Swap for next frame
    [rtA, rtB] = [rtB, rtA];
  }

  // ─── PUBLIC API ──────────────────────────────────────────────
  return {
    particles,                  // The THREE.Points object — add to scene
    simMaterial,                // For runtime parameter tuning
    particleMaterial,           // For runtime color/size tuning
    update,
    dispose() {
      rtA.dispose();
      rtB.dispose();
      particleGeo.dispose();
      particleMaterial.dispose();
      simMaterial.dispose();
      dataTexture.dispose();
    }
  };
}


// ─────────────────────────────────────────────────────────────────────
// PRESETS
// ─────────────────────────────────────────────────────────────────────

export const FBO_PRESETS = {

  /**
   * VORTEX_STORM — Active Theory hero style
   * Heavy, swirling, dark base + copper highlights
   * Use case: Galzura.com hero, luxury hotel sites, premium showcase
   */
  VORTEX_STORM: {
    textureSize: 512,
    initialRadius: 2.0,
    speed: 2.0,
    curlFrequency: 0.55,
    centerStrength: 0.5,
    mouseRadius: 2.0,
    mouseStrength: 2.0,
    scrollAmount: 0.5,
    pointSize: 10.0,
    colorBase: 0x05010a,
    colorHighlight: 0xe86a23,
    opacity: 0.6
  },

  /**
   * DUST_ATELIER — Architectural / construction site mood
   * Slow, sparse, warm — like dust in sunlight
   * Use case: CM-Bau, architecture firms, atelier brands
   */
  DUST_ATELIER: {
    textureSize: 128,             // Sparse — fewer particles is the point
    initialRadius: 4.0,
    speed: 0.15,
    curlFrequency: 0.1,
    centerStrength: 0.2,
    mouseRadius: 1.5,
    mouseStrength: 1.0,
    scrollAmount: 0.2,
    pointSize: 14.0,
    colorBase: 0x3a3530,
    colorHighlight: 0xffeedd,
    opacity: 0.45
  },

  /**
   * QUANTUM_FIELD — Scientific / medical / clean
   * Organized, electric blue, tight attractor
   * Use case: Dental clinics, medical SaaS, tech startups
   */
  QUANTUM_FIELD: {
    textureSize: 256,
    initialRadius: 1.5,
    speed: 3.5,
    curlFrequency: 1.2,
    centerStrength: 1.5,          // Tighter — keeps the "atom" shape
    mouseRadius: 2.5,
    mouseStrength: 3.0,
    scrollAmount: 0.3,
    pointSize: 8.0,
    colorBase: 0x001133,
    colorHighlight: 0x00e5ff,
    opacity: 0.7
  }

};
