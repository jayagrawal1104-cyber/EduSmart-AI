// Thin wrapper around face-api.js. All face detection/recognition runs
// entirely in the browser via TensorFlow.js — the backend never runs any ML
// model and never receives an image, only the resulting 128-length
// descriptor array(s). See backend/src/utils/faceMatch.js for the matching
// side.
//
// Model weights are NOT bundled in this repo (they're a few MB of binary
// files). Download them once into frontend/public/models/ from face-api.js's
// own weights folder:
//   https://github.com/vladmandic/face-api/tree/master/model
// You need: tiny_face_detector, face_landmark_68, face_recognition
// (the *_model-weights_manifest.json + matching *_shard*.bin for each).

import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';
let modelsLoadedPromise = null;

/** Loads the three models needed for detection + landmarks + descriptor extraction. Safe to call repeatedly — only loads once. */
export function loadFaceModels() {
  if (!modelsLoadedPromise) {
    modelsLoadedPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]).catch((err) => {
      modelsLoadedPromise = null; // allow retrying on next call
      throw err;
    });
  }
  return modelsLoadedPromise;
}

const detectorOptions = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

/**
 * Enrollment: expects exactly one face in frame. Returns a plain number[128]
 * ready to send to the backend, or throws with a user-facing message.
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} input
 */
export async function extractSingleDescriptor(input) {
  await loadFaceModels();
  const result = await faceapi
    .detectSingleFace(input, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!result) {
    throw new Error('No face detected. Make sure your face is well-lit and centered in frame.');
  }
  return Array.from(result.descriptor);
}

/**
 * Attendance scan: detects every face in frame (a classroom shot) and
 * returns one descriptor per face, in no particular order.
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement} input
 */
export async function extractAllDescriptors(input) {
  await loadFaceModels();
  const results = await faceapi
    .detectAllFaces(input, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();

  return results.map((r) => Array.from(r.descriptor));
}