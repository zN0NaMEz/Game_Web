'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';

// ============================================
// TYPES
// ============================================
declare global {
  interface Window {
    tmPose: any;
    tf: any;
  }
}

// FIX: PoseKey ต้องตรงกับ key จริงที่ใช้ใน POSES ด้านล่าง (เดิมพิมพ์เป็นชื่อท่าโยคะเก่าที่ไม่ตรงกัน
// ทำให้ TypeScript คอมไพล์ไม่ผ่านทั้งไฟล์)
type PoseKey = 'Two hand' | 'one side' | 'one leg up' | 'tree';

interface PoseInfo {
  key: PoseKey;
  label: string;
  short: string;
  aliases: string[];
  points: number;
  accent: string;
  icon: string;
  color: string;
}

interface WallSlot {
  id: number;
  pose: PoseKey;
  x: number;
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
// แก้ MODEL_URL ให้เป็นลิงก์โมเดล Pose Project ของคุณเอง (ต้องมี 4 class)
const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/7C6Gkj5M7/';
const CONFIDENCE_LIMIT = 0.8;
const CAMERA_SIZE = 420;
const GAME_SECONDS = 60;
const TARGET_DISTANCE = 600; // ตำแหน่งที่กำแพงเดินสุดขวาแล้วเกิดใหม่
const WALL_SPEED = 2.8; // ต่อ "เฟรม 60fps" หนึ่งหน่วย (ปรับตามเวลาจริงด้วย dt ด้านล่าง)
const WALL_GAP = 260; // ระยะห่างระหว่างกำแพงแต่ละบาน
const CENTER_X = 200; // ตำแหน่ง x ที่ถือว่า "อยู่ตรงจุดตรวจจับ"
const HIT_ZONE = 300; // รัศมีรอบ CENTER_X ที่นับว่าเป็นเป้าหมายปัจจุบัน / ทำคะแนนได้

const POSES: Record<PoseKey, PoseInfo> = {
  'Two hand': {
    key: 'Two hand',
    label: 'ยกสองมือ',
    short: 'TWO HAND',
    aliases: ['two hand', 'two hands', 'สองมือ', 'ยกสองมือ', 'class 1', 'pose1', 'pose 1'],
    points: 100,
    accent: '#4CAF50',
    icon: '🙌',
    color: '#4CAF50',
  },
  'one side': {
    key: 'one side',
    label: 'เอียงข้าง',
    short: 'ONE SIDE',
    aliases: ['one side', 'oneside', 'ข้างเดียว', 'เอียงข้าง', 'class 2', 'pose2', 'pose 2'],
    points: 150,
    accent: '#FF9800',
    icon: '🤾',
    color: '#FF9800',
  },
  'one leg up': {
    key: 'one leg up',
    label: 'ยกขาข้างเดียว',
    short: 'LEG UP',
    aliases: [
      'one leg up',
      'oneleg up',
      'one leg',
      'ขาเดียว',
      'ยกขาข้างเดียว',
      'class 3',
      'pose3',
      'pose 3',
    ],
    points: 150,
    accent: '#9C27B0',
    icon: '🦩',
    color: '#9C27B0',
  },
  tree: {
    key: 'tree',
    label: 'ท่าต้นไม้',
    short: 'TREE',
    aliases: ['tree', 'tree pose', 'ต้นไม้', 'ท่าต้นไม้', 'class 4', 'pose4', 'pose 4'],
    points: 150,
    accent: '#2196F3',
    icon: '🌳',
    color: '#2196F3',
  },
};

// ลำดับนี้ใช้เป็น fallback เวลาจับคู่ชื่อ class จากโมเดลไม่ได้ (ดู buildLabelMap ด้านล่าง)
// ควรตรงกับลำดับที่เทรน 4 ท่านี้ใน Teachable Machine: Two hand → one side → one leg up → tree
const POSE_ORDER: PoseKey[] = ['Two hand', 'one side', 'one leg up', 'tree'];

// ============================================
// HELPERS
// ============================================
function normalizeLabel(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ');
}

function matchModelLabel(label: string): PoseKey | null {
  const normalized = normalizeLabel(label);
  for (const poseKey of POSE_ORDER) {
    const pose = POSES[poseKey];
    if (pose.aliases.some((alias) => normalized === normalizeLabel(alias))) {
      return poseKey;
    }
  }
  return null;
}

function buildLabelMap(labels: string[]): Record<string, PoseKey> {
  const map: Record<string, PoseKey> = {};
  const usedPoseKeys = new Set<PoseKey>();

  labels.forEach((label) => {
    const matched = matchModelLabel(label);
    if (matched && !usedPoseKeys.has(matched)) {
      map[label] = matched;
      usedPoseKeys.add(matched);
    }
  });

  const remainingPoseKeys = POSE_ORDER.filter((key) => !usedPoseKeys.has(key));
  let cursor = 0;
  labels.forEach((label) => {
    if (!map[label] && cursor < remainingPoseKeys.length) {
      map[label] = remainingPoseKeys[cursor];
      cursor += 1;
    }
  });

  return map;
}

function randomPose(previous?: PoseKey): PoseKey {
  const candidates = POSE_ORDER.filter((key) => key !== previous);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function createWallSlot(id: number, pose: PoseKey, x: number): WallSlot {
  return { id, pose, x };
}

function createInitialWall(): WallSlot[] {
  return [
    createWallSlot(1, randomPose(), CENTER_X - WALL_GAP * 2),
    createWallSlot(2, randomPose(), CENTER_X - WALL_GAP),
    createWallSlot(3, randomPose(), CENTER_X),
  ];
}

// ============================================
// SILHOUETTE COMPONENT
// ============================================
function Silhouette({ pose, active = false }: { pose: PoseKey; active?: boolean }) {
  return (
    <svg
      className={`silhouette ${active ? 'is-active' : ''}`}
      viewBox="0 0 160 220"
      role="img"
      aria-label={POSES[pose].label}
    >
      <g className="silhouette__person">
        <circle cx="80" cy="34" r="20" />

        {pose === 'Two hand' && (
          <>
            {/* แขนสองข้างยกขึ้นเหนือหัว (ท่า Y) */}
            <path d="M68 61 C55 46 46 33 38 18 L28 24 L48 68 C55 80 65 88 78 88 Z" />
            <path d="M92 61 C105 46 114 33 122 18 L132 24 L112 68 C105 80 95 88 82 88 Z" />
            <path d="M67 85 L52 125 L38 183 L55 186 L71 133 L89 133 L105 186 L122 183 L108 125 L93 85 Z" />
          </>
        )}

        {pose === 'one side' && (
          <>
            {/* แขนขวาเหยียดออกด้านข้าง แขนซ้ายแนบตัว ขาก้าวเยื้องไปด้านข้าง */}
            <path d="M72 63 C64 68 58 74 55 82 L62 90 C68 84 73 79 78 74 Z" />
            <path d="M88 57 C98 69 109 74 124 76 L141 64 L149 75 L126 95 C119 101 110 103 101 101 L85 93 Z" />
            <path d="M66 87 L58 118 L46 178 L63 181 L74 130 L86 130 L100 178 L117 178 L106 122 L96 87 Z" />
          </>
        )}

        {pose === 'one leg up' && (
          <>
            {/* แขนสองข้างกางออกเล็กน้อยเพื่อทรงตัว ขาข้างหนึ่งยกงอเข่าไปด้านหน้า */}
            <path d="M70 60 C60 66 52 70 42 72 L34 64 L40 74 L58 88 C63 92 69 93 75 91 Z" />
            <path d="M90 60 C100 66 108 70 118 72 L126 64 L120 74 L102 88 C97 92 91 93 85 91 Z" />
            <path d="M70 87 L62 130 L55 186 L72 186 L80 135 Z" />
            <path d="M88 87 L96 110 L118 108 L120 122 L98 128 L84 118 Z" />
          </>
        )}

        {pose === 'tree' && (
          <>
            {/* มือสองข้างประกบกันเหนือหัว ขาข้างหนึ่งยืนตรง อีกข้างงอเท้าพิงต้นขา (ท่าต้นไม้) */}
            <path d="M74 60 C70 44 68 30 68 14 L78 12 L82 58 Z" />
            <path d="M86 60 C90 44 92 30 92 14 L82 12 L78 58 Z" />
            <path d="M72 87 L66 130 L60 186 L77 186 L82 135 Z" />
            <path d="M88 87 L108 95 L116 82 L124 90 L112 106 L90 108 Z" />
          </>
        )}

        <path className="silhouette__body" d="M67 63 Q80 55 93 63 L99 103 Q80 115 61 103 Z" />
      </g>
      <text x="80" y="211" textAnchor="middle" className="silhouette__label">
        {POSES[pose].short}
      </text>
    </svg>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function PoseWallGame() {
  const webcamRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const predictionBusyRef = useRef(false);
  const wallRef = useRef<WallSlot[]>(createInitialWall());
  const nextWallIdRef = useRef(4);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const matchedRef = useRef(0);
  const startedAtRef = useRef(0);
  const gameOverRef = useRef(false);
  const currentTargetRef = useRef<PoseKey>(wallRef.current[2]?.pose ?? 'Two hand');
  const lastScoredWallIdRef = useRef<number | null>(null);
  const frameRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const nextParticleIdRef = useRef(1);
  const shakeRef = useRef(0);
  // FIX: เก็บผลจับคู่ "ชื่อ class จริงจากโมเดล" -> PoseKey ของเกม (สร้างครั้งเดียวตอนโหลดโมเดลเสร็จ)
  const labelToPoseRef = useRef<Record<string, PoseKey>>({});
  const poseToLabelRef = useRef<Partial<Record<PoseKey, string>>>({});

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [confidence, setConfidence] = useState(0);
  const [detectedPose, setDetectedPose] = useState<PoseKey | 'unknown'>('unknown');
  const [targetPose, setTargetPose] = useState<PoseKey>(currentTargetRef.current);
  const [message, setMessage] = useState('กด "เริ่มเกม" แล้วทำตามท่าบนกำแพง');
  const [modelClasses, setModelClasses] = useState<string[]>([]);
  const [flash, setFlash] = useState(false);
  const [lastPoints, setLastPoints] = useState<number | null>(null);
  const [wallSlots, setWallSlots] = useState<WallSlot[]>(() => createInitialWall());
  const [classScores, setClassScores] = useState<Record<string, number>>({});
  const [particleTick, setParticleTick] = useState(0);

  const targetInfo = POSES[targetPose];
  const detectedInfo = detectedPose !== 'unknown' ? POSES[detectedPose] : null;

  // เก็บ particleTick ไว้เผื่อ debug อ่าน state ปัจจุบัน (ไม่ได้ใช้โดยตรงในการ render)
  void particleTick;

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
  // INITIALIZE MODEL & CAMERA
  // ==========================================
  const loadModel = useCallback(async () => {
    if (modelRef.current && webcamRef.current) return;

    setLoading(true);
    setMessage('กำลังโหลด AI และเปิดกล้อง...');

    await loadScript('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js');
    await loadScript(
      'https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8.3/dist/teachablemachine-pose.min.js'
    );

    const tmPose = window.tmPose;
    const modelURL = `${MODEL_URL}model.json`;
    const metadataURL = `${MODEL_URL}metadata.json`;

    const model = await tmPose.load(modelURL, metadataURL);
    const webcam = new tmPose.Webcam(CAMERA_SIZE, CAMERA_SIZE, true);

    await webcam.setup();
    await webcam.play();

    modelRef.current = model;
    webcamRef.current = webcam;

    // FIX: ดึง "ชื่อ class จริง" จากโมเดลแทนการสร้างชื่อปลอม "Class 1/2/3" แล้วจับคู่กับ PoseKey
    let labels: string[] = [];
    try {
      if (typeof model.getClassLabels === 'function') {
        labels = model.getClassLabels();
      } else if (typeof model.getTotalClasses === 'function') {
        labels = Array.from({ length: model.getTotalClasses() }, (_, i) => `Class ${i + 1}`);
      }
    } catch {
      labels = [];
    }

    if (labels.length !== POSE_ORDER.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `โมเดลมี ${labels.length} class แต่เกมนี้ออกแบบไว้สำหรับ 4 ท่า (Two hand, one side, one leg up, tree) ` +
          'บางท่าอาจตรวจจับไม่ได้จนกว่าจะแก้โมเดลหรือ POSE_ORDER ให้ตรงกัน'
      );
    }

    const map = buildLabelMap(labels);
    labelToPoseRef.current = map;
    const reverse: Partial<Record<PoseKey, string>> = {};
    Object.entries(map).forEach(([label, poseKey]) => {
      reverse[poseKey] = label;
    });
    poseToLabelRef.current = reverse;

    setModelClasses(labels);
    setReady(true);
    setLoading(false);
    setMessage('พร้อมแล้ว! กดเริ่มเกม');

    if (canvasRef.current) {
      canvasRef.current.width = CAMERA_SIZE;
      canvasRef.current.height = CAMERA_SIZE;
    }
  }, []);

  // ==========================================
  // GAME CONTROL
  // ==========================================
  const resetWall = useCallback(() => {
    const wall = createInitialWall();
    wallRef.current = wall;
    nextWallIdRef.current = 4;
    setWallSlots(wall);
    currentTargetRef.current = wall[2]?.pose ?? 'Two hand';
    setTargetPose(currentTargetRef.current);
    lastScoredWallIdRef.current = null;
  }, []);

  const resetGame = useCallback(() => {
    scoreRef.current = 0;
    comboRef.current = 0;
    matchedRef.current = 0;
    gameOverRef.current = false;
    startedAtRef.current = performance.now();
    frameRef.current = 0;
    particlesRef.current = [];
    nextParticleIdRef.current = 1;
    shakeRef.current = 0;
    setScore(0);
    setCombo(0);
    setTimeLeft(GAME_SECONDS);
    setGameOver(false);
    setLastPoints(null);
    setFlash(false);
    setMessage('กำแพงกำลังเข้ามา เตรียมทำตาม silhouette!');
    setDetectedPose('unknown');
    resetWall();
  }, [resetWall]);

  const startGame = useCallback(async () => {
    try {
      if (!ready) await loadModel();
      resetGame();
      setRunning(true);
      setMessage('เริ่ม! ทำท่าให้ตรงกับกำแพง');
    } catch (error) {
      console.error(error);
      setLoading(false);
      setMessage('เปิดกล้องหรือโหลดโมเดลไม่ได้ กรุณาตรวจสอบ MODEL_URL และสิทธิ์กล้อง');
    }
  }, [loadModel, ready, resetGame]);

  const restartGame = useCallback(() => {
    resetGame();
    setRunning(true);
    setMessage('เริ่มใหม่! ทำท่าให้ตรงกับกำแพง');
  }, [resetGame]);

  const stopGame = useCallback(() => {
    setRunning(false);
    gameOverRef.current = true;
    setGameOver(true);
    setMessage(`จบเกม! ทำสำเร็จ ${matchedRef.current} ครั้ง`);
  }, []);

  // ==========================================
  // SCORING
  // ==========================================
  const addParticles = useCallback((x: number, y: number, color: string) => {
    for (let i = 0; i < 24; i += 1) {
      particlesRef.current.push({
        id: nextParticleIdRef.current++,
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1,
        color,
        size: Math.random() * 8 + 2,
      });
    }
  }, []);

  const scoreHit = useCallback(
    (wall: WallSlot, hitConfidence: number) => {
      if (lastScoredWallIdRef.current === wall.id) return;

      const perfect = hitConfidence >= 0.92;
      const basePoints = POSES[wall.pose].points;
      const comboBonus = Math.min(comboRef.current * 10, 100);
      const points = basePoints + comboBonus + (perfect ? 50 : 0);

      lastScoredWallIdRef.current = wall.id;
      scoreRef.current += points;
      comboRef.current += 1;
      matchedRef.current += 1;

      setScore(scoreRef.current);
      setCombo(comboRef.current);
      setLastPoints(points);
      setFlash(true);
      setMessage(perfect ? `PERFECT! +${points}` : `ตรงท่า! +${points}`);
      addParticles(400, 200, POSES[wall.pose].accent);
      shakeRef.current = 6;

      window.setTimeout(() => setFlash(false), 250);
    },
    [addParticles]
  );

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
      webcam.update();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, CAMERA_SIZE, CAMERA_SIZE);
        ctx.drawImage(webcam.canvas, 0, 0);
      }

      const { pose, posenetOutput } = await model.estimatePose(webcam.canvas);
      const predictions = await model.predict(posenetOutput);

      if (ctx && pose) {
        window.tmPose.drawKeypoints(pose.keypoints, 0.5, ctx);
        window.tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
      }

      if (!predictions || predictions.length === 0) return;

      // อัปเดตความมั่นใจของ "ชื่อ class จริง" ทุกตัว (ใช้แสดงผลใน UI)
      const scores: Record<string, number> = {};
      predictions.forEach((p: any) => {
        scores[p.className] = p.probability;
      });
      setClassScores(scores);

      let best = predictions[0];
      for (let i = 1; i < predictions.length; i += 1) {
        if (predictions[i].probability > best.probability) best = predictions[i];
      }

      // FIX: ใช้ตารางที่จับคู่ไว้ตอนโหลดโมเดล (แม่นยำกว่าการเดาชื่อ alias สดๆ ทุกเฟรม)
      const fromMap = labelToPoseRef.current[best.className];
      const mapped: PoseKey | null = fromMap ?? matchModelLabel(best.className);
      const nextConfidence = best.probability;
      setConfidence(nextConfidence);

      if (nextConfidence >= CONFIDENCE_LIMIT && mapped) {
        setDetectedPose(mapped);

        if (mapped === currentTargetRef.current) {
          const target = wallRef.current.find(
            (slot) =>
              slot.pose === currentTargetRef.current && Math.abs(slot.x - CENTER_X) < HIT_ZONE
          );
          if (target) scoreHit(target, nextConfidence);
        } else {
          comboRef.current = 0;
          setCombo(0);
          setMessage(`กำแพงบอกท่า: ${POSES[currentTargetRef.current].label}`);
        }
      } else {
        setDetectedPose('unknown');
        setMessage('ยังจับท่าไม่ชัด ลองอยู่เต็มตัวในกล้อง');
      }
    } finally {
      predictionBusyRef.current = false;
    }
  }, [running, scoreHit]);

  // ==========================================
  // WALL MOVEMENT
  // ==========================================
  const advanceWall = useCallback((dt: number = 1) => {
    for (let i = 0; i < wallRef.current.length; i += 1) {
      wallRef.current[i].x += WALL_SPEED * dt;
    }

    const passed = wallRef.current.find((slot) => slot.x > TARGET_DISTANCE);
    if (passed) {
      const nextPose = randomPose(wallRef.current[wallRef.current.length - 1]?.pose);
      const lastX = wallRef.current[wallRef.current.length - 1]?.x ?? TARGET_DISTANCE;
      const nextX = lastX - WALL_GAP;
      const nextId = nextWallIdRef.current++;
      wallRef.current = [
        ...wallRef.current.filter((slot) => slot.id !== passed.id),
        createWallSlot(nextId, nextPose, nextX),
      ];
    }

    setWallSlots([...wallRef.current]);

    const target =
      wallRef.current.find(
        (slot) => slot.x > CENTER_X - HIT_ZONE && slot.x < CENTER_X + HIT_ZONE
      ) ?? wallRef.current[1];
    if (target && target.pose !== currentTargetRef.current) {
      currentTargetRef.current = target.pose;
      setTargetPose(target.pose);
      lastScoredWallIdRef.current = null;
    }
  }, []);

  // ==========================================
  // GAME LOOP
  // FIX: เดิมใช้ requestAnimationFrame(gameLoop) เรียกตัวเองซ้ำจากใน event handler
  // (startGame / ปุ่มเริ่มใหม่) ซึ่งฟังก์ชัน gameLoop ที่ถูกอ้างถึงตอนนั้นยังจำค่า
  // running = false จากตอนสร้างคอมโพเนนต์ครั้งแรก (stale closure) ทำให้ลูปเกม
  // ทำงานแค่เฟรมเดียวแล้วหยุดไปเฉยๆ (กำแพงไม่ขยับ, เวลาไม่นับถอยหลัง)
  // แก้โดยย้ายลูปทั้งหมดไปอยู่ใน useEffect ที่ผูกกับ state `running` โดยตรง
  // เหมือนกับ useEffect ของ predictPose ด้านล่าง และเพิ่ม delta-time (dt)
  // เพื่อให้ความเร็วกำแพงคงที่ไม่ว่าจอจะรีเฟรชกี่ Hz ก็ตาม
  // ==========================================
  useEffect(() => {
    if (!running) return undefined;

    let raf = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      if (gameOverRef.current) return;

      const dt = Math.min(2, (now - lastTime) / (1000 / 60));
      lastTime = now;

      frameRef.current += 1;
      const elapsed = (now - startedAtRef.current) / 1000;
      const remaining = Math.max(0, Math.ceil(GAME_SECONDS - elapsed));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        stopGame();
        return;
      }

      advanceWall(dt);

      const particles = particlesRef.current;
      let particlesChanged = false;
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        particles[i].x += particles[i].vx * dt;
        particles[i].y += particles[i].vy * dt;
        particles[i].life -= 0.025 * dt;
        if (particles[i].life <= 0) {
          particles.splice(i, 1);
        }
        particlesChanged = true;
      }
      if (particlesChanged) setParticleTick((t) => t + 1);

      if (shakeRef.current > 0) {
        shakeRef.current *= Math.pow(0.9, dt);
        if (shakeRef.current < 0.5) shakeRef.current = 0;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, advanceWall, stopGame]);

  // ==========================================
  // PREDICTION LOOP
  // ==========================================
  useEffect(() => {
    if (!running || gameOverRef.current) return undefined;
    let active = true;
    let timer = 0;

    const runPrediction = async () => {
      if (!active) return;
      await predictPose();
      timer = window.setTimeout(runPrediction, 120);
    };

    timer = window.setTimeout(runPrediction, 50);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [predictPose, running]);

  // ==========================================
  // CLEANUP
  // ==========================================
  useEffect(() => {
    return () => {
      try {
        webcamRef.current?.stop?.();
      } catch {
        // เพิกเฉยได้ — แค่พยายามปิดกล้องให้เรียบร้อยตอน unmount
      }
      webcamRef.current = null;
      modelRef.current = null;
    };
  }, []);

  // ==========================================
  // RENDER HELPERS
  // ==========================================
  const wallStyle = (x: number): CSSProperties => ({
    transform: `translateX(${x}px)`,
    transition: 'transform 80ms linear',
  });

  const statusTone = gameOver ? 'danger' : detectedPose === targetPose ? 'success' : 'neutral';

  return (
    <div className={`pose-game ${flash ? 'pose-game--flash' : ''}`}>
      <style>{`
        .pose-game, .pose-game * { box-sizing: border-box; }
        .pose-game {
          min-height: 100vh;
          padding: 28px;
          color: #15131a;
          background:
            radial-gradient(circle at 15% 10%, rgba(255,255,255,.95), transparent 34%),
            linear-gradient(135deg, #e7ecff 0%, #ffe8f3 48%, #e9fff6 100%);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        .pose-game--flash { animation: screenFlash .25s ease; }
        @keyframes screenFlash { 0%,100% { filter: brightness(1); } 50% { filter: brightness(1.14); } }
        .shell { max-width: 1380px; margin: 0 auto; }
        .topbar {
          display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 18px;
          padding: 18px 20px; border: 1px solid rgba(255,255,255,.72); border-radius: 26px;
          background: rgba(255,255,255,.67); backdrop-filter: blur(16px); box-shadow: 0 16px 50px rgba(54,40,90,.12);
        }
        .brand { display:flex; gap: 13px; align-items:center; }
        .logo { width: 48px; height: 48px; border-radius: 16px; display:grid; place-items:center; font-size: 25px; background:#18151f; color:white; box-shadow: 0 8px 20px rgba(24,21,31,.2); }
        h1 { margin:0; font-size: clamp(22px, 3vw, 34px); letter-spacing:-.03em; }
        .subtitle { margin: 3px 0 0; color:#6d6678; font-size:14px; }
        .controls { display:flex; gap:10px; flex-wrap:wrap; }
        button { border:0; cursor:pointer; border-radius: 14px; padding: 12px 16px; font-weight: 800; font-size:14px; transition:.18s transform, .18s box-shadow, .18s opacity; }
        button:hover { transform: translateY(-2px); }
        button:disabled { cursor: not-allowed; opacity:.55; transform:none; }
        .btn-primary { color:white; background:#18151f; box-shadow: 0 10px 20px rgba(24,21,31,.18); }
        .btn-secondary { color:#18151f; background:white; box-shadow: 0 8px 20px rgba(24,21,31,.08); }
        .stats { display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
        .stat { background: rgba(255,255,255,.72); border:1px solid rgba(255,255,255,.7); border-radius:20px; padding:14px 16px; box-shadow:0 10px 28px rgba(54,40,90,.08); }
        .stat small { display:block; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#81798d; margin-bottom:4px; }
        .stat strong { font-size:28px; letter-spacing:-.04em; }
        .content { display:grid; grid-template-columns: 390px minmax(0,1fr); gap:18px; }
        .panel { border:1px solid rgba(255,255,255,.78); background:rgba(255,255,255,.73); backdrop-filter: blur(18px); box-shadow:0 16px 50px rgba(54,40,90,.11); border-radius:26px; padding:18px; }
        .panel h2 { margin:0 0 12px; font-size:16px; }
        .camera-frame { position:relative; overflow:hidden; border-radius:22px; background:#0f0c14; aspect-ratio:1; }
        .camera-frame canvas { width:100%; height:100%; display:block; object-fit:cover; transform:scaleX(-1); }
        .camera-badge { position:absolute; top:12px; left:12px; padding:7px 10px; background:rgba(0,0,0,.55); color:white; border-radius:999px; font-size:11px; font-weight:800; backdrop-filter:blur(8px); }
        .detect-card { margin-top:12px; border-radius:19px; padding:14px; background:#f7f5f8; }
        .detect-row { display:flex; justify-content:space-between; align-items:center; gap:12px; }
        .pose-chip { display:inline-flex; align-items:center; gap:7px; padding:8px 11px; border-radius:999px; background:white; font-weight:900; box-shadow:0 4px 14px rgba(0,0,0,.06); }
        .dot { width:9px; height:9px; border-radius:999px; background:currentColor; }
        .confidence { margin-top:10px; height:8px; background:#ded9e4; border-radius:999px; overflow:hidden; }
        .confidence > i { display:block; height:100%; border-radius:999px; background:linear-gradient(90deg,#4CAF50,#FF9800,#9C27B0,#2196F3); transition: width .15s ease; }
        .model-note { margin-top:12px; padding:11px 12px; border-radius:15px; background:#fff; color:#6e6777; font-size:12px; line-height:1.5; }
        .game-panel { min-width:0; }
        .game-stage { position:relative; min-height:610px; overflow:hidden; border-radius:26px; background:linear-gradient(180deg, #191622 0 22%, #272231 22% 100%); border: 7px solid #f5f0f7; box-shadow: inset 0 0 0 1px rgba(255,255,255,.08); }
        .stage-lights { position:absolute; inset:0 0 auto; height:24%; background: repeating-linear-gradient(90deg, rgba(255,255,255,.14) 0 16px, transparent 16px 55px); opacity:.35; }
        .stage-lights::after { content:""; position:absolute; inset:-40% 0 0; background:radial-gradient(circle at 8% 20%, rgba(76,175,80,.42), transparent 20%), radial-gradient(circle at 50% 0%, rgba(255,152,0,.35), transparent 22%), radial-gradient(circle at 92% 24%, rgba(156,39,176,.38), transparent 20%); }
        .floor { position:absolute; left:-5%; right:-5%; bottom:-15px; height:38%; transform:perspective(650px) rotateX(48deg); transform-origin:bottom; background:repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 2px, transparent 2px 90px), linear-gradient(180deg,#413851,#1a1721); }
        .wall-area { position:absolute; top:64px; left:0; right:0; height:390px; display:flex; align-items:center; justify-content:center; }
        .wall-frame { position:relative; width:min(880px,92%); height:330px; border:10px solid #ece6f3; border-radius:12px; background:linear-gradient(180deg,#df657e,#cf4765); box-shadow:0 20px 45px rgba(0,0,0,.28), inset 0 0 0 5px rgba(255,255,255,.12); overflow:hidden; }
        .wall-grid { position:absolute; inset:0; opacity:.3; background:linear-gradient(rgba(255,255,255,.14) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.14) 1px, transparent 1px); background-size:44px 44px; }
        .wall-holes { position:absolute; inset:22px 20px; overflow:hidden; }
        .wall-slot { position:absolute; top:8px; width:235px; height:290px; display:grid; place-items:center; animation: slotFloat 1.7s ease-in-out infinite; }
        .wall-slot::before { content:""; position:absolute; inset:0; border-radius:18px; background:rgba(79,15,30,.28); border:3px dashed rgba(255,255,255,.18); box-shadow: inset 0 0 25px rgba(0,0,0,.16); }
        .wall-slot--target::before { border-color:rgba(255,255,255,.7); box-shadow: inset 0 0 30px rgba(0,0,0,.15), 0 0 0 4px rgba(255,255,255,.12); }
        .wall-label { position:absolute; bottom:7px; left:12px; right:12px; text-align:center; color:#fff; font-size:11px; font-weight:900; letter-spacing:.12em; opacity:.8; }
        @keyframes slotFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        .silhouette { position:relative; z-index:2; width:190px; height:260px; filter: drop-shadow(0 8px 10px rgba(0,0,0,.2)); }
        .silhouette__person { fill:#18121a; transition:.25s; }
        .silhouette__body { opacity:.96; }
        .silhouette__label { fill:#fff; font-size:14px; font-weight:900; letter-spacing:2px; opacity:.8; }
        .wall-slot--target .silhouette__person { fill:#140f17; }
        .wall-slot--target .silhouette { transform:scale(1.03); }
        .target-banner { position:absolute; top:20px; left:50%; transform:translateX(-50%); z-index:10; padding:9px 16px; border-radius:999px; background:rgba(255,255,255,.93); color:#17131d; font-weight:900; box-shadow:0 10px 28px rgba(0,0,0,.18); }
        .stage-center-line { position:absolute; left:50%; bottom:86px; transform:translateX(-50%); width:5px; height:150px; background:linear-gradient(180deg, transparent, rgba(255,255,255,.7), transparent); box-shadow:0 0 25px rgba(255,255,255,.25); }
        .player-zone { position:absolute; left:50%; bottom:66px; transform:translateX(-50%); width:250px; text-align:center; color:white; z-index:9; }
        .player-ring { width:150px; height:150px; margin:0 auto -12px; border:2px solid rgba(255,255,255,.5); border-radius:50%; box-shadow:0 0 0 14px rgba(255,255,255,.04), 0 0 40px rgba(255,255,255,.14); animation:ringPulse 1.35s ease-in-out infinite; }
        @keyframes ringPulse { 0%,100%{transform:scale(.98);opacity:.65} 50%{transform:scale(1.03);opacity:1} }
        .target-card { margin:0 auto; width:210px; padding:11px 14px; border-radius:18px; background:rgba(18,15,23,.78); backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,.15); }
        .target-card small { display:block; color:#bcb2c8; font-size:10px; font-weight:800; letter-spacing:.14em; }
        .target-card strong { display:block; margin-top:3px; font-size:24px; color:white; }
        .stage-overlay { position:absolute; inset:0; pointer-events:none; }
        .message-pill { position:absolute; left:50%; bottom:20px; transform:translateX(-50%); min-width:290px; max-width:80%; padding:10px 15px; border-radius:999px; background:rgba(14,12,17,.78); color:white; text-align:center; font-weight:800; font-size:13px; backdrop-filter:blur(14px); z-index:15; }
        .big-points { position:absolute; left:50%; top:46%; transform:translate(-50%,-50%); color:white; font-weight:1000; font-size:50px; text-shadow:0 8px 30px rgba(0,0,0,.3); z-index:30; animation:popPoints .7s ease forwards; }
        @keyframes popPoints { 0%{opacity:0;transform:translate(-50%,-20%) scale(.6)} 20%{opacity:1;transform:translate(-50%,-50%) scale(1.06)} 100%{opacity:0;transform:translate(-50%,-90%) scale(1)} }
        .game-over { position:absolute; inset:0; z-index:40; display:grid; place-items:center; background:rgba(11,8,16,.76); backdrop-filter:blur(10px); }
        .game-over-card { text-align:center; width:min(440px,86%); padding:28px; border-radius:26px; color:white; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.18); box-shadow:0 25px 80px rgba(0,0,0,.35); }
        .game-over-card h3 { margin:0 0 8px; font-size:42px; letter-spacing:-.05em; }
        .result-score { font-size:62px; font-weight:1000; margin:8px 0 18px; }
        .legend { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-top:14px; }
        .legend-item { display:flex; align-items:center; gap:7px; padding:9px 10px; border-radius:13px; background:rgba(255,255,255,.58); font-size:11px; font-weight:800; }
        .legend-dot { width:9px; height:9px; border-radius:50%; flex:0 0 auto; }
        .status-line { margin-top:12px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 12px; border-radius:14px; background:#fff; }
        .status-dot { width:10px; height:10px; border-radius:50%; background:#9d96a9; }
        .status-dot.success { background:#4CAF50; box-shadow:0 0 0 5px rgba(76,175,80,.13); }
        .status-dot.danger { background:#ff477e; }
        .status-text { font-size:12px; font-weight:800; color:#655e6e; }
        .class-scores { margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .class-score { padding:6px 8px; border-radius:8px; background:rgba(255,255,255,.5); font-size:11px; font-weight:700; display:flex; justify-content:space-between; }
        .particle { position:absolute; border-radius:50%; pointer-events:none; z-index:25; }
        @media (max-width: 980px) { .content { grid-template-columns:1fr; } .game-stage { min-height:560px; } }
        @media (max-width: 620px) { .pose-game { padding:12px; } .topbar { flex-direction:column; align-items:stretch; } .stats { grid-template-columns:repeat(2,1fr); } .legend { grid-template-columns:repeat(2,1fr); } .wall-frame { height:300px; } .wall-slot { width:190px; } .silhouette { width:158px; height:220px; } .game-stage { min-height:520px; } }
      `}</style>

      <div className="shell">
        {/* HEADER */}
        <header className="topbar">
          <div className="brand">
            <div className="logo">🧱</div>
            <div>
              <h1>กำแพงซ่า - Pose Challenge</h1>
              <p className="subtitle">เกมเลียนแบบท่าจากกำแพง ด้วย AI Pose Detection</p>
            </div>
          </div>
          <div className="controls">
            <button
              className="btn-primary"
              type="button"
              onClick={startGame}
              disabled={loading || running}
            >
              {loading ? '⏳ กำลังโหลด AI…' : running ? '🎮 กำลังเล่น' : '🎮 เริ่มเกม'}
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={restartGame}
              disabled={!ready}
            >
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
            <strong>×{combo}</strong>
          </div>
          <div className="stat">
            <small>Time</small>
            <strong>{timeLeft}s</strong>
          </div>
          <div className="stat">
            <small>Target</small>
            <strong>
              {targetInfo.icon} {targetInfo.short}
            </strong>
          </div>
        </section>

        {/* MAIN CONTENT */}
        <main className="content">
          {/* LEFT: CAMERA PANEL */}
          <aside className="panel">
            <h2>📷 กล้องตรวจจับท่าทาง</h2>
            <div className="camera-frame">
              <canvas ref={canvasRef} />
              <div className="camera-badge">AI CAMERA</div>
            </div>

            <div className="detect-card">
              <div className="detect-row">
                <div>
                  <div style={{ fontSize: 11, color: '#82798c', fontWeight: 800 }}>ตรวจพบ</div>
                  <div className="pose-chip">
                    <span className="dot" style={{ color: detectedInfo?.accent ?? '#9d96a9' }} />
                    {detectedInfo?.label ?? 'ยังไม่พบ'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#82798c', fontWeight: 800 }}>Confidence</div>
                  <strong style={{ fontSize: 20 }}>{Math.round(confidence * 100)}%</strong>
                </div>
              </div>
              <div className="confidence">
                <i style={{ width: `${Math.min(confidence * 100, 100)}%` }} />
              </div>
            </div>

            <div className="status-line">
              <span className={`status-dot ${statusTone}`} />
              <span className="status-text">{message}</span>
            </div>

            {/* Class Scores — อ่านค่าจริงจาก classScores ผ่านตาราง poseToLabelRef ที่จับคู่ไว้ตอนโหลดโมเดล */}
            <div className="class-scores">
              {POSE_ORDER.map((key) => {
                const realLabel = poseToLabelRef.current[key];
                const prob = realLabel ? classScores[realLabel] ?? 0 : 0;
                return (
                  <div
                    key={key}
                    className="class-score"
                    style={{
                      background: detectedPose === key ? `${POSES[key].color}30` : 'rgba(255,255,255,.5)',
                      border:
                        detectedPose === key ? `2px solid ${POSES[key].color}` : '2px solid transparent',
                    }}
                  >
                    <span>
                      {POSES[key].icon} {POSES[key].label}
                    </span>
                    <span>{(prob * 100).toFixed(0)}%</span>
                  </div>
                );
              })}
            </div>

            <div className="model-note">
              <strong>4 ท่าที่ใช้ในเกม</strong>
              <br />
              🙌 ยกสองมือ · 🤾 เอียงข้าง · 🦩 ยกขาข้างเดียว · 🌳 ท่าต้นไม้
              <br />
              <br />
              ความมั่นใจขั้นต่ำ: {Math.round(CONFIDENCE_LIMIT * 100)}%
              {modelClasses.length > 0 && (
                <>
                  <br />
                  class จากโมเดล ({modelClasses.length}): {modelClasses.join(', ')}
                </>
              )}
            </div>
          </aside>

          {/* RIGHT: GAME PANEL */}
          <section className="panel game-panel">
            <h2>🎮 กำแพงท่าโพส</h2>
            <div className="game-stage">
              <div className="stage-lights" />
              <div className="floor" />

              {/* WALLS */}
              <div className="wall-area">
                <div className="wall-frame">
                  <div className="wall-grid" />
                  <div className="target-banner">ทำตามท่าที่กำลังเข้าจุดกลาง</div>
                  <div className="wall-holes">
                    {wallSlots.map((slot) => {
                      const isTarget =
                        slot.pose === targetPose && Math.abs(slot.x - CENTER_X) < HIT_ZONE;
                      return (
                        <div
                          key={slot.id}
                          className={`wall-slot ${isTarget ? 'wall-slot--target' : ''}`}
                          style={wallStyle(slot.x)}
                        >
                          <Silhouette pose={slot.pose} active={isTarget} />
                          <div className="wall-label">{POSES[slot.pose].label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CENTER LINE */}
              <div className="stage-center-line" />

              {/* PLAYER ZONE */}
              <div className="player-zone">
                <div className="player-ring" />
                <div className="target-card">
                  <small>ท่าที่ต้องทำ</small>
                  <strong>
                    {targetInfo.icon} {targetInfo.label}
                  </strong>
                </div>
              </div>

              {/* PARTICLES */}
              {particlesRef.current.map((p) => (
                <div
                  key={p.id}
                  className="particle"
                  style={{
                    left: p.x,
                    top: p.y,
                    width: p.size,
                    height: p.size,
                    background: p.color,
                    opacity: p.life,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              ))}

              {/* POINTS POPUP */}
              {lastPoints !== null && (
                <div key={`${lastPoints}-${score}`} className="big-points">
                  +{lastPoints}
                </div>
              )}

              {/* MESSAGE PILL */}
              {!gameOver && <div className="message-pill">{message}</div>}

              {/* GAME OVER OVERLAY */}
              {gameOver && (
                <div className="game-over">
                  <div className="game-over-card">
                    <h3>GAME OVER</h3>
                    <div style={{ opacity: 0.7, fontWeight: 700 }}>คะแนนรวม</div>
                    <div className="result-score">{score.toLocaleString()}</div>
                    <div style={{ marginBottom: 18, opacity: 0.78 }}>
                      ทำสำเร็จ {matchedRef.current} ครั้ง · คอมโบสูงสุด ×{combo}
                    </div>
                    <button className="btn-primary" type="button" onClick={restartGame}>
                      เล่นอีกครั้ง
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* LEGEND */}
            <div className="legend">
              {POSE_ORDER.map((key) => (
                <div className="legend-item" key={key}>
                  <span className="legend-dot" style={{ background: POSES[key].accent }} />
                  {POSES[key].icon} {POSES[key].label}
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}