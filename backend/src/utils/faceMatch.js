// Descriptors are 128-length float arrays produced client-side by
// face-api.js (SsdMobilenetv1/TinyFaceDetector + FaceRecognitionNet). The
// backend never runs any ML model itself — it only stores these arrays and
// compares them with plain vector math, so there's no native dependency
// (canvas, tfjs-node, GPU) on the server.

export const DESCRIPTOR_LENGTH = 128;

// face-api.js's own docs/examples use ~0.6 as the standard match threshold
// for its FaceRecognitionNet descriptors (Euclidean distance, lower = more
// similar). Keep it configurable in case you want to tighten/loosen it.
export const MATCH_THRESHOLD = 0.55;

export function isValidDescriptor(value) {
  return Array.isArray(value) && value.length === DESCRIPTOR_LENGTH && value.every((n) => typeof n === 'number' && Number.isFinite(n));
}

export function euclideanDistance(a, b) {
  let sum = 0;
  for (let i = 0; i < DESCRIPTOR_LENGTH; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Greedy 1:1 matching of detected face descriptors against a roster of
 * enrolled (studentId, descriptor) pairs. Each detected face is matched to
 * its closest enrolled student under MATCH_THRESHOLD; once a student is
 * matched they're removed from the pool so two detected faces can't both
 * claim the same student.
 *
 * @param {number[][]} detectedDescriptors
 * @param {{ studentId: string, descriptor: number[] }[]} roster
 * @returns {{ matches: { studentId: string, distance: number }[], unmatched: { distance: number|null }[] }}
 */
export function matchDescriptors(detectedDescriptors, roster) {
  const pool = [...roster];
  const matches = [];
  const unmatched = [];

  for (const detected of detectedDescriptors) {
    let best = null;
    let bestIndex = -1;
    for (let i = 0; i < pool.length; i++) {
      const distance = euclideanDistance(detected, pool[i].descriptor);
      if (distance <= MATCH_THRESHOLD && (!best || distance < best.distance)) {
        best = { studentId: pool[i].studentId, distance };
        bestIndex = i;
      }
    }
    if (best) {
      matches.push(best);
      pool.splice(bestIndex, 1);
    } else {
      // Not a confident match, but report how close the nearest enrolled
      // face was (against the full original roster) so the UI can show a
      // "how unmatched was this" indicator instead of just "unknown" — no
      // studentId, since it fell below the match threshold.
      let closest = null;
      for (const candidate of roster) {
        const distance = euclideanDistance(detected, candidate.descriptor);
        if (closest === null || distance < closest) closest = distance;
      }
      unmatched.push({ distance: closest });
    }
  }

  return { matches, unmatched };
}