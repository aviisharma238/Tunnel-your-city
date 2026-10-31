/**
 * Camera.js — Camera controls tailored for Trafficity's top-down cartographic view
 * with support for panning, zooming, and switching between top-down and free 3D inspection.
 */

import * as THREE from 'three';
import { eventBus, EVENTS } from '../core/EventBus.js';

export const CAMERA_MODES = {
  TOPDOWN: 'topdown', // Default: true top-down 2D cartographic view
  FREE: 'free',       // 3D perspective orbit
  STREET: 'street',   // Low inspection
};

export class CameraController {
  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {HTMLElement} domElement
   */
  constructor(camera, domElement) {
    this._camera = camera;
    this._dom = domElement;
    this._mode = CAMERA_MODES.TOPDOWN; // Start directly in iconic top-down view

    // Orbit/View state
    this._spherical = new THREE.Spherical(260, 0.02, 0); // near-vertical overhead
    this._target = new THREE.Vector3(0, 0, 0);
    this._targetSmooth = new THREE.Vector3(0, 0, 0);

    // Input state
    this._keys = {};
    this._isDragging = false;
    this._isRightDrag = false;
    this._lastMouse = { x: 0, y: 0 };

    // Speed settings
    this._panSpeed = 0.55;
    this._orbitSpeed = 0.005;
    this._zoomSpeed = 8;

    // Constraints
    this._minDistance = 25;
    this._maxDistance = 650;
    this._minPolarAngle = 0.02; // near-vertical
    this._maxPolarAngle = Math.PI / 2 - 0.08;

    this._applySpherical();
    this._bindEvents();
  }

  get mode() { return this._mode; }

  setMode(mode) {
    if (!CAMERA_MODES[mode.toUpperCase()]) return;
    this._mode = mode;

    if (mode === CAMERA_MODES.TOPDOWN) {
      this._spherical.phi = 0.02; // look straight down
      this._spherical.theta = 0;
    } else if (mode === CAMERA_MODES.FREE) {
      this._spherical.phi = Math.PI / 4; // 45 degree angle
      this._spherical.theta = Math.PI / 6;
    } else if (mode === CAMERA_MODES.STREET) {
      this._spherical.phi = Math.PI / 2.3;
      this._spherical.radius = 60;
    }

    eventBus.emit(EVENTS.CAMERA_MODE_CHANGED, mode);
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

    const radiusFactor = this._spherical.radius / 250;

    // In top-down mode: right-drag OR middle-drag pans the map effortlessly
    if (this._mode === CAMERA_MODES.TOPDOWN) {
      if (this._isRightDrag || e.buttons === 4) {
        this._target.x -= dx * this._panSpeed * radiusFactor;
        this._target.z -= dy * this._panSpeed * radiusFactor;
      }
    } else {
      // In free mode: right drag orbits
      if (this._isRightDrag) {
        this._spherical.theta -= dx * this._orbitSpeed;
        this._spherical.phi = Math.max(
          this._minPolarAngle,
          Math.min(this._maxPolarAngle, this._spherical.phi + dy * this._orbitSpeed)
        );
      } else if (e.buttons === 4) {
        // Middle drag pans
        const right = new THREE.Vector3();
        const forward = new THREE.Vector3();
        right.setFromMatrixColumn(this._camera.matrix, 0);
        this._camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        right.y = 0; right.normalize();
        this._target.addScaledVector(right, -dx * this._panSpeed * radiusFactor);
        this._target.addScaledVector(forward, -dy * this._panSpeed * radiusFactor);
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
      Math.min(this._maxDistance, this._spherical.radius + zoomDelta * 12)
    );
  }

  _onKeyDown(e) { this._keys[e.code] = true; }
  _onKeyUp(e) { this._keys[e.code] = false; }

  update(dt) {
    const speed = this._panSpeed * (this._spherical.radius / 150) * (dt / 16);

    // WASD pan
    if (this._keys['KeyW'] || this._keys['ArrowUp'])    this._target.z -= speed * 1.5;
    if (this._keys['KeyS'] || this._keys['ArrowDown'])  this._target.z += speed * 1.5;
    if (this._keys['KeyA'] || this._keys['ArrowLeft'])  this._target.x -= speed * 1.5;
    if (this._keys['KeyD'] || this._keys['ArrowRight']) this._target.x += speed * 1.5;

    // Smooth target follow
    this._targetSmooth.lerp(this._target, 0.15);
    this._applySpherical();
  }

  _applySpherical() {
    this._spherical.makeSafe();
    const offset = new THREE.Vector3().setFromSpherical(this._spherical);
    this._camera.position.copy(this._targetSmooth).add(offset);
    this._camera.lookAt(this._targetSmooth);
  }

  dispose() {
    this._dom.removeEventListener('mousedown', this._onMouseDown.bind(this));
    this._dom.removeEventListener('mousemove', this._onMouseMove.bind(this));
    this._dom.removeEventListener('mouseup', this._onMouseUp.bind(this));
    this._dom.removeEventListener('wheel', this._onWheel.bind(this));
    window.removeEventListener('keydown', this._onKeyDown.bind(this));
    window.removeEventListener('keyup', this._onKeyUp.bind(this));
  }
}
