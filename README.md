# Galzura Premium 3D Assets

> **Türkiye'nin ilk AI-Atelier 3D web kütüphanesi.**
> Active Theory, Lusion, Monopo seviyesinde premium siteler üretmek için reverse-engineered shader'lar, motor parçaları ve asset pipeline.

---

## 🎯 Neden Var

Standart Three.js kullanarak premium agency seviyesi siteler üretmek imkânsız değil — sadece **bilgi gizli**. Lusion'ın iridescent shader'ı, Active Theory'nin FBO partikül vortex'i, Monopo'nun cinematic kamera spline'ları — bunların hiçbiri açık tutorial değil. AI'lar (Gemini 3.1 Pro, Claude Opus, GPT-5.5) kullanılarak bu tekniklerin **reverse engineering**'ini yapıp Galzura iş akışına uyarlıyoruz.

Bu repo o bilginin **kalıcı belleği**.

---

## 📁 Klasör Yapısı

```
premium-3d-assets/
│
├─ /shaders/              GLSL shader kütüphanesi
│  ├─ iridescent-fresnel.glsl    [v0.1] Lusion-style premium materyal
│  ├─ fbo-particles.glsl         [planlanıyor] Active Theory vortex
│  ├─ liquid-metal.glsl          [planlanıyor] Sıvı yansımalar
│  └─ README.md
│
├─ /engine/               Çekirdek motor parçaları
│  ├─ premium-renderer-setup.js  [v0.1] ACES + post-processing + Lenis
│  ├─ scroll-camera-spline.js    [planlanıyor] CatmullRom kamera yolu
│  └─ README.md
│
├─ /models/               3D modeller (GLTF/GLB, KTX2 textures)
│  └─ (Sketchfab CC0, Poly Pizza, kişisel Blender çıktıları)
│
├─ /hdri/                 Environment maps (.hdr, .exr)
│  └─ (Poly Haven CC0)
│
├─ /textures/             PBR doku setleri
│
├─ /lottie/               UI mikro-animasyonlar
│
├─ /fonts/                Premium font dosyaları (lisanslı)
│
├─ /sounds/               UI ses efektleri
│
└─ /reference/            İlham aldığımız sitelerden ekran kayıtları + analizler
   ├─ lusion-analysis-2026-04.md
   ├─ active-theory-analysis-2026-04.md
   └─ monopo-analysis-(planlanıyor).md
```

---

## 🚀 Quick Start (CM-Bau örneği)

```javascript
import { createPremiumRenderer, PRESETS } from './engine/premium-renderer-setup.js';
import iridescentVert from './shaders/iridescent-fresnel.vert.glsl?raw';
import iridescentFrag from './shaders/iridescent-fresnel.frag.glsl?raw';

// 1. Premium motor başlat (CM-Bau için ATELIER_INDUSTRIAL preseti)
const { scene, camera, render, pointer } = createPremiumRenderer({
  canvas: document.querySelector('#hero-canvas'),
  ...PRESETS.ATELIER_INDUSTRIAL
});

// 2. Iridescent materyal — kopper rim, koyu base
const material = new THREE.ShaderMaterial({
  vertexShader: iridescentVert,
  fragmentShader: iridescentFrag,
  uniforms: {
    uTime:                { value: 0 },
    uBaseColor:           { value: new THREE.Color(0x0a0a0c) },
    uFresnelColor:        { value: new THREE.Color(0xc89669) },
    uFresnelPower:        { value: 3.0 },
    uIridescenceStrength: { value: 0.5 }
  }
});

// 3. Sahneyi kur (instanced cubes — geometric tower)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const tower = new THREE.InstancedMesh(geometry, material, 50);
// ... matrices for tower ...
scene.add(tower);

// 4. Frame loop
function tick(time) {
  material.uniforms.uTime.value = time * 0.001;
  tower.rotation.y = pointer.smooth.x * 0.3;
  render(time);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

---

## 🎨 Sektör Preset'leri

| Preset | Sektör | Karakter |
|---|---|---|
| `CLEAN_LUXURY` | Dental, medical, SaaS | Steril, beyaz, hafif |
| `ATELIER_INDUSTRIAL` | İnşaat, mimari, mühendislik | Kopper, ağır, sanatkâr |
| `HERITAGE_GOLD` | Otel, moda, ajans | Altın, sinemasal, lüks |
| `SHOWREEL_MAX` | Portfolyo, festival, demo | Maksimum efekt |

---

## 📚 Kaynak Belgeleri (`/reference/`)

Her premium kapasite gelişimi belgelenir:

- **Hangi referans siteyi inceledik**
- **Hangi AI'a sorduk** (Gemini 3.1 Pro / Claude / GPT-5.5)
- **Çıkan teknik analiz** (raw, kısaltılmamış)
- **Galzura için uyarlanma kararları**

Bu, gelecekte:
1. Ekibe katılan herkesi 1 günde "premium hazır" hale getirir
2. Her sektör için doğru reçeteyi anında bulmamızı sağlar
3. AI çıktılarının karşılaştırılabilir kalmasını sağlar (reproducibility)

---

## 🔄 Versiyon Tarihi

### v0.1 · 2026-04-27 (BUGÜN)
- ✅ Iridescent Fresnel shader (Lusion + Active Theory analizinden)
- ✅ Premium renderer setup (ACES tone mapping + post-processing + Lenis + pointer inertia)
- ✅ 4 sektör preset'i (Clean / Atelier / Heritage / Showreel)
- 🚧 FBO Particles shader (Aşama 2 — yarın)
- 🚧 Scroll camera spline engine (Aşama 3)
- 🚧 İlk GLTF model setleri

---

## 🤝 İş Akışı

**Yönetmen:** Claude Opus 4.7 (vizyon, sentez, entegrasyon, kalite kontrol)
**3D Sanatçı:** Gemini 3.1 Pro Ultra (referans analiz, shader üretimi, multimodal görsel anlama)
**Producer:** Volkan Çatak (orchestrator, geri bildirim, prodüksiyon)

Her yeni premium kapasite şu döngüden geçer:

```
Volkan referans gönderir
  ↓
Claude Gemini için spesifik prompt yazar
  ↓
Volkan Gemini'ye gönderir, sonucu Claude'a döndürür
  ↓
Claude shader/motor parçasını ürün-hazır hale getirir
  ↓
Repo'ya commit edilir, /reference'a belgelenir
  ↓
Sonraki proje template literal'ından çağrılır
```

---

## 📄 Lisans

Iç kullanım. Üçüncü taraf shader'lar/modeller kendi lisansları altında (Sketchfab CC0, Poly Haven CC0, vb.).

**Galzura Intelligence** © 2026
