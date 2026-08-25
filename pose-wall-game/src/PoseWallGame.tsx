'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  POSES,
  POSE_ORDER,
  Silhouette,
  buildLabelMap,
  matchModelLabel,
  randomPose,
} from './poseData';
import type { PoseKey } from './poseData';
import { MagicCircle, MagicVisualStyles } from './magicVisuals';

// ============================================
// TYPES
// ============================================
declare global {
  interface Window {
    tmPose: any;
    tf: any;
  }
}

interface Wall {
  id: number;
  pose: PoseKey;
  z: number;        // ระยะจากกล้อง (0 = ไกล, 100 = ใกล้/ชน)
  state: 'approach' | 'lock' | 'hit' | 'miss' | 'passed';
  scale: number;
  opacity: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

// ============================================
// CONFIGURATION
// ============================================
const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/7C6Gkj5M7/';
const CONFIDENCE_LIMIT = 0.80;
const CAMERA_SIZE = 420;
const GAME_SECONDS = 60;
const WALL_APPROACH_SPEED = 0.35;  // ความเร็วกำแพงเข้ามา (% ต่อเฟรม 60fps)
const WALL_SPAWN_Z = -10;          // จุดเกิดกำแพง (ไกล)
const WALL_LOCK_Z = 50;            // จุดตรวจสอบท่า
const WALL_PASS_Z = 85;            // จุดทะลุผ่าน
const WALL_DESPAWN_Z = 110;        // จุดหายไป
const SPAWN_INTERVAL = 280;        // ระยะเฟรมระหว่างกำแพง

function createWall(id: number, pose: PoseKey): Wall {
  return {
    id,
    pose,
    z: WALL_SPAWN_Z,
    state: 'approach',
    scale: 0.3,
    opacity: 0,
  };
}

// ============================================
// MAIN COMPONENT
// ============================================
interface PoseWallGameProps {
  onExit?: () => void;
}

export default function PoseWallGame({ onExit }: PoseWallGameProps) {
  // Refs
  const webcamRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const predictionBusyRef = useRef(false);
  // Latest pose skeleton from the AI prediction loop (~10/sec). The camera
  // render loop below redraws it every frame alongside the fresh webcam
  // image so the overlay doesn't vanish between prediction ticks.
  const lastPoseRef = useRef<any>(null);
  const wallsRef = useRef<Wall[]>([]);
  const nextWallIdRef = useRef(1);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const matchedRef = useRef(0);
  const livesRef = useRef(3);
  const startedAtRef = useRef(0);
  const gameOverRef = useRef(false);
  const currentTargetRef = useRef<PoseKey | null>(null);
  const lastScoredWallIdRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const nextParticleIdRef = useRef(1);
  const shakeRef = useRef(0);
  const labelToPoseRef = useRef<Record<string, PoseKey>>({});
  const poseToLabelRef = useRef<Partial<Record<PoseKey, string>>>({});
  const spawnTimerRef = useRef(0);
  // Wall/particle position updates happen every RAF frame. Writing them via
  // setState would re-render the whole tree (incl. the blurred side panel)
  // at 60fps. Instead we mutate the DOM directly through these ref maps and
  // only trigger a React re-render when walls/particles are actually
  // added, removed, or change state (spawn/despawn/lock/hit/miss).
  const wallElRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const particleElRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const wallsDirtyRef = useRef(false);

  // State
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [confidence, setConfidence] = useState(0);
  const [detectedPose, setDetectedPose] = useState<PoseKey | 'unknown'>('unknown');
  const [targetPose, setTargetPose] = useState<PoseKey | null>(null);
  const [message, setMessage] = useState('กด "เริ่มเกม" เพื่อเล่น');
  const [flash, setFlash] = useState(false);
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [classScores, setClassScores] = useState<Record<string, number>>({});
  const [, setParticleTick] = useState(0);
  const [showStartScreen, setShowStartScreen] = useState(true);

  const targetInfo = targetPose ? POSES[targetPose] : null;
  const detectedInfo = detectedPose !== 'unknown' ? POSES[detectedPose] : null;

  // ==========================================
  // LOAD SCRIPTS
  // ==========================================
  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`โหลดสคริปต์ไม่สำเร็จ: ${src}`));
      document.head.appendChild(script);
    });
  };

  // ==========================================
  // INIT MODEL
  // ==========================================
  const loadModel = useCallback(async () => {
    if (modelRef.current && webcamRef.current) return;
    setLoading(true);
    setMessage('กำลังโหลด AI และเปิดกล้อง...');

    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js');
    // Force WebGL backend explicitly — without this tf.js may silently
    // fall back to the CPU backend if WebGL init hasn't settled yet,
    // which makes pose estimation many times slower.
    if (window.tf) {
      await window.tf.setBackend('webgl');
      await window.tf.ready();
    }
    await loadScript('https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8.3/dist/teachablemachine-pose.min.js');

    const tmPose = window.tmPose;
    const model = await tmPose.load(`${MODEL_URL}model.json`, `${MODEL_URL}metadata.json`);
    const webcam = new tmPose.Webcam(CAMERA_SIZE, CAMERA_SIZE, true);
    await webcam.setup();
    await webcam.play();

    modelRef.current = model;
    webcamRef.current = webcam;

    let labels: string[] = [];
    try {
      if (typeof model.getClassLabels === 'function') labels = model.getClassLabels();
      else if (typeof model.getTotalClasses === 'function') {
        labels = Array.from({ length: model.getTotalClasses() }, (_, i) => `Class ${i + 1}`);
      }
    } catch { /* ignore */ }

    const map = buildLabelMap(labels);
    labelToPoseRef.current = map;
    const reverse: Partial<Record<PoseKey, string>> = {};
    Object.entries(map).forEach(([l, k]) => { reverse[k] = l; });
    poseToLabelRef.current = reverse;

    setReady(true);
    setLoading(false);
    setMessage('พร้อม! กดเริ่มเกม');

    if (canvasRef.current) {
      canvasRef.current.width = CAMERA_SIZE;
      canvasRef.current.height = CAMERA_SIZE;
    }
  }, []);

  // ==========================================
  // GAME CONTROL
  // ==========================================
  const resetGame = useCallback(() => {
    wallsRef.current = [];
    nextWallIdRef.current = 1;
    scoreRef.current = 0;
    comboRef.current = 0;
    matchedRef.current = 0;
    livesRef.current = 3;
    gameOverRef.current = false;
    startedAtRef.current = performance.now();
    frameRef.current = 0;
    particlesRef.current = [];
    nextParticleIdRef.current = 1;
    shakeRef.current = 0;
    spawnTimerRef.current = 0;
    currentTargetRef.current = null;
    lastScoredWallIdRef.current = null;

    setScore(0);
    setCombo(0);
    setLives(3);
    setTimeLeft(GAME_SECONDS);
    setGameOver(false);
    setLastPoints(null);
    setFlash(false);
    setMessage('ทำท่าให้ตรงกับช่องว่างในกำแพง!');
    setDetectedPose('unknown');
    setTargetPose(null);
    setWalls([]);
    setShowStartScreen(false);
  }, []);

  const startGame = useCallback(async () => {
    try {
      if (!ready) await loadModel();
      resetGame();
      setRunning(true);
      setMessage('เริ่ม! กำแพงกำลังเข้ามา...');
    } catch (err) {
      console.error(err);
      setLoading(false);
      setMessage('โหลดโมเดลหรือกล้องไม่สำเร็จ');
    }
  }, [loadModel, ready, resetGame]);

  const stopGame = useCallback(() => {
    setRunning(false);
    gameOverRef.current = true;
    setGameOver(true);
    setMessage(`จบเกม! ทำสำเร็จ ${matchedRef.current} ครั้ง`);
  }, []);

  // ==========================================
  // PARTICLES
  // ==========================================
  const addParticles = useCallback((x: number, y: number, color: string, count = 30) => {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 3 + Math.random() * 6;
      particlesRef.current.push({
        id: nextParticleIdRef.current++,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        color,
        size: 3 + Math.random() * 6,
      });
    }
    setParticleTick((t) => t + 1);
  }, []);

  // ==========================================
  // SCORING
  // ==========================================
  const scoreHit = useCallback((wall: Wall, hitConfidence: number) => {
    if (lastScoredWallIdRef.current === wall.id) return;
    const perfect = hitConfidence >= 0.92;
    const base = POSES[wall.pose].points;
    const bonus = Math.min(comboRef.current * 15, 150);
    const points = base + bonus + (perfect ? 50 : 0);

    lastScoredWallIdRef.current = wall.id;
    scoreRef.current += points;
    comboRef.current += 1;
    matchedRef.current += 1;

    setScore(scoreRef.current);
    setCombo(comboRef.current);
    setLastPoints(points);
    setFlash(true);
    setMessage(perfect ? `✨ PERFECT! +${points}` : `🎯 NICE! +${points}`);
    addParticles(50, 50, POSES[wall.pose].color, 36);
    shakeRef.current = 4;

    // Mark wall as passed
    const w = wallsRef.current.find((x) => x.id === wall.id);
    if (w) { w.state = 'passed'; wallsDirtyRef.current = true; }

    window.setTimeout(() => setFlash(false), 300);
  }, [addParticles]);

  const handleMiss = useCallback((wall: Wall) => {
    livesRef.current -= 1;
    setLives(livesRef.current);
    comboRef.current = 0;
    setCombo(0);
    setMessage('💥 ชน! ท่าไม่ตรง');
    shakeRef.current = 12;
    addParticles(50, 50, '#ff1744', 20);

    const w = wallsRef.current.find((x) => x.id === wall.id);
    if (w) { w.state = 'miss'; wallsDirtyRef.current = true; }

    if (livesRef.current <= 0) {
      window.setTimeout(stopGame, 600);
    }
  }, [addParticles, stopGame]);

  // ==========================================
  // POSE PREDICTION
  // ==========================================
  const predictPose = useCallback(async () => {
    if (!running || gameOverRef.current || predictionBusyRef.current) return;
    const model = modelRef.current;
    const webcam = webcamRef.current;
    if (!model || !webcam) return;

    predictionBusyRef.current = true;
    try {
      // The camera render loop (below) already keeps webcam.canvas fresh at
      // 60fps and redraws the skeleton every frame — this loop only needs
      // to run the (expensive) AI inference and hand back the result.
      const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
      const predictions = await model.predict(posenetOutput);
      lastPoseRef.current = pose ?? null;

      if (!predictions?.length) return;

      const scores: Record<string, number> = {};
      predictions.forEach((p: any) => { scores[p.className] = p.probability; });
      setClassScores(scores);

      let best = predictions[0];
      for (let i = 1; i < predictions.length; i++) {
        if (predictions[i].probability > best.probability) best = predictions[i];
      }

      const fromMap = labelToPoseRef.current[best.className];
      const mapped: PoseKey | null = fromMap ?? matchModelLabel(best.className);
      const conf = best.probability;
      setConfidence(conf);

      if (conf >= CONFIDENCE_LIMIT && mapped) {
        setDetectedPose(mapped);
        const target = currentTargetRef.current;
        if (target && mapped === target) {
          const activeWall = wallsRef.current.find(
            (w) => w.pose === target && w.state === 'lock' && w.id !== lastScoredWallIdRef.current
          );
          if (activeWall) scoreHit(activeWall, conf);
        }
      } else {
        setDetectedPose('unknown');
      }
    } finally {
      predictionBusyRef.current = false;
    }
  }, [running, scoreHit]);

  // ==========================================
  // GAME LOOP
  // ==========================================
  useEffect(() => {
    if (!running) return undefined;
    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (gameOverRef.current) return;
      const dt = Math.min(2.5, (now - lastTime) / (1000 / 60));
      lastTime = now;

      // Timer
      const elapsed = (now - startedAtRef.current) / 1000;
      const remaining = Math.max(0, Math.ceil(GAME_SECONDS - elapsed));
      setTimeLeft(remaining);
      if (remaining <= 0) { stopGame(); return; }

      // Spawn walls
      spawnTimerRef.current += dt;
      if (spawnTimerRef.current >= SPAWN_INTERVAL) {
        spawnTimerRef.current = 0;
        const lastPose = wallsRef.current[wallsRef.current.length - 1]?.pose;
        const newWall = createWall(nextWallIdRef.current++, randomPose(lastPose));
        wallsRef.current.push(newWall);
        wallsDirtyRef.current = true;
      }

      // Update walls
      const wallList = wallsRef.current;
      for (let i = wallList.length - 1; i >= 0; i--) {
        const w = wallList[i];
        if (w.state === 'passed' || w.state === 'miss') {
          w.z += WALL_APPROACH_SPEED * dt * 2;
          w.opacity -= 0.03 * dt;
          if (w.opacity <= 0 || w.z > WALL_DESPAWN_Z) {
            wallList.splice(i, 1);
            wallElRefs.current.delete(w.id);
            wallsDirtyRef.current = true;
          }
          continue;
        }

        w.z += WALL_APPROACH_SPEED * dt;
        // Scale & opacity based on Z (0-100)
        const progress = Math.max(0, Math.min(1, (w.z - WALL_SPAWN_Z) / (WALL_PASS_Z - WALL_SPAWN_Z)));
        w.scale = 0.25 + progress * 0.85;
        w.opacity = progress < 0.1 ? progress * 10 : (progress > 0.9 ? (1 - progress) * 10 : 1);

        // State transitions
        if (w.z >= WALL_LOCK_Z && w.z < WALL_LOCK_Z + 5 && w.state === 'approach') {
          w.state = 'lock';
          wallsDirtyRef.current = true;
          currentTargetRef.current = w.pose;
          setTargetPose(w.pose);
          setMessage(`ทำท่า: ${POSES[w.pose].label}!`);
        }

        if (w.z >= WALL_PASS_Z && w.state === 'lock') {
          // Player failed to match in time
          handleMiss(w);
        }

        if (w.z > WALL_DESPAWN_Z) {
          wallList.splice(i, 1);
          wallElRefs.current.delete(w.id);
          wallsDirtyRef.current = true;
        }
      }

      // Only trigger a React re-render when the wall list actually changed
      // shape (spawn/despawn/state transition) — not every frame.
      if (wallsDirtyRef.current) {
        wallsDirtyRef.current = false;
        setWalls([...wallList]);
      }

      // Position/scale/opacity change every frame regardless of the above —
      // write them straight to the DOM instead of going through React.
      for (let i = 0; i < wallList.length; i++) {
        const w = wallList[i];
        const el = wallElRefs.current.get(w.id);
        if (!el) continue;
        const isShaking = shakeRef.current > 0 && w.state === 'miss';
        const shakeX = isShaking ? (Math.random() - 0.5) * shakeRef.current : 0;
        const shakeY = isShaking ? (Math.random() - 0.5) * shakeRef.current : 0;
        el.style.transform = `translate(-50%, -50%) translateZ(${w.z * 4}px) scale(${w.scale}) translate(${shakeX}px, ${shakeY}px)`;
        el.style.opacity = String(w.opacity);
        el.style.zIndex = String(Math.floor(w.z));
      }

      // Update target to nearest lock wall
      const lockWall = wallList.find((w) => w.state === 'lock');
      if (lockWall) {
        currentTargetRef.current = lockWall.pose;
        setTargetPose(lockWall.pose);
      } else if (!wallList.some((w) => w.state === 'approach' && w.z > WALL_LOCK_Z - 20)) {
        currentTargetRef.current = null;
        setTargetPose(null);
      }

      // Particles: only mount/unmount via React state; per-frame position
      // updates are written straight to each particle's DOM node.
      const particles = particlesRef.current;
      let particleRemoved = false;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.15 * dt; // gravity
        p.life -= 0.02 * dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          particleElRefs.current.delete(p.id);
          particleRemoved = true;
          continue;
        }
        const el = particleElRefs.current.get(p.id);
        if (el) {
          el.style.left = `${p.x}%`;
          el.style.top = `${p.y}%`;
          el.style.opacity = String(p.life);
        }
      }
      if (particleRemoved) setParticleTick((t) => t + 1);

      // Shake decay
      if (shakeRef.current > 0) {
        shakeRef.current *= Math.pow(0.88, dt);
        if (shakeRef.current < 0.3) shakeRef.current = 0;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, stopGame, handleMiss]);

  // ==========================================
  // PREDICTION LOOP
  // ==========================================
  useEffect(() => {
    if (!running || gameOverRef.current) return undefined;
    let active = true;
    let timer = 0;
    const run = async () => {
      if (!active) return;
      await predictPose();
      timer = window.setTimeout(run, 100);
    };
    timer = window.setTimeout(run, 50);
    return () => { active = false; window.clearTimeout(timer); };
  }, [predictPose, running]);

  // ==========================================
  // CAMERA RENDER LOOP
  // Deliberately separate from the prediction loop above. AI inference only
  // runs ~10x/sec (it's expensive), but the visible camera feed used to be
  // redrawn only inside that same tick — capping it at ~10fps and making it
  // look choppy next to the 60fps wall animation. This loop redraws the
  // webcam image (+ last known skeleton) every frame regardless of how
  // often/slowly prediction completes, so the feed itself stays smooth.
  // ==========================================
  useEffect(() => {
    if (!ready) return undefined;
    let raf = 0;
    const draw = () => {
      const webcam = webcamRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (webcam && ctx) {
        webcam.update();
        ctx.clearRect(0, 0, CAMERA_SIZE, CAMERA_SIZE);
        ctx.drawImage(webcam.canvas, 0, 0);
        const pose = lastPoseRef.current;
        if (pose) {
          window.tmPose.drawKeypoints(pose.keypoints, 0.5, ctx);
          window.tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  // ==========================================
  // CLEANUP
  // ==========================================
  useEffect(() => {
    return () => {
      try { webcamRef.current?.stop?.(); } catch { /* ignore */ }
      webcamRef.current = null;
      modelRef.current = null;
    };
  }, []);

  // ==========================================
  // RENDER HELPERS
  // ==========================================
  const statusTone = gameOver ? 'danger' : detectedPose === targetPose ? 'success' : 'neutral';

  const getWallTransform = (wall: Wall): CSSProperties => {
    const shakeX = shakeRef.current > 0 && wall.state === 'miss' ? (Math.random() - 0.5) * shakeRef.current : 0;
    const shakeY = shakeRef.current > 0 && wall.state === 'miss' ? (Math.random() - 0.5) * shakeRef.current : 0;
    return {
      transform: `translate(-50%, -50%) translateZ(${wall.z * 4}px) scale(${wall.scale}) translate(${shakeX}px, ${shakeY}px)`,
      opacity: wall.opacity,
      zIndex: Math.floor(wall.z),
    };
  };

  return (
    <div className={`pose-game ${flash ? 'pose-game--flash' : ''}`}>
      <MagicVisualStyles />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .pose-game, .pose-game * { box-sizing: border-box; }
        .pose-game {
          min-height: 100vh;
          padding: 20px;
          color: #fff;
          background: radial-gradient(ellipse at 50% 0%, #0d1330 0%, #080c1c 50%, #05070d 100%);
          font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
          overflow-x: hidden;
          position: relative;
        }
        .pose-game::before {
          content: '';
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1.5px 1.5px at 78% 8%, rgba(160,190,255,0.55), transparent),
            radial-gradient(1px 1px at 55% 60%, rgba(255,255,255,0.45), transparent),
            radial-gradient(1.5px 1.5px at 25% 82%, rgba(160,190,255,0.45), transparent),
            radial-gradient(1px 1px at 92% 55%, rgba(255,255,255,0.4), transparent),
            radial-gradient(1.5px 1.5px at 42% 38%, rgba(255,255,255,0.35), transparent);
          background-repeat: repeat;
          background-size: 700px 700px;
          animation: starDrift 60s linear infinite;
          opacity: 0.6;
        }
        @keyframes starDrift { from { background-position: 0 0; } to { background-position: -700px 700px; } }
        .pose-game--flash { animation: screenFlash .3s ease; }
        @keyframes screenFlash { 0%,100%{ filter: brightness(1) saturate(1); } 50%{ filter: brightness(1.6) saturate(1.3); } }

        .shell { max-width: 1280px; margin: 0 auto; position: relative; z-index: 1; }

        /* HEADER */
        .topbar {
          display: flex; justify-content: space-between; align-items: center; gap: 16px;
          margin-bottom: 16px; padding: 14px 20px;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; backdrop-filter: blur(20px);
        }
        .brand { display:flex; gap: 12px; align-items:center; }
        .logo {
          width: 44px; height: 44px; border-radius: 14px;
          background: linear-gradient(135deg, #5b8cff, #1d3a8f);
          display: grid; place-items: center; font-size: 22px;
          box-shadow: 0 0 20px rgba(91,140,255,0.35);
        }
        .brand h1 { margin:0; font-size: 24px; font-weight: 800; letter-spacing: -0.01em; background: linear-gradient(135deg, #ffffff, #9fc0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .brand p { margin: 2px 0 0; color: #93a0bc; font-size: 13px; }
        .controls { display:flex; gap:10px; }
        button {
          border: none; cursor: pointer; border-radius: 12px; padding: 10px 20px;
          font-weight: 800; font-size: 14px; transition: all 0.2s ease;
          font-family: inherit;
        }
        button:hover { transform: translateY(-2px); }
        button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
        .btn-primary {
          background: linear-gradient(135deg, #3b63ff, #5b8cff);
          color: #fff; box-shadow: 0 4px 20px rgba(91,140,255,0.4);
        }
        .btn-secondary {
          background: rgba(255,255,255,0.1); color: #fff;
          border: 1px solid rgba(255,255,255,0.15);
        }

        /* STATS */
        .stats { display:grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
        .stat {
          background: rgba(20,24,44,0.55); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 16px; padding: 12px 14px; text-align: center;
        }
        .stat small { display:block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #6f7aa0; margin-bottom: 4px; }
        .stat strong { font-size: 24px; font-weight: 900; letter-spacing: -0.03em; }
        .stat.lives strong { color: #ff5470; }

        /* CONTENT GRID */
        .content { display:grid; grid-template-columns: 360px minmax(0,1fr); gap: 16px; }

        /* PANELS */
        .panel {
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 24px; padding: 16px; backdrop-filter: blur(16px);
        }
        .panel h2 { margin: 0 0 12px; font-size: 15px; font-weight: 800; color: #b9c4e0; }

        /* CAMERA */
        .camera-frame { position: relative; overflow: hidden; border-radius: 20px; background: #06080f; aspect-ratio: 1; border: 2px solid rgba(255,255,255,0.08); }
        .camera-frame canvas { width: 100%; height: 100%; display: block; object-fit: cover; transform: scaleX(-1); }
        .camera-badge { position: absolute; top: 10px; left: 10px; padding: 6px 10px; background: rgba(0,0,0,0.6); color: #fff; border-radius: 999px; font-size: 10px; font-weight: 800; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.1); }
        .camera-scanline { position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(91,140,255,0.04) 2px, rgba(91,140,255,0.04) 4px); animation: scanline 3s linear infinite; }
        @keyframes scanline { 0%{ transform: translateY(0); } 100%{ transform: translateY(8px); } }

        /* DETECT CARD */
        .detect-card { margin-top: 12px; padding: 14px; border-radius: 18px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); }
        .detect-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .pose-chip { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,0.08); font-weight: 900; font-size: 14px; border: 1px solid rgba(255,255,255,0.1); }
        .dot { width: 10px; height: 10px; border-radius: 999px; background: currentColor; box-shadow: 0 0 10px currentColor; }
        .confidence { margin-top: 10px; height: 6px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; }
        .confidence > i { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, #00e5ff, #ff477e, #76ff03, #ffab00); transition: width 0.2s ease; }

        /* CLASS SCORES */
        .class-scores { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .class-score { padding: 8px 10px; border-radius: 10px; background: rgba(255,255,255,0.04); font-size: 12px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; border: 1px solid transparent; transition: all 0.2s; }
        .class-score.active { background: rgba(255,255,255,0.1); border-color: currentColor; }

        /* STATUS */
        .status-line { margin-top: 12px; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); }
        .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #5a5270; transition: all 0.3s; }
        .status-dot.success { background: #00e676; box-shadow: 0 0 0 4px rgba(0,230,118,0.2); }
        .status-dot.danger { background: #ff1744; box-shadow: 0 0 0 4px rgba(255,23,68,0.2); }
        .status-text { font-size: 12px; font-weight: 800; color: #9aa5c4; }

        /* GAME STAGE - 3D Perspective */
        .game-stage-wrapper { position: relative; height: 600px; border-radius: 24px; overflow: hidden; border: 2px solid rgba(255,255,255,0.08); background: linear-gradient(180deg, #080c1c 0%, #0d1330 40%, #05070d 100%); }
        .game-stage { position: absolute; inset: 0; perspective: 800px; perspective-origin: 50% 40%; overflow: hidden; }
        .stage-floor { position: absolute; bottom: 0; left: -20%; right: -20%; height: 35%; transform: rotateX(60deg); transform-origin: bottom; background: linear-gradient(180deg, rgba(91,140,255,0.12), transparent), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 60px); }
        .stage-grid { position: absolute; inset: 0; background: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 50px 50px; opacity: 0.5; }
        .stage-fog { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 100%, transparent 30%, #05070d 80%); pointer-events: none; }

        /* WALL */
        .wall-container { position: absolute; top: 50%; left: 50%; width: 320px; height: 420px; transform-style: preserve-3d; pointer-events: none; }
        .wall-body {
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(28,32,58,0.85), rgba(10,12,24,0.9));
          border: 3px solid rgba(255,255,255,0.15);
          border-radius: 24px;
          box-shadow: 0 0 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(255,255,255,0.03);
        }
        .wall-body::before {
          content: ''; position: absolute; inset: -3px; border-radius: 24px;
          background: linear-gradient(135deg, var(--wall-glow, rgba(255,255,255,0.2)), transparent 60%);
          opacity: 0.6; z-index: -1;
        }
        .wall-hole {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 160px; height: 260px;
          background: radial-gradient(ellipse at center, rgba(0,0,0,0.9) 40%, rgba(0,0,0,0.6) 70%, transparent 100%);
          border-radius: 80px;
          box-shadow: inset 0 0 30px rgba(0,0,0,0.8), 0 0 20px var(--wall-glow, rgba(255,255,255,0.1));
          display: grid; place-items: center;
        }
        .wall-hole svg { filter: drop-shadow(0 0 15px var(--wall-glow, rgba(255,255,255,0.3))); }
        .wall-rune-ring {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 190px; height: 290px; border-radius: 100px;
          background: conic-gradient(from 0deg, transparent 0 20deg, var(--wall-glow, rgba(255,255,255,0.3)) 30deg, transparent 55deg, transparent 90deg, var(--wall-glow, rgba(255,255,255,0.3)) 100deg, transparent 125deg, transparent 160deg, var(--wall-glow, rgba(255,255,255,0.3)) 170deg, transparent 195deg, transparent 230deg, var(--wall-glow, rgba(255,255,255,0.3)) 240deg, transparent 265deg, transparent 300deg, var(--wall-glow, rgba(255,255,255,0.3)) 310deg, transparent 335deg);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px));
          animation: runeSpin 8s linear infinite;
          opacity: 0.85; pointer-events: none;
        }
        @keyframes runeSpin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
        .wall-spell-tag {
          position: absolute; top: 14px; left: 0; right: 0; text-align: center;
          font-size: 11px; font-weight: 800; letter-spacing: 0.1em;
        }
        .wall-label {
          position: absolute; bottom: 16px; left: 0; right: 0; text-align: center;
          font-size: 13px; font-weight: 900; letter-spacing: 0.15em;
          color: rgba(255,255,255,0.7); text-transform: uppercase;
        }
        .wall-lockon {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          width: 200px; height: 300px; border: 2px dashed rgba(255,255,255,0.3);
          border-radius: 100px; animation: lockonPulse 1s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes lockonPulse { 0%,100%{ opacity: 0.3; transform: translate(-50%,-50%) scale(1); } 50%{ opacity: 0.7; transform: translate(-50%,-50%) scale(1.05); } }

        /* PLAYER ZONE */
        .player-zone { position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); text-align: center; z-index: 100; }
        .player-ring {
          width: 120px; height: 120px; margin: 0 auto 8px; border-radius: 50%;
          border: 3px solid rgba(255,255,255,0.2);
          box-shadow: 0 0 0 10px rgba(255,255,255,0.03), 0 0 40px rgba(255,255,255,0.1);
          animation: playerPulse 2s ease-in-out infinite;
          display: grid; place-items: center; font-size: 48px;
        }
        @keyframes playerPulse { 0%,100%{ transform: scale(0.95); opacity: 0.7; } 50%{ transform: scale(1.05); opacity: 1; } }
        .target-hud {
          padding: 10px 20px; border-radius: 16px;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .target-hud small { display: block; font-size: 10px; font-weight: 800; color: #8a93ab; letter-spacing: 0.15em; margin-bottom: 2px; }
        .target-hud strong { font-size: 20px; font-weight: 900; }

        /* PARTICLES */
        .particle { position: absolute; border-radius: 50%; pointer-events: none; z-index: 200; }

        /* POINTS POPUP */
        .big-points { position: absolute; left: 50%; top: 40%; transform: translate(-50%,-50%); font-weight: 900; font-size: 56px; z-index: 300; animation: popPoints 0.8s ease forwards; text-shadow: 0 4px 30px rgba(0,0,0,0.5); }
        @keyframes popPoints { 0%{ opacity: 0; transform: translate(-50%,-30%) scale(0.4); } 25%{ opacity: 1; transform: translate(-50%,-50%) scale(1.1); } 100%{ opacity: 0; transform: translate(-50%,-90%) scale(0.9); } }

        /* COMBO */
        .combo-display { position: absolute; top: 20px; right: 24px; z-index: 150; text-align: right; }
        .combo-display .combo-count { font-size: 48px; font-weight: 900; line-height: 1; color: #7fb0ff; text-shadow: 0 0 30px rgba(91,140,255,0.5); }
        .combo-display .combo-label { font-size: 12px; font-weight: 800; color: #7fb0ff; letter-spacing: 0.2em; }

        /* MESSAGE */
        .message-pill { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); padding: 10px 24px; border-radius: 999px; background: rgba(0,0,0,0.6); backdrop-filter: blur(14px); border: 1px solid rgba(255,255,255,0.1); font-weight: 800; font-size: 14px; z-index: 150; white-space: nowrap; }

        /* GAME OVER */
        .game-over { position: absolute; inset: 0; z-index: 400; display: grid; place-items: center; background: rgba(5,7,13,0.85); backdrop-filter: blur(16px); }
        .game-over-card { text-align: center; width: min(420px, 90%); padding: 36px 28px; border-radius: 28px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 30px 80px rgba(0,0,0,0.5); }
        .game-over-card h2 { margin: 0 0 8px; font-size: 40px; font-weight: 900; letter-spacing: -0.03em; background: linear-gradient(135deg, #ffffff, #9fc0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .result-score { font-size: 64px; font-weight: 900; margin: 8px 0; color: #fff; text-shadow: 0 0 40px rgba(255,255,255,0.2); }
        .game-over-stats { display: flex; justify-content: center; gap: 24px; margin: 16px 0 24px; color: #93a0bc; font-size: 14px; }

        /* START SCREEN */
        .start-screen { position: absolute; inset: 0; z-index: 500; display: grid; place-items: center; background: rgba(5,7,13,0.7); backdrop-filter: blur(20px); }
        .start-card { position: relative; z-index: 1; text-align: center; width: min(480px, 90%); padding: 40px 32px; border-radius: 32px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); }
        .start-rune { position: absolute; left: 50%; top: 50%; translate: -50% -50%; pointer-events: none; }
        .start-card h2 { margin: 0 0 12px; font-size: 36px; font-weight: 900; }
        .start-card p { color: #93a0bc; margin-bottom: 24px; line-height: 1.6; }
        .pose-preview { display: flex; justify-content: center; gap: 16px; margin: 20px 0; flex-wrap: wrap; }
        .pose-preview-item { padding: 12px 16px; border-radius: 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); text-align: center; }
        .pose-preview-item .icon { font-size: 28px; margin-bottom: 4px; }
        .pose-preview-item .name { font-size: 11px; font-weight: 800; color: #b9c4e0; }

        /* LEGEND */
        .legend { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
        .legend-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); font-size: 12px; font-weight: 700; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

        /* LIVES */
        .lives-display { position: absolute; top: 20px; left: 24px; z-index: 150; display: flex; gap: 6px; }
        .life-heart { font-size: 24px; filter: drop-shadow(0 0 8px rgba(255,71,126,0.4)); transition: all 0.3s; }
        .life-heart.lost { opacity: 0.2; filter: grayscale(1); }

        /* RESPONSIVE */
        @media (max-width: 980px) { .content { grid-template-columns: 1fr; } .game-stage-wrapper { height: 500px; } .stats { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 620px) { .pose-game { padding: 12px; } .topbar { flex-direction: column; align-items: stretch; } .stats { grid-template-columns: repeat(2, 1fr); } .game-stage-wrapper { height: 450px; } .wall-container { width: 260px; height: 340px; } .wall-hole { width: 130px; height: 210px; } }
      `}</style>

      <div className="shell">
        {/* HEADER */}
        <header className="topbar">
          <div className="brand">
            <div className="logo">🔮</div>
            <div>
              <h1>ARCANE GATE</h1>
              <p>ร่ายท่าให้ตรงกับประตูเวทมนตร์ ก่อนมันจะกลืนคุณเข้าไป!</p>
            </div>
          </div>
          <div className="controls">
            {onExit && (
              <button className="btn-secondary" onClick={onExit}>
                ← หน้าหลัก
              </button>
            )}
            <button className="btn-primary" onClick={startGame} disabled={loading || running}>
              {loading ? '⏳ โหลด AI...' : running ? '🎮 เล่นอยู่' : '🎮 เริ่มเกม'}
            </button>
            <button className="btn-secondary" onClick={() => { resetGame(); setRunning(true); }} disabled={!ready || running}>
              🔄 เริ่มใหม่
            </button>
          </div>
        </header>

        {/* STATS */}
        <section className="stats">
          <div className="stat">
            <small>Score</small>
            <strong>{score.toLocaleString()}</strong>
          </div>
          <div className="stat">
            <small>Combo</small>
            <strong style={{ color: combo > 2 ? '#ffab00' : '#fff' }}>×{combo}</strong>
          </div>
          <div className="stat">
            <small>Time</small>
            <strong style={{ color: timeLeft <= 10 ? '#ff1744' : '#fff' }}>{timeLeft}s</strong>
          </div>
          <div className="stat">
            <small>Target</small>
            <strong style={{ color: targetInfo?.color || '#fff' }}>
              {targetInfo ? `${targetInfo.icon} ${targetInfo.short}` : '---'}
            </strong>
          </div>
          <div className="stat lives">
            <small>Lives</small>
            <strong>{'❤️'.repeat(lives)}{'🖤'.repeat(3 - lives)}</strong>
          </div>
        </section>

        {/* MAIN */}
        <main className="content">
          {/* CAMERA PANEL */}
          <aside className="panel">
            <h2>📷 กล้อง AI</h2>
            <div className="camera-frame">
              <canvas ref={canvasRef} />
              <div className="camera-badge">● LIVE</div>
              <div className="camera-scanline" />
            </div>

            <div className="detect-card">
              <div className="detect-row">
                <div>
                  <div style={{ fontSize: 10, color: '#7a6f8a', fontWeight: 800, marginBottom: 4 }}>ตรวจพบ</div>
                  <div className="pose-chip" style={{ borderColor: detectedInfo?.color || 'rgba(255,255,255,0.1)' }}>
                    <span className="dot" style={{ color: detectedInfo?.color || '#5a5270' }} />
                    {detectedInfo?.label || 'รอการตรวจจับ...'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: '#7a6f8a', fontWeight: 800, marginBottom: 4 }}>Confidence</div>
                  <strong style={{ fontSize: 22, color: confidence >= CONFIDENCE_LIMIT ? '#00e676' : '#fff' }}>
                    {Math.round(confidence * 100)}%
                  </strong>
                </div>
              </div>
              <div className="confidence"><i style={{ width: `${Math.min(confidence * 100, 100)}%` }} /></div>
            </div>

            <div className="status-line">
              <span className={`status-dot ${statusTone}`} />
              <span className="status-text">{message}</span>
            </div>

            <div className="class-scores">
              {POSE_ORDER.map((key) => {
                const realLabel = poseToLabelRef.current[key];
                const prob = realLabel ? classScores[realLabel] ?? 0 : 0;
                const isActive = detectedPose === key;
                return (
                  <div key={key} className={`class-score ${isActive ? 'active' : ''}`} style={{ color: POSES[key].color, borderColor: isActive ? POSES[key].color : 'transparent' }}>
                    <span>{POSES[key].icon} {POSES[key].label}</span>
                    <span>{(prob * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.03)', fontSize: 12, color: '#8a8098', lineHeight: 1.6 }}>
              <strong style={{ color: '#d4cde0' }}>วิธีเล่น:</strong><br />
              ประตูเวทมนตร์จะเคลื่อนเข้ามา ให้ร่ายท่าคาถาให้ตรงกับช่องว่างตอนประตูถึงเส้นล็อก<br />
              ร่ายถูก = ทะลุผ่าน + คะแนน | ร่ายผิด = โดนมนตร์สะท้อน! 💥
            </div>
          </aside>

          {/* GAME PANEL */}
          <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="game-stage-wrapper">
              <div className="game-stage">
                <div className="stage-grid" />
                <div className="stage-floor" />
                <div className="stage-fog" />

                {/* WALLS */}
                {walls.map((wall) => {
                  const info = POSES[wall.pose];
                  const isLock = wall.state === 'lock';
                  const isMiss = wall.state === 'miss';
                  return (
                    <div
                      key={wall.id}
                      ref={(el) => {
                        if (el) wallElRefs.current.set(wall.id, el);
                        else wallElRefs.current.delete(wall.id);
                      }}
                      className="wall-container"
                      style={getWallTransform(wall)}
                    >
                      <div
                        className="wall-body"
                        style={{
                          '--wall-glow': isMiss ? 'rgba(255,23,68,0.5)' : info.glow,
                          borderColor: isMiss ? 'rgba(255,23,68,0.6)' : isLock ? info.color : 'rgba(255,255,255,0.15)',
                          boxShadow: isLock
                            ? `0 0 80px ${info.glow}, inset 0 0 40px rgba(255,255,255,0.05)`
                            : '0 0 60px rgba(0,0,0,0.5), inset 0 0 40px rgba(255,255,255,0.03)',
                        } as CSSProperties}
                      >
                        <div className="wall-spell-tag" style={{ color: info.color }}>✦ {info.spell} ✦</div>
                        <div className="wall-rune-ring" style={{ '--wall-glow': info.glow } as CSSProperties} />
                        <div className="wall-hole" style={{ '--wall-glow': info.glow } as CSSProperties}>
                          <Silhouette pose={wall.pose} size={140} />
                        </div>
                        <div className="wall-label" style={{ color: info.color }}>{info.label}</div>
                        {isLock && <div className="wall-lockon" style={{ borderColor: info.color }} />}
                      </div>
                    </div>
                  );
                })}

                {/* PLAYER ZONE */}
                <div className="player-zone">
                  <div className="player-ring">
                    {detectedInfo?.icon || '🧙'}
                  </div>
                  <div className="target-hud">
                    <small>คาถาที่ต้องร่าย</small>
                    <strong style={{ color: targetInfo?.color || '#fff' }}>
                      {targetInfo ? `${targetInfo.icon} ${targetInfo.label}` : 'รอ...'}
                    </strong>
                  </div>
                </div>

                {/* PARTICLES */}
                {particlesRef.current.map((p) => (
                  <div
                    key={p.id}
                    ref={(el) => {
                      if (el) particleElRefs.current.set(p.id, el);
                      else particleElRefs.current.delete(p.id);
                    }}
                    className="particle"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      width: p.size,
                      height: p.size,
                      background: p.color,
                      opacity: p.life,
                      boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
                      transform: `translate(-50%, -50%)`,
                    }}
                  />
                ))}

                {/* COMBO */}
                {combo > 1 && (
                  <div className="combo-display">
                    <div className="combo-count">{combo}</div>
                    <div className="combo-label">COMBO</div>
                  </div>
                )}

                {/* POINTS */}
                {lastPoints !== null && (
                  <div key={`${lastPoints}-${score}`} className="big-points" style={{ color: POSES[targetPose || 'Two hand']?.color || '#fff' }}>
                    +{lastPoints}
                  </div>
                )}

                {/* MESSAGE */}
                {!gameOver && <div className="message-pill">{message}</div>}

                {/* LIVES */}
                <div className="lives-display">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className={`life-heart ${i >= lives ? 'lost' : ''}`}>❤️</span>
                  ))}
                </div>

                {/* START SCREEN */}
                {showStartScreen && !loading && (
                  <div className="start-screen">
                    <MagicCircle className="start-rune" size="min(76vmin, 540px)" color="#7fb0ff" spin={64} opacity={0.3} />
                    <div className="start-card">
                      <h2>🔮 Arcane Gate</h2>
                      <p>ประตูเวทมนตร์กำลังเคลื่อนเข้ามา! ร่ายท่าคาถาให้ตรงกับช่องว่างก่อนมันจะถึงตัวคุณ<br />ใช้กล้องและ AI ตรวจจับท่าทางของคุณแบบเรียลไทม์</p>
                      <div className="pose-preview">
                        {POSE_ORDER.map((key) => (
                          <div key={key} className="pose-preview-item">
                            <div className="icon">{POSES[key].icon}</div>
                            <div className="name">{POSES[key].label}</div>
                          </div>
                        ))}
                      </div>
                      <button className="btn-primary" onClick={startGame} style={{ fontSize: 18, padding: '14px 36px' }}>
                        ▶ เริ่มเล่น
                      </button>
                    </div>
                  </div>
                )}

                {/* GAME OVER */}
                {gameOver && (
                  <div className="game-over">
                    <div className="game-over-card">
                      <h2>GAME OVER</h2>
                      <div className="result-score">{score.toLocaleString()}</div>
                      <div className="game-over-stats">
                        <span>✅ สำเร็จ {matchedRef.current} ครั้ง</span>
                        <span>🔥 Combo สูงสุด ×{combo}</span>
                      </div>
                      <button className="btn-primary" onClick={() => { resetGame(); setRunning(true); }}>
                        ▶ เล่นอีกครั้ง
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* LEGEND */}
            <div style={{ padding: 16 }}>
              <div className="legend">
                {POSE_ORDER.map((key) => (
                  <div key={key} className="legend-item">
                    <span className="legend-dot" style={{ background: POSES[key].color, boxShadow: `0 0 10px ${POSES[key].color}` }} />
                    <span>{POSES[key].icon} {POSES[key].label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}