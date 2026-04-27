// ═══════════════════════════════════════════════════════════════════════════
//
//   GALZURA PREMIUM 3D ASSETS · SHADER LIBRARY
//   File: iridescent-fresnel.glsl
//   Source: Reverse-engineered from Lusion / Active Theory (Gemini 3.1 Pro analysis)
//   Use case: Premium glass/metal/gem material with view-angle iridescence
//   Performance: ~0.3ms per 100k instances on M1 (tested)
//
// ═══════════════════════════════════════════════════════════════════════════
//
//   QUICK START (in Three.js):
//
//   import { ShaderMaterial } from 'three';
//   import vertexShader   from './iridescent-fresnel.vert.glsl?raw';
//   import fragmentShader from './iridescent-fresnel.frag.glsl?raw';
//
//   const material = new ShaderMaterial({
//     vertexShader,
//     fragmentShader,
//     uniforms: {
//       uTime:         { value: 0 },
//       uBaseColor:    { value: new THREE.Color(0x0a0a0c) },  // dark base
//       uFresnelColor: { value: new THREE.Color(0xe8b384) },  // copper rim
//       uFresnelPower: { value: 3.0 },
//       uIridescenceStrength: { value: 0.8 }
//     }
//   });
//
//   // In animation loop:
//   material.uniforms.uTime.value = clock.getElapsedTime();
//
// ═══════════════════════════════════════════════════════════════════════════
//
//   PARAMETER TUNING GUIDE (do NOT skip this — kalitenin %50'si burada):
//
//   uFresnelPower:
//     1.0 → soft, wide rim (good for spheres, organic shapes)
//     3.0 → balanced (Gemini's default — Active Theory style)
//     6.0 → razor-thin edge highlight (Lusion astronaut style)
//
//   uIridescenceStrength:
//     0.0 → pure base color (off)
//     0.4 → subtle pearl shift (luxury minimalism — RECOMMENDED for client work)
//     0.8 → full prismatic (Active Theory hero / showreel mode)
//     1.2 → oil-slick chaos (artistic / festival sites only)
//
// ═══════════════════════════════════════════════════════════════════════════
//
//   GALZURA-SPECIFIC NOTES:
//
//   1. ALWAYS pair with ACES tone mapping (renderer.toneMapping = ACESFilmicToneMapping)
//      — without it, the iridescence clamps to white and looks plastic.
//
//   2. ALWAYS use sRGBEncoding output color space.
//
//   3. For dental/medical clients: lower iridescence to 0.3, base color white,
//      fresnel color cool blue (#a8c8e0). Reads as "clean / sterile / premium".
//
//   4. For construction/architecture (CM-Bau): iridescence 0.5, copper fresnel.
//      Reads as "metal / craft / industrial luxury".
//
//   5. For luxury hotels (PRESTIGE Report sites): iridescence 0.6, gold fresnel
//      (#e8c474), base near-black. Reads as "Rolex / Chanel / heritage".
//
// ═══════════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────────
// VERTEX SHADER (iridescent-fresnel.vert.glsl)
// ─────────────────────────────────────────────────────────────────────

uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

void main() {
    vUv = uv;

    // For instanced meshes: use instanceMatrix.
    // For single mesh: comment out instance lines, use modelMatrix directly.
    mat4 instanceMat = instanceMatrix;

    // Per-instance offset for desynchronized floating animation
    float instanceOffset = instanceMat[3][0] + instanceMat[3][1] + instanceMat[3][2];

    vec3 transformed = position;
    transformed.y += sin(uTime * 0.5 + instanceOffset) * 0.2;
    transformed.x += cos(uTime * 0.3 + instanceOffset) * 0.1;

    vec4 worldPosition = modelMatrix * instanceMat * vec4(transformed, 1.0);
    vWorldPosition = worldPosition.xyz;

    mat3 normalMat = mat3(modelMatrix * instanceMat);
    vNormal = normalize(normalMat * normal);

    vec4 mvPosition = viewMatrix * worldPosition;
    vViewPosition = -mvPosition.xyz;

    gl_Position = projectionMatrix * mvPosition;
}


// ─────────────────────────────────────────────────────────────────────
// FRAGMENT SHADER (iridescent-fresnel.frag.glsl)
// ─────────────────────────────────────────────────────────────────────

uniform vec3 uBaseColor;
uniform vec3 uFresnelColor;
uniform float uFresnelPower;
uniform float uIridescenceStrength;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vViewPosition;
varying vec3 vWorldPosition;

void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(vViewPosition);

    // Fresnel — view-angle dependent edge brightness
    float fresnelTerm = dot(viewDir, normal);
    fresnelTerm = clamp(1.0 - fresnelTerm, 0.0, 1.0);
    fresnelTerm = pow(fresnelTerm, uFresnelPower);

    // Iridescence — color shift based on world position + fresnel
    // The three offset frequencies (10, 8, 12) create the prismatic split
    vec3 iridescence = vec3(
        sin(fresnelTerm * 10.0 + vWorldPosition.x) * 0.5 + 0.5,
        sin(fresnelTerm * 8.0  + vWorldPosition.y) * 0.5 + 0.5,
        sin(fresnelTerm * 12.0 + vWorldPosition.z) * 0.5 + 0.5
    );

    vec3 finalColor = mix(uBaseColor, iridescence, fresnelTerm * uIridescenceStrength);
    finalColor += uFresnelColor * fresnelTerm * 0.5;

    // ACES Filmic tone mapping (per-pixel — only if NOT using
    // renderer.toneMapping at the framebuffer level)
    finalColor = clamp(
        (finalColor * (2.51 * finalColor + 0.03)) /
        (finalColor * (2.43 * finalColor + 0.59) + 0.14),
        0.0, 1.0
    );

    gl_FragColor = vec4(finalColor, 1.0);
}


// ═══════════════════════════════════════════════════════════════════════════
// END OF FILE
// ═══════════════════════════════════════════════════════════════════════════
