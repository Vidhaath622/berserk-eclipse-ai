/**
 * Procedural 3D Berserk WebGL Scene (Three.js)
 * 100% self-contained geometries & custom GLSL shaders:
 *  1. Volumetric Blood-Eclipse Corona & Astral Crimson Mist Backdrop
 *  2. 3D Forged-Iron Brand of Sacrifice Sigil with state-reactive crimson veins
 *  3. Peripheral Obsidian Monoliths & Dragon Slayer Greatsword Silhouette
 *  4. Dual-layer Rising Ember & Drifting Ash Particle Systems
 *
 * Strictly zero cursor-tracking circles, rings, or mousemove listeners.
 */

import * as THREE from '/vendor/three/three.module.js';

const ECLIPSE_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ECLIPSE_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform float uAspect;
  uniform float uSurge;      // 0.0 idle -> 1.0 streaming surge
  uniform float uErrorMode;  // 0.0 normal -> 1.0 missing/invalid API key
  uniform float uSubtlety;   // 1.0 full, 0.55 subtle, 0.42 static

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      val += amp * noise(p);
      p = rot * p * 2.04 + vec2(1.7, 9.2);
      amp *= 0.5;
    }
    return val;
  }

  void main() {
    vec2 uv = vUv;
    vec2 sunCenter = vec2(0.5, 0.69);
    vec2 delta = uv - sunCenter;
    delta.x *= uAspect;

    float dist = length(delta);
    float angle = atan(delta.y, delta.x);
    float swirlTime = uTime * mix(0.24, 0.72, uSurge);

    // Polar plasma turbulence for solar corona tendrils
    vec2 polarA = vec2(angle * 3.5 + swirlTime * 0.18, dist * 5.2 - swirlTime * 0.55);
    vec2 polarB = vec2(angle * 7.0 - swirlTime * 0.25, dist * 9.0 - swirlTime * 0.82);
    float plasma = fbm(polarA) * 0.65 + fbm(polarB) * 0.35;

    float moonRadius = 0.128;
    float perturbedDist = dist - (plasma - 0.5) * mix(0.032, 0.058, uSurge);

    // Deep abyssal sky gradient
    vec3 abyssTop = vec3(0.024, 0.018, 0.032);
    vec3 abyssMid = vec3(0.055, 0.032, 0.052);
    vec3 sky = mix(abyssMid, abyssTop, smoothstep(0.15, 0.95, uv.y));

    // Broad atmospheric blood-sky wash behind eclipse
    float skyHalo = exp(-dist * 2.35) * (0.46 + 0.28 * uSurge);
    vec3 bloodWash = mix(vec3(0.42, 0.06, 0.07), vec3(0.24, 0.20, 0.25), uErrorMode * 0.72);
    sky += bloodWash * skyHalo * uSubtlety;

    // Volumetric solar corona filaments
    float coronaMask = smoothstep(moonRadius * 0.88, moonRadius * 1.03, dist);
    float outerDecay = exp(-max(0.0, perturbedDist - moonRadius) * mix(5.8, 4.1, uSurge));
    float coronaRays = pow(max(0.0, plasma * 1.22), 1.65) * outerDecay * coronaMask;

    vec3 crimsonCore = mix(vec3(0.76, 0.10, 0.11), vec3(0.45, 0.38, 0.43), uErrorMode * 0.68);
    vec3 emberAmber = mix(vec3(0.94, 0.42, 0.18), vec3(0.75, 0.18, 0.18), uErrorMode * 0.75);
    vec3 coronaColor = mix(crimsonCore, emberAmber, smoothstep(0.35, 0.85, plasma));

    sky += coronaColor * coronaRays * mix(1.25, 2.05, uSurge) * uSubtlety;

    // Razor-sharp eclipse rim ring (solar chromosphere)
    float rimDelta = abs(dist - moonRadius);
    float rimGlow = exp(-rimDelta * 82.0) * (0.95 + 0.45 * plasma + 0.45 * uSurge);
    vec3 rimTint = mix(vec3(1.0, 0.48, 0.30), vec3(0.82, 0.22, 0.22), uErrorMode * 0.65);
    sky += rimTint * rimGlow * uSubtlety;

    // Occluded black lunar disc at center
    float discMask = 1.0 - smoothstep(moonRadius - 0.004, moonRadius + 0.004, dist);
    vec3 occludedSun = vec3(0.018, 0.014, 0.022);
    sky = mix(sky, occludedSun, discMask * 0.96);

    // Lower astral horizon crimson mist
    vec2 mistCoord = vec2(uv.x * uAspect * 2.3 + uTime * 0.035, uv.y * 4.6 - uTime * 0.018);
    float mistNoise = fbm(mistCoord);
    float horizonBand = smoothstep(0.46, 0.0, uv.y);
    vec3 mistColor = mix(vec3(0.36, 0.055, 0.075), vec3(0.18, 0.15, 0.20), uErrorMode * 0.7);
    sky += mistColor * mistNoise * horizonBand * 0.48 * uSubtlety;

    // Soft edge vignette inside shader backdrop
    float edgeFade = smoothstep(1.35, 0.28, length((uv - 0.5) * vec2(1.15, 1.05)));
    sky *= mix(0.55, 1.0, edgeFade);

    gl_FragColor = vec4(sky, 1.0);
  }
