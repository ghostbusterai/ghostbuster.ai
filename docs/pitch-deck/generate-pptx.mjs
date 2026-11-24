import pptxgen from "pptxgenjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "GhostBuster-Pitch-Deck.pptx");

const BG = "0A0A0F";
const BG_PANEL = "111118";
const TEXT = "F0F0F5";
const TEXT_MUTED = "B8B8C0";
const ACCENT = "B8FF57";
const FONT = "Calibri";

const pptx = new pptxgen();
pptx.layout = "LAYOUT_16x9";
pptx.author = "GhostBuster AI";
pptx.title = "GhostBuster AI — Pitch Deck";
pptx.subject = "Investor pitch deck";

function darkSlide(title) {
  const slide = pptx.addSlide();
  slide.background = { color: BG };
  if (title) {
    slide.addText(title, {
      x: 0.5,
      y: 0.35,
      w: 9,
      h: 0.35,
      fontSize: 11,
      bold: true,
      color: ACCENT,
      charSpacing: 2,
      fontFace: FONT,
    });
  }
  return slide;
}

function heading(slide, text, y = 0.75) {
  slide.addText(text, {
    x: 0.5,
    y,
    w: 9,
    h: 0.7,
    fontSize: 28,
    bold: true,
    color: TEXT,
    fontFace: FONT,
  });
}

function bodyText(slide, text, opts = {}) {
  slide.addText(text, {
    x: opts.x ?? 0.5,
    y: opts.y ?? 1.5,
    w: opts.w ?? 9,
    h: opts.h ?? 4,
    fontSize: opts.fontSize ?? 14,
    color: opts.color ?? TEXT_MUTED,
    fontFace: FONT,
    valign: "top",
    ...opts,
  });
}

function bullets(slide, items, opts = {}) {
  const rows = items.map((t) => ({
    text: t,
    options: { bullet: { code: "2022" }, breakLine: true },
  }));
  slide.addText(rows, {
    x: opts.x ?? 0.5,
    y: opts.y ?? 1.55,
    w: opts.w ?? 4.3,
    h: opts.h ?? 3.8,
    fontSize: opts.fontSize ?? 13,
    color: TEXT_MUTED,
    fontFace: FONT,
    valign: "top",
  });
}

function quote(slide, text, opts = {}) {
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: opts.x ?? 0.5,
    y: opts.y ?? 2.2,
    w: opts.w ?? 4.2,
    h: opts.h ?? 1.4,
    fill: { color: BG_PANEL },
    line: { color: ACCENT, width: 1 },
  });
  slide.addText(text, {
    x: (opts.x ?? 0.5) + 0.15,
    y: (opts.y ?? 2.2) + 0.12,
    w: (opts.w ?? 4.2) - 0.3,
    h: (opts.h ?? 1.4) - 0.24,
    fontSize: 16,
    bold: true,
    color: ACCENT,
    fontFace: FONT,
    valign: "middle",
  });
}

function table(slide, headers, rows, opts = {}) {
  const data = [
    headers.map((h) => ({
      text: h,
      options: { bold: true, color: ACCENT, fill: { color: BG_PANEL } },
    })),
    ...rows.map((row) =>
      row.map((cell, i) => ({
        text: cell,
        options: { color: i === 0 ? TEXT : TEXT_MUTED, fill: { color: BG } },
      }))
    ),
  ];
  slide.addTable(data, {
    x: opts.x ?? 0.5,
    y: opts.y ?? 2.0,
    w: opts.w ?? 9,
    colW: opts.colW,
    fontSize: 11,
    fontFace: FONT,
    border: { type: "solid", color: "333340", pt: 0.5 },
    autoPage: false,
  });
}

// Slide 1 — Cover
{
  const slide = darkSlide();
  slide.addText("GhostBuster AI", {
    x: 0.5,
    y: 1.8,
    w: 9,
    h: 1,
    fontSize: 48,
    bold: true,
    color: TEXT,
    align: "center",
    fontFace: FONT,
  });
  slide.addText("The networking assistant that helps you keep the connections that matter.", {
    x: 0.8,
    y: 2.85,
    w: 8.4,
    h: 0.8,
    fontSize: 20,
    color: TEXT_MUTED,
    align: "center",
    fontFace: FONT,
  });
  slide.addText(
    "Turn messy student networking into a simple habit — remember who you met, follow up thoughtfully, and never ghost a good connection.",
    {
      x: 1,
      y: 3.6,
      w: 8,
      h: 0.7,
      fontSize: 14,
      color: TEXT_MUTED,
      align: "center",
      fontFace: FONT,
    }
  );
  slide.addText(
    "Founders: Ananya Pamal & Surabhi Komanduri  |  Carnegie Mellon University\nContact: [your email] · [your phone] · [LinkedIn]\nAugust 2026 · Pre-seed / Accelerator pitch",
    {
      x: 0.8,
      y: 4.6,
      w: 8.4,
      h: 1,
      fontSize: 12,
      color: TEXT_MUTED,
      align: "center",
      fontFace: FONT,
    }
  );
}

