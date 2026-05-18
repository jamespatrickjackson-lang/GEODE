import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Tween, Easing, Group as TweenGroup } from "@tweenjs/tween.js";
import type { EasingName, Pose } from "./types";
import { capturePose } from "./capturePose";

// Camera tween orchestration with single-flight interrupt semantics.
//
// Design choices (decided 2026-04-29):
// - Mid-tween nav INTERRUPTS the active tween and starts a new one from the
//   current camera pose. No queueing -- on a wired demo, queue lag reads as
//   broken.
// - We tween position, target, and fov in a single Tween over a single object,
//   so they progress with one easing curve. up is a scene-wide constant
//   (Z-up) and is not tweened.
// - OrbitControls.enabled is flipped off during the tween so the user's mouse
//   doesn't fight the animation.

const easingMap: Record<EasingName, (k: number) => number> = {
  linear: Easing.Linear.None,
  easeInOutCubic: Easing.Cubic.InOut,
  easeOutCubic: Easing.Cubic.Out,
  easeOutQuart: Easing.Quartic.Out,
  easeInOutSine: Easing.Sinusoidal.InOut,
};

export class CameraTweener {
  private group = new TweenGroup();
  private active: Tween<TweenState> | null = null;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private controls: OrbitControls,
  ) {}

  /** Tick from the render loop. */
  update(timeMs: number): void {
    this.group.update(timeMs);
  }

  get isAnimating(): boolean {
    return this.active !== null;
  }

  /**
   * Start a tween from the camera's current pose to `to`. If a tween is
   * already running, stop it and start a fresh one from where the camera
   * currently sits (interrupt semantics).
   */
  tweenTo(
    to: Pose,
    durationMs: number,
    easing: EasingName,
    onComplete?: () => void,
  ): void {
    // Interrupt any in-flight tween. The active tween's onComplete does NOT
    // fire on interrupt -- callers depending on completion must check
    // isAnimating.
    if (this.active) {
      this.active.stop();
      this.group.remove(this.active);
      this.active = null;
    }

    const from = capturePose(this.camera, this.controls);
    const state: TweenState = {
      px: from.position[0], py: from.position[1], pz: from.position[2],
      tx: from.target[0],   ty: from.target[1],   tz: from.target[2],
      fov: from.fov,
    };
    const target: TweenState = {
      px: to.position[0], py: to.position[1], pz: to.position[2],
      tx: to.target[0],   ty: to.target[1],   tz: to.target[2],
      fov: to.fov,
    };

    this.controls.enabled = false;

    const tween = new Tween(state, this.group)
      .to(target, durationMs)
      .easing(easingMap[easing] ?? Easing.Cubic.InOut)
      .onUpdate(() => {
        this.camera.position.set(state.px, state.py, state.pz);
        this.controls.target.set(state.tx, state.ty, state.tz);
        if (this.camera.fov !== state.fov) {
          this.camera.fov = state.fov;
          this.camera.updateProjectionMatrix();
        }
        // controls.update() not called here -- it would override target with
        // the camera's current rotation. We just write target directly; the
        // next render uses it.
      })
      .onComplete(() => {
        this.active = null;
        this.controls.enabled = true;
        // Final controls.update() snaps the orbit math into a consistent
        // state so user-initiated free-look starts from the right basis.
        this.controls.update();
        onComplete?.();
      });

    this.active = tween;
    tween.start();
  }
}

interface TweenState {
  px: number; py: number; pz: number;
  tx: number; ty: number; tz: number;
  fov: number;
}