`;

const PARTICLE_VERTEX_SHADER = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uMotionScale;
  varying float vAlpha;
  varying float vPhase;

  void main() {
    vec3 pos = position;
    float cycle = mod(pos.y + uTime * aSpeed * uMotionScale + 9.0, 18.0) - 9.0;
    pos.y = cycle;
    pos.x += sin(uTime * 0.42 * uMotionScale + aPhase) * 0.45;
    pos.z += cos(uTime * 0.31 * uMotionScale + aPhase * 1.3) * 0.28;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uPixelRatio * (18.0 / max(1.5, -mvPosition.z));
    gl_Position = projectionMatrix * mvPosition;

    float fadeBottom = smoothstep(-9.0, -5.5, pos.y);
    float fadeTop = 1.0 - smoothstep(4.5, 9.0, pos.y);
    vAlpha = fadeBottom * fadeTop;
    vPhase = aPhase;
  }
`;

const EMBER_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uGlowBoost;
  uniform float uErrorMode;
  varying float vAlpha;
  varying float vPhase;

  void main() {
    vec2 pt = gl_PointCoord - vec2(0.5);
    float r = length(pt);
    if (r > 0.5) discard;

    float core = smoothstep(0.5, 0.04, r);
    float hotCenter = smoothstep(0.22, 0.0, r);
    float flicker = 0.72 + 0.28 * sin(uTime * 3.4 + vPhase * 5.0);

    vec3 outerCrimson = mix(vec3(0.82, 0.11, 0.11), vec3(0.45, 0.36, 0.40), uErrorMode * 0.7);
    vec3 innerAmber = mix(vec3(1.0, 0.76, 0.42), vec3(0.85, 0.28, 0.25), uErrorMode * 0.7);
    vec3 col = mix(outerCrimson, innerAmber, hotCenter);

    float alpha = core * vAlpha * flicker * uGlowBoost;
    gl_FragColor = vec4(col, alpha);
  }
`;

const ASH_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform float uSubtlety;
  varying float vAlpha;
  varying float vPhase;

  void main() {
    vec2 pt = gl_PointCoord - vec2(0.5);
    // Slightly angular flake silhouette
    float angle = vPhase;
    mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 rp = rot * pt * vec2(1.0, 1.45);
    float r = length(rp);
    if (r > 0.48) discard;

    float soft = smoothstep(0.48, 0.12, r);
    vec3 ashCol = vec3(0.36, 0.31, 0.39);
    gl_FragColor = vec4(ashCol, soft * vAlpha * 0.36 * uSubtlety);
  }
`;

