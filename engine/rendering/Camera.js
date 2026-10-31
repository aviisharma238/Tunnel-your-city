/**
 * Camera — handles all camera modes and transitions.
 * This is a plain JS class that manipulates a Three.js camera.
 * Keyboard/mouse events are attached via the React component.
 *
 * Modes:
 *   'free'      — WASD pan + scroll zoom + right-drag orbit
 *   'topdown'   — locked pitch ~80°, top-down construction view
 *   'street'    — low ground-level inspection camera
 */

import * as THREE from 'three';
import { eventBus, EVENTS } from '../core/EventBus.js';

export const CAMERA_MODES = {
  FREE: 'free',
  TOPDOWN: 'topdown',
  STREET: 'street',
};

const DEFAULTS = {
  position: new THREE.Vector3(0, 120, 180),
  target: new THREE.Vector3(0, 0, 0),
};

export class CameraController {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} domElement
   */
  constructor(camera, domElement) {
    this._camera = camera;
    this._dom = domElement;
    this._mode = CAMERA_MODES.FREE;

    // Orbit state
    this._spherical = new THREE.Spherical();
    this._target = DEFAULTS.target.clone();
    this._targetSmooth = DEFAULTS.target.clone();

    // Pan state
    this._panDelta = new THREE.Vector3();

    // Input state
    this._keys = {};
    this._isDragging = false;
    this._isRightDrag = false;
    this._lastMouse = { x: 0, y: 0 };

    // Speed settings
    this._panSpeed = 0.4;
    this._orbitSpeed = 0.005;
    this._zoomSpeed = 8;

    // Constraints
    this._minDistance = 20;
    this._maxDistance = 800;
    this._minPolarAngle = 0.1;
    this._maxPolarAngle = Math.PI / 2 - 0.05;

    this._initFromPosition(DEFAULTS.position, DEFAULTS.target);
    this._bindEvents();
  }

  get mode() { return this._mode; }

  setMode(mode) {
    if (!CAMERA_MODES[mode.toUpperCase()]) return;
    this._mode = mode;
    eventBus.emit(EVENTS.CAMERA_MODE_CHANGED, mode);
  }

  _initFromPosition(pos, target) {
    this._target.copy(target);
    this._targetSmooth.copy(target);
    const offset = new THREE.Vector3().subVectors(pos, target);
    this._spherical.setFromVector3(offset);
    this._spherical.theta = Math.PI / 6;
    this._spherical.phi = Math.PI / 4;
    this._spherical.radius = 300;
    this._applySpherical();
  }

  _bindEvents() {
    this._dom.addEventListener('mousedown', this._onMouseDown.bind(this));
    this._dom.addEventListener('mousemove', this._onMouseMove.bind(this));
    this._dom.addEventListener('mouseup', this._onMouseUp.bind(this));
    this._dom.addEventListener('wheel', this._onWheel.bind(this), { passive: false });
    window.addEventListener('keydown', this._onKeyDown.bind(this));
    window.addEventListener('keyup', this._onKeyUp.bind(this));
    this._dom.addEventListener('contextmenu', e => e.preventDefault());
  }

  _onMouseDown(e) {
    this._isDragging = true;
    this._isRightDrag = e.button === 2;
    this._lastMouse = { x: e.clientX, y: e.clientY };
  }

  _onMouseMove(e) {
    if (!this._isDragging) return;
    const dx = e.clientX - this._lastMouse.x;
    const dy = e.clientY - this._lastMouse.y;
    this._lastMouse = { x: e.clientX, y: e.clientY };

    if (this._isRightDrag) {
      // Orbit
      this._spherical.theta -= dx * this._orbitSpeed;
      this._spherical.phi = Math.max(
        this._minPolarAngle,
        Math.min(this._maxPolarAngle, this._spherical.phi + dy * this._orbitSpeed)
      );
    } else {
      // Middle-drag pan
      if (e.buttons === 4) {
        const panX = -dx * this._panSpeed * (this._spherical.radius / 300);
        const panZ = -dy * this._panSpeed * (this._spherical.radius / 300);
        const right = new THREE.Vector3();
        const forward = new THREE.Vector3();
        right.setFromMatrixColumn(this._camera.matrix, 0);
        this._camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        right.y = 0; right.normalize();
        this._target.addScaledVector(right, panX);
        this._target.addScaledVector(forward, panZ);
      }
    }
  }

  _onMouseUp() {
    this._isDragging = false;
  }

  _onWheel(e) {
    e.preventDefault();
    const zoomDelta = e.deltaY * 0.001 * this._zoomSpeed * (this._spherical.radius / 100);
    this._spherical.radius = Math.max(
      this._minDistance,
      Math.min(this._maxDistance, this._spherical.radius + zoomDelta * 10)
    );
  }

  _onKeyDown(e) { this._keys[e.code] = true; }
  _onKeyUp(e) { this._keys[e.code] = false; }

  /** Called every render frame. dt in ms. */
  update(dt) {
    const speed = this._panSpeed * (this._spherical.radius / 200) * (dt / 16);

    // WASD pan
    const right = new THREE.Vector3();
    const forward = new THREE.Vector3();
    right.setFromMatrixColumn(this._camera.matrix, 0);
    this._camera.getWorldDirection(forward);
    forward.y = 0; forward.normalize();
    right.y = 0; right.normalize();

    if (this._keys['KeyW'] || this._keys['ArrowUp'])    this._target.addScaledVector(forward, speed);
    if (this._keys['KeyS'] || this._keys['ArrowDown'])  this._target.addScaledVector(forward, -speed);
    if (this._keys['KeyA'] || this._keys['ArrowLeft'])  this._target.addScaledVector(right, -speed);
    if (this._keys['KeyD'] || this._keys['ArrowRight']) this._target.addScaledVector(right, speed);

    // Mode-specific constraints
    if (this._mode === CAMERA_MODES.TOPDOWN) {
      this._spherical.phi = 0.15; // near-vertical
    }

    // Smooth target follow
    this._targetSmooth.lerp(this._target, 0.1);
    this._applySpherical();
  }

  _applySpherical() {
    this._spherical.makeSafe();
    const offset = new THREE.Vector3().setFromSpherical(this._spherical);
    this._camera.position.copy(this._targetSmooth).add(offset);
    this._camera.lookAt(this._targetSmooth);
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown.bind(this));
    window.removeEventListener('keyup', this._onKeyUp.bind(this));
  }
}
