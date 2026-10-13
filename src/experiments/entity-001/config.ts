import type { CameraGoal } from "../../core/camera";

export const ENTITY = {
  radius: 2.1,
  aperture: 0.46,
  // Three-quarter stance of the Blender character: the body turns toward the key
  // light while the neck and eye bring the face back to the visitor.
  restYaw: -0.34,
  eye: { width: 0.69, height: 0.23, y: 0.12, z: 1.55 },
  palette: {
    graphite: "#424a55",
    ember: "#ed9b56",
    frost: "#93b8cb",
    ivory: "#eee2c8",
    void: "#030304",
  },
} as const;

// A longer lens (28° instead of 34°) flattens the egg less and separates the halo
// from the skull; the distance keeps the same subject size on screen.
export const CAMERA_BASE: CameraGoal = { distance: 16.2, orbit: 0.06, height: 0.035, fov: 28 };
export const CAMERA_INTRO: CameraGoal = { distance: 21.4, orbit: -0.24, height: 0.1, fov: 30 };
export const MIN_CAMERA_DISTANCE = 15.3;
export const HOLD_SECONDS = 1.25;

export type Quality = { shards: number; dust: number; pixelRatio: number };
export function qualityFor(compact: boolean): Quality {
  return compact
    ? { shards: 820, dust: 200, pixelRatio: 1.25 }
    : { shards: 1800, dust: 420, pixelRatio: 1.6 };
}