// Slide 2 — Problem & Insight
{
  const slide = darkSlide("PROBLEM & INSIGHT");
  heading(slide, "The follow-up gap in student networking");
  slide.addText("The problem", {
    x: 0.5,
    y: 1.45,
    w: 4.3,
    h: 0.35,
    fontSize: 16,
    bold: true,
    color: TEXT,
    fontFace: FONT,
  });
  bullets(slide, [
    "Students meet dozens of people at career fairs, coffee chats, and interviews — then lose momentum",
    "Contacts live in notes apps, LinkedIn threads, and memory",
    "Follow-ups feel awkward: “What do I say? Has it been too long?”",
    "Good intentions fade; relationships go cold",
    "Opportunities slip to people who stay in touch, not just who met once",
  ], { y: 1.85, h: 3.2 });
  slide.addText("Our insight", {
    x: 5.1,
    y: 1.45,
    w: 4.3,
    h: 0.35,
    fontSize: 16,
    bold: true,
    color: TEXT,
    fontFace: FONT,
  });
  quote(slide, "Your career isn’t shaped by who you meet — it’s shaped by who you stay in touch with.", {
    x: 5.1,
    y: 1.85,
    w: 4.3,
    h: 1.5,
  });
  bodyText(slide, "LinkedIn optimizes for discovery and visibility.\n\nGhostBuster optimizes for follow-through.", {
    x: 5.25,
    y: 3.5,
    w: 4,
    h: 1.5,
    fontSize: 14,
    color: TEXT_MUTED,
  });
}

// Slide 3 — Market
{
  const slide = darkSlide("MARKET");
  heading(slide, "College students — our wedge");
  slide.addText("Initial market", {
    x: 0.5,
    y: 1.45,
    w: 4.3,
    h: 0.3,
    fontSize: 15,
    bold: true,
    color: TEXT,
    fontFace: FONT,
  });
  bullets(slide, [
    "High volume of new contacts in short windows (career fairs, info sessions)",
    "High stakes: referrals and warm intros beat cold applications",
    "Digitally native, AI-comfortable, habit-forming life stage",
  ], { y: 1.8, h: 2.2 });
  slide.addText("Why now", {
    x: 5.1,
    y: 1.45,
    w: 4.3,
    h: 0.3,
    fontSize: 15,
    bold: true,
    color: TEXT,
    fontFace: FONT,
  });
  bullets(slide, [
    "AI messaging — draft warm follow-ups in seconds",
    "Remote networking — Zoom chats need Ghostwriter notes",
    "Job market pressure — edge beyond “connect on LinkedIn”",
    "CRM gap — no student-first post-meeting tool",
  ], { x: 5.1, y: 1.8, w: 4.3, h: 2.2 });
  table(
    slide,
    ["Segment", "Definition", "Size (edit)"],
    [
      ["TAM", "US college students + recent grads", "[e.g. 20M+ · source]"],
      ["SAM", "Students actively job-searching / networking", "[e.g. 4M · source]"],
      ["SOM", "Year 1–3: CMU + N target campuses", "[your plan]"],
    ],
    { y: 4.0, colW: [1.2, 4.5, 3.3] }
  );
}

