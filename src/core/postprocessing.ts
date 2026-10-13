import { HalfFloatType, Vector2, Vector4, WebGLRenderTarget, type Camera, type Scene, type WebGLRenderer } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

// Display-space finishing: vignette, film grain, a faint lens split and a ripple
// that travels outward from a point (used to acknowledge the visitor's gestures).
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null as unknown },
    uTime: { value: 0 },
    uVignette: { value: 0.55 },
    uGrain: { value: 0.009 },
    uAberration: { value: 0.00065 },
    // Display-space grade: 0 leaves the image untouched.
    uGrade: { value: 0 },
    // Darkens the lower frame so a figure's base dissolves into the void.
    uFloor: { value: 0 },
    // xy: ripple origin in UV space, z: amplitude, w: unused.
    uRipple: { value: new Vector4(0.5, 0.5, 0, 0) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uVignette, uGrain, uAberration, uGrade, uFloor;
    uniform vec4 uRipple;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 toRipple = uv - uRipple.xy;
      float distance = length(toRipple);
      float wave = sin(distance * 58.0 - uTime * 11.0) * exp(-distance * 8.5) * uRipple.z;
      uv += normalize(toRipple + 1e-5) * wave * 0.010;

      vec2 centered = vUv - 0.5;
      float radius = length(centered);
      vec2 split = centered * uAberration * radius;
      vec3 color = vec3(
        texture2D(tDiffuse, uv + split).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - split).b
      );

      // Gentle S-curve around mid grey and a cool lift confined to the shadows.
      vec3 curved = color * color * (3.0 - 2.0 * color);
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      vec3 graded = mix(color, curved, 0.35) + vec3(-0.004, 0.003, 0.008) * (1.0 - smoothstep(0.0, 0.25, luma));
      color = mix(color, graded, uGrade);

      float vignette = (1.0 - smoothstep(0.18, 0.92, radius * (1.0 + uVignette * 0.5)));
      color *= mix(1.0 - uVignette, 1.0, vignette);
      color *= 1.0 - uFloor * (1.0 - smoothstep(0.0, 0.42, vUv.y));
      color += (hash(vUv * 1024.0 + fract(uTime)) - 0.5) * uGrain;
      gl_FragColor = vec4(max(color, 0.0), 1.0);
    }
  `,
};

export type PostProcessing = {
  bloom: UnrealBloomPass;
  finish: ShaderPass;
  render(dt: number, elapsed: number): void;
  setSize(width: number, height: number, pixelRatio: number): void;
  ripple(x: number, y: number, amplitude: number): void;
  dispose(): void;
};

export function createPostProcessing(renderer: WebGLRenderer, scene: Scene, camera: Camera, width: number, height: number): PostProcessing {
  const target = new WebGLRenderTarget(width, height, { type: HalfFloatType, samples: 0 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(width, height);

  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(width, height), 0.2, 0.35, 1.2);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const antialias = new ShaderPass(FXAAShader);
  antialias.uniforms.resolution.value.set(1 / width, 1 / height);
  composer.addPass(antialias);
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);

  return {
    bloom,
    finish,
    render(dt, elapsed) {
      finish.uniforms.uTime.value = elapsed;
      finish.uniforms.uRipple.value.z *= Math.exp(-dt * 3.2);
      composer.render(dt);
    },
    setSize(nextWidth, nextHeight, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(nextWidth, nextHeight);
      antialias.uniforms.resolution.value.set(1 / (nextWidth * pixelRatio), 1 / (nextHeight * pixelRatio));
    },
    ripple(x, y, amplitude) {
      finish.uniforms.uRipple.value.set(x, y, amplitude, 0);
    },
    dispose() {
      composer.passes.forEach((pass) => pass.dispose?.());
      composer.dispose();
    },
  };
}
