import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

interface HeroScene3DProps {
  className?: string;
}

const _targetRot = new THREE.Euler();
const _dummy = new THREE.Object3D();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createKnurlBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = '#d4d4d4';
    ctx.lineWidth = 2;
    const step = 16;
    for (let i = -size; i < size * 2; i += step) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(i + size, 0);
      ctx.lineTo(i, size);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 2);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      8,
      size / 2,
      size / 2,
      size / 2,
    );
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
    grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPlateGeometry(
  outerRadius: number,
  innerRadius: number,
  depth: number,
): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 3,
    curveSegments: 36,
  });
  geo.center();
  return geo;
}

export default function HeroScene3D({ className = '' }: HeroScene3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglReady, setWebglReady] = useState(true);
  const pointerRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const isSmallMobile = window.innerWidth < 768;

    if (prefersReducedMotion || isSmallMobile) {
      setWebglReady(false);
      return;
    }

    const isSoftwareGl = detectSoftwareWebGL();

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglReady(false);
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080808, 0.055);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 60);
    camera.position.set(0, 0.4, 8.8);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTarget = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    pmremGenerator.dispose();

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const knurlTex = createKnurlBumpTexture(maxAnisotropy);
    const shadowTex = createContactShadowTexture();

    // Three-point warm/cool athletic studio lighting
    const hemiLight = new THREE.HemisphereLight(0xa5b4fc, 0x181210, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e0, 2.5);
    keyLight.position.set(4.5, 6.5, 5.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -5;
      keyLight.shadow.camera.right = 5;
      keyLight.shadow.camera.top = 5;
      keyLight.shadow.camera.bottom = -5;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xff5a1f, 3.2);
    rimLight.position.set(-5.0, 2.5, -4.0);
    scene.add(rimLight);

    const accentSpot = new THREE.PointLight(0xff6b35, 3.6, 14, 1.5);
    accentSpot.position.set(2.4, -1.2, 3.0);
    scene.add(accentSpot);

    // Shared PBR materials with calibrated roughness deltas (>= 0.25)
    const brushedSteelMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      metalness: 0.92,
      roughness: 0.22,
      bumpMap: knurlTex,
      bumpScale: 0.015,
    });

    const gunmetalSleeveMat = new THREE.MeshStandardMaterial({
      color: 0x3f3f46,
      metalness: 0.88,
      roughness: 0.28,
    });

    const rubberPlateMat = new THREE.MeshStandardMaterial({
      color: 0x101012,
      metalness: 0.14,
      roughness: 0.74,
    });

    const emberAccentMat = new THREE.MeshStandardMaterial({
      color: 0xff5a1f,
      metalness: 0.74,
      roughness: 0.24,
      emissive: 0xff3b00,
      emissiveIntensity: 0.25,
    });

    const titaniumRingMat = new THREE.MeshStandardMaterial({
      color: 0x52525b,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Composite 10+ part hero barbell + kinetic ring assembly
    const assemblyGroup = new THREE.Group();
    assemblyGroup.position.set(width >= 1024 ? 1.85 : 0.6, 0.05, 0);
    assemblyGroup.rotation.set(0.18, -0.48, -0.14);
    scene.add(assemblyGroup);

    const geometriesToDispose: THREE.BufferGeometry[] = [];
    const materialsToDispose: THREE.Material[] = [
      brushedSteelMat,
      gunmetalSleeveMat,
      rubberPlateMat,
      emberAccentMat,
      titaniumRingMat,
    ];

    // 1. Primary Olympic Bar Shaft (Cylinder rotated horizontally)
    const shaftGeo = new THREE.CylinderGeometry(0.085, 0.085, 5.2, 24);
    shaftGeo.rotateZ(Math.PI / 2);
    geometriesToDispose.push(shaftGeo);
    const shaftMesh = new THREE.Mesh(shaftGeo, brushedSteelMat);
    shaftMesh.castShadow = !isSoftwareGl;
    assemblyGroup.add(shaftMesh);

    // 2. Stepped Sleeve Collars (LatheGeometry)
    const sleevePoints = [
      new THREE.Vector2(0.085, 0),
      new THREE.Vector2(0.19, 0.04),
      new THREE.Vector2(0.19, 0.12),
      new THREE.Vector2(0.13, 0.14),
      new THREE.Vector2(0.13, 1.05),
      new THREE.Vector2(0.11, 1.08),
      new THREE.Vector2(0, 1.08),
    ];
    const sleeveGeo = new THREE.LatheGeometry(sleevePoints, 28);
    geometriesToDispose.push(sleeveGeo);

    [-1, 1].forEach((side) => {
      const sleeve = new THREE.Mesh(sleeveGeo, gunmetalSleeveMat);
      sleeve.rotation.z = side === 1 ? -Math.PI / 2 : Math.PI / 2;
      sleeve.position.x = side * 1.38;
      sleeve.castShadow = !isSoftwareGl;
      assemblyGroup.add(sleeve);
    });

    // 3. Outer Matte Bumper Plates (ExtrudeGeometry with bevels)
    const bigPlateGeo = createPlateGeometry(1.18, 0.22, 0.18);
    const midPlateGeo = createPlateGeometry(0.92, 0.22, 0.14);
    const outerTrimRingGeo = new THREE.TorusGeometry(0.68, 0.024, 16, 48);
    const steelHubRingGeo = new THREE.TorusGeometry(0.34, 0.02, 16, 36);
    const innerCollarGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.18, 24);
    innerCollarGeo.rotateZ(Math.PI / 2);
    geometriesToDispose.push(
      bigPlateGeo,
      midPlateGeo,
      outerTrimRingGeo,
      steelHubRingGeo,
      innerCollarGeo,
    );

    const boltPositions: THREE.Matrix4[] = [];
    const boltOffsetAngles = [0, 1, 2, 3, 4, 5].map((i) => (i * Math.PI) / 3);

    [-1, 1].forEach((side) => {
      const xBase = side * 1.66;

      const outerPlate = new THREE.Mesh(bigPlateGeo, rubberPlateMat);
      outerPlate.rotation.y = Math.PI / 2;
      outerPlate.position.x = xBase;
      outerPlate.castShadow = !isSoftwareGl;
      outerPlate.receiveShadow = !isSoftwareGl;
      assemblyGroup.add(outerPlate);

      const secondPlate = new THREE.Mesh(midPlateGeo, rubberPlateMat);
      secondPlate.rotation.y = Math.PI / 2;
      secondPlate.position.x = xBase + side * 0.26;
      secondPlate.castShadow = !isSoftwareGl;
      assemblyGroup.add(secondPlate);

      const exposedFaceX = xBase + side * 0.39;

      const trimRing = new THREE.Mesh(outerTrimRingGeo, emberAccentMat);
      trimRing.rotation.y = Math.PI / 2;
      trimRing.position.x = exposedFaceX;
      assemblyGroup.add(trimRing);

      const steelHubRing = new THREE.Mesh(steelHubRingGeo, brushedSteelMat);
      steelHubRing.rotation.y = Math.PI / 2;
      steelHubRing.position.x = exposedFaceX;
      assemblyGroup.add(steelHubRing);

      const lockCollar = new THREE.Mesh(innerCollarGeo, emberAccentMat);
      lockCollar.position.x = xBase + side * 0.48;
      assemblyGroup.add(lockCollar);

      // Collect flange bolts on exposed outer plate face for InstancedMesh
      boltOffsetAngles.forEach((angle) => {
        _dummy.position.set(
          exposedFaceX + side * 0.015,
          Math.sin(angle) * 0.51,
          Math.cos(angle) * 0.51,
        );
        _dummy.rotation.set(0, 0, Math.PI / 2);
        _dummy.scale.set(1, 1, 1);
        _dummy.updateMatrix();
        boltPositions.push(_dummy.matrix.clone());
      });
    });

    // 4. Instanced Flange Bolts
    const boltGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.04, 6);
    geometriesToDispose.push(boltGeo);
    const boltInstances = new THREE.InstancedMesh(
      boltGeo,
      brushedSteelMat,
      boltPositions.length,
    );
    boltPositions.forEach((mat, idx) => boltInstances.setMatrixAt(idx, mat));
    boltInstances.instanceMatrix.needsUpdate = true;
    boltInstances.computeBoundingSphere();
    assemblyGroup.add(boltInstances);

    // 5. Concentric Kinetic Architectural Rings
    const outerGimbalGeo = new THREE.TorusGeometry(2.15, 0.018, 12, 80);
    const innerGimbalGeo = new THREE.TorusGeometry(1.78, 0.014, 12, 72);
    geometriesToDispose.push(outerGimbalGeo, innerGimbalGeo);

    const outerGimbal = new THREE.Mesh(outerGimbalGeo, titaniumRingMat);
    outerGimbal.rotation.set(Math.PI / 3.2, Math.PI / 6, 0);
    assemblyGroup.add(outerGimbal);

    const innerGimbal = new THREE.Mesh(innerGimbalGeo, emberAccentMat);
    innerGimbal.rotation.set(-Math.PI / 3.8, -Math.PI / 5, 0);
    assemblyGroup.add(innerGimbal);

    // 6. Soft Contact Shadow Disc (transparent canvas blends seamlessly onto hero backdrop)
    const shadowPlaneGeo = new THREE.CircleGeometry(2.8, 32);
    shadowPlaneGeo.rotateX(-Math.PI / 2);
    const shadowPlaneMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.45,
    });
    geometriesToDispose.push(shadowPlaneGeo);
    materialsToDispose.push(shadowPlaneMat);
    const contactShadow = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    contactShadow.position.set(assemblyGroup.position.x, -2.1, 0);
    scene.add(contactShadow);

    // 7. Subtle Atmospheric Ember Particles
    const particleCount = 60;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 9 + 1.2;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 4;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(particlePositions, 3),
    );
    const particleMat = new THREE.PointsMaterial({
      color: 0xff7a45,
      size: 0.035,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    geometriesToDispose.push(particleGeo);
    materialsToDispose.push(particleMat);
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const onPointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -(e.clientY / window.innerHeight) * 2 + 1;
      pointerRef.current.x = nx;
      pointerRef.current.y = ny;
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      assemblyGroup.position.x = w >= 1024 ? 1.85 : 0.6;
      contactShadow.position.x = assemblyGroup.position.x;
    };
    window.addEventListener('resize', onResize);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglReady(false);
    };
    const onContextRestored = () => {
      setWebglReady(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    let disposed = false;
    let frameId = 0;
    const startTime = performance.now();
    let lastTime = startTime;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      if (window.innerWidth < 768) {
        frameId = window.setTimeout(tick, 250);
        return;
      }
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      const elapsed = (now - startTime) / 1000;
      lastTime = now;

      _targetRot.set(
        0.18 + pointerRef.current.y * 0.14 + Math.sin(elapsed * 0.6) * 0.04,
        -0.48 + pointerRef.current.x * 0.22 + elapsed * 0.14,
        -0.14 + Math.cos(elapsed * 0.5) * 0.03,
      );

      assemblyGroup.rotation.x = THREE.MathUtils.damp(
        assemblyGroup.rotation.x,
        _targetRot.x,
        4.5,
        delta,
      );
      assemblyGroup.rotation.y = THREE.MathUtils.damp(
        assemblyGroup.rotation.y,
        _targetRot.y,
        4.5,
        delta,
      );
      assemblyGroup.rotation.z = THREE.MathUtils.damp(
        assemblyGroup.rotation.z,
        _targetRot.z,
        4.5,
        delta,
      );
      assemblyGroup.position.y = 0.08 + Math.sin(elapsed * 1.1) * 0.08;

      outerGimbal.rotation.z += delta * 0.25;
      innerGimbal.rotation.z -= delta * 0.36;
      particles.rotation.y += delta * 0.04;

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
      knurlTex.dispose();
      shadowTex.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (!webglReady) {
    return null;
  }

  return (
    <div
      ref={mountRef}
      data-testid="hero-3d-canvas"
      aria-hidden="true"
      className={`pointer-events-none ${className}`}
    />
  );
}