// Slide 4 — Solution
{
  const slide = darkSlide("SOLUTION");
  heading(slide, "One place from “nice to meet you” to “following up”");
  bodyText(slide, "A networking assistant that helps you foster and maintain meaningful professional connections — from crafting the perfect first message to keeping those relationships warm over time.", {
    y: 1.45,
    h: 0.8,
    fontSize: 14,
  });
  const steps = [
    ["1. Meet someone", "Career fair, coffee chat, referral"],
    ["2. Save contact", "Role, company, notes, context"],
    ["3. Capture context", "Ghostwriter live notes → AI summary"],
    ["4. Follow up", "AI Compose drafts; Gmail draft/schedule"],
    ["5. Stay consistent", "Tracker + Reminders + Calendar"],
    ["6. Grow", "Résumé updates → AI suggests who to notify"],
  ];
  steps.forEach((s, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.5 + col * 3.1,
      y: 2.35 + row * 1.15,
      w: 2.9,
      h: 0.95,
      fill: { color: BG_PANEL },
      line: { color: "333340", width: 0.5 },
    });
    slide.addText(s[0], {
      x: 0.6 + col * 3.1,
      y: 2.42 + row * 1.15,
      w: 2.7,
      h: 0.35,
      fontSize: 12,
      bold: true,
      color: ACCENT,
      fontFace: FONT,
    });
    slide.addText(s[1], {
      x: 0.6 + col * 3.1,
      y: 2.75 + row * 1.15,
      w: 2.7,
      h: 0.45,
      fontSize: 11,
      color: TEXT_MUTED,
      fontFace: FONT,
    });
  });
  quote(slide, "GhostBuster doesn’t find strangers for you. It helps you nurture people you’ve already met.", {
    x: 0.5,
    y: 4.65,
    w: 9,
    h: 0.75,
  });
}

// Slide 5 — Product
{
  const slide = darkSlide("PRODUCT");
  heading(slide, "Live platform — built and deployed");
  const features = [
    ["👥 Contacts", "Save everyone you meet with context"],
    ["✨ AI Compose", "Draft warm outreach from contact + goal"],
    ["🎙 Ghostwriter", "Live meeting notes → AI summary"],
    ["📊 Tracker", "Log outreach; see connection warmth"],
    ["🔔 Reminders", "Never miss a follow-up; Calendar sync"],
    ["📄 Resume", "Version history + AI outreach on updates"],
    ["✉ Gmail", "Save drafts or schedule sends"],
    ["🔗 Demo", "ghostbuster-ai-js5l.onrender.com"],
  ];
  features.forEach((f, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.5 + col * 2.35,
      y: 1.55 + row * 1.55,
      w: 2.15,
      h: 1.35,
      fill: { color: BG_PANEL },
      line: { color: "333340", width: 0.5 },
    });
    slide.addText(f[0], {
      x: 0.58 + col * 2.35,
      y: 1.62 + row * 1.55,
      w: 2,
      h: 0.4,
      fontSize: 12,
      bold: true,
      color: TEXT,
      fontFace: FONT,
    });
    slide.addText(f[1], {
      x: 0.58 + col * 2.35,
      y: 2.05 + row * 1.55,
      w: 2,
      h: 0.75,
      fontSize: 10,
      color: TEXT_MUTED,
      fontFace: FONT,
    });
  });
  bodyText(slide, "[Insert 2–3 product screenshots on this slide]", {
    y: 4.85,
    h: 0.4,
    fontSize: 11,
    color: TEXT_MUTED,
  });
}

// Slide 6 — Differentiation
{
  const slide = darkSlide("DIFFERENTIATION");
  heading(slide, "The layer after the handshake");
  table(
    slide,
    ["", "LinkedIn", "GhostBuster AI"],
    [
      ["Core job", "Be found; grow network", "Keep relationships warm"],
      ["Starts after", "Connection request", "After you actually talk"],
      ["Context", "Profile + DM thread", "Meeting notes, touchpoints, résumé fit"],
      ["Follow-up", "Blank message box", "AI drafts + reminders + tracker"],
      ["Success metric", "Connections, views", "Consistent, thoughtful outreach"],
    ],
    { y: 1.45, colW: [1.8, 3.5, 3.7], fontSize: 10 }
  );
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 0.5,
    y: 4.15,
    w: 4.3,
    h: 1.0,
    fill: { color: BG_PANEL },
    line: { color: "333340", width: 0.5 },
  });
  slide.addText("vs. generic CRM / Notion: Built for students, not sales teams. AI-native compose + meeting summaries. Low setup.", {
    x: 0.65,
    y: 4.25,
    w: 4,
    h: 0.85,
    fontSize: 11,
    color: TEXT_MUTED,
    fontFace: FONT,
  });
  slide.addShape(pptx.shapes.RECTANGLE, {
    x: 5.1,
    y: 4.15,
    w: 4.4,
    h: 1.0,
    fill: { color: BG_PANEL },
    line: { color: ACCENT, width: 0.75 },
  });
  slide.addText("Moat (building): Habit + contact graph + conversation memory. Campus distribution. AI tuned for warm student networking.", {
    x: 5.25,
    y: 4.25,
    w: 4.1,
    h: 0.85,
    fontSize: 11,
    color: TEXT_MUTED,
    fontFace: FONT,
  });
}

