import type { CSSProperties } from 'react';
import { POSES, POSE_ORDER, Silhouette } from './poseData';

interface HomePageProps {
  onStart: () => void;
}

const STEPS = [
  {
    n: '01',
    title: 'เตรียมพื้นที่ให้พร้อม',
    desc: 'ยืนห่างจากกล้อง/หน้าจอประมาณ 1.5–2 เมตร ในที่ที่มีแสงสว่างเพียงพอ และมีพื้นที่โล่งพอให้ขยับแขนขาได้เต็มที่',
    icon: '🕯️',
  },
  {
    n: '02',
    title: 'อนุญาตให้ใช้กล้อง',
    desc: 'กดปุ่ม "เข้าสู่หอคาถา" แล้วอนุญาตให้เว็บไซต์เข้าถึงกล้องของคุณ ระบบ AI จะเริ่มมองเห็นท่าทางทันที',
    icon: '📷',
  },
  {
    n: '03',
    title: 'จดจำคาถาทั้ง 4',
    desc: 'ประตูเวทมนตร์แต่ละบานต้องการท่าทางที่ต่างกัน เลื่อนดูแกลเลอรีด้านล่างเพื่อฝึกท่าไว้ล่วงหน้า',
    icon: '📖',
  },
  {
    n: '04',
    title: 'ร่ายท่าให้ตรงจังหวะ',
    desc: 'เมื่อประตูเวทมนตร์เคลื่อนมาถึงเส้นล็อกกลางจอ ให้ทำท่าที่ตรงกับช่องว่างให้ทัน AI จะตรวจจับและให้คะแนนทันที',
    icon: '✨',
  },
  {
    n: '05',
    title: 'รักษาคอมโบและพลังชีวิต',
    desc: 'ร่ายถูกต่อเนื่องจะได้โบนัสคอมโบทวีคูณคะแนน แต่ถ้าร่ายผิด 3 ครั้งจะโดนมนตร์สะท้อนจนหมดพลัง เกมจบทันที',
    icon: '❤️',
  },
];

const FEATURES = [
  {
    icon: '🧠',
    title: 'AI ตรวจจับท่าทางเรียลไทม์',
    desc: 'ขับเคลื่อนด้วย Teachable Machine และ TensorFlow.js ตรวจจับท่าทางผ่านกล้องเว็บแบบสด ไม่ต้องติดตั้งเซนเซอร์เพิ่ม',
  },
  {
    icon: '🔥',
    title: 'ระบบคอมโบและคะแนนโบนัส',
    desc: 'ยิ่งร่ายคาถาต่อเนื่องแม่นยำเท่าไร ยิ่งได้ตัวคูณคะแนนสูงขึ้น พร้อมโบนัส "PERFECT" สำหรับท่าที่แม่นยำที่สุด',
  },
  {
    icon: '🌀',
    title: 'ประตูเวทมนตร์ 4 รูปแบบ',
    desc: 'แต่ละประตูมีสัญลักษณ์และท่วงท่าเฉพาะตัว ความเร็วในการเข้ามาจะเพิ่มขึ้นเรื่อย ๆ ตามจังหวะเกม',
  },
];

function GridIcon() {
  return (
    <span className="grid-icon">
      {Array.from({ length: 9 }).map((_, i) => <i key={i} />)}
    </span>
  );
}

