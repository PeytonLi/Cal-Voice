// All audio is pre-rendered (see scripts/gen-audio.mjs) and served as static
// mp3, so nothing here needs an API key at runtime.
//
// Browsers refuse to start an AudioContext before a user gesture, so resume()
// must be called from the same click that captures the pointer.

import * as THREE from 'three';

const BASE = './public/audio/';

let listener = null;
let ambience = null;
let bells = null;
let stepBuf = null;
let narration = null;          // plain HTMLAudioElement, easiest to interrupt
let started = false;
let bellTimer = 0;

export function initAudio(camera, scene, towerPos) {
  listener = new THREE.AudioListener();
  camera.add(listener);
  const loader = new THREE.AudioLoader();

  ambience = new THREE.Audio(listener);
  loader.load(BASE + 'ambience.mp3', (b) => {
    ambience.setBuffer(b);
    ambience.setLoop(true);
    ambience.setVolume(0.3);
    if (started) ambience.play();
  }, undefined, () => console.warn('ambience.mp3 missing'));

  // The carillon is a real feature of the tower, so place it there and let
  // distance do the work: audible across campus, dominant underneath it.
  bells = new THREE.PositionalAudio(listener);
  bells.setRefDistance(45);
  bells.setMaxDistance(700);
  bells.setRolloffFactor(1.2);
  bells.setVolume(1.0);
  const anchor = new THREE.Object3D();
  anchor.position.set(towerPos.x, 70, towerPos.z);   // up in the belfry
  anchor.add(bells);
  scene.add(anchor);
  loader.load(BASE + 'bells.mp3', (b) => bells.setBuffer(b), undefined,
    () => console.warn('bells.mp3 missing'));

  loader.load(BASE + 'step.mp3', (b) => { stepBuf = b; }, undefined,
    () => console.warn('step.mp3 missing'));
}

export function resumeAudio() {
  if (!listener) return;
  if (listener.context.state === 'suspended') listener.context.resume();
  if (started) return;
  started = true;
  if (ambience?.buffer && !ambience.isPlaying) ambience.play();
  bellTimer = 8;                                     // first chime shortly in
}

export function playLine(poiId, index) {
  stopLine();
  narration = new Audio(`${BASE}${poiId}-${index}.mp3`);
  narration.volume = 0.95;
  // autoplay can still be refused; the dialogue text stands on its own
  narration.play().catch(() => {});
}

export function stopLine() {
  if (!narration) return;
  narration.pause();
  narration.currentTime = 0;
  narration = null;
}

export function updateAudio(dt, moving, running) {
  if (!started) return;

  bellTimer -= dt;
  if (bellTimer <= 0) {
    bellTimer = 95 + Math.random() * 45;
    if (bells?.buffer && !bells.isPlaying) bells.play();
  }

  if (!stepBuf) return;
  stepPhase += moving ? dt * (running ? 2.6 : 1.7) : 0;
  if (stepPhase >= 1) {
    stepPhase = 0;
    const s = new THREE.Audio(listener);
    s.setBuffer(stepBuf);
    s.setVolume(0.22);
    s.setPlaybackRate(0.92 + Math.random() * 0.16);
    s.play();
  }
}
let stepPhase = 0;