// Slide 7 — Traction
{
  const slide = darkSlide("TRACTION");
  heading(slide, "Product live · CMU founding wedge");
  table(
    slide,
    ["Metric", "Today", "6 mo target"],
    [
      ["Registered users", "[ ]", "[ ]"],
      ["Contacts saved", "[ ]", "[ ]"],
      ["Outreach logged", "[ ]", "[ ]"],
      ["Ghostwriter sessions", "[ ]", "[ ]"],
      ["Campuses / pilots", "CMU (founding)", "[ ]"],
    ],
    { x: 0.5, y: 1.45, w: 4.3, colW: [1.6, 1.2, 1.5] }
  );
  bodyText(slide, "Live web app · Google sign-in · MongoDB · End-to-end workflow shipped", {
    x: 0.5,
    y: 4.0,
    w: 4.3,
    h: 0.4,
    fontSize: 10,
  });
  slide.addText("Roadmap", {
    x: 5.1,
    y: 1.45,
    w: 4.3,
    h: 0.35,
    fontSize: 16,
    bold: true,
    color: TEXT,
    fontFace: FONT,
  });
  const roadmap = [
    ["Now", "CMU beta, career center + club pilots"],
    ["Next", "Mobile UX, referral loops, analytics dashboard"],
    ["Scale", "B2B2C: universities, career services, alumni networks"],
  ];
  roadmap.forEach((r, i) => {
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 5.1,
      y: 1.9 + i * 1.05,
      w: 4.4,
      h: 0.85,
      fill: { color: BG_PANEL },
      line: { color: i === 2 ? ACCENT : "333340", width: i === 2 ? 0.75 : 0.5 },
    });
    slide.addText(`${r[0]} — ${r[1]}`, {
      x: 5.25,
      y: 2.05 + i * 1.05,
      w: 4.1,
      h: 0.6,
      fontSize: 12,
      color: TEXT_MUTED,
      fontFace: FONT,
    });
  });
}

// Slide 8 — Business Model
{
  const slide = darkSlide("BUSINESS MODEL");
  heading(slide, "Freemium habit → institutional scale");
  const models = [
    ["1. Freemium", "Free core; premium AI limits, advanced analytics, Ghostwriter power features"],
    ["2. Campus license", "Per-seat or per-school annual contract with career centers"],
    ["3. Partnerships", "Interview prep, mentorship marketplaces (later stage)"],
  ];
  models.forEach((m, i) => {
    slide.addShape(pptx.shapes.RECTANGLE, {
      x: 0.5 + i * 3.15,
      y: 1.5,
      w: 2.95,
      h: 1.5,
      fill: { color: BG_PANEL },
      line: { color: i === 0 ? ACCENT : "333340", width: i === 0 ? 0.75 : 0.5 },
    });
    slide.addText(m[0], {
      x: 0.65 + i * 3.15,
      y: 1.58,
      w: 2.65,
      h: 0.35,
      fontSize: 14,
      bold: true,
      color: TEXT,
      fontFace: FONT,
    });
    slide.addText(m[1], {
      x: 0.65 + i * 3.15,
      y: 1.95,
      w: 2.65,
      h: 0.95,
      fontSize: 11,
      color: TEXT_MUTED,
      fontFace: FONT,
    });
  });
  table(
    slide,
    ["Metric", "Hypothesis (edit)"],
    [
      ["CAC", "[ ]"],
      ["LTV", "[ ]"],
      ["Pricing", "[e.g. $X/mo student Pro · $Y/k/year campus]"],
    ],
    { y: 3.35, colW: [2, 7] }
  );
}

