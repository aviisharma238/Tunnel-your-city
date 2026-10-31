/**
 * World — holds references to the Three.js scene, renderer and camera.
 * Acts as a dependency container so engine systems don't import from React.
 */

export class World {
  constructor() {
    this.scene = null;
    this.renderer = null;
    this.camera = null;
  }
}
