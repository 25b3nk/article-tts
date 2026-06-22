import { KokoroTTS } from "kokoro-js";

export type Device = "webgpu" | "wasm";
export type Dtype = "fp32" | "fp16" | "q8" | "q4" | "q4f16";

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

export interface LoadProgress {
  status: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

let ttsPromise: Promise<KokoroTTS> | null = null;
let loadedWith: { device: Device; dtype: Dtype } | null = null;

export async function detectDevice(): Promise<Device> {
  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) return "webgpu";
    } catch {
      // fall through to wasm
    }
  }
  return "wasm";
}

export async function loadTTS(
  device: Device,
  dtype: Dtype,
  onProgress?: (p: LoadProgress) => void,
): Promise<KokoroTTS> {
  if (ttsPromise && loadedWith?.device === device && loadedWith?.dtype === dtype) {
    return ttsPromise;
  }
  loadedWith = { device, dtype };
  ttsPromise = KokoroTTS.from_pretrained(MODEL_ID, {
    dtype,
    device,
    progress_callback: onProgress as any,
  });
  return ttsPromise;
}

export const VOICE_LIST = [
  "af_heart",
  "af_bella",
  "af_nicole",
  "af_sarah",
  "am_adam",
  "am_michael",
  "bf_emma",
  "bm_george",
] as const;
export type Voice = (typeof VOICE_LIST)[number];