export default function HomePage({ onStart }: HomePageProps) {
  return (
    <div className="home">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .home, .home * { box-sizing: border-box; }
        .home {
          min-height: 100vh;
          color: #fff;
          font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;
          background: #05070d;
          overflow-x: hidden;
          position: relative;
        }

        /* starfield carried through the whole page */
        .home::before {
          content: '';
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1.5px 1.5px at 78% 8%, rgba(160,190,255,0.6), transparent),
            radial-gradient(1px 1px at 55% 60%, rgba(255,255,255,0.5), transparent),
            radial-gradient(1.5px 1.5px at 25% 82%, rgba(160,190,255,0.5), transparent),
            radial-gradient(1px 1px at 92% 55%, rgba(255,255,255,0.45), transparent),
            radial-gradient(1.5px 1.5px at 42% 38%, rgba(255,255,255,0.4), transparent),
            radial-gradient(1px 1px at 66% 92%, rgba(160,190,255,0.4), transparent);
          background-repeat: repeat;
          background-size: 700px 700px;
          animation: starDrift 60s linear infinite;
          opacity: 0.8;
        }
        @keyframes starDrift { from { background-position: 0 0; } to { background-position: -700px 700px; } }
        @keyframes twinkle { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }

        .home-shell { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 0 24px 80px; }

        /* HERO — full-bleed cinematic */
        .hero-full { position: relative; min-height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
        .hero-bg { position: absolute; inset: 0; z-index: 0;
          background:
            radial-gradient(ellipse 55% 45% at 78% 18%, rgba(91,140,255,0.38), transparent 62%),
            radial-gradient(ellipse 50% 40% at 12% 85%, rgba(60,95,200,0.28), transparent 60%),
            linear-gradient(180deg, #060913 0%, #080c1c 45%, #05070d 100%);
        }
        .hero-orb {
          position: absolute; top: -10%; right: -8%; z-index: 0; width: 52vw; height: 52vw; border-radius: 50%;
          background: radial-gradient(circle at 40% 40%, rgba(120,165,255,0.55), rgba(80,120,255,0.15) 55%, transparent 72%);
          filter: blur(6px);
        }
        .hero-rune {
          position: absolute; top: 50%; right: 6%; z-index: 0; width: 46vw; height: 46vw; max-width: 640px; max-height: 640px;
          transform: translateY(-50%); border-radius: 50%;
          background: conic-gradient(from 0deg, transparent 0 15deg, rgba(130,170,255,0.35) 22deg, transparent 40deg, transparent 70deg, rgba(130,170,255,0.35) 78deg, transparent 96deg, transparent 130deg, rgba(130,170,255,0.35) 138deg, transparent 156deg, transparent 190deg, rgba(130,170,255,0.35) 198deg, transparent 216deg, transparent 250deg, rgba(130,170,255,0.35) 258deg, transparent 276deg, transparent 310deg, rgba(130,170,255,0.35) 318deg, transparent 336deg);
          -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
          mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1px));
          animation: runeSpinSlow 60s linear infinite;
          opacity: 0.5;
        }
        @keyframes runeSpinSlow { from { transform: translateY(-50%) rotate(0deg); } to { transform: translateY(-50%) rotate(360deg); } }
        .hero-vignette { position: absolute; inset: 0; z-index: 0; background: radial-gradient(ellipse 90% 70% at 50% 100%, rgba(0,0,0,0.55), transparent 60%); }

        .hero-inner { position: relative; z-index: 2; max-width: 1180px; width: 100%; margin: 0 auto; padding: 0 24px; flex: 1; display: flex; flex-direction: column; }

        /* NAV — transparent, floating over the hero */
        .home-nav { display: flex; align-items: center; justify-content: space-between; padding: 26px 0; }
        .home-brand strong { font-size: 18px; letter-spacing: -0.01em; font-weight: 800; color: #fff; }
        .nav-links { display: flex; align-items: center; gap: 32px; }
        .home-nav a { color: rgba(255,255,255,0.85); text-decoration: none; font-size: 13.5px; font-weight: 500; }
        .home-nav a:hover { color: #fff; }
        .btn-glass {
          border: none; cursor: pointer; border-radius: 999px; font-family: inherit; text-decoration: none;
          font-weight: 600; font-size: 13px; padding: 10px 20px; display: inline-flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.22);
          backdrop-filter: blur(14px); transition: background 0.2s ease, transform 0.15s ease;
        }
        .btn-glass:hover { background: rgba(255,255,255,0.18); transform: translateY(-1px); }

        /* HERO CONTENT */
        .hero-content { flex: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 40px 0 64px; gap: 40px; }
        .hero-tag {
          display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500;
          color: rgba(255,255,255,0.85); text-shadow: 0 2px 12px rgba(0,0,0,0.5); margin-bottom: 20px;
        }
        .hero-title {
          font-weight: 900; letter-spacing: -0.02em; text-transform: uppercase;
          font-size: clamp(44px, 9vw, 108px); margin: 0; line-height: 0.98; color: #fff;
          text-shadow: 0 6px 40px rgba(0,0,0,0.55), 0 2px 10px rgba(0,0,0,0.4);
          max-width: 900px;
        }
        .hero-bottom { display: flex; align-items: flex-end; justify-content: flex-end; gap: 56px; flex-wrap: wrap; }
        .hero-desc { max-width: 340px; margin: 0; color: rgba(255,255,255,0.78); font-size: 14px; line-height: 1.75; text-align: left; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
        .hero-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 14px; }

        .home-btn {
          border: none; cursor: pointer; border-radius: 12px; font-family: inherit;
          font-weight: 700; font-size: 14px; padding: 15px 24px; transition: transform 0.15s ease, background 0.15s ease;
          display: inline-flex; align-items: center; gap: 10px;
        }
        .home-btn:hover { transform: translateY(-2px); }
        .home-btn.primary {
          background: rgba(8,10,20,0.85); color: #fff; border: 1px solid rgba(255,255,255,0.14);
          backdrop-filter: blur(10px); box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }
        .home-btn.primary:hover { background: #0d1120; }
        .home-btn.ghost { background: transparent; color: rgba(255,255,255,0.8); padding: 4px; font-size: 12.5px; font-weight: 600; }
        .home-btn.ghost:hover { color: #fff; }

        .grid-icon { display: grid; grid-template-columns: repeat(3, 3px); grid-template-rows: repeat(3, 3px); gap: 2.5px; }
        .grid-icon i { width: 3px; height: 3px; background: #7fb0ff; border-radius: 1px; display: block; }

        /* SECTION HEADINGS */
        .section { padding: 72px 0; border-top: 1px solid rgba(255,255,255,0.09); }
        .section-head { max-width: 640px; margin: 0 0 40px; }
        .section-kicker { font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; color: #7fb0ff; text-transform: uppercase; margin-bottom: 12px; }
        .section-head h2 { font-size: clamp(24px, 3.4vw, 34px); margin: 0 0 12px; font-weight: 800; letter-spacing: -0.01em; }
        .section-head p { color: #93a0bc; line-height: 1.7; margin: 0; font-size: 13.5px; }

        /* FEATURE GRID */
        .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.09); }
        .feature-card { background: #05070d; padding: 28px 24px; transition: background 0.2s ease; }
        .feature-card:hover { background: rgba(91,140,255,0.06); }
        .feature-icon { font-size: 22px; margin-bottom: 16px; }
        .feature-card h3 { font-size: 14.5px; margin: 0 0 10px; font-weight: 700; letter-spacing: 0.01em; }
        .feature-card p { margin: 0; color: #8a93ab; font-size: 13px; line-height: 1.7; }

        /* STEPS */
        .steps { display: flex; flex-direction: column; }
        .step-row {
          display: grid; grid-template-columns: 64px 1fr; gap: 20px; align-items: flex-start;
          border-top: 1px solid rgba(255,255,255,0.09); padding: 22px 4px;
        }
        .step-row:last-child { border-bottom: 1px solid rgba(255,255,255,0.09); }
        .step-num { font-weight: 800; font-size: 22px; color: #2a3450; font-variant-numeric: tabular-nums; }
        .step-body h4 { margin: 0 0 8px; font-size: 14.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
        .step-body p { margin: 0; color: #8a93ab; font-size: 13px; line-height: 1.7; max-width: 640px; }

        /* SPELL GALLERY */
        .spell-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.09); }
        .spell-card { background: #05070d; padding: 24px 16px; text-align: center; position: relative; overflow: hidden; }
        .spell-figure { display: grid; place-items: center; margin-bottom: 14px; filter: drop-shadow(0 0 10px var(--glow, rgba(127,176,255,0.3))); }
        .spell-name { font-weight: 700; font-size: 13px; margin-bottom: 6px; }
        .spell-label { font-size: 11.5px; color: #8a93ab; font-weight: 500; }
        .spell-points { margin-top: 12px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; color: #7fb0ff; }

        /* TIPS */
        .tips-card { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: rgba(255,255,255,0.09); border: 1px solid rgba(255,255,255,0.09); }
        .tip { background: #05070d; padding: 24px; display: flex; flex-direction: column; gap: 10px; }
        .tip .tip-icon { font-size: 18px; }
        .tip strong { font-size: 13px; font-weight: 700; }
        .tip span { font-size: 12.5px; color: #8a93ab; line-height: 1.65; }

        /* FINAL CTA */
        .final-cta {
          text-align: left; padding: 56px 32px;
          border: 1px solid rgba(255,255,255,0.09); border-top: 2px solid #5b8cff;
          background: radial-gradient(ellipse 60% 100% at 100% 0%, rgba(91,140,255,0.1), transparent 70%);
        }
        .final-cta h2 { font-size: clamp(22px, 3.4vw, 32px); margin: 0 0 14px; font-weight: 800; letter-spacing: -0.01em; }
        .final-cta p { color: #93a0bc; margin: 0 0 26px; font-size: 13.5px; }

        /* FOOTER */
        .home-footer { padding: 32px 0 10px; color: #4a5170; font-size: 11.5px; border-top: 1px solid rgba(255,255,255,0.09); }
        .home-footer strong { color: #8a93ab; }

        @media (max-width: 900px) {
          .feature-grid { grid-template-columns: 1fr; }
          .spell-grid { grid-template-columns: repeat(2, 1fr); }
          .tips-card { grid-template-columns: repeat(2, 1fr); }
          .hero-bottom { justify-content: flex-start; }
          .hero-actions { align-items: flex-start; }
        }
        @media (max-width: 560px) {
          .nav-links { display: none; }
          .step-row { grid-template-columns: 40px 1fr; padding: 18px 2px; }
          .step-num { font-size: 18px; }
          .tips-card { grid-template-columns: 1fr; }
          .hero-desc { max-width: 100%; }
          .hero-content { padding: 24px 0 48px; }
        }
      `}</style>

      {/* HERO — full-bleed cinematic */}
      <section className="hero-full">
        <div className="hero-bg" />
        <div className="hero-orb" />
        <div className="hero-rune" />
        <div className="hero-vignette" />

        <div className="hero-inner">
          {/* NAV */}
          <nav className="home-nav">
            <div className="home-brand">
              <strong>ARCANE GATE</strong>
            </div>
            <div className="nav-links">
              <a href="#features">เกี่ยวกับเกม</a>
              <a href="#how-to-play">วิธีเล่น</a>
              <a href="#spells">คาถาทั้ง 4</a>
            </div>
            <button className="btn-glass" onClick={onStart}>🪄 เข้าสู่หอคาถา</button>
          </nav>

          {/* CONTENT */}
          <div className="hero-content">
            <div>
              <div className="hero-tag">🤍 <span>เวทมนตร์ที่เกือบจับต้องได้</span></div>
              <h1 className="hero-title">ARCANE<br />GATE</h1>
            </div>

            <div className="hero-bottom">
              <p className="hero-desc">
                จอมเวทย์ต้องร่ายท่าคาถาให้ตรงกับ "ประตูเวทมนตร์" ที่เคลื่อนเข้ามาไม่หยุด
                ก่อนที่มันจะกลืนคุณเข้าไป — ใช้เพียงร่างกายและกล้องเว็บ ให้ AI มองเห็นและตัดสินทุกท่วงท่าของคุณแบบเรียลไทม์
              </p>
              <div className="hero-actions">
                <button className="home-btn primary" onClick={onStart}>
                  <GridIcon /> เข้าสู่หอคาถา
                </button>
                <a href="#how-to-play" className="home-btn ghost" style={{ textDecoration: 'none' }}>
                  📖 ดูวิธีเล่นก่อน
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="home-shell">
        {/* FEATURES */}
        <section className="section" id="features">
          <div className="section-head">
            <div className="section-kicker">เกี่ยวกับเกม</div>
            <h2>เกมท่าทางที่ผสานเวทมนตร์เข้ากับ AI</h2>
            <p>ต่อยอดจากแนว Hole in the Wall ให้กลายเป็นการผจญภัยของจอมเวทย์ ที่ต้องใช้ร่างกายจริงในการร่ายคาถา</p>
          </div>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <div className="feature-card" key={f.title}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* HOW TO PLAY */}
        <section className="section" id="how-to-play">
          <div className="section-head">
            <div className="section-kicker">คู่มือจอมเวทย์</div>
            <h2>วิธีการเล่น</h2>
            <p>ทำตาม 5 ขั้นตอนนี้ก่อนเริ่มผจญภัยครั้งแรกของคุณ</p>
          </div>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step-row" key={s.n}>
                <div className="step-num">{s.n}</div>
                <div className="step-body">
                  <h4><span>{s.icon}</span> {s.title}</h4>
                  <p>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SPELL GALLERY */}
        <section className="section" id="spells">
          <div className="section-head">
            <div className="section-kicker">แกลเลอรีคาถา</div>
            <h2>คาถาทั้ง 4 ที่ต้องจดจำ</h2>
            <p>แต่ละประตูเวทมนตร์ต้องการท่าทางเฉพาะตัว ยิ่งแม่นยำ ยิ่งได้คะแนนโบนัส "PERFECT"</p>
          </div>
          <div className="spell-grid">
            {POSE_ORDER.map((key) => {
              const info = POSES[key];
              return (
                <div className="spell-card" key={key} style={{ '--glow': info.glow } as CSSProperties}>
                  <div className="spell-figure">
                    <Silhouette pose={key} size={90} />
                  </div>
                  <div className="spell-name" style={{ color: info.color }}>{info.icon} {info.spell}</div>
                  <div className="spell-label">ท่า: {info.label}</div>
                  <div className="spell-points">+{info.points} คะแนนพื้นฐาน</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* TIPS */}
        <section className="section">
          <div className="section-head">
            <div className="section-kicker">ก่อนเริ่มเล่น</div>
            <h2>เคล็ดลับให้ AI มองเห็นคุณชัดที่สุด</h2>
          </div>
          <div className="tips-card">
            <div className="tip"><span className="tip-icon">💡</span><strong>แสงสว่างเพียงพอ</strong><span>หลีกเลี่ยงห้องมืดหรือแสงย้อน จะช่วยให้ AI ตรวจจับท่าทางได้แม่นยำขึ้น</span></div>
            <div className="tip"><span className="tip-icon">🖼️</span><strong>พื้นหลังโล่ง</strong><span>เลือกพื้นหลังที่ไม่รก ลดสิ่งกีดขวางที่อาจรบกวนการตรวจจับ</span></div>
            <div className="tip"><span className="tip-icon">🧍</span><strong>เห็นทั้งตัว</strong><span>เว้นระยะห่างจากกล้องให้เห็นตั้งแต่ศีรษะถึงเข่าอย่างน้อย</span></div>
            <div className="tip"><span className="tip-icon">👕</span><strong>ขยับตัวสะดวก</strong><span>สวมใส่เสื้อผ้าที่เคลื่อนไหวง่าย เพื่อร่ายท่าคาถาได้เต็มที่</span></div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="final-cta">
          <h2>พร้อมเป็นจอมเวทย์แล้วหรือยัง?</h2>
          <p>เปิดกล้อง ยืนให้พร้อม แล้วก้าวเข้าสู่หอคาถาเพื่อพิสูจน์ฝีมือของคุณ</p>
          <button className="home-btn primary" onClick={onStart}>
            <GridIcon /> เริ่มเกมเลย
          </button>
        </section>

        <footer className="home-footer">
          <p><strong>ARCANE GATE</strong> — เกมท่าทางเวทมนตร์ขับเคลื่อนด้วย Teachable Machine &amp; TensorFlow.js</p>
        </footer>
      </div>
    </div>
  );
}