export class BerserkScene3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.state = 'idle'; // 'idle' | 'streaming' | 'error'
    this.atmosphere = 'full'; // 'full' | 'subtle' | 'static'
    this.disposed = false;
    this.rafId = null;
    this.webglReady = false;

    // Smoothly interpolated reactive values
    this.currentSurge = 0;
    this.currentError = 0;
    this.currentGlow = 0.35;
    this.elapsed = 12.5; // Start at an evocative corona phase
    this.lastTimestamp = 0;

    this.init();
  }

  init() {
    if (!this.canvas) return;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
    } catch (err) {
      console.warn('WebGL unavailable; enabling layered CSS Eclipse fallback.', err);
      document.body.classList.add('webgl-fallback');
      return;
    }

    this.webglReady = true;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x060508, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070509, 0.042);

    this.camera = new THREE.PerspectiveCamera(
      46,
      window.innerWidth / Math.max(1, window.innerHeight),
      0.1,
      80
    );
    this.cameraBase = new THREE.Vector3(0, 0.35, 8.8);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(0, 0.65, -6);

    this.buildLights();
    this.buildEclipseBackdrop();
    this.buildBrandOfSacrifice();
    this.buildPeripheryMonolithsAndSword();
    this.buildParticleFields();

    this.handleResize = this.onResize.bind(this);
    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(document.documentElement);
    this.onResize();

    this.handleVisibility = () => {
      if (document.hidden) {
        this.stopLoop();
      } else if (this.atmosphere !== 'static') {
        this.startLoop();
      } else {
        this.renderSingleFrame();
      }
    };
    document.addEventListener('visibilitychange', this.handleVisibility);

    this.startLoop();
  }

  buildLights() {
    const ambient = new THREE.AmbientLight(0x231a28, 0.85);
    this.scene.add(ambient);

    // Primary crimson rim light emanating from the Eclipse
    this.eclipseLight = new THREE.PointLight(0xdc2626, 4.2, 34, 1.5);
    this.eclipseLight.position.set(0, 2.55, -7.2);
    this.scene.add(this.eclipseLight);

    // Secondary cold steel fill from below-left
    const coldRim = new THREE.DirectionalLight(0x4a3f55, 0.75);
    coldRim.position.set(-6, -2, 6);
    this.scene.add(coldRim);

    // Subtle ember uplight near horizon
    this.emberLight = new THREE.PointLight(0xc89645, 1.4, 22, 1.8);
    this.emberLight.position.set(2.5, -3.6, -2.5);
    this.scene.add(this.emberLight);
  }

  buildEclipseBackdrop() {
    this.eclipseUniforms = {
      uTime: { value: this.elapsed },
      uAspect: { value: window.innerWidth / Math.max(1, window.innerHeight) },
      uSurge: { value: 0.0 },
      uErrorMode: { value: 0.0 },
      uSubtlety: { value: 1.0 }
    };

    const geo = new THREE.PlaneGeometry(42, 25, 1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.eclipseUniforms,
      vertexShader: ECLIPSE_VERTEX_SHADER,
      fragmentShader: ECLIPSE_FRAGMENT_SHADER,
      depthWrite: false,
      fog: false
    });

    this.eclipseMesh = new THREE.Mesh(geo, mat);
    this.eclipseMesh.position.set(0, 0.85, -16.5);
    this.scene.add(this.eclipseMesh);
  }

  /**
   * Procedurally constructs a 3D forged-iron Brand of Sacrifice sigil with glowing crimson veins.
   */
  buildBrandOfSacrifice() {
    this.brandGroup = new THREE.Group();
    this.brandGroup.position.set(0, 2.38, -7.6);
    this.brandGroup.scale.setScalar(0.76);

    this.brandIronMat = new THREE.MeshStandardMaterial({
      color: 0x1b151f,
      metalness: 0.86,
      roughness: 0.34,
      emissive: new THREE.Color(0x52090c),
      emissiveIntensity: 0.25
    });

    this.brandVeinMat = new THREE.MeshStandardMaterial({
      color: 0xfca5a5,
      metalness: 0.2,
      roughness: 0.2,
      emissive: new THREE.Color(0xef4444),
      emissiveIntensity: 1.15
    });

    // Iconic angular coordinates of the Berserk Brand of Sacrifice
    const segments = [
      // Central vertical spine
      [[0, -1.62], [0, 1.44], 0.068],
      // Lower angular diamond V-legs
      [[0, -1.62], [-0.66, -0.78], 0.064],
      [[0, -1.62], [0.66, -0.78], 0.064],
      // Crossing center X-limbs
      [[-0.66, -0.78], [0.76, 0.68], 0.064],
      [[0.66, -0.78], [-0.76, 0.68], 0.064],
      // Upper diamond convergence to crown base
      [[-0.76, 0.68], [0, 1.44], 0.064],
      [[0.76, 0.68], [0, 1.44], 0.064],
      // Crown / three-pronged apex fork
      [[0, 1.40], [-0.27, 1.76], 0.052],
      [[0, 1.40], [0.27, 1.76], 0.052],
      [[0, 1.40], [0, 1.88], 0.054],
      // Subtle horizontal center barbs
      [[-0.36, -0.05], [0.36, -0.05], 0.046]
    ];

    const addStrut = ([x1, y1], [x2, y2], radius) => {
      const start = new THREE.Vector3(x1, y1, 0);
      const end = new THREE.Vector3(x2, y2, 0);
      const dir = new THREE.Vector3().subVectors(end, start);
      const len = dir.length() + radius * 0.7;
      const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
      const angle = Math.atan2(dir.y, dir.x) - Math.PI / 2;

      // 4-sided diamond-bevel forged iron bar
      const ironGeo = new THREE.CylinderGeometry(radius, radius, len, 4, 1);
      ironGeo.rotateY(Math.PI / 4);
      const ironMesh = new THREE.Mesh(ironGeo, this.brandIronMat);
      ironMesh.position.copy(mid);
      ironMesh.rotation.z = angle;
      ironMesh.scale.set(1.0, 1.0, 0.72);
      this.brandGroup.add(ironMesh);

      // Recessed glowing crimson sacrificial vein along the front ridge
      const veinGeo = new THREE.CylinderGeometry(radius * 0.30, radius * 0.30, len * 0.96, 4, 1);
      veinGeo.rotateY(Math.PI / 4);
      const veinMesh = new THREE.Mesh(veinGeo, this.brandVeinMat);
      veinMesh.position.set(mid.x, mid.y, radius * 0.56);
      veinMesh.rotation.z = angle;
      this.brandGroup.add(veinMesh);
    };

    for (const [p1, p2, r] of segments) {
      addStrut(p1, p2, r);
    }

    // Sharp beveled apex & base spikes
    const tipCone = new THREE.ConeGeometry(0.085, 0.24, 4);
    tipCone.rotateY(Math.PI / 4);
    const bottomSpike = new THREE.Mesh(tipCone, this.brandIronMat);
    bottomSpike.position.set(0, -1.70, 0);
    bottomSpike.rotation.z = Math.PI;
    this.brandGroup.add(bottomSpike);

    this.scene.add(this.brandGroup);
  }

  /**
   * Frames the far left and far right periphery with jagged obsidian monoliths
   * and a monumental procedural 3D Dragon Slayer greatsword embedded in cleaved stone.
   */
  buildPeripheryMonolithsAndSword() {
    this.peripheryGroup = new THREE.Group();

    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x0f0b13,
      metalness: 0.42,
      roughness: 0.68,
      flatShading: true
    });

    const createMonolith = (radius, height, x, y, z, rotZ, rotY = 0) => {
      const geo = new THREE.ConeGeometry(radius, height, 5, 4);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        // Deterministic jagged rock crags (no external textures required)
        const seed = Math.sin(vx * 7.1 + vy * 3.7 + vz * 5.3 + x);
        const factor = 1.0 + seed * 0.18;
        pos.setXYZ(i, vx * factor, vy, vz * factor);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, obsidianMat);
      mesh.position.set(x, y, z);
      mesh.rotation.set(0.06, rotY, rotZ);
      this.peripheryGroup.add(mesh);
    };

    // Far-left obsidian crag spires (clear of center reading column)
    createMonolith(1.35, 8.2, -6.9, -2.1, -5.8, -0.14, 0.4);
    createMonolith(0.95, 6.4, -8.2, -2.6, -7.2, 0.11, 1.1);
    createMonolith(1.65, 4.8, -5.9, -3.7, -4.6, -0.22, 2.0);

    // Far-right obsidian crags & mound anchoring the Dragon Slayer
    createMonolith(1.45, 7.6, 7.4, -2.3, -6.4, 0.16, 0.8);
    createMonolith(1.85, 3.8, 5.45, -3.85, -3.9, 0.08, 1.6);
    createMonolith(1.05, 5.5, 8.5, -2.9, -7.8, -0.12, 2.4);

    // Procedural 3D Dragon Slayer Greatsword embedded diagonally on far right ridge
    const swordGroup = new THREE.Group();

    const darkFullerMat = new THREE.MeshStandardMaterial({
      color: 0x120f16,
      metalness: 0.78,
      roughness: 0.52
    });

    const honedEdgeMat = new THREE.MeshStandardMaterial({
      color: 0x6b5f73,
      metalness: 0.92,
      roughness: 0.24,
      emissive: new THREE.Color(0x3a0b0e),
      emissiveIntensity: 0.28
    });

    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x261d24,
      metalness: 0.25,
      roughness: 0.85
    });

    // Beveled outer steel blade slab (chisel-pointed massive slab)
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(-0.34, -2.2);
    bladeShape.lineTo(0.34, -2.2);
    bladeShape.lineTo(0.31, 2.15);
    bladeShape.lineTo(0, 2.75);
    bladeShape.lineTo(-0.31, 2.15);
    bladeShape.closePath();

    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, {
      depth: 0.075,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.055,
      bevelThickness: 0.045
    });
    bladeGeo.center();
    const bladeOuter = new THREE.Mesh(bladeGeo, honedEdgeMat);
    swordGroup.add(bladeOuter);

    // Heavy blackened iron central slab core (classic Dragon Slayer contrast)
    const coreGeo = new THREE.BoxGeometry(0.42, 4.35, 0.175);
    const bladeCore = new THREE.Mesh(coreGeo, darkFullerMat);
    bladeCore.position.set(0, -0.18, 0);
    swordGroup.add(bladeCore);

    // Stubby forged iron collar & crossguard lugs
    const guardGeo = new THREE.BoxGeometry(0.92, 0.22, 0.28);
    const guardMesh = new THREE.Mesh(guardGeo, honedEdgeMat);
    guardMesh.position.set(0, 2.38, 0);
    swordGroup.add(guardMesh);

    const ricassoCollar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.30, 0.24), darkFullerMat);
    ricassoCollar.position.set(0, 2.18, 0);
    swordGroup.add(ricassoCollar);

    // Long two-handed wrapped hilt
    const gripGeo = new THREE.CylinderGeometry(0.085, 0.095, 1.25, 8);
    const gripMesh = new THREE.Mesh(gripGeo, gripMat);
    gripMesh.position.set(0, 3.08, 0);
    swordGroup.add(gripMesh);

    // Iconic pommel cap & iron ring link
    const pommelCap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.10, 0.18, 8), honedEdgeMat);
    pommelCap.position.set(0, 3.74, 0);
    swordGroup.add(pommelCap);

    const pommelRing = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 18), honedEdgeMat);
    pommelRing.position.set(0, 3.92, 0);
    swordGroup.add(pommelRing);

    // Embed tip downward into the right-hand obsidian crag
    swordGroup.rotation.z = Math.PI + 0.24;
    swordGroup.rotation.y = -0.34;
    swordGroup.position.set(5.35, -0.65, -3.65);
    swordGroup.scale.setScalar(0.92);

    this.swordGroup = swordGroup;
    this.peripheryGroup.add(swordGroup);
    this.scene.add(this.peripheryGroup);
  }

  /**
   * Builds dual THREE.Points particle layers:
   *  - Rising glowing crimson/amber embers
   *  - Drifting dark ash flakes
   */
  buildParticleFields() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    // 1. Rising Blood-Red Embers
    const emberCount = 210;
    const emberPos = new Float32Array(emberCount * 3);
    const emberSize = new Float32Array(emberCount);
    const emberPhase = new Float32Array(emberCount);
    const emberSpeed = new Float32Array(emberCount);

    for (let i = 0; i < emberCount; i++) {
      emberPos[i * 3] = (Math.random() - 0.5) * 22;
      emberPos[i * 3 + 1] = (Math.random() - 0.5) * 18;
      emberPos[i * 3 + 2] = -1.5 - Math.random() * 12;
      emberSize[i] = 6.0 + Math.random() * 15.0;
      emberPhase[i] = Math.random() * Math.PI * 2;
      emberSpeed[i] = 0.45 + Math.random() * 1.05;
    }

    const emberGeo = new THREE.BufferGeometry();
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
    emberGeo.setAttribute('aSize', new THREE.BufferAttribute(emberSize, 1));
    emberGeo.setAttribute('aPhase', new THREE.BufferAttribute(emberPhase, 1));
    emberGeo.setAttribute('aSpeed', new THREE.BufferAttribute(emberSpeed, 1));

    this.emberUniforms = {
      uTime: { value: this.elapsed },
      uPixelRatio: { value: pixelRatio },
      uMotionScale: { value: 1.0 },
      uGlowBoost: { value: 0.88 },
      uErrorMode: { value: 0.0 }
    };

    const emberMat = new THREE.ShaderMaterial({
      uniforms: this.emberUniforms,
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: EMBER_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.emberPoints = new THREE.Points(emberGeo, emberMat);
    this.scene.add(this.emberPoints);

    // 2. Drifting Dark Ash Flakes
    const ashCount = 150;
    const ashPos = new Float32Array(ashCount * 3);
    const ashSize = new Float32Array(ashCount);
    const ashPhase = new Float32Array(ashCount);
    const ashSpeed = new Float32Array(ashCount);

    for (let i = 0; i < ashCount; i++) {
      ashPos[i * 3] = (Math.random() - 0.5) * 24;
      ashPos[i * 3 + 1] = (Math.random() - 0.5) * 18;
      ashPos[i * 3 + 2] = -0.8 - Math.random() * 11;
      ashSize[i] = 7.0 + Math.random() * 13.0;
      ashPhase[i] = Math.random() * Math.PI * 2;
      ashSpeed[i] = 0.16 + Math.random() * 0.42;
    }

    const ashGeo = new THREE.BufferGeometry();
    ashGeo.setAttribute('position', new THREE.BufferAttribute(ashPos, 3));
    ashGeo.setAttribute('aSize', new THREE.BufferAttribute(ashSize, 1));
    ashGeo.setAttribute('aPhase', new THREE.BufferAttribute(ashPhase, 1));
    ashGeo.setAttribute('aSpeed', new THREE.BufferAttribute(ashSpeed, 1));

    this.ashUniforms = {
      uTime: { value: this.elapsed },
      uPixelRatio: { value: pixelRatio },
      uMotionScale: { value: 1.0 },
      uSubtlety: { value: 1.0 }
    };

    const ashMat = new THREE.ShaderMaterial({
      uniforms: this.ashUniforms,
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: ASH_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.ashPoints = new THREE.Points(ashGeo, ashMat);
    this.scene.add(this.ashPoints);
  }

  /**
   * Updates chatbot visual state ('idle' | 'streaming' | 'error')
   */
  setState(nextState) {
    if (!['idle', 'streaming', 'error'].includes(nextState)) return;
    this.state = nextState;
    if (this.webglReady && this.atmosphere === 'static') {
      this.applyImmediateStateForStatic();
      this.renderSingleFrame();
    }
  }

  /**
   * Updates 3D atmosphere intensity ('full' | 'subtle' | 'static')
   */
  setAtmosphere(level) {
    if (!['full', 'subtle', 'static'].includes(level)) return;
    this.atmosphere = level;
    if (!this.webglReady) return;

    const subtlety = level === 'full' ? 1.0 : level === 'subtle' ? 0.62 : 0.48;
    this.eclipseUniforms.uSubtlety.value = subtlety;
    this.ashUniforms.uSubtlety.value = subtlety;
    this.emberPoints.visible = level !== 'static' ? true : true;

    if (level === 'static') {
      this.stopLoop();
      this.applyImmediateStateForStatic();
      this.renderSingleFrame();
    } else if (!document.hidden) {
      this.startLoop();
    }
  }

  applyImmediateStateForStatic() {
    const isErr = this.state === 'error';
    const isStream = this.state === 'streaming';
    this.currentSurge = isStream ? 1.0 : 0.0;
    this.currentError = isErr ? 1.0 : 0.0;
    this.currentGlow = isStream ? 1.0 : isErr ? 0.22 : 0.35;
    this.updateSceneObjects(0);
  }

  onResize() {
    if (!this.webglReady || this.disposed) return;
    const width = window.innerWidth || 1280;
    const height = Math.max(1, window.innerHeight || 800);
    const aspect = width / height;

    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);

    if (this.eclipseUniforms) {
      this.eclipseUniforms.uAspect.value = aspect;
    }

    // Push periphery monoliths slightly wider on ultra-wide screens or tuck on narrow screens
    if (this.peripheryGroup) {
      const spread = aspect < 0.9 ? 0.72 : aspect < 1.3 ? 0.88 : 1.0;
      this.peripheryGroup.scale.set(spread, 1.0, 1.0);
    }

    if (this.atmosphere === 'static') {
      this.renderSingleFrame();
    }
  }

  startLoop() {
    if (!this.webglReady || this.rafId !== null || this.disposed) return;
    this.lastTimestamp = performance.now();
    const tick = (now) => {
      if (this.disposed || this.atmosphere === 'static') {
        this.rafId = null;
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTimestamp) / 1000));
      this.lastTimestamp = now;

      this.updateSceneObjects(dt);
      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  renderSingleFrame() {
    if (!this.webglReady || this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  updateSceneObjects(dt) {
    const motionFactor =
      this.atmosphere === 'full' ? 1.0 : this.atmosphere === 'subtle' ? 0.45 : 0.0;

    this.elapsed += dt * motionFactor;

    const targetSurge = this.state === 'streaming' ? 1.0 : 0.0;
    const targetError = this.state === 'error' ? 1.0 : 0.0;
    const targetGlow =
      this.state === 'streaming' ? 1.0 : this.state === 'error' ? 0.24 : 0.35;

    const lerpRate = dt > 0 ? Math.min(1, dt * 3.8) : 1;
    this.currentSurge += (targetSurge - this.currentSurge) * lerpRate;
    this.currentError += (targetError - this.currentError) * lerpRate;
    this.currentGlow += (targetGlow - this.currentGlow) * lerpRate;

    // Update Eclipse GLSL shader
    this.eclipseUniforms.uTime.value = this.elapsed;
    this.eclipseUniforms.uSurge.value = this.currentSurge;
    this.eclipseUniforms.uErrorMode.value = this.currentError;

    // Update Brand of Sacrifice levitation, solemn breathing tilt, & vein glow
    const pulseWave = Math.sin(this.elapsed * (1.5 + this.currentSurge * 3.2));
    const errFlicker =
      this.currentError > 0.1
        ? 0.65 + 0.35 * Math.sin(this.elapsed * 13.0) * Math.cos(this.elapsed * 5.7)
        : 1.0;

    const veinIntensity =
      (this.currentGlow * 2.1 + pulseWave * (0.12 + 0.26 * this.currentSurge)) *
      errFlicker *
      (this.atmosphere === 'subtle' ? 0.72 : 1.0);

    this.brandVeinMat.emissiveIntensity = Math.max(0.12, veinIntensity);

    if (this.currentError > 0.25) {
      this.brandIronMat.color.setHex(0x2d2a33);
      this.brandVeinMat.emissive.setHex(0xb91c1c);
    } else {
      this.brandIronMat.color.setHex(0x1b151f);
      this.brandVeinMat.emissive.setHex(0xef4444);
    }

    this.brandGroup.position.y = 2.38 + Math.sin(this.elapsed * 0.85) * 0.11;
    this.brandGroup.rotation.y = Math.sin(this.elapsed * 0.42) * 0.24;
    this.brandGroup.rotation.z = Math.cos(this.elapsed * 0.31) * 0.045;

    // Eclipse rim light surge
    this.eclipseLight.intensity =
      (3.8 + this.currentSurge * 3.2 + pulseWave * 0.4) *
      (1.0 - this.currentError * 0.45);

    // Particle field uniforms
    const particleSpeedScale =
      (1.0 + this.currentSurge * 1.45) *
      (this.atmosphere === 'subtle' ? 0.55 : this.atmosphere === 'static' ? 0.0 : 1.0);

    this.emberUniforms.uTime.value = this.elapsed;
    this.emberUniforms.uMotionScale.value = Math.max(0.15, particleSpeedScale);
    this.emberUniforms.uGlowBoost.value =
      (0.75 + this.currentSurge * 0.45) * (this.atmosphere === 'subtle' ? 0.58 : 1.0);
    this.emberUniforms.uErrorMode.value = this.currentError;

    this.ashUniforms.uTime.value = this.elapsed;
    this.ashUniforms.uMotionScale.value = Math.max(0.15, particleSpeedScale * 0.7);

    // Purely time-based sinusoidal camera breathing drift (zero mouse tracking)
    this.camera.position.x = this.cameraBase.x + Math.sin(this.elapsed * 0.23) * 0.18;
    this.camera.position.y = this.cameraBase.y + Math.cos(this.elapsed * 0.19) * 0.11;
    this.camera.lookAt(0, 0.65, -6);
  }

  dispose() {
    this.disposed = true;
    this.stopLoop();
    document.removeEventListener('visibilitychange', this.handleVisibility);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.scene) {
      this.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }
    if (this.renderer) {
      this.renderer.dispose();
    }
  }
}
