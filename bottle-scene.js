/*
 * ЭФИР — интерактивная 3D-сцена флакона «ВУАЛЬ» (Three.js r160, ES-модуль).
 * Загружает настоящую 3D-модель (assets/models/perfume-bottle-real.glb,
 * CC-BY, «Perfume Bottle» — Michaela Blanchfield, Sketchfab) и показывает
 * её родные материалы (розовое рифлёное стекло + золотая крышка) без
 * подмены цвета. Подключается как <script type="module" src="bottle-scene.js">.
 *
 * Публичный API:
 *   window.initBottleScene(canvasEl) -> { setScrollProgress(p), destroy() } | null
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MODEL_URL = 'assets/models/perfume-bottle-real.glb';
const MODEL_HEIGHT = 2.15;
// Where the (re-centered) model's own origin sits in world space, and the
// floor's Y derived from it so the model's base always rests on the floor
// regardless of its exact source proportions.
const GROUP_Y_OFFSET = -0.08;
const FLOOR_Y = GROUP_Y_OFFSET - (MODEL_HEIGHT / 2) - 0.02;

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function buildCameraKeyframes() {
  return [
    { p: 0.0, pos: new THREE.Vector3(0.0, 0.25, 5.3), look: new THREE.Vector3(0, 0.0, 0), fov: 32 },
    { p: 0.33, pos: new THREE.Vector3(0.0, 0.25, 5.3), look: new THREE.Vector3(0, 0.0, 0), fov: 32 },
    { p: 0.66, pos: new THREE.Vector3(0.15, 1.1, 2.5), look: new THREE.Vector3(0, 0.9, 0), fov: 27 },
    { p: 1.0, pos: new THREE.Vector3(-0.15, -0.6, 2.05), look: new THREE.Vector3(0, -0.5, 0), fov: 29 }
  ];
}

function evalCameraKeyframes(keyframes, p) {
  p = clamp(p, 0, 1);
  let a, b, t;
  if (p <= keyframes[1].p) {
    a = keyframes[0]; b = keyframes[1];
    t = b.p === a.p ? 0 : (p - a.p) / (b.p - a.p);
  } else if (p <= keyframes[2].p) {
    a = keyframes[1]; b = keyframes[2];
    t = (p - a.p) / (b.p - a.p);
  } else {
    a = keyframes[2]; b = keyframes[3];
    t = (p - a.p) / (b.p - a.p);
  }
  return {
    pos: new THREE.Vector3(
      lerp(a.pos.x, b.pos.x, t),
      lerp(a.pos.y, b.pos.y, t),
      lerp(a.pos.z, b.pos.z, t)
    ),
    look: new THREE.Vector3(
      lerp(a.look.x, b.look.x, t),
      lerp(a.look.y, b.look.y, t),
      lerp(a.look.z, b.look.z, t)
    ),
    fov: lerp(a.fov, b.fov, t)
  };
}

window.initBottleScene = function initBottleScene(canvasEl) {
  if (!canvasEl) return null;

  const reduceMotionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reducedMotion = !!(reduceMotionQuery && reduceMotionQuery.matches);
  const lowEnd = !!(navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  function onReduceMotionChange(e) { reducedMotion = e.matches; }
  if (reduceMotionQuery) {
    if (reduceMotionQuery.addEventListener) reduceMotionQuery.addEventListener('change', onReduceMotionChange);
    else if (reduceMotionQuery.addListener) reduceMotionQuery.addListener(onReduceMotionChange);
  }

  // ---------- renderer / scene / camera ----------
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
  } catch (err) {
    return null;
  }
  renderer.setPixelRatio(lowEnd ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  if (renderer.outputColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !lowEnd;
  if (renderer.shadowMap.enabled) renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();

  function getSize() {
    const parent = canvasEl.parentElement;
    const w = (parent && parent.clientWidth) || canvasEl.clientWidth || 1;
    const h = (parent && parent.clientHeight) || canvasEl.clientHeight || 1;
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  let size = getSize();
  const camera = new THREE.PerspectiveCamera(32, size.w / size.h, 0.1, 100);
  const camKeyframes = buildCameraKeyframes();
  const initialCam = evalCameraKeyframes(camKeyframes, 0);
  camera.position.copy(initialCam.pos);
  const currentLook = initialCam.look.clone();
  camera.lookAt(currentLook);

  const scrollTarget = { pos: initialCam.pos.clone(), look: initialCam.look.clone(), fov: initialCam.fov };

  renderer.setSize(size.w, size.h, false);

  // ---------- lighting: soft studio set-up for a delicate product shot ----------
  const ambient = new THREE.AmbientLight(0xfff2de, 0.65);
  const key = new THREE.DirectionalLight(0xfff6e8, 1.75);
  key.position.set(2.4, 3.2, 3.6);
  key.castShadow = renderer.shadowMap.enabled;
  if (key.castShadow) {
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.bias = -0.0015;
  }
  const rim = new THREE.DirectionalLight(0xf3c9d4, 0.9);
  rim.position.set(-3.2, 1.6, -2.4);
  const fill = new THREE.DirectionalLight(0xffe9c7, 0.5);
  fill.position.set(-1.5, -0.5, 2.8);
  scene.add(ambient, key, rim, fill);

  // ---------- floor ----------
  const floorGeo = new THREE.CircleGeometry(4.2, lowEnd ? 24 : 48);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0xf1ded2, roughness: 0.4, metalness: 0.05, transparent: true, opacity: 0.6
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  floor.receiveShadow = renderer.shadowMap.enabled;
  floor.renderOrder = 0;
  scene.add(floor);

  // ---------- bottle group (filled once the GLTF model loads) ----------
  const pivotGroup = new THREE.Group();
  pivotGroup.rotation.x = -0.06;
  pivotGroup.rotation.y = 0.5;
  scene.add(pivotGroup);

  const bottleGroup = new THREE.Group();
  bottleGroup.position.y = GROUP_Y_OFFSET;
  pivotGroup.add(bottleGroup);

  let loadedRoot = null;

  const loader = new GLTFLoader();
  loader.load(MODEL_URL, (gltf) => {
    const model = gltf.scene;

    const box = new THREE.Box3().setFromObject(model);
    const size3 = new THREE.Vector3();
    box.getSize(size3);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const scale = size3.y > 0.0001 ? MODEL_HEIGHT / size3.y : 1;
    model.scale.setScalar(scale);
    // position is applied in the parent's (already-scaled) space, so the
    // recentring offset must be scaled too — otherwise models far from unit
    // scale (this one is ~0.1 units tall) end up barely recentred at all.
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = renderer.shadowMap.enabled;
      child.receiveShadow = false;
    });

    bottleGroup.add(model);
    loadedRoot = model;
  }, undefined, (err) => {
    console.warn('ЭФИР: не удалось загрузить 3D-модель флакона', err);
  });

  // ---------- pointer drag-to-rotate (+ inertia) ----------
  let isDragging = false;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let velY = 0;
  let velX = 0;
  let activePointerId = null;
  const MAX_TILT = THREE.MathUtils.degToRad(22);
  const DRAG_SENSITIVITY = 0.009;
  const INERTIA_DAMPING = 0.95;
  const VELOCITY_EPSILON = 0.00012;

  function onPointerDown(e) {
    isDragging = true;
    activePointerId = e.pointerId;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    velX = 0;
    velY = 0;
    if (canvasEl.setPointerCapture) {
      try { canvasEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    }
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - lastPointerX;
    const dy = e.clientY - lastPointerY;
    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    velY = dx * DRAG_SENSITIVITY;
    velX = dy * DRAG_SENSITIVITY;
    pivotGroup.rotation.y += velY;
    pivotGroup.rotation.x = clamp(pivotGroup.rotation.x + velX, -MAX_TILT, MAX_TILT);
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    if (canvasEl.releasePointerCapture && activePointerId !== null) {
      try { canvasEl.releasePointerCapture(activePointerId); } catch (err) { /* ignore */ }
    }
    activePointerId = null;
    if (reducedMotion) { velX = 0; velY = 0; }
  }

  canvasEl.style.touchAction = canvasEl.style.touchAction || 'none';
  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', endDrag);
  canvasEl.addEventListener('pointercancel', endDrag);
  canvasEl.addEventListener('pointerleave', endDrag);

  // ---------- scroll progress ----------
  function setScrollProgress(p) {
    if (typeof p !== 'number' || isNaN(p)) return;
    const target = evalCameraKeyframes(camKeyframes, clamp(p, 0, 1));
    scrollTarget.pos.copy(target.pos);
    scrollTarget.look.copy(target.look);
    scrollTarget.fov = target.fov;
  }

  // ---------- resize ----------
  function onResize() {
    const s = getSize();
    renderer.setSize(s.w, s.h, false);
    camera.aspect = s.w / s.h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', onResize);

  // ---------- animation loop ----------
  const clock = new THREE.Clock();
  let rafId = null;
  const AUTO_ROTATE_SPEED = 0.12;

  function animate() {
    rafId = window.requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    if (isDragging) {
      // handled directly in onPointerMove
    } else if (Math.abs(velY) > VELOCITY_EPSILON || Math.abs(velX) > VELOCITY_EPSILON) {
      pivotGroup.rotation.y += velY;
      pivotGroup.rotation.x = clamp(pivotGroup.rotation.x + velX, -MAX_TILT, MAX_TILT);
      velY *= INERTIA_DAMPING;
      velX *= INERTIA_DAMPING;
      if (Math.abs(velY) <= VELOCITY_EPSILON) velY = 0;
      if (Math.abs(velX) <= VELOCITY_EPSILON) velX = 0;
    } else if (!reducedMotion) {
      pivotGroup.rotation.y += AUTO_ROTATE_SPEED * delta;
    }

    camera.position.lerp(scrollTarget.pos, 0.06);
    currentLook.lerp(scrollTarget.look, 0.06);
    camera.fov = lerp(camera.fov, scrollTarget.fov, 0.06);
    camera.updateProjectionMatrix();
    camera.lookAt(currentLook);

    renderer.render(scene, camera);
  }
  animate();

  // ---------- destroy ----------
  function destroy() {
    if (rafId !== null) window.cancelAnimationFrame(rafId);
    rafId = null;

    window.removeEventListener('resize', onResize);
    canvasEl.removeEventListener('pointerdown', onPointerDown);
    canvasEl.removeEventListener('pointermove', onPointerMove);
    canvasEl.removeEventListener('pointerup', endDrag);
    canvasEl.removeEventListener('pointercancel', endDrag);
    canvasEl.removeEventListener('pointerleave', endDrag);

    if (reduceMotionQuery) {
      if (reduceMotionQuery.removeEventListener) reduceMotionQuery.removeEventListener('change', onReduceMotionChange);
      else if (reduceMotionQuery.removeListener) reduceMotionQuery.removeListener(onReduceMotionChange);
    }

    if (loadedRoot) {
      loadedRoot.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });
    }
    floorGeo.dispose();
    floorMat.dispose();
    renderer.dispose();
  }

  return {
    setScrollProgress,
    destroy
  };
};