// Slide 9 — Team
{
  const slide = darkSlide("TEAM");
  heading(slide, "Built by students who live this problem");
  slide.addImage({
    path: path.join(__dirname, "assets", "ananya.png"),
    x: 0.5,
    y: 1.55,
    w: 1.0,
    h: 1.0,
    rounding: true,
  });
  slide.addText("Ananya Pamal — Co-founder", {
    x: 1.65,
    y: 1.55,
    w: 3.2,
    h: 0.35,
    fontSize: 16,
    bold: true,
    color: TEXT,
    fontFace: FONT,
  });
  slide.addText("Mechanical Engineering · CS minor · CMU", {
    x: 1.65,
    y: 1.9,
    w: 3.2,
    h: 0.3,
    fontSize: 11,
    color: ACCENT,
    fontFace: FONT,
  });
  slide.addText("Student researcher, RocketSmith lab. Teaching assistant, engineering course.\n[Add 1 line on why Ananya cares about this problem]\nlinkedin.com/in/ananya-pamal", {
    x: 1.65,
    y: 2.2,
    w: 3.2,
    h: 1.2,
    fontSize: 11,
    color: TEXT_MUTED,
    fontFace: FONT,
  });
  slide.addImage({
    path: path.join(__dirname, "assets", "surabhi.png"),
    x: 5.1,
    y: 1.55,
    w: 1.0,
    h: 1.0,
    rounding: true,
  });
  slide.addText("Surabhi Komanduri — Co-founder", {
    x: 6.25,
    y: 1.55,
    w: 3.2,
    h: 0.35,
    fontSize: 16,
    bold: true,
    color: TEXT,
    fontFace: FONT,
  });
  slide.addText("Business · HCI · CMU", {
    x: 6.25,
    y: 1.9,
    w: 3.2,
    h: 0.3,
    fontSize: 11,
    color: ACCENT,
    fontFace: FONT,
  });
  slide.addText("Swartz Innovation Scholar. Executive boards: UEA & TMA. TA, business leadership; orientation counselor.\nlinkedin.com/in/surabhi-komanduri", {
    x: 6.25,
    y: 2.2,
    w: 3.2,
    h: 1.2,
    fontSize: 11,
    color: TEXT_MUTED,
    fontFace: FONT,
  });
  quote(slide, "We’re students who live this problem every recruiting season — and we’ve built the product we wished existed after every career fair.", {
    x: 0.5,
    y: 3.85,
    w: 9,
    h: 0.9,
  });
}

// Slide 10 — The Ask
{
  const slide = darkSlide("THE ASK");
  heading(slide, "Raising to scale campus-by-campus");
  slide.addText("$[amount]", {
    x: 0.5,
    y: 1.5,
    w: 4.3,
    h: 0.75,
    fontSize: 44,
    bold: true,
    color: ACCENT,
    fontFace: FONT,
  });
  slide.addText("[Pre-seed / Seed] · [18 / 24] months runway", {
    x: 0.5,
    y: 2.25,
    w: 4.3,
    h: 0.4,
    fontSize: 16,
    color: TEXT_MUTED,
    fontFace: FONT,
  });
  slide.addText("What this round unlocks", {
    x: 0.5,
    y: 2.75,
    w: 4.3,
    h: 0.35,
    fontSize: 14,
    bold: true,
    color: TEXT,
    fontFace: FONT,
  });
  bullets(slide, [
    "[ ] active campus pilots",
    "[ ] paying career-center or student Pro subscribers",
    "Clear retention + weekly outreach habit metrics",
  ], { y: 3.1, h: 1.5 });
  slide.addText("Use of funds", {
    x: 5.1,
    y: 1.45,
    w: 4.3,
    h: 0.35,
    fontSize: 14,
    bold: true,
    color: TEXT,
    fontFace: FONT,
  });
  table(
    slide,
    ["Category", "%", "Purpose"],
    [
      ["Product & engineering", "[ ]%", "Mobile, reliability, AI quality"],
      ["Go-to-market", "[ ]%", "Campus pilots, career-center sales"],
      ["Operations & legal", "[ ]%", "Incorporation, security, compliance"],
      ["Buffer", "[ ]%", "Runway"],
    ],
    { x: 5.1, y: 1.85, w: 4.4, colW: [1.5, 0.6, 2.3] }
  );
}

// Slide 11 — Thank You
{
  const slide = darkSlide();
  slide.addText("GhostBuster AI", {
    x: 0.5,
    y: 1.6,
    w: 9,
    h: 0.9,
    fontSize: 44,
    bold: true,
    color: TEXT,
    align: "center",
    fontFace: FONT,
  });
  slide.addText("Keep the connections that change your career.", {
    x: 0.8,
    y: 2.5,
    w: 8.4,
    h: 0.5,
    fontSize: 20,
    color: ACCENT,
    align: "center",
    fontFace: FONT,
  });
  slide.addText(
    "Ananya Pamal — [email] · [phone]\nSurabhi Komanduri — [email] · [phone]\n\nghostbuster-ai-js5l.onrender.com\ngithub.com/ghostbusterai/ghostbuster.ai\n\nThank you.",
    {
      x: 1,
      y: 3.2,
      w: 8,
      h: 2,
      fontSize: 14,
      color: TEXT_MUTED,
      align: "center",
      fontFace: FONT,
    }
  );
}

await pptx.writeFile({ fileName: OUT });
console.log(`Wrote ${OUT}`);
