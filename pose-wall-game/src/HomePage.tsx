import { useCallback, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion';
import type { MotionValue } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Brain,
  Camera,
  ChevronDown,
  Flame,
  Heart,
  Image as ImageIcon,
  Lightbulb,
  Maximize,
  Orbit,
  PersonStanding,
  Shirt,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { POSES, POSE_ORDER, Silhouette } from './poseData';
import { MagicCircle, MagicGate, MagicVisualStyles } from './magicVisuals';

interface HomePageProps {
  onStart: () => void;
}

/** Scroll height each pinned chapter occupies, in vh. */
const CHAPTER_VH = 88;

const STEPS = [
  {
    n: '01',
    kicker: 'THE THRESHOLD',
    title: 'เตรียมพื้นที่ให้พร้อม',
    desc: 'ยืนห่างจากกล้องประมาณ 1.5–2 เมตร ในที่ที่มีแสงสว่างเพียงพอ และมีพื้นที่โล่งพอให้ขยับแขนขาได้เต็มที่',
    Icon: Maximize,
    color: '#7fb0ff',
  },
  {
    n: '02',
    kicker: 'THE EYE',
    title: 'อนุญาตให้ใช้กล้อง',
    desc: 'กดปุ่ม "เข้าสู่หอคาถา" แล้วอนุญาตให้เว็บไซต์เข้าถึงกล้องของคุณ',
    Icon: Camera,
    color: '#67e8f9',
  },
  {
    n: '03',
    kicker: 'THE GRIMOIRE',
    title: 'จดจำคาถาทั้ง 4',
    desc: 'ประตูเวทมนตร์แต่ละบานต้องการท่าทางที่ต่างกัน เลื่อนดูแกลเลอรีคาถาด้านล่างเพื่อฝึกท่าไว้ล่วงหน้า ก่อนที่ประตูบานแรกจะเคลื่อนมาถึง',
    Icon: BookOpen,
    color: '#a78bfa',
  },
  {
    n: '04',
    kicker: 'THE CASTING',
    title: 'ร่ายท่าให้ตรงจังหวะ',
    desc: 'เมื่อประตูเวทมนตร์เคลื่อนมาถึงเส้นล็อกกลางจอ ให้ทำท่าที่ตรงกับช่องว่างให้ทันที',
    Icon: WandSparkles,
    color: '#f0d9a0',
  },
  {
    n: '05',
    kicker: 'THE TOLL',
    title: 'รักษาคอมโบและพลังชีวิต',
    desc: 'ร่ายถูกต่อเนื่องจะได้โบนัสคอมโบทวีคูณคะแนน แต่ถ้าร่ายผิด 3 ครั้งจะโดนมนตร์สะท้อนจนหมดพลัง และประตูจะปิดลงตลอดกาล',
    Icon: Heart,
    color: '#7fb0ff',
  },
];

const FEATURES = [
  {
    Icon: Brain,
    title: 'AI ตรวจจับท่าทางเรียลไทม์',
    desc: 'ขับเคลื่อนด้วย Teachable Machine และ TensorFlow.js ตรวจจับท่าทางผ่านกล้องเว็บแบบสด ไม่ต้องติดตั้งเซนเซอร์เพิ่ม',
  },
  {
    Icon: Flame,
    title: 'ระบบคอมโบและคะแนนโบนัส',
    desc: 'ยิ่งร่ายคาถาต่อเนื่องแม่นยำเท่าไร ยิ่งได้ตัวคูณคะแนนสูงขึ้น พร้อมโบนัส "PERFECT" สำหรับท่าที่แม่นยำที่สุด',
  },
  {
    Icon: Orbit,
    title: 'ประตูเวทมนตร์ 4 รูปแบบ',
    desc: 'แต่ละประตูมีสัญลักษณ์และท่วงท่าเฉพาะตัว ความเร็วในการเข้ามาจะเพิ่มขึ้นเรื่อย ๆ ตามจังหวะเกม',
  },
];

const TIPS = [
  { Icon: Lightbulb, title: 'แสงสว่างเพียงพอ', desc: 'หลีกเลี่ยงห้องมืดหรือแสงย้อน จะช่วยให้ AI ตรวจจับท่าทางได้แม่นยำขึ้น' },
  { Icon: ImageIcon, title: 'พื้นหลังโล่ง', desc: 'เลือกพื้นหลังที่ไม่รก ลดสิ่งกีดขวางที่อาจรบกวนการตรวจจับ' },
  { Icon: PersonStanding, title: 'เห็นทั้งตัว', desc: 'เว้นระยะห่างจากกล้องให้เห็นตั้งแต่ศีรษะถึงเท้า' },
  { Icon: Shirt, title: 'ขยับตัวสะดวก', desc: 'สวมใส่เสื้อผ้าที่เคลื่อนไหวง่าย เพื่อร่ายท่าคาถาได้เต็มที่' },
];

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Blur-to-sharp entrance used throughout the page. */
function Reveal({
  children,
  delay = 0,
  y = 26,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-12% 0px -12% 0px' }}
      transition={{ duration: 0.85, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Owns `navSolid` itself so the scroll listener that flips it doesn't
 * re-render the rest of the page (spells gallery, features, tips, ...).
 */
function Nav({ scrollY, onEnterGate }: { scrollY: MotionValue<number>; onEnterGate: () => void }) {
  const [navSolid, setNavSolid] = useState(false);
  useMotionValueEvent(scrollY, 'change', (v) => {
    const next = v > 24;
    setNavSolid((prev) => (prev === next ? prev : next));
  });

  return (
    <nav className={`hp-nav ${navSolid ? 'is-solid' : ''}`}>
      <div className="hp-brand">
        <Sparkles size={17} strokeWidth={1.5} />
        Arcane Gate
      </div>
      <div className="hp-navlinks">
        <a href="#how-to-play">วิธีเล่น</a>
        <a href="#spells">คาถาทั้ง 4</a>
        <a href="#features">เกี่ยวกับเกม</a>
      </div>
      <button className="hp-btn hp-btn-ghost" onClick={onEnterGate}>
        เข้าสู่หอคาถา
        <ArrowRight size={15} strokeWidth={1.6} />
      </button>
    </nav>
  );
}

/**
 * Owns `step` (and the scroll-linked target it derives from) itself so
 * scrubbing through the 5 steps only re-renders this pinned chapter, not
 * the whole page.
 */
function HowToPlaySection() {
  const howRef = useRef<HTMLElement | null>(null);

  const { scrollYProgress: howP } = useScroll({
    target: howRef,
    offset: ['start start', 'end end'],
  });
  const [step, setStep] = useState(0);
  useMotionValueEvent(howP, 'change', (v) => {
    const i = Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)));
    setStep((prev) => (prev === i ? prev : i));
  });
  const stageScale = useTransform(howP, [0, 1], [0.84, 1.16]);
  const stageSpin = useTransform(howP, [0, 1], [-24, 24]);
  const railFill = useTransform(howP, [0, 1], ['0%', '100%']);

  const active = STEPS[step];

  const goToStep = useCallback((i: number) => {
    const el = howRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const travel = el.offsetHeight - window.innerHeight;
    window.scrollTo({ top: top + travel * ((i + 0.5) / STEPS.length), behavior: 'smooth' });
  }, []);

  return (
    <section
      className="hp-how"
      id="how-to-play"
      ref={howRef}
      style={{ height: `${STEPS.length * CHAPTER_VH}vh` }}
    >
      <div className="hp-stage">
        <motion.div className="hp-stage-art" style={{ scale: stageScale, rotate: stageSpin }}>
          <div
            className="hp-stage-halo"
            style={{ background: `radial-gradient(circle, ${active.color}38, transparent 68%)` }}
          />
          <MagicCircle className="hp-stage-circle" size="min(88vmin, 720px)" color={active.color} spin={66} opacity={0.4} />
          <MagicCircle className="hp-stage-circle" size="min(52vmin, 430px)" color={active.color} spin={44} opacity={0.28} runes={false} />
        </motion.div>

        <div className="hp-stage-art">
          <MagicGate
            className="hp-stage-gate"
            width="min(40vmin, 330px)"
            color={active.color}
            intensity={0.34 + (step / (STEPS.length - 1)) * 0.66}
          />
        </div>

        <div className="hp-stage-veil" />

        <div className="hp-ghost-num">{active.n}</div>

        <div className="hp-stage-inner">
          <div className="hp-stage-head">
            <div className="hp-kicker is-th">
              วิธีเล่น <span className="hp-kicker-en">How to Play</span>
            </div>
            <div className="hp-stage-count">
              <b>{active.n}</b> / {String(STEPS.length).padStart(2, '0')}
            </div>
          </div>

          {/* Steps are stacked and cross-faded by index rather than mounted /
              unmounted, so fast scrolling never queues up exit animations. */}
          <div className="hp-copywrap">
            {STEPS.map((s, i) => {
              const isActive = i === step;
              return (
                <motion.div
                  key={s.n}
                  className="hp-copy"
                  initial={false}
                  animate={
                    isActive
                      ? { opacity: 1, y: 0, filter: 'blur(0px)' }
                      : { opacity: 0, y: i < step ? -26 : 26, filter: 'blur(8px)' }
                  }
                  transition={{ duration: 0.5, ease: EASE }}
                  style={{ pointerEvents: isActive ? 'auto' : 'none' }}
                  aria-hidden={!isActive}
                >
                  <div className="hp-copy-icon" style={{ color: s.color }}>
                    <s.Icon size={20} strokeWidth={1.5} />
                  </div>
                  <div className="hp-copy-kicker" style={{ color: s.color }}>
                    {s.n} — {s.kicker}
                  </div>
                  <h3 className="hp-copy-title">{s.title}</h3>
                  <p className="hp-copy-desc">{s.desc}</p>
                </motion.div>
              );
            })}
          </div>

          <div className="hp-rail">
            <div className="hp-rail-track" />
            <motion.div className="hp-rail-fill" style={{ height: railFill }} />
            {STEPS.map((s, i) => (
              <button
                key={s.n}
                className={`hp-rail-item ${i === step ? 'is-active' : ''}`}
                onClick={() => goToStep(i)}
                aria-label={`ไปยังขั้นตอน ${s.n}: ${s.title}`}
              >
                <span className="hp-rail-dot" />
                <span>{s.n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage({ onStart }: HomePageProps) {
  const heroRef = useRef<HTMLElement | null>(null);

  // Page-wide progress → the hairline bar pinned to the top of the viewport.
  const { scrollY, scrollYProgress } = useScroll();
  const barScale = useSpring(scrollYProgress, { stiffness: 130, damping: 30, restDelta: 0.001 });

  // Hero parallax: the gate sinks and swells as it leaves.
  const { scrollYProgress: heroP } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroGateY = useTransform(heroP, [0, 1], ['0%', '18%']);
  const heroGateScale = useTransform(heroP, [0, 1], [1, 1.22]);
  const heroCopyY = useTransform(heroP, [0, 1], ['0%', '-32%']);
  const heroFade = useTransform(heroP, [0, 0.72], [1, 0]);

  const enterGate = useCallback(() => {
    const colors = ['#7fb0ff', '#a78bfa', '#ffffff', '#f0d9a0'];
    confetti({
      particleCount: 70,
      spread: 78,
      startVelocity: 42,
      origin: { y: 0.62 },
      colors,
      scalar: 0.9,
      ticks: 180,
      disableForReducedMotion: true,
    });
    window.setTimeout(
      () =>
        confetti({
          particleCount: 40,
          spread: 115,
          startVelocity: 26,
          origin: { y: 0.54 },
          colors,
          scalar: 0.7,
          ticks: 150,
          disableForReducedMotion: true,
        }),
      140,
    );
    onStart();
  }, [onStart]);

  return (
    <div className="hp">
      <MagicVisualStyles />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@200;300;400;500;600&family=IBM+Plex+Sans+Thai:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        .hp {
          --line: rgba(255,255,255,0.09);
          --line-soft: rgba(255,255,255,0.05);
          --dim: #8f9bb8;
          --faint: #59637f;
          --blue: #7fb0ff;
          --violet: #a78bfa;

          position: relative;
          min-height: 100svh;
          color: #fff;
          background: #03040a;
          font-family: var(--sans);
          /* clip, not hidden — hidden would make this a scroll container and
             break every position:sticky inside it. */
          overflow-x: clip;
        }
        .hp * { box-sizing: border-box; }

        /* ---------- AMBIENT ---------- */
        .hp-stars, .hp-aurora { position: fixed; pointer-events: none; z-index: 0; }
        .hp-stars {
          inset: 0;
          background-image:
            radial-gradient(1.4px 1.4px at 12% 18%, rgba(255,255,255,0.75), transparent),
            radial-gradient(1.4px 1.4px at 78% 8%, rgba(160,190,255,0.6), transparent),
            radial-gradient(1px 1px at 55% 62%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1.4px 1.4px at 25% 82%, rgba(160,190,255,0.5), transparent),
            radial-gradient(1px 1px at 92% 55%, rgba(255,255,255,0.45), transparent),
            radial-gradient(1.4px 1.4px at 42% 38%, rgba(255,255,255,0.4), transparent),
            radial-gradient(1px 1px at 66% 92%, rgba(160,190,255,0.4), transparent);
          background-size: 720px 720px;
          animation: hpStars 70s linear infinite;
          opacity: 0.75;
        }
        @keyframes hpStars { from { background-position: 0 0; } to { background-position: -720px 720px; } }
        .hp-aurora {
          inset: -25%;
          background:
            radial-gradient(38% 30% at 22% 22%, rgba(59,99,255,0.18), transparent 70%),
            radial-gradient(34% 26% at 78% 62%, rgba(167,139,250,0.13), transparent 70%);
          filter: blur(40px);
          animation: hpAurora 26s ease-in-out infinite alternate;
        }
        @keyframes hpAurora { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(0,-5%,0) scale(1.14); } }

        /* ---------- CHROME ---------- */
        .hp-progress {
          position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 60;
          transform-origin: 0 50%;
          background: linear-gradient(90deg, #3b63ff, #7fb0ff 45%, #a78bfa);
        }
        .hp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 50;
          display: flex; align-items: center; justify-content: space-between; gap: 20px;
          padding: 18px 32px;
          transition: background 0.35s ease, border-color 0.35s ease, padding 0.35s ease;
          border-bottom: 1px solid transparent;
        }
        .hp-nav.is-solid {
          background: rgba(4,6,14,0.72);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border-bottom-color: var(--line);
          padding-block: 13px;
        }
        .hp-brand {
          display: flex; align-items: center; gap: 10px;
          font-family: var(--display); font-weight: 500; font-size: 15px;
          letter-spacing: 0.22em; text-transform: uppercase; color: #fff;
        }
        .hp-brand svg { color: var(--blue); }
        .hp-navlinks { display: flex; align-items: center; gap: 34px; }
        .hp-navlinks a {
          color: var(--dim); text-decoration: none; font-size: 13px; font-weight: 400;
          letter-spacing: 0.02em; transition: color 0.2s ease;
        }
        .hp-navlinks a:hover { color: #fff; }

        /* ---------- BUTTONS ---------- */
        .hp-btn {
          display: inline-flex; align-items: center; gap: 10px;
          border: 1px solid transparent; cursor: pointer; font-family: var(--sans);
          font-size: 14px; font-weight: 500; padding: 13px 24px; border-radius: 999px;
          transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
          text-decoration: none; white-space: nowrap;
        }
        .hp-btn:hover { transform: translateY(-2px); }
        .hp-btn-primary {
          background: linear-gradient(135deg, #eaf1ff, #ffffff);
          color: #05070f; box-shadow: 0 10px 40px rgba(127,176,255,0.28);
        }
        .hp-btn-primary:hover { box-shadow: 0 14px 50px rgba(127,176,255,0.42); }
        .hp-btn-ghost {
          background: rgba(255,255,255,0.05); color: #fff;
          border-color: rgba(255,255,255,0.16);
          backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
        }
        .hp-btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.32); }
        .hp-nav .hp-btn { padding: 10px 20px; font-size: 13px; }

        /* ---------- SHARED TYPE ---------- */
        .hp-shell { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 0 32px; }
        .hp-kicker {
          font-family: var(--mono); font-size: 11px; font-weight: 500;
          letter-spacing: 0.28em; text-transform: uppercase; color: var(--blue);
          display: flex; align-items: center; gap: 12px;
        }
        .hp-kicker::before { content: ''; width: 28px; height: 1px; background: currentColor; opacity: 0.6; }
        /* Thai must not carry the wide Latin tracking — it pulls the vowel and
           tone marks away from their base consonants. */
        .hp-kicker.is-th { font-family: var(--sans); font-size: 12.5px; letter-spacing: 0.02em; text-transform: none; }
        .hp-kicker-en { font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.26em; text-transform: uppercase; opacity: 0.6; }
        .hp-h2 {
          font-family: var(--display); font-weight: 200;
          font-size: clamp(30px, 4.6vw, 56px); line-height: 1.12;
          letter-spacing: 0.01em; margin: 20px 0 16px; color: #fff;
        }
        .hp-lead { color: var(--dim); font-size: 15px; font-weight: 300; line-height: 1.85; max-width: 620px; }
        .hp-section { position: relative; z-index: 1; padding: clamp(88px, 13vw, 168px) 0; }
        .hp-section + .hp-section { border-top: 1px solid var(--line-soft); }
        [id] { scroll-margin-top: 84px; }

        /* ---------- HERO ---------- */
        .hp-hero {
          position: relative; z-index: 1; min-height: 100svh;
          display: grid; place-items: center; padding: 96px 32px 120px;
        }
        .hp-hero-stage {
          position: absolute; inset: 0; display: grid; place-items: center;
          pointer-events: none; z-index: 0;
        }
        /* Absolutely-positioned children of a grid container fall back to a
           "static position" that browsers resolve inconsistently — pin them
           explicitly instead of trusting place-items to centre them. */
        .hp-hero-halo, .hp-hero-circle, .hp-hero-gate,
        .hp-stage-halo, .hp-stage-circle, .hp-stage-gate,
        .hp-final-halo, .hp-final-circle, .hp-final-gate,
        .hp-spell-circle {
          position: absolute; left: 50%; top: 50%; translate: -50% -50%;
        }
        .hp-hero-halo {
          width: min(78vmin, 700px); aspect-ratio: 1; border-radius: 50%;
          background: radial-gradient(circle, rgba(91,140,255,0.3), rgba(91,140,255,0.06) 48%, transparent 70%);
          filter: blur(20px);
        }
        .hp-hero-gate { transform: translateY(4%); }
        .hp-hero-scrim {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 42% 34% at 50% 46%, rgba(3,4,10,0.86), transparent 72%);
        }
        .hp-hero-copy { position: relative; z-index: 2; text-align: center; display: grid; justify-items: center; gap: 26px; }
        .hp-hero-tag {
          display: inline-flex; align-items: center; gap: 10px;
          font-family: var(--mono); font-size: 11px; letter-spacing: 0.3em; text-transform: uppercase;
          color: #c7d6f5; padding: 9px 18px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04);
          backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        }
        .hp-title {
          font-family: var(--display); font-weight: 200; text-transform: uppercase;
          font-size: clamp(48px, 12vw, 150px); line-height: 0.94; letter-spacing: 0.08em;
          margin: 0; color: #fff; text-shadow: 0 10px 60px rgba(3,6,20,0.8);
        }
        .hp-title em { display: block; font-style: normal; font-weight: 300; }
        .hp-hero-lead { color: #b6c2dc; font-size: 15px; font-weight: 300; line-height: 1.9; max-width: 560px; }
        .hp-hero-actions { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; }
        .hp-scrollhint {
          position: absolute; bottom: 34px; left: 50%; transform: translateX(-50%); z-index: 2;
          display: grid; justify-items: center; gap: 10px;
          font-family: var(--sans); font-size: 11.5px; font-weight: 300;
          letter-spacing: 0.02em; color: var(--faint);
        }

        /* ---------- MANIFESTO ---------- */
        .hp-manifesto { text-align: center; display: grid; justify-items: center; gap: 28px; }
        .hp-manifesto-line {
          font-family: var(--display); font-weight: 200;
          font-size: clamp(28px, 5.4vw, 68px); line-height: 1.24; letter-spacing: 0.01em;
          max-width: 15ch; color: #fff;
        }
        .hp-manifesto-line b { font-weight: 300; color: var(--blue); }

        /* ---------- PINNED CHAPTER ---------- */
        .hp-how { position: relative; z-index: 1; }
        .hp-stage {
          position: sticky; top: 0; height: 100svh; overflow: hidden;
          display: grid; place-items: center;
        }
        .hp-stage-art { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
        .hp-stage-halo {
          width: min(70vmin, 620px); aspect-ratio: 1; border-radius: 50%;
          filter: blur(26px); transition: background 0.7s ease;
        }
        .hp-stage-gate { transform: translateY(-2%); }
        .hp-stage-veil {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(180deg, rgba(3,4,10,0.9) 0%, transparent 24%, transparent 44%, rgba(3,4,10,0.94) 88%);
        }
        .hp-stage-inner {
          position: relative; z-index: 2; width: 100%; height: 100%;
          max-width: 1180px; margin: 0 auto; padding: 92px 32px 56px;
        }
        .hp-stage-head { position: absolute; top: 92px; left: 32px; right: 32px; display: flex; justify-content: space-between; align-items: baseline; gap: 20px; }
        .hp-stage-count { font-family: var(--mono); font-size: 11px; letter-spacing: 0.22em; color: var(--faint); }
        .hp-stage-count b { color: #fff; font-weight: 500; }

        .hp-copywrap { position: absolute; left: 32px; right: 32px; bottom: 58px; height: 244px; max-width: 620px; }
        .hp-copy { position: absolute; inset: 0; display: grid; align-content: end; gap: 14px; }
        .hp-copy-kicker { font-family: var(--mono); font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase; }
        .hp-copy-title {
          font-family: var(--display); font-weight: 200;
          font-size: clamp(28px, 4.4vw, 52px); line-height: 1.16; color: #fff;
        }
        .hp-copy-desc { color: var(--dim); font-size: 14.5px; font-weight: 300; line-height: 1.85; }
        .hp-copy-icon {
          width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center;
          border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        }
        .hp-ghost-num {
          position: absolute; right: 32px; bottom: 34px; z-index: 1;
          font-family: var(--display); font-weight: 200; font-size: clamp(120px, 21vw, 280px);
          line-height: 0.8; color: rgba(255,255,255,0.045); user-select: none; pointer-events: none;
        }

        .hp-rail { position: absolute; top: 50%; right: 32px; transform: translateY(-50%); display: grid; gap: 2px; }
        .hp-rail-track { position: absolute; left: 5px; top: 0; bottom: 0; width: 1px; background: var(--line); }
        .hp-rail-fill { position: absolute; left: 5px; top: 0; width: 1px; background: linear-gradient(180deg, #7fb0ff, #a78bfa); }
        .hp-rail-item {
          position: relative; display: flex; align-items: center; gap: 12px;
          background: none; border: 0; cursor: pointer; padding: 9px 0 9px 0;
          font-family: var(--mono); font-size: 10px; letter-spacing: 0.18em;
          color: var(--faint); transition: color 0.3s ease;
        }
        .hp-rail-item:hover { color: #c7d6f5; }
        .hp-rail-item.is-active { color: #fff; }
        .hp-rail-dot {
          width: 11px; height: 11px; border-radius: 50%; flex: none;
          border: 1px solid currentColor; background: #03040a;
          transition: box-shadow 0.3s ease, background 0.3s ease;
        }
        .hp-rail-item.is-active .hp-rail-dot { background: currentColor; box-shadow: 0 0 0 4px rgba(127,176,255,0.16); }

        /* ---------- SPELLS ---------- */
        .hp-spells { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; margin-top: 56px; }
        .hp-spell {
          position: relative; overflow: hidden; border-radius: 20px; padding: 28px 20px 26px;
          border: 1px solid var(--line); background: rgba(255,255,255,0.022);
          text-align: center; transition: border-color 0.35s ease, transform 0.35s ease, background 0.35s ease;
        }
        .hp-spell:hover { transform: translateY(-6px); border-color: rgba(127,176,255,0.4); background: rgba(127,176,255,0.05); }
        .hp-spell-art { position: relative; display: grid; place-items: center; height: 168px; margin-bottom: 18px; }
        .hp-spell-circle { position: absolute; opacity: 0.55; transition: opacity 0.35s ease; }
        .hp-spell:hover .hp-spell-circle { opacity: 1; }
        .hp-spell-fig { position: relative; z-index: 1; }
        .hp-spell-name { font-family: var(--display); font-weight: 400; font-size: 15px; margin-bottom: 6px; }
        .hp-spell-label { font-size: 12.5px; color: var(--dim); font-weight: 300; }
        .hp-spell-pts { margin-top: 14px; font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.16em; color: var(--blue); }

        /* ---------- FEATURES / TIPS ---------- */
        .hp-grid3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--line); border: 1px solid var(--line); margin-top: 56px; border-radius: 20px; overflow: hidden; }
        .hp-cell { background: #03040a; padding: 34px 28px; transition: background 0.35s ease; }
        .hp-cell:hover { background: rgba(127,176,255,0.045); }
        .hp-cell-icon { color: var(--blue); margin-bottom: 20px; }
        .hp-cell h3 { font-family: var(--display); font-weight: 400; font-size: 16px; margin-bottom: 12px; color: #fff; }
        .hp-cell p { color: var(--dim); font-size: 13.5px; font-weight: 300; line-height: 1.8; }

        .hp-tips { display: grid; grid-template-columns: repeat(4, 1fr); gap: 34px 28px; margin-top: 56px; }
        .hp-tip-icon { color: var(--blue); margin-bottom: 16px; }
        .hp-tip h4 { font-family: var(--display); font-weight: 400; font-size: 14.5px; margin-bottom: 9px; color: #fff; }
        .hp-tip p { color: var(--dim); font-size: 13px; font-weight: 300; line-height: 1.78; }

        /* ---------- FINAL CTA ---------- */
        .hp-final { position: relative; z-index: 1; padding: clamp(110px, 16vw, 210px) 32px; overflow: hidden; text-align: center; border-top: 1px solid var(--line-soft); }
        .hp-final-art { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
        .hp-final-halo {
          width: min(64vmin, 560px); aspect-ratio: 1; border-radius: 50%;
          background: radial-gradient(circle, rgba(91,140,255,0.26), transparent 68%); filter: blur(24px);
        }
        .hp-final-scrim { position: absolute; inset: 0; background: radial-gradient(ellipse 40% 40% at 50% 50%, rgba(3,4,10,0.84), transparent 74%); }
        .hp-final-inner { position: relative; z-index: 2; display: grid; justify-items: center; gap: 26px; }
        .hp-final h2 {
          font-family: var(--display); font-weight: 200; text-transform: uppercase;
          font-size: clamp(32px, 6vw, 78px); line-height: 1.04; letter-spacing: 0.06em; color: #fff;
        }

        /* ---------- FOOTER ---------- */
        .hp-footer {
          position: relative; z-index: 1; border-top: 1px solid var(--line-soft);
          padding: 34px 32px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap;
          font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.14em; color: var(--faint);
        }

        /* ---------- RESPONSIVE ---------- */
        @media (max-width: 1080px) {
          .hp-spells { grid-template-columns: repeat(2, 1fr); }
          .hp-tips { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 820px) {
          .hp-navlinks { display: none; }
          .hp-nav { padding: 16px 20px; }
          .hp-shell, .hp-final, .hp-footer { padding-inline: 20px; }
          .hp-grid3 { grid-template-columns: 1fr; }
          .hp-stage-inner, .hp-stage-head { padding-inline: 20px; }
          .hp-stage-head { left: 20px; right: 20px; }
          .hp-copywrap { left: 20px; right: 20px; bottom: 40px; height: 272px; }
          .hp-rail { display: none; }
          .hp-ghost-num { right: 20px; opacity: 0.7; }
          .hp-hero { padding: 88px 20px 110px; }
        }
        @media (max-width: 560px) {
          .hp-spells { grid-template-columns: 1fr; }
          .hp-tips { grid-template-columns: 1fr; }
          .hp-hero-actions { width: 100%; flex-direction: column; }
          .hp-hero-actions .hp-btn { justify-content: center; }
        }
      `}</style>

      <div className="hp-aurora" />
      <div className="hp-stars" />

      <motion.div className="hp-progress" style={{ scaleX: barScale }} />

      <Nav scrollY={scrollY} onEnterGate={enterGate} />

      {/* ---------- HERO ---------- */}
      <section className="hp-hero" ref={heroRef}>
        <motion.div
          className="hp-hero-stage"
          style={{ y: heroGateY, scale: heroGateScale, opacity: heroFade }}
        >
          <div className="hp-hero-halo" />
          <MagicCircle className="hp-hero-circle" size="min(96vmin, 820px)" color="#5b8cff" spin={78} opacity={0.42} />
          <MagicCircle className="hp-hero-circle" size="min(58vmin, 500px)" color="#a78bfa" spin={52} opacity={0.3} runes={false} />
          <MagicGate className="hp-hero-gate" width="min(44vmin, 360px)" color="#8ec5ff" intensity={0.9} />
          <div className="hp-hero-scrim" />
        </motion.div>

        <motion.div className="hp-hero-copy" style={{ y: heroCopyY, opacity: heroFade }}>
          <motion.div
            className="hp-hero-tag"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <Sparkles size={13} strokeWidth={1.6} />
            Pose-Detection Magic
          </motion.div>

          <motion.h1
            className="hp-title"
            initial={{ opacity: 0, y: 34, filter: 'blur(16px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.15, delay: 0.1, ease: EASE }}
          >
            Arcane
            <em>Gate</em>
          </motion.h1>

          <motion.p
            className="hp-hero-lead"
            initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1, delay: 0.32, ease: EASE }}
          >
            ประตูเวทมนตร์เคลื่อนเข้ามาไม่หยุด — ร่ายท่าคาถาให้ตรงกับช่องว่างก่อนที่มันจะกลืนคุณเข้าไป
            ใช้เพียงร่างกายและกล้องเว็บ ให้ AI มองเห็นและตัดสินทุกท่วงท่าแบบเรียลไทม์
          </motion.p>

          <motion.div
            className="hp-hero-actions"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.48, ease: EASE }}
          >
            <button className="hp-btn hp-btn-primary" onClick={enterGate}>
              <WandSparkles size={16} strokeWidth={1.6} />
              เข้าสู่หอคาถา
            </button>
            <a href="#how-to-play" className="hp-btn hp-btn-ghost">
              <BookOpen size={16} strokeWidth={1.6} />
              ดูวิธีเล่นก่อน
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          className="hp-scrollhint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
          style={{ opacity: heroFade }}
        >
          <span>เลื่อนลงเพื่อเปิดประตู</span>
          <motion.span
            animate={{ y: [0, 7, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ display: 'grid' }}
          >
            <ChevronDown size={16} strokeWidth={1.4} />
          </motion.span>
        </motion.div>
      </section>

      {/* ---------- MANIFESTO ---------- */}
      <section className="hp-section">
        <div className="hp-shell hp-manifesto">
          <Reveal>
            <div className="hp-kicker">The Old Magic</div>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="hp-manifesto-line">
              ไม่มีคทา ไม่มีคาถาให้ท่อง<br />มีเพียง <b>ร่างกายของคุณ</b>
            </p>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="hp-lead" style={{ textAlign: 'center' }}>
              ต่อยอดจากแนว Hole in the Wall ให้กลายเป็นการผจญภัยของจอมเวทย์
              ที่ทุกท่วงท่าของร่างกายจริงคือคาถา และกล้องเว็บคือดวงตาที่คอยตัดสิน
            </p>
          </Reveal>
        </div>
      </section>

      <HowToPlaySection />

      {/* ---------- SPELLS ---------- */}
      <section className="hp-section" id="spells">
        <div className="hp-shell">
          <Reveal>
            <div className="hp-kicker is-th">
              แกลเลอรีคาถา <span className="hp-kicker-en">Grimoire</span>
            </div>
            <h2 className="hp-h2">คาถาทั้ง 4 ที่ต้องจดจำ</h2>
            <p className="hp-lead">
              แต่ละประตูเวทมนตร์ต้องการท่าทางเฉพาะตัว ยิ่งร่ายแม่นยำ ยิ่งได้คะแนนโบนัส "PERFECT"
            </p>
          </Reveal>

          <div className="hp-spells">
            {POSE_ORDER.map((key, i) => {
              const info = POSES[key];
              return (
                <Reveal key={key} delay={i * 0.08}>
                  <div className="hp-spell">
                    <div className="hp-spell-art">
                      <MagicCircle
                        className="hp-spell-circle"
                        size={168}
                        color={info.color}
                        spin={40 + i * 6}
                        opacity={0.6}
                        runes={false}
                      />
                      <div className="hp-spell-fig">
                        <Silhouette pose={key} size={86} />
                      </div>
                    </div>
                    <div className="hp-spell-name" style={{ color: info.color }}>
                      {info.spell}
                    </div>
                    <div className="hp-spell-label">ท่า: {info.label}</div>
                    <div className="hp-spell-pts">+{info.points} PTS</div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section className="hp-section" id="features">
        <div className="hp-shell">
          <Reveal>
            <div className="hp-kicker is-th">
              เกี่ยวกับเกม <span className="hp-kicker-en">The Craft</span>
            </div>
            <h2 className="hp-h2">เวทมนตร์ที่ขับเคลื่อนด้วย AI</h2>
          </Reveal>

          <div className="hp-grid3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08} className="hp-cell">
                <div className="hp-cell-icon">
                  <f.Icon size={24} strokeWidth={1.4} />
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- TIPS ---------- */}
      <section className="hp-section">
        <div className="hp-shell">
          <Reveal>
            <div className="hp-kicker is-th">
              ก่อนเริ่มเล่น <span className="hp-kicker-en">Preparation</span>
            </div>
            <h2 className="hp-h2">เคล็ดลับให้ AI มองเห็นคุณชัดที่สุด</h2>
          </Reveal>

          <div className="hp-tips">
            {TIPS.map((t, i) => (
              <Reveal key={t.title} delay={i * 0.07} className="hp-tip">
                <div className="hp-tip-icon">
                  <t.Icon size={22} strokeWidth={1.4} />
                </div>
                <h4>{t.title}</h4>
                <p>{t.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="hp-final">
        <div className="hp-final-art">
          <div className="hp-final-halo" />
          <MagicCircle className="hp-final-circle" size="min(74vmin, 640px)" color="#7fb0ff" spin={60} opacity={0.34} />
          <MagicGate className="hp-final-gate" width="min(34vmin, 280px)" color="#8ec5ff" intensity={1} />
          <div className="hp-final-scrim" />
        </div>

        <div className="hp-final-inner">
          <Reveal>
            <div className="hp-kicker" style={{ justifyContent: 'center' }}>
              The Gate Awaits
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h2>ประตูเปิดแล้ว</h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="hp-lead" style={{ textAlign: 'center' }}>
              เปิดกล้อง ยืนให้พร้อม แล้วก้าวข้ามอุปสรรคเพื่อพิสูจน์ฝีมือจอมเวทย์ของคุณ
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <button className="hp-btn hp-btn-primary" onClick={enterGate}>
              <WandSparkles size={16} strokeWidth={1.6} />
              เริ่มเกมเลย
            </button>
          </Reveal>
        </div>
      </section>

      <footer className="hp-footer">
        <span>ARCANE GATE</span>
      </footer>
    </div>
  );
}
