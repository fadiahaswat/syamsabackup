import { useState } from "react";
import {
  Check, Clock, Thermometer, FileText, Home, AlertTriangle, Minus,
  Eye, EyeOff, Search, Bell, Moon, Sun, ChevronDown, Download,
  BookOpen, BarChart2, User, ClipboardList,
  CheckCircle, Info, AlertCircle, XCircle, X, Loader,
  Users, TrendingUp, TrendingDown, ArrowRight, ChevronRight, WifiOff, Wifi,
  Trophy, Medal, Star, Flame, GraduationCap,
  Globe, Wrench, BookMarked, Crown, ShieldCheck, Stethoscope, HeartPulse, UserCheck, UserCog,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import syamsaLogo from "@/imports/Syamsa-1.png";
import logoPrimary       from "@/imports/Primary_Logo.png";
import logoVertical      from "@/imports/Vertical_Logo.png";
import logoMark          from "@/imports/Logomark.png";
import logoWordmark      from "@/imports/Wordmark.png";
import logoMuallimin     from "@/imports/Logo_Mu_allimin.png";
import logoMuhammadiyah  from "@/imports/LOGO_PP_MUHAMMADIYAH_HOR-1.png";

function cx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

type StatusKey = "H" | "T" | "S" | "I" | "P" | "A" | "Y" | "-";

const STATUS_META: Record<StatusKey, { label: string; color: string; bg: string; icon: React.ReactNode; score: number }> = {
  H: { label: "Hadir",  color: "#10B981", bg: "rgba(16,185,129,0.12)",  icon: <Check size={12} strokeWidth={2.5} />, score: 100 },
  Y: { label: "Ya",     color: "#10B981", bg: "rgba(16,185,129,0.12)",  icon: <Check size={12} strokeWidth={2.5} />, score: 100 },
  T: { label: "Telat",  color: "#17C3D4", bg: "rgba(23,195,212,0.12)",  icon: <Clock size={12} />, score: 80 },
  S: { label: "Sakit",  color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  icon: <Thermometer size={12} />, score: 75 },
  I: { label: "Izin",   color: "#3B82F6", bg: "rgba(59,130,246,0.12)",  icon: <FileText size={12} />, score: 75 },
  P: { label: "Pulang", color: "#A855F7", bg: "rgba(168,85,247,0.12)",  icon: <Home size={12} />, score: 0 },
  A: { label: "Alpa",   color: "#EF4444", bg: "rgba(239,68,68,0.12)",   icon: <AlertTriangle size={12} />, score: -50 },
  "-": { label: "Tidak", color: "#64748B", bg: "rgba(100,116,139,0.12)", icon: <Minus size={12} />, score: 0 },
};

const SESI_META = [
  { id: "shubuh",  label: "Shubuh",  time: "04:00–06:00", color: "#22C55E", bg: "rgba(34,197,94,0.12)",   cssVar: "--color-sesi-shubuh",  desc: "Fardu, sunnah, tahfizh",  icon: <Star /> },
  { id: "sekolah", label: "Sekolah", time: "06:00–15:00", color: "#17C3D4", bg: "rgba(23,195,212,0.12)",  cssVar: "--color-sesi-sekolah", desc: "KBM sekolah",              icon: <GraduationCap /> },
  { id: "ashar",   label: "Ashar",   time: "15:00–17:00", color: "#EAB308", bg: "rgba(234,179,8,0.12)",   cssVar: "--color-sesi-ashar",   desc: "Fardu, dzikir",            icon: <Sun /> },
  { id: "maghrib", label: "Maghrib", time: "18:00–19:00", color: "#FB923C", bg: "rgba(251,146,60,0.12)",  cssVar: "--color-sesi-maghrib", desc: "Fardu, sunnah, KBM mahad", icon: <Flame /> },
  { id: "isya",    label: "Isya",    time: "19:00–21:00", color: "#8B5CF6", bg: "rgba(139,92,246,0.12)",  cssVar: "--color-sesi-isya",    desc: "Fardu, sunnah, Al-Kahfi",  icon: <Moon /> },
];

function SectionHeader({ number, title, description }: { number: string; title: string; description?: string }) {
  return (
    <div className="mb-8 pb-4 border-b border-border">
      <div className="flex items-baseline gap-4">
        <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-xs text-muted-foreground tracking-widest">{number}</span>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
      </div>
      {description && <p className="mt-1 ml-10 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function ColorSwatch({ hex, name, cssVar, role }: { hex: string; name: string; cssVar?: string; role?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const isDark = (h: string) => {
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  };
  return (
    <button onClick={copy} className="group rounded-xl overflow-hidden border border-border hover:shadow-lg transition-all duration-200 text-left w-full">
      <div className="h-16 flex items-end p-2" style={{ background: hex }}>
        {copied && (
          <span className={cx("text-[10px] font-bold px-1.5 py-0.5 rounded", isDark(hex) ? "bg-white/20 text-white" : "bg-black/15 text-black")}>
            Disalin!
          </span>
        )}
      </div>
      <div className="p-3 bg-card">
        <p className="text-xs font-semibold text-foreground">{name}</p>
        {role && <p className="text-[10px] text-muted-foreground mt-0.5">{role}</p>}
        <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-[10px] text-muted-foreground mt-1">{hex}</p>
        {cssVar && <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-[10px] text-muted-foreground truncate">{cssVar}</p>}
      </div>
    </button>
  );
}

function StatusBadge({ statusKey }: { statusKey: StatusKey }) {
  const s = STATUS_META[statusKey];
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold" style={{ color: s.color, background: s.bg }}>
      {s.icon}<span>{statusKey}</span>
    </span>
  );
}

function Btn({ variant = "primary", size = "md", children, disabled, loading }: {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "attendance" | "tahfizh";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
}) {
  const base = "inline-flex items-center justify-center gap-2 font-semibold rounded-[0.875rem] transition-all duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2";
  const sizes = { sm: "h-8 px-4 text-xs", md: "h-10 px-5 text-sm", lg: "h-12 px-6 text-base" };
  const variants = {
    primary:    "bg-[#0C81E4] text-white hover:brightness-110",
    attendance: "bg-[#10B981] text-white hover:brightness-110",
    tahfizh:    "bg-[#F97316] text-white hover:brightness-110",
    danger:     "bg-[#EF4444] text-white hover:brightness-110",
    secondary:  "bg-card text-foreground border border-border hover:bg-muted",
    ghost:      "bg-transparent text-foreground hover:bg-muted",
  };
  return (
    <button className={cx(base, sizes[size], variants[variant], disabled && "opacity-50 cursor-not-allowed")} disabled={disabled || loading}>
      {loading && <Loader size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

function ToastItem({ type }: { type: "success" | "info" | "warning" | "error" }) {
  const config = {
    success: { icon: <CheckCircle size={16} />, color: "#10B981", bg: "#F0FDF4", border: "#BBF7D0", title: "Presensi tersimpan", desc: "Sesi Isya berhasil dikonfirmasi." },
    info:    { icon: <Info size={16} />,         color: "#3B82F6", bg: "#EFF6FF", border: "#BFDBFE", title: "Sesi akan dimulai", desc: "Sesi Maghrib dimulai dalam 15 menit." },
    warning: { icon: <AlertCircle size={16} />,  color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", title: "3 santri belum hadir", desc: "Segera lakukan konfirmasi status." },
    error:   { icon: <XCircle size={16} />,      color: "#EF4444", bg: "#FEF2F2", border: "#FECACA", title: "Gagal menyimpan", desc: "Cek koneksi dan coba lagi." },
  };
  const c = config[type];
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-xl border text-sm" style={{ background: c.bg, borderColor: c.border }}>
      <span style={{ color: c.color }} className="mt-0.5 shrink-0">{c.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold" style={{ color: c.color }}>{c.title}</p>
        <p className="text-xs mt-0.5 text-muted-foreground">{c.desc}</p>
      </div>
      <button className="text-muted-foreground hover:text-foreground transition-colors"><X size={14} /></button>
    </div>
  );
}

// ─── Chart components (isolated to prevent Recharts key collision) ───────────

const AREA_DATA = [
  {d:"1",pct:88},{d:"3",pct:91},{d:"5",pct:87},{d:"7",pct:93},{d:"9",pct:89},
  {d:"11",pct:95},{d:"13",pct:92},{d:"15",pct:90},{d:"17",pct:94},{d:"19",pct:91},
  {d:"21",pct:96},{d:"23",pct:93},{d:"25",pct:89},{d:"27",pct:95},{d:"29",pct:97},
];
function TrendAreaChart() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={AREA_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="areaGradStat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
        <XAxis dataKey="d" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
        <YAxis domain={[80,100]} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }} formatter={(v) => [`${v}%`, "Kehadiran"]} />
        <Area type="monotone" dataKey="pct" stroke="#10B981" strokeWidth={2.5} fill="url(#areaGradStat)" dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const BAR_KELAS_DATA = [
  {k:"10A",hadir:95},{k:"10B",hadir:88},{k:"11A",hadir:92},{k:"11B",hadir:79},{k:"12A",hadir:96},{k:"12B",hadir:84},
];
function BarKelasChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={BAR_KELAS_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
        <XAxis dataKey="k" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
        <YAxis domain={[70,100]} tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }} formatter={(v) => [`${v}%`, "Hadir"]} />
        <Bar dataKey="hadir" radius={[6, 6, 0, 0]} fill="#0C81E4" />
      </BarChart>
    </ResponsiveContainer>
  );
}

const STACKED_DATA = [
  {s:"Shubuh",H:88,T:6,S:2,A:4},{s:"Sekolah",H:92,T:4,S:2,A:2},
  {s:"Ashar",H:85,T:8,S:3,A:4},{s:"Maghrib",H:90,T:5,S:2,A:3},{s:"Isya",H:87,T:7,S:3,A:3},
];
function StackedBarChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={STACKED_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
        <XAxis dataKey="s" tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid rgba(0,0,0,0.08)", fontSize: 11 }} />
        <Bar dataKey="H" stackId="s" fill="#10B981" name="Hadir" />
        <Bar dataKey="T" stackId="s" fill="#17C3D4" name="Telat" />
        <Bar dataKey="S" stackId="s" fill="#F59E0B" name="Sakit" />
        <Bar dataKey="A" stackId="s" fill="#EF4444" name="Alpa" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SparklineChart({ data, dk, color }: { data: number[]; dk: string; color: string }) {
  const chartData = data.map((v, i) => ({ x: i, [dk]: v }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData}>
        <Line type="monotone" dataKey={dk} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Role Icons (Lucide) ──────────────────────────────────────────────────────

const ROLE_ICONS: {
  id: string; label: string; color: string; bg: string;
  icon: React.ReactNode; badge?: string;
}[] = [
  { id:"kelas1", label:"Santri Kelas 1", color:"#2563EB", bg:"#DBEAFE", icon:<GraduationCap size={22}/>, badge:"1" },
  { id:"kelas2", label:"Santri Kelas 2", color:"#7C3AED", bg:"#EDE9FE", icon:<GraduationCap size={22}/>, badge:"2" },
  { id:"kelas3", label:"Santri Kelas 3", color:"#059669", bg:"#D1FAE5", icon:<GraduationCap size={22}/>, badge:"3" },
  { id:"kelas4", label:"Santri Kelas 4", color:"#D97706", bg:"#FEF3C7", icon:<GraduationCap size={22}/>, badge:"4" },
  { id:"kelas5", label:"Santri Kelas 5", color:"#0891B2", bg:"#CFFAFE", icon:<GraduationCap size={22}/>, badge:"5" },
  { id:"kelas6", label:"Santri Kelas 6", color:"#4F46E5", bg:"#E0E7FF", icon:<GraduationCap size={22}/>, badge:"6" },
  { id:"unggulan",      label:"Program Unggulan",       color:"#B45309", bg:"#FEF3C7", icon:<Star size={22}/>       },
  { id:"internasional", label:"Program Internasional",  color:"#0C81E4", bg:"#E0F2FE", icon:<Globe size={22}/>      },
  { id:"musyrif",  label:"Musyrif",  color:"#0C4E8C", bg:"#DBEAFE", icon:<ClipboardList size={22}/> },
  { id:"pamong",   label:"Pamong",   color:"#78350F", bg:"#FEF3C7", icon:<UserCheck size={22}/>     },
  { id:"mujanib",  label:"Mujanib",  color:"#374151", bg:"#F3F4F6", icon:<Wrench size={22}/>        },
  { id:"guru",     label:"Guru",     color:"#1D4ED8", bg:"#DBEAFE", icon:<BookMarked size={22}/>    },
  { id:"direksi",  label:"Direksi",  color:"#0C1F3D", bg:"#E0E7FF", icon:<Crown size={22}/>         },
  { id:"satpam",   label:"Satpam",   color:"#1F2937", bg:"#F3F4F6", icon:<ShieldCheck size={22}/>   },
  { id:"dokter",   label:"Dokter",   color:"#0891B2", bg:"#CFFAFE", icon:<Stethoscope size={22}/>   },
  { id:"perawat",  label:"Perawat",  color:"#BE185D", bg:"#FCE7F3", icon:<HeartPulse size={22}/>    },
];

const NAV_ITEMS = [
  { id: "brand", label: "Brand" }, { id: "colors", label: "Warna" },
  { id: "typography", label: "Tipografi" }, { id: "buttons", label: "Button" },
  { id: "badges", label: "Badge" }, { id: "cards", label: "Card" },
  { id: "sesi", label: "Sesi" }, { id: "forms", label: "Form" },
  { id: "status", label: "Status" }, { id: "toasts", label: "Toast" },
  { id: "navigation", label: "Nav" }, { id: "glass", label: "Glass" },
  { id: "statistics", label: "Statistik" }, { id: "streak", label: "🔥 Streak" },
  { id: "quran", label: "Al-Qur'an" }, { id: "roles", label: "Role Icons" },
];

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checked, setChecked] = useState(false);
  const [toggled, setToggled] = useState(true);
  const [activeTab, setActiveTab] = useState("Rekap");
  const [activeNav, setActiveNav] = useState("home");

  return (
    <div className={cx("min-h-screen", darkMode && "dark")} style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: "var(--background)" }}>

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <img src={syamsaLogo} alt="Syamsa" className="h-7 w-auto object-contain brightness-0 invert" />
            <div className="h-4 w-px bg-white/15 hidden sm:block" />
            <span className="text-xs font-semibold text-slate-400 hidden sm:block tracking-wide">Design System</span>
          </div>
          <nav className="hidden lg:flex items-center gap-0.5 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <a key={item.id} href={`#${item.id}`}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap">
                {item.label}
              </a>
            ))}
          </nav>
          <button onClick={() => setDarkMode(!darkMode)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-colors shrink-0">
            {darkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0C4E8C 0%, #0C81E4 50%, #17C3D4 100%)" }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 60%, #4FE7AF 0%, transparent 50%), radial-gradient(circle at 85% 20%, #fff 0%, transparent 40%)"
        }} />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <img src={syamsaLogo} alt="Syamsa" className="h-10 w-auto object-contain brightness-0 invert mb-5" />
          <h1 className="text-3xl sm:text-4xl font-black text-white">Design System</h1>
          <p className="mt-3 text-white/70 max-w-lg text-base">
            Referensi visual resmi untuk <strong className="text-white">Syamsa PWA</strong> — token, komponen, pola, dan aturan desain dalam satu halaman.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {["Plus Jakarta Sans", "Lucide Icons", "Tailwind CSS", "v2.0"].map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full bg-white/15 text-white text-xs font-medium border border-white/20">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-20">

        {/* 00 — BRAND ASSETS */}
        <section id="brand">
          <SectionHeader number="00" title="Brand Assets" description="Logo resmi Syamsa dan Mu'allimin — varian, penggunaan, dan panduan clear space." />

          {/* ── Logo Variants ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Logo Variants</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { src: logoPrimary,  alt: "Syamsa Primary Logo",  label: "Primary Logo",  desc: "Horizontal · Default",        bg: "bg-card border border-border", imgCls: "", textCls: "text-foreground", subCls: "text-muted-foreground" },
                { src: logoPrimary,  alt: "Syamsa Primary Logo",  label: "Primary Logo",  desc: "Horizontal · Dark background", bg: "",                              style: { background: "#0C1F3D" }, imgCls: "brightness-0 invert", textCls: "text-white", subCls: "text-white/50" },
                { src: logoPrimary,  alt: "Syamsa Primary Logo",  label: "Primary Logo",  desc: "Horizontal · Brand gradient",  bg: "",                              style: { background: "linear-gradient(135deg,#0C4E8C,#0C81E4,#17C3D4)" }, imgCls: "brightness-0 invert", textCls: "text-white", subCls: "text-white/50" },
                { src: logoVertical, alt: "Syamsa Vertical Logo", label: "Vertical Logo", desc: "Mark di atas Wordmark",        bg: "bg-card border border-border", imgCls: "", textCls: "text-foreground", subCls: "text-muted-foreground" },
                { src: logoMark,     alt: "Syamsa Logomark",      label: "Logomark",      desc: "Icon · App icon, favicon",     bg: "bg-card border border-border", imgCls: "", textCls: "text-foreground", subCls: "text-muted-foreground" },
                { src: logoWordmark, alt: "Syamsa Wordmark",      label: "Wordmark",      desc: "Teks · Header, watermark",     bg: "bg-card border border-border", imgCls: "", textCls: "text-foreground", subCls: "text-muted-foreground" },
              ].map((item, i) => (
                <div key={i} className={`rounded-[1.5rem] p-6 flex flex-col items-center gap-4 ${item.bg}`} style={(item as any).style}>
                  <div className="flex items-center justify-center h-20 w-full">
                    <img src={item.src} alt={item.alt} className={`max-h-16 max-w-full w-auto object-contain ${item.imgCls}`} />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-bold ${item.textCls}`}>{item.label}</p>
                    <p className={`text-xs mt-0.5 ${item.subCls}`}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Partner Brands ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Partner Brands</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { src: logoMuallimin,    alt: "Logo Mu'allimin",     label: "Mu'allimin",       desc: "Light bg",  bg: "bg-card border border-border", imgCls: "", textCls: "text-foreground", subCls: "text-muted-foreground" },
                { src: logoMuallimin,    alt: "Logo Mu'allimin",     label: "Mu'allimin",       desc: "Dark bg",   bg: "", style: { background: "#0C1F3D" }, imgCls: "brightness-0 invert", textCls: "text-white", subCls: "text-white/50" },
                { src: logoMuhammadiyah, alt: "Logo PP Muhammadiyah",label: "PP Muhammadiyah",  desc: "Light bg",  bg: "bg-card border border-border", imgCls: "", textCls: "text-foreground", subCls: "text-muted-foreground" },
                { src: logoMuhammadiyah, alt: "Logo PP Muhammadiyah",label: "PP Muhammadiyah",  desc: "Dark bg",   bg: "", style: { background: "#0C1F3D" }, imgCls: "brightness-0 invert", textCls: "text-white", subCls: "text-white/50" },
              ].map((item, i) => (
                <div key={i} className={`rounded-[1.5rem] p-6 flex flex-col items-center gap-4 ${item.bg}`} style={(item as any).style}>
                  <div className="flex items-center justify-center h-16 w-full">
                    <img src={item.src} alt={item.alt} className={`max-h-12 max-w-full w-auto object-contain ${item.imgCls}`} />
                  </div>
                  <div className="text-center">
                    <p className={`text-sm font-bold ${item.textCls}`}>{item.label}</p>
                    <p className={`text-xs mt-0.5 ${item.subCls}`}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Logomark sizes ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Logomark — Size Scale</p>
            <div className="bg-card rounded-[1.5rem] border border-border p-6 flex flex-wrap items-end gap-8">
              {[
                { size: 16,  label: "16px",  use: "Favicon" },
                { size: 24,  label: "24px",  use: "Nav inline" },
                { size: 32,  label: "32px",  use: "Header" },
                { size: 48,  label: "48px",  use: "App icon SM" },
                { size: 64,  label: "64px",  use: "App icon MD" },
                { size: 96,  label: "96px",  use: "Splash screen" },
                { size: 128, label: "128px", use: "App store" },
              ].map((s) => (
                <div key={s.size} className="flex flex-col items-center gap-2">
                  <img src={logoMark} alt="Logomark" style={{ width: s.size, height: s.size }} className="object-contain" />
                  <div className="text-center">
                    <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-[10px] font-semibold text-foreground">{s.label}</p>
                    <p className="text-[9px] text-muted-foreground">{s.use}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Logo Lockup / Sejajar ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Logo Lockup — Disejajarkan</p>
            <div className="space-y-4">

              {/* Light background */}
              <div className="bg-card rounded-[1.5rem] border border-border p-8">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-6">Light Background</p>
                <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
                  <img src={logoMuhammadiyah} alt="PP Muhammadiyah" className="h-12 w-auto object-contain" />
                  <div className="w-px h-10 bg-border hidden sm:block" />
                  <img src={logoMuallimin} alt="Mu'allimin" className="h-12 w-auto object-contain" />
                  <div className="w-px h-10 bg-border hidden sm:block" />
                  <img src={logoPrimary} alt="Syamsa" className="h-12 w-auto object-contain" />
                </div>
              </div>

              {/* Dark background */}
              <div className="rounded-[1.5rem] p-8" style={{ background: "#0C1F3D" }}>
                <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-6">Dark Background</p>
                <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
                  <img src={logoMuhammadiyah} alt="PP Muhammadiyah" className="h-12 w-auto object-contain brightness-0 invert" />
                  <div className="w-px h-10 hidden sm:block" style={{ background: "rgba(255,255,255,0.15)" }} />
                  <img src={logoMuallimin} alt="Mu'allimin" className="h-12 w-auto object-contain brightness-0 invert" />
                  <div className="w-px h-10 hidden sm:block" style={{ background: "rgba(255,255,255,0.15)" }} />
                  <img src={logoPrimary} alt="Syamsa" className="h-12 w-auto object-contain brightness-0 invert" />
                </div>
              </div>

              {/* Brand gradient */}
              <div className="rounded-[1.5rem] p-8" style={{ background: "linear-gradient(135deg, #0C4E8C 0%, #0C81E4 50%, #17C3D4 100%)" }}>
                <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider mb-6">Brand Gradient</p>
                <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
                  <img src={logoMuhammadiyah} alt="PP Muhammadiyah" className="h-12 w-auto object-contain brightness-0 invert" />
                  <div className="w-px h-10 hidden sm:block" style={{ background: "rgba(255,255,255,0.3)" }} />
                  <img src={logoMuallimin} alt="Mu'allimin" className="h-12 w-auto object-contain brightness-0 invert" />
                  <div className="w-px h-10 hidden sm:block" style={{ background: "rgba(255,255,255,0.3)" }} />
                  <img src={logoPrimary} alt="Syamsa" className="h-12 w-auto object-contain brightness-0 invert" />
                </div>
              </div>

              {/* Compact — logomark only */}
              <div className="bg-card rounded-[1.5rem] border border-border p-6">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-5">Compact — Logomark + Wordmark</p>
                <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8">
                  <img src={logoMuhammadiyah} alt="PP Muhammadiyah" className="h-8 w-auto object-contain" />
                  <div className="w-px h-6 bg-border" />
                  <img src={logoMuallimin} alt="Mu'allimin" className="h-8 w-auto object-contain" />
                  <div className="w-px h-6 bg-border" />
                  <img src={logoMark} alt="Syamsa" className="h-8 w-auto object-contain" />
                  <img src={logoWordmark} alt="Syamsa" className="h-6 w-auto object-contain" />
                </div>
              </div>

            </div>
          </div>

          {/* ── Usage rules ── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Panduan Penggunaan</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Do */}
              <div className="bg-card rounded-[1.5rem] border border-emerald-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check size={12} className="text-white" strokeWidth={3} />
                  </div>
                  <p className="text-sm font-bold text-emerald-700">Boleh (Do)</p>
                </div>
                <ul className="space-y-2">
                  {[
                    "Gunakan Primary Logo untuk sebagian besar kebutuhan",
                    "Gunakan Logomark saja untuk ukuran kecil (< 32px)",
                    "Gunakan versi inverted (putih) di atas background gelap",
                    "Berikan clear space minimal 1× tinggi logomark di sekeliling logo",
                    "Gunakan Vertical Logo untuk format portrait / square",
                  ].map((rule) => (
                    <li key={rule} className="flex items-start gap-2 text-xs text-foreground">
                      <Check size={12} className="text-emerald-500 mt-0.5 shrink-0" strokeWidth={3} />
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
              {/* Don't */}
              <div className="bg-card rounded-[1.5rem] border border-red-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                    <X size={12} className="text-white" strokeWidth={3} />
                  </div>
                  <p className="text-sm font-bold text-red-700">Dilarang (Don't)</p>
                </div>
                <ul className="space-y-2">
                  {[
                    "Jangan ubah warna logo dari palet resmi",
                    "Jangan stretch atau distorsi proporsi logo",
                    "Jangan tambahkan shadow, outline, atau efek di atas logo",
                    "Jangan gunakan logo di atas background yang kontrasnya rendah",
                    "Jangan rotasi logo kecuali untuk keperluan motion yang disetujui",
                  ].map((rule) => (
                    <li key={rule} className="flex items-start gap-2 text-xs text-foreground">
                      <X size={12} className="text-red-500 mt-0.5 shrink-0" strokeWidth={3} />
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 01 — COLORS */}
        <section id="colors">
          <SectionHeader number="01" title="Color Palette" description="Token warna resmi. Klik swatch untuk menyalin hex." />
          <div className="space-y-8">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Brand Utama</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ColorSwatch hex="#0C4E8C" name="Brand Deep" cssVar="--color-brand-deep" role="Heading, dark teks" />
                <ColorSwatch hex="#0C81E4" name="Brand Blue" cssVar="--color-brand-blue" role="Primary CTA, link" />
                <ColorSwatch hex="#17C3D4" name="Brand Cyan" cssVar="--color-brand-cyan" role="Accent, ring, telat" />
                <ColorSwatch hex="#4FE7AF" name="Brand Mint" cssVar="--color-brand-mint" role="Success highlight" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Status Presensi</p>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                {([["#10B981","Hadir","--color-status-hadir"],["#17C3D4","Telat","--color-status-telat"],["#F59E0B","Sakit","--color-status-sakit"],["#3B82F6","Izin","--color-status-izin"],["#A855F7","Pulang","--color-status-pulang"],["#EF4444","Alpa","--color-status-alpa"],["#64748B","Tidak","--color-status-tidak"],["#10B981","Ya","--color-status-ya"]] as const).map(([hex,name,cssVar]) => (
                  <ColorSwatch key={name} hex={hex} name={name} cssVar={cssVar} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Sesi Presensi</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {SESI_META.map((s) => (
                  <ColorSwatch key={s.id} hex={s.color} name={s.label} cssVar={s.cssVar} role={s.time} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Feature Domain</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ColorSwatch hex="#10B981" name="Attendance" role="Dashboard/Home nav" />
                <ColorSwatch hex="#F97316" name="Tahfizh" role="Tahfizh nav & hero" />
                <ColorSwatch hex="#3B82F6" name="Laporan" role="Report nav" />
                <ColorSwatch hex="#A855F7" name="Profil" role="Profile nav" />
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Surface</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ColorSwatch hex="#F4F8FF" name="Background" role="Page bg" />
                <ColorSwatch hex="#EEF3FB" name="Muted" role="Input, subtle bg" />
                <ColorSwatch hex="#FFFFFF" name="Card" role="Card surface" />
                <ColorSwatch hex="#5B7099" name="Muted FG" role="Labels, captions" />
              </div>
            </div>
          </div>
        </section>

        {/* 02 — TYPOGRAPHY */}
        <section id="typography">
          <SectionHeader number="02" title="Typography" description="Plus Jakarta Sans untuk teks umum. DM Mono untuk data & label teknis." />
          <div className="bg-card rounded-[1.5rem] border border-border divide-y divide-border overflow-hidden">
            {[
              { label: "Display", cls: "text-4xl font-black", sample: "Syamsa — illuminate every presence" },
              { label: "H1",      cls: "text-3xl font-bold",  sample: "Rekap Presensi Kelas 10A" },
              { label: "H2",      cls: "text-2xl font-bold",  sample: "Dashboard Hari Ini" },
              { label: "H3",      cls: "text-xl font-semibold", sample: "Sesi Maghrib 18:00–19:00" },
              { label: "H4",      cls: "text-lg font-semibold", sample: "Status Kehadiran Santri" },
              { label: "Body",    cls: "text-base font-normal", sample: "Ahmad Rizki Maulana sudah ditetapkan hadir pada sesi Shubuh dengan catatan tepat waktu." },
              { label: "Body SM", cls: "text-sm font-normal",  sample: "Presensi tersimpan otomatis. Santri bermasalah tampil di filter." },
              { label: "Caption", cls: "text-xs font-medium",  sample: "Diperbarui 5 menit lalu · Sesi Isya · Kelas 10A" },
              { label: "Label",   cls: "text-[10px] font-semibold uppercase tracking-widest", sample: "STATUS KEHADIRAN" },
            ].map((row) => (
              <div key={row.label} className="flex items-baseline gap-4 sm:gap-6 px-5 py-4">
                <span style={{ fontFamily: "'DM Mono', monospace" }} className="w-14 shrink-0 text-[10px] text-muted-foreground">{row.label}</span>
                <span className={cx(row.cls, "text-foreground leading-snug")}>{row.sample}</span>
              </div>
            ))}
            <div className="flex items-baseline gap-4 sm:gap-6 px-5 py-4 bg-muted/40">
              <span style={{ fontFamily: "'DM Mono', monospace" }} className="w-14 shrink-0 text-[10px] text-muted-foreground">Mono</span>
              <span className="text-sm text-foreground tabular-nums" style={{ fontFamily: "'DM Mono', monospace" }}>06:05:30 · NIS: 2024001 · Score: 87.5</span>
            </div>
          </div>
        </section>

        {/* 03 — BUTTONS */}
        <section id="buttons">
          <SectionHeader number="03" title="Buttons" description="Varian, ukuran, dan state. Warna mengikuti domain fitur." />
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Variants</p>
              <div className="flex flex-wrap gap-3">
                <Btn variant="primary">Primary Brand</Btn>
                <Btn variant="attendance"><Check size={14} />Presensi</Btn>
                <Btn variant="tahfizh"><BookOpen size={14} />Tahfizh</Btn>
                <Btn variant="danger">Hapus</Btn>
                <Btn variant="secondary">Secondary</Btn>
                <Btn variant="ghost">Ghost</Btn>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Sizes</p>
              <div className="flex flex-wrap items-center gap-3">
                <Btn size="sm">Small</Btn>
                <Btn size="md">Medium</Btn>
                <Btn size="lg">Large</Btn>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">States</p>
              <div className="flex flex-wrap items-center gap-3">
                <Btn>Default</Btn>
                <Btn disabled>Disabled</Btn>
                <Btn loading>Memuat...</Btn>
                <button className="h-10 px-5 text-sm font-semibold rounded-[0.875rem] bg-[#0C81E4] text-white ring-2 ring-[#17C3D4] ring-offset-2">Focused</button>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Icon & Pill</p>
              <div className="flex flex-wrap items-center gap-3">
                <button className="w-10 h-10 rounded-xl bg-[#0C81E4] text-white flex items-center justify-center hover:brightness-110 transition-all active:scale-95"><Download size={16} /></button>
                <button className="w-10 h-10 rounded-xl bg-card border border-border text-foreground flex items-center justify-center hover:bg-muted transition-all active:scale-95"><Bell size={16} /></button>
                <button className="h-8 px-4 rounded-full bg-[#0C81E4] text-white text-xs font-semibold hover:brightness-110 transition-all active:scale-95">Pill Button</button>
                <button className="h-8 px-4 rounded-full bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 hover:brightness-110 transition-all active:scale-95"><Check size={12} />Hadir Semua</button>
              </div>
            </div>
          </div>
        </section>

        {/* 04 — BADGES */}
        <section id="badges">
          <SectionHeader number="04" title="Badges & Pills" description="Label status, kategori, dan indikator singkat." />
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Status Presensi — Compact</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUS_META) as StatusKey[]).map((k) => <StatusBadge key={k} statusKey={k} />)}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Status Presensi — Pill</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(STATUS_META) as StatusKey[]).map((k) => {
                  const s = STATUS_META[k];
                  return (
                    <span key={k} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ color: s.color, background: s.bg }}>
                      {s.icon}{s.label}
                    </span>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Permit Category</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Sakit", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
                  { label: "Izin Kegiatan", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
                  { label: "Izin Pulang", color: "#A855F7", bg: "rgba(168,85,247,0.12)" },
                ].map((b) => (
                  <span key={b.label} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold" style={{ color: b.color, background: b.bg }}>{b.label}</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Permit Status & Context</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Pending",  color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
                  { label: "Approved", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
                  { label: "Rejected", color: "#EF4444", bg: "rgba(239,68,68,0.12)" },
                  { label: "Aktif",    color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
                  { label: "Selesai",  color: "#64748B", bg: "rgba(100,116,139,0.12)" },
                ].map((b) => (
                  <span key={b.label} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold" style={{ color: b.color, background: b.bg }}>{b.label}</span>
                ))}
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-emerald-700 bg-emerald-100"><Wifi size={10} />Online</span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-600 bg-slate-100"><WifiOff size={10} />Offline</span>
              </div>
            </div>
          </div>
        </section>

        {/* 05 — CARDS */}
        <section id="cards">
          <SectionHeader number="05" title="Cards & Panels" description="Varian card untuk berbagai kebutuhan operasional." />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Solid */}
            <div className="bg-card border border-border rounded-[1.5rem] p-5 shadow-sm">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Solid Card</p>
              <p className="text-sm text-foreground mt-2">Card standar untuk menampilkan data operasional, form, atau konten berulang.</p>
            </div>
            {/* Interactive */}
            <div className="bg-card border border-border rounded-[1.5rem] p-5 cursor-pointer hover:shadow-[0_18px_46px_-26px_rgba(12,78,140,0.32)] hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Sesi Isya</p>
                  <p className="text-base font-bold text-foreground mt-0.5">19:00 – 21:00</p>
                </div>
                <ChevronRight size={18} className="text-muted-foreground group-hover:text-[#0C81E4] transition-colors" />
              </div>
              <div className="mt-3 flex gap-1.5">
                <StatusBadge statusKey="H" /><StatusBadge statusKey="T" /><StatusBadge statusKey="A" />
              </div>
            </div>
            {/* Stat */}
            <div className="bg-card rounded-[1.5rem] p-5 border border-border shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Total Hadir</p>
                  <p className="text-3xl font-black text-foreground mt-1 tabular-nums">24<span className="text-base font-semibold text-muted-foreground">/30</span></p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <Users size={18} className="text-emerald-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <TrendingUp size={12} className="text-emerald-500" />
                <span className="text-xs text-emerald-600 font-semibold">+3 dari kemarin</span>
              </div>
            </div>
            {/* Alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-[1.5rem] p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">3 Santri Bermasalah</p>
                  <p className="text-xs text-amber-600 mt-0.5">Ahmad Rizki, Budi Santoso, dan 1 lainnya belum dipresensi sesi Isya.</p>
                </div>
              </div>
            </div>
            {/* Brand gradient */}
            <div className="rounded-[1.5rem] p-5 sm:col-span-2" style={{ background: "linear-gradient(135deg, #0C4E8C 0%, #0C81E4 60%, #17C3D4 100%)" }}>
              <p className="text-[10px] text-white/60 font-medium uppercase tracking-wider">Hero / Gradient Card</p>
              <p className="text-2xl font-black text-white mt-2">Sesi Isya Aktif</p>
              <p className="text-white/70 text-sm mt-1">19:00 – 21:00 · Fardu, Sunnah, Al-Kahfi</p>
              <div className="mt-4">
                <Btn variant="secondary" size="sm">Buka Presensi</Btn>
              </div>
            </div>
          </div>

          {/* Tahfizh + Glass */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-[1.5rem] p-5" style={{ background: "linear-gradient(135deg, #7C2D12 0%, #F97316 70%, #FCD34D 100%)" }}>
              <p className="text-[10px] text-orange-100/70 font-medium uppercase tracking-wider">Tahfizh Hero</p>
              <p className="text-xl font-black text-white mt-1">Target: 30 Juz</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-white/20 rounded-full h-2">
                  <div className="bg-white rounded-full h-2 w-2/5" />
                </div>
                <span className="text-white text-xs font-bold tabular-nums">12/30</span>
              </div>
            </div>
            {/* Glass card showcase — light + dark variants */}
            <div className="rounded-[1.5rem] p-5 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0C4E8C, #17C3D4)" }}>
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, #fff 0%, transparent 60%)" }} />
              <div className="space-y-3 relative">
                {/* Light glass */}
                <div className="rounded-[1.25rem] p-4" style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.35)" }}>
                  <p className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">Light Glass</p>
                  <p className="text-sm text-white mt-1 font-medium">bg-white/18 · backdrop-blur · border-white/35</p>
                </div>
                {/* Dark glass */}
                <div className="rounded-[1.25rem] p-4" style={{ background: "rgba(2,6,23,0.55)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.10)" }}>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Dark Glass</p>
                  <p className="text-sm text-white mt-1 font-medium">bg-slate-950/55 · backdrop-blur-xl · border-white/10</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 06 — SESI CARDS */}
        <section id="sesi">
          <SectionHeader number="06" title="Kartu Sesi" description="Slot card per sesi presensi dengan warna domain masing-masing." />

          {/* Grid kartu sesi */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            {SESI_META.map((sesi) => (
              <div
                key={sesi.id}
                className="rounded-[1.5rem] p-4 cursor-pointer hover:-translate-y-0.5 transition-all duration-200 group"
                style={{ background: sesi.bg, border: `1.5px solid ${sesi.color}22` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white [&>svg]:w-4 [&>svg]:h-4"
                    style={{ background: sesi.color }}
                  >
                    {sesi.icon}
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ color: sesi.color, background: `${sesi.color}18` }}
                  >
                    Aktif
                  </span>
                </div>
                <p className="text-sm font-bold text-foreground">{sesi.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>{sesi.time}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{sesi.desc}</p>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">Hadir</span>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: sesi.color }}>24/30</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: `${sesi.color}20` }}>
                    <div className="h-1.5 rounded-full transition-all" style={{ width: "80%", background: sesi.color }} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Sesi cards — glass variant di atas gradient */}
          <div
            className="rounded-[1.5rem] p-6"
            style={{ background: "linear-gradient(135deg, #0C4E8C 0%, #0C1F3D 100%)" }}
          >
            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-widest mb-4">Sesi Cards — Glass Variant</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {SESI_META.map((sesi) => (
                <div
                  key={sesi.id}
                  className="rounded-[1.25rem] p-4 hover:-translate-y-0.5 transition-all duration-200"
                  style={{
                    background: `${sesi.color}18`,
                    backdropFilter: "blur(12px)",
                    border: `1px solid ${sesi.color}30`,
                    WebkitBackdropFilter: "blur(12px)",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white mb-3 [&>svg]:w-4 [&>svg]:h-4"
                    style={{ background: sesi.color }}
                  >
                    {sesi.icon}
                  </div>
                  <p className="text-sm font-bold text-white">{sesi.label}</p>
                  <p className="text-[10px] text-white/50 mt-0.5" style={{ fontFamily: "'DM Mono', monospace" }}>{sesi.time}</p>
                  <div className="mt-3 flex gap-1">
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-white/80">
                      <Check size={9} strokeWidth={3} />H
                    </span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold text-white/60" style={{ background: `${sesi.color}25` }}>
                      <Clock size={9} />T
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Token table */}
          <div className="mt-4 bg-card rounded-[1.5rem] border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Sesi","Ikon","Waktu","Warna","CSS Variable","Aktivitas"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SESI_META.map((sesi, i) => (
                    <tr key={sesi.id} className={cx("border-b border-border/50 hover:bg-muted/30 transition-colors", i % 2 === 1 && "bg-muted/10")}>
                      <td className="px-4 py-3 font-bold text-foreground">{sesi.label}</td>
                      <td className="px-4 py-3">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5 text-white" style={{ background: sesi.color }}>{sesi.icon}</span>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{sesi.time}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md shrink-0" style={{ background: sesi.color }} />
                          <span className="text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{sesi.color}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{sesi.cssVar}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{sesi.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 07 — FORMS */}
        <section id="forms">
          <SectionHeader number="07" title="Form & Input" description="States: empty, focused, valid, invalid, disabled." />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Nama Santri</label>
                <input type="text" placeholder="Ahmad Rizki Maulana"
                  className="w-full h-10 px-4 rounded-[0.875rem] border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#17C3D4]/40 focus:border-[#0C81E4]"
                  style={{ background: "var(--input-background)", borderColor: "var(--border)" }} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">NIS <span className="text-red-500 text-xs font-normal">(invalid)</span></label>
                <div className="relative">
                  <input type="text" defaultValue="abcd"
                    className="w-full h-10 px-4 pr-10 rounded-[0.875rem] border border-red-400 text-sm focus:outline-none"
                    style={{ background: "var(--input-background)" }} />
                  <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500" />
                </div>
                <p className="text-xs text-red-500 mt-1">NIS hanya boleh berisi angka</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Kelas <span className="text-emerald-600 text-xs font-normal">(valid)</span></label>
                <div className="relative">
                  <input type="text" defaultValue="10A"
                    className="w-full h-10 px-4 pr-10 rounded-[0.875rem] border border-emerald-400 text-sm focus:outline-none"
                    style={{ background: "var(--input-background)" }} />
                  <CheckCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Password</label>
                <div className="relative">
                  <input type={showPassword ? "text" : "password"} defaultValue="musyrif123"
                    className="w-full h-10 px-4 pr-10 rounded-[0.875rem] border text-sm focus:outline-none focus:ring-2 focus:ring-[#17C3D4]/40 focus:border-[#0C81E4]"
                    style={{ background: "var(--input-background)", borderColor: "var(--border)" }} />
                  <button onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-1.5">Disabled</label>
                <input type="text" disabled placeholder="Tidak dapat diedit"
                  className="w-full h-10 px-4 rounded-[0.875rem] border text-sm opacity-50 cursor-not-allowed"
                  style={{ background: "var(--input-background)", borderColor: "var(--border)" }} />
              </div>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Sesi</label>
                <div className="relative">
                  <select className="w-full h-10 px-4 pr-10 rounded-[0.875rem] border text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-[#17C3D4]/40 focus:border-[#0C81E4]"
                    style={{ background: "var(--input-background)", borderColor: "var(--border)" }}>
                    <option>Shubuh (04:00–06:00)</option>
                    <option>Ashar (15:00–17:00)</option>
                    <option>Maghrib (18:00–19:00)</option>
                    <option>Isya (19:00–21:00)</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Alasan / Catatan</label>
                <textarea rows={3} placeholder="Santri demam sejak kemarin dan sudah dibawa ke klinik..."
                  className="w-full px-4 py-3 rounded-[0.875rem] border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#17C3D4]/40 focus:border-[#0C81E4]"
                  style={{ background: "var(--input-background)", borderColor: "var(--border)" }} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Search</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="search" placeholder="Cari nama santri..."
                    className="w-full h-10 pl-9 pr-4 rounded-[0.875rem] border text-sm focus:outline-none focus:ring-2 focus:ring-[#17C3D4]/40 focus:border-[#0C81E4]"
                    style={{ background: "var(--input-background)", borderColor: "var(--border)" }} />
                </div>
              </div>
              <div className="space-y-3 pt-1">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div onClick={() => setChecked(!checked)}
                    className={cx("w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                      checked ? "bg-[#0C81E4] border-[#0C81E4]" : "border-border group-hover:border-[#0C81E4]")}>
                    {checked && <Check size={11} className="text-white" strokeWidth={3} />}
                  </div>
                  <span className="text-sm text-foreground">Tandai semua hadir</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => setToggled(!toggled)}
                    className={cx("w-11 h-6 rounded-full relative transition-colors duration-200 shrink-0", toggled ? "bg-[#0C81E4]" : "bg-[#b0c4de]")}>
                    <div className={cx("absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200", toggled ? "translate-x-6" : "translate-x-1")} />
                  </div>
                  <span className="text-sm text-foreground">Notifikasi aktif</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* 08 — STATUS TABLE */}
        <section id="status">
          <SectionHeader number="08" title="Attendance Status" description="STATUS_META — sumber kebenaran tunggal untuk warna, ikon, label, dan score." />
          <div className="bg-card rounded-[1.5rem] border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Kode","Label","Warna","CSS Variable","Ikon","Score","Contoh"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(Object.entries(STATUS_META) as [StatusKey, typeof STATUS_META[StatusKey]][]).map(([key, s], i) => (
                    <tr key={key} className={cx("border-b border-border/50 hover:bg-muted/30 transition-colors", i % 2 === 1 && "bg-muted/10")}>
                      <td className="px-4 py-3"><span className="font-bold text-base" style={{ color: s.color, fontFamily: "'DM Mono', monospace" }}>{key}</span></td>
                      <td className="px-4 py-3 font-medium text-foreground">{s.label}</td>
                      <td className="px-4 py-3"><div className="w-5 h-5 rounded-md" style={{ background: s.color }} /></td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>--color-status-{key === "-" ? "tidak" : s.label.toLowerCase()}</td>
                      <td className="px-4 py-3"><span style={{ color: s.color }}>{s.icon}</span></td>
                      <td className="px-4 py-3 font-bold tabular-nums" style={{ fontFamily: "'DM Mono', monospace", color: s.score < 0 ? "#EF4444" : s.score === 0 ? "#64748B" : "#0C1F3D" }}>{s.score}</td>
                      <td className="px-4 py-3"><StatusBadge statusKey={key} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tap cycle */}
          <div className="mt-4 bg-card rounded-[1.5rem] border border-border p-5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Tap Cycle — Urutan Resmi</p>
            <div className="flex flex-wrap items-center gap-2">
              {(["H","A","S","I","P","T","H"] as StatusKey[]).map((k, i, arr) => (
                <span key={i} className="inline-flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold"
                    style={{ color: STATUS_META[k].color, background: STATUS_META[k].bg }}>
                    {STATUS_META[k].icon}{k}
                  </span>
                  {i < arr.length - 1 && <ArrowRight size={14} className="text-muted-foreground" />}
                </span>
              ))}
            </div>
          </div>

          {/* Student rows */}
          <div className="mt-4 bg-card rounded-[1.5rem] border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Baris Santri — Presensi</p>
            </div>
            {[
              { name: "Ahmad Rizki Maulana",  room: "Kamar 3A", status: "H" as StatusKey, note: "" },
              { name: "Budi Santoso Wijaya",   room: "Kamar 3A", status: "T" as StatusKey, note: "Terlambat 10 menit" },
              { name: "Cahya Ramadhan",        room: "Kamar 3B", status: "S" as StatusKey, note: "Demam, sudah ke klinik" },
              { name: "Daffa Arya Pratama",    room: "Kamar 3B", status: "A" as StatusKey, note: "" },
              { name: "Eka Putra Wirawan",     room: "Kamar 3C", status: "I" as StatusKey, note: "Lomba KSM provinsi" },
            ].map((row) => {
              const meta = STATUS_META[row.status];
              return (
                <div key={row.name} className="flex items-center gap-3 sm:gap-4 px-5 py-3.5 border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: meta.color }}>
                    {row.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.room}{row.note && ` · ${row.note}`}</p>
                  </div>
                  <StatusBadge statusKey={row.status} />
                </div>
              );
            })}
          </div>
        </section>

        {/* 09 — TOASTS */}
        <section id="toasts">
          <SectionHeader number="09" title="Toast & Empty State" description="Feedback cepat dan placeholder konten kosong." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            <ToastItem type="success" /><ToastItem type="info" />
            <ToastItem type="warning" /><ToastItem type="error" />
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: <Users size={36} strokeWidth={1.5} />, title: "Semua santri lengkap", desc: "Tidak ada santri bermasalah hari ini." },
              { icon: <FileText size={36} strokeWidth={1.5} />, title: "Belum ada izin", desc: "Izin yang diajukan akan muncul di sini." },
              { icon: <BookOpen size={36} strokeWidth={1.5} />, title: "Belum ada setoran", desc: "Tambahkan setoran pertama untuk santri ini." },
            ].map((e) => (
              <div key={e.title} className="flex flex-col items-center text-center p-8 rounded-[1.5rem] border-2 border-dashed border-border">
                <span className="text-muted-foreground mb-3">{e.icon}</span>
                <p className="text-sm font-semibold text-foreground">{e.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{e.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 10 — NAVIGATION */}
        <section id="navigation">
          <SectionHeader number="10" title="Navigation" description="Bottom nav mobile dan tabs/segmented controls." />
          <div className="space-y-8">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Tabs — Underline</p>
              <div className="inline-flex border-b border-border gap-0.5">
                {["Rekap","Analisis"].map((tab) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={cx("px-5 py-2.5 text-sm font-semibold transition-all border-b-2 -mb-px",
                      activeTab === tab ? "text-[#3B82F6] border-[#3B82F6]" : "text-muted-foreground border-transparent hover:text-foreground")}>
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Segmented Control</p>
              <div className="inline-flex bg-muted rounded-[0.875rem] p-1 gap-1">
                {[
                  { id: "sakit", label: "Sakit" }, { id: "izin", label: "Izin" }, { id: "pulang", label: "Pulang" },
                ].map((tab) => (
                  <button key={tab.id} onClick={() => setActiveNav(tab.id)}
                    className={cx("px-4 py-1.5 text-sm font-semibold rounded-[0.625rem] transition-all",
                      activeNav === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Bottom Navigation — Glassmorphism</p>
              {/* Dark glassmorphism pill nav — persis pola aplikasi */}
              <div className="max-w-sm p-6 rounded-[1.5rem] flex items-end justify-center" style={{ background: "linear-gradient(135deg,#0C4E8C,#17C3D4)" }}>
                <div className="w-full bg-slate-950/90 backdrop-blur-xl rounded-full shadow-2xl border border-white/10 p-1.5">
                  <div className="flex items-center justify-between gap-1">
                    {[
                      { id: "home",    icon: <ClipboardList size={24} />, label: "Home",    activeColor: "text-emerald-400", activeBg: "bg-emerald-500/15" },
                      { id: "tahfizh", icon: <BookOpen size={24} />,      label: "Tahfizh", activeColor: "text-orange-400",  activeBg: "bg-orange-500/15" },
                      { id: "rekap",   icon: <BarChart2 size={24} />,     label: "Rekap",   activeColor: "text-blue-400",    activeBg: "bg-blue-500/15" },
                      { id: "profil",  icon: <User size={24} />,          label: "Profil",  activeColor: "text-purple-400",  activeBg: "bg-purple-500/15" },
                    ].map((item) => {
                      const isActive = activeNav === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveNav(item.id)}
                          className={cx(
                            "group relative flex items-center justify-center gap-1.5 py-3 rounded-full transition-all duration-300",
                            isActive ? "flex-1 px-4" : "w-14",
                            isActive ? item.activeColor : "text-slate-400 hover:text-slate-200"
                          )}
                        >
                          {/* Glow background — scale in on active */}
                          <div className={cx(
                            "absolute inset-0 rounded-full transition-transform duration-300",
                            item.activeBg,
                            isActive ? "scale-100" : "scale-0"
                          )} />
                          {/* Icon */}
                          <span className="relative z-10">{item.icon}</span>
                          {/* Label — hanya muncul saat active */}
                          {isActive && (
                            <span className="relative z-10 text-[11px] font-black text-white whitespace-nowrap">{item.label}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 11 — GLASSMORPHISM */}
        <section id="glass">
          <SectionHeader number="11" title="Glassmorphism" description="Pola glass resmi Syamsa — dark glass untuk nav/header, light glass untuk card di atas warna." />
          <div className="space-y-4">

            {/* Nav pill glass — replika persis dari aplikasi */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Nav Pill — Dark Glass (bg-slate-950/90 · backdrop-blur-xl · border-white/10)</p>
              <div className="p-8 rounded-[1.5rem] flex justify-center" style={{ background: "linear-gradient(135deg,#0C4E8C,#0C81E4,#17C3D4)" }}>
                <div className="w-full max-w-sm bg-slate-950/90 backdrop-blur-xl rounded-full shadow-2xl shadow-black/40 border border-white/10 p-1.5">
                  <div className="flex items-center justify-between gap-1">
                    {[
                      { id: "g-home",    icon: <ClipboardList size={24} />, label: "Home",    activeColor: "text-emerald-400", activeBg: "bg-emerald-500/20" },
                      { id: "g-tahfizh", icon: <BookOpen size={24} />,      label: "Tahfizh", activeColor: "text-orange-400",  activeBg: "bg-orange-500/20" },
                      { id: "g-rekap",   icon: <BarChart2 size={24} />,     label: "Rekap",   activeColor: "text-blue-400",    activeBg: "bg-blue-500/20" },
                      { id: "g-profil",  icon: <User size={24} />,          label: "Profil",  activeColor: "text-purple-400",  activeBg: "bg-purple-500/20" },
                    ].map((item) => {
                      const isActive = activeNav === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveNav(item.id)}
                          className={cx(
                            "group relative flex items-center justify-center gap-1.5 py-3 rounded-full transition-all duration-300",
                            isActive ? "flex-1 px-4" : "w-14",
                            isActive ? item.activeColor : "text-slate-400 hover:text-slate-200"
                          )}
                        >
                          <div className={cx(
                            "absolute inset-0 rounded-full transition-transform duration-300",
                            item.activeBg,
                            isActive ? "scale-100" : "scale-0"
                          )} />
                          <span className="relative z-10">{item.icon}</span>
                          {isActive && (
                            <span className="relative z-10 text-[11px] font-black text-white whitespace-nowrap">{item.label}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Glass card grid */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Glass Cards — Light & Dark Variants</p>
              <div className="p-8 rounded-[1.5rem] grid grid-cols-1 sm:grid-cols-3 gap-4"
                style={{ background: "linear-gradient(160deg,#0C4E8C 0%,#0C81E4 40%,#17C3D4 80%,#4FE7AF 100%)" }}>
                {[
                  { label: "White Glass", style: { background: "rgba(255,255,255,0.18)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.35)", WebkitBackdropFilter: "blur(16px)" }, title: "Light Glass", value: "bg-white/18" },
                  { label: "Dark Glass",  style: { background: "rgba(2,6,23,0.55)",       backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.10)", WebkitBackdropFilter: "blur(16px)" }, title: "Dark Glass",  value: "bg-slate-950/55" },
                  { label: "Tinted Glass", style: { background: "rgba(12,81,228,0.25)",  backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.20)", WebkitBackdropFilter: "blur(16px)" }, title: "Brand Glass", value: "bg-blue-600/25" },
                ].map((g) => (
                  <div key={g.label} className="rounded-[1.5rem] p-5" style={g.style}>
                    <p className="text-[10px] text-white/50 font-semibold uppercase tracking-wider">{g.label}</p>
                    <p className="text-white font-bold mt-1">{g.title}</p>
                    <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-[11px] text-white/60 mt-1">{g.value}</p>
                    <div className="mt-4 flex items-center gap-2">
                      <div className="flex-1 bg-white/20 rounded-full h-1.5">
                        <div className="bg-white/60 rounded-full h-1.5 w-3/4" />
                      </div>
                      <span className="text-white text-xs font-bold">75%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Code snippet */}
            <div className="bg-slate-950 rounded-[1.5rem] p-6 border border-white/10">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-4">Pola CSS — Dark Nav Glass</p>
              <pre className="text-sm text-slate-300 overflow-x-auto leading-relaxed" style={{ fontFamily: "'DM Mono', monospace" }}>
{`bg-slate-950/90
backdrop-blur-xl
rounded-full
shadow-2xl shadow-black/40
border border-white/10

/* Active glow (per domain): */
bg-emerald-500/20  → Home
bg-orange-500/20   → Tahfizh
bg-blue-500/20     → Rekap
bg-purple-500/20   → Profil`}
              </pre>
            </div>

          </div>
        </section>

        {/* 12 — STATISTICS */}
        <section id="statistics">
          <SectionHeader number="12" title="Statistics & Data Viz" description="Komponen statistik yang relevan untuk dashboard presensi operasional harian." />

          {/* ── 1. KPI Cards ── */}
          <div className="mb-10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">1 — KPI Card</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: "Total Santri",    value: "312",  change: "+4",  up: true,  color: "#0C81E4", bg: "rgba(12,129,228,0.10)", icon: <Users size={18} /> },
                { label: "Hadir Hari Ini",  value: "289",  change: "+12", up: true,  color: "#10B981", bg: "rgba(16,185,129,0.10)", icon: <Check size={18} strokeWidth={2.5} /> },
                { label: "Telat Hari Ini",  value: "17",   change: "-3",  up: false, color: "#17C3D4", bg: "rgba(23,195,212,0.10)", icon: <Clock size={18} /> },
                { label: "Alpa Hari Ini",   value: "6",    change: "+2",  up: false, color: "#EF4444", bg: "rgba(239,68,68,0.10)",  icon: <AlertTriangle size={18} /> },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-card rounded-[1.5rem] border border-border p-5 hover:shadow-[0_14px_40px_-24px_rgba(15,23,42,0.28)] transition-all duration-200">
                  <div className="flex items-start justify-between mb-3">
                    <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: kpi.bg, color: kpi.color }}>
                      {kpi.icon}
                    </div>
                  </div>
                  <p className="text-3xl font-black text-foreground tabular-nums">{kpi.value}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {kpi.up
                      ? <TrendingUp size={12} style={{ color: kpi.color }} />
                      : <TrendingDown size={12} className="text-red-500" />}
                    <span className="text-xs font-semibold" style={{ color: kpi.up ? kpi.color : "#EF4444" }}>
                      {kpi.change} dari kemarin
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 2. Stat Grid ── */}
          <div className="mb-10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">2 — Stat Grid</p>
            <div className="bg-card rounded-[1.5rem] border border-border p-5">
              <p className="text-sm font-bold text-foreground mb-4">Sesi Isya — Ringkasan</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {(Object.entries(STATUS_META) as [StatusKey, typeof STATUS_META[StatusKey]][])
                  .filter(([k]) => k !== "Y" && k !== "-")
                  .map(([key, s]) => (
                    <div key={key} className="flex flex-col items-center text-center p-3 rounded-xl" style={{ background: s.bg }}>
                      <span className="text-[10px] font-bold mb-1" style={{ color: s.color }}>{s.label}</span>
                      <span className="text-2xl font-black tabular-nums" style={{ color: s.color }}>
                        {key === "H" ? "245" : key === "T" ? "12" : key === "S" ? "4" : key === "I" ? "8" : key === "P" ? "3" : "2"}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* ── 3 & 4. Progress Bar + Circular Progress ── */}
          <div className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">3 — Progress Bar</p>
              <div className="bg-card rounded-[1.5rem] border border-border p-5 space-y-5">
                {[
                  { label: "Kehadiran",          value: 95, color: "#10B981" },
                  { label: "Target Tahfizh",      value: 80, color: "#F97316" },
                  { label: "Kelengkapan Timesheet", value: 67, color: "#A855F7" },
                  { label: "Presensi Isya",       value: 53, color: "#8B5CF6" },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <span className="text-sm font-black tabular-nums" style={{ color: item.color }}>{item.value}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${item.value}%`, background: item.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">4 — Circular Progress</p>
              <div className="bg-card rounded-[1.5rem] border border-border p-5 grid grid-cols-2 gap-4">
                {[
                  { label: "Kehadiran Bulanan", value: 92, color: "#10B981", track: "rgba(16,185,129,0.12)" },
                  { label: "Hafalan Target",    value: 75, color: "#F97316", track: "rgba(249,115,22,0.12)" },
                  { label: "Sesi Selesai",      value: 60, color: "#0C81E4", track: "rgba(12,129,228,0.12)" },
                  { label: "Disiplin Score",    value: 88, color: "#8B5CF6", track: "rgba(139,92,246,0.12)" },
                ].map((item) => {
                  const r = 36; const c = 2 * Math.PI * r;
                  const offset = c - (item.value / 100) * c;
                  return (
                    <div key={item.label} className="flex flex-col items-center gap-2">
                      <div className="relative w-24 h-24">
                        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                          <circle cx="48" cy="48" r={r} fill="none" strokeWidth="8" stroke={item.track} />
                          <circle cx="48" cy="48" r={r} fill="none" strokeWidth="8"
                            stroke={item.color} strokeLinecap="round"
                            strokeDasharray={c} strokeDashoffset={offset}
                            style={{ transition: "stroke-dashoffset 0.8s ease" }} />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-lg font-black tabular-nums" style={{ color: item.color }}>{item.value}%</span>
                        </div>
                      </div>
                      <p className="text-xs text-center text-muted-foreground font-medium">{item.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── 5. Trend / Area Chart ── */}
          <div className="mb-10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">5 — Trend Chart (Area)</p>
            <div className="bg-card rounded-[1.5rem] border border-border p-5">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-sm font-bold text-foreground">Kehadiran 30 Hari Terakhir</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Rata-rata: <strong className="text-foreground">91.4%</strong></p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full">
                  <TrendingUp size={11} />+4.2%
                </span>
              </div>
              <TrendAreaChart />
            </div>
          </div>

          {/* ── 6, 7, 8. Bar Charts ── */}
          <div className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">6 — Bar Chart (per Kelas)</p>
              <div className="bg-card rounded-[1.5rem] border border-border p-5">
                <p className="text-sm font-bold text-foreground mb-4">Presensi per Kelas</p>
                <BarKelasChart />
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">8 — Stacked Bar (Komposisi Status)</p>
              <div className="bg-card rounded-[1.5rem] border border-border p-5">
                <p className="text-sm font-bold text-foreground mb-4">Komposisi Sesi — Minggu Ini</p>
                <StackedBarChart />
              </div>
            </div>
          </div>

          {/* ── 7. Horizontal Bar (Ranking) ── */}
          <div className="mb-10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">7 — Horizontal Bar (Ranking Kelas)</p>
            <div className="bg-card rounded-[1.5rem] border border-border p-5 space-y-3">
              {[
                { label: "Kelas 12A — Musyrif Fadhil",   pct: 97, color: "#10B981" },
                { label: "Kelas 10A — Musyrif Hamid",    pct: 95, color: "#0C81E4" },
                { label: "Kelas 11A — Musyrif Rizal",    pct: 92, color: "#8B5CF6" },
                { label: "Kelas 10B — Musyrif Doni",     pct: 88, color: "#17C3D4" },
                { label: "Kelas 12B — Musyrif Fauzan",   pct: 84, color: "#F97316" },
                { label: "Kelas 11B — Musyrif Andika",   pct: 79, color: "#EF4444" },
              ].map((row, i) => (
                <div key={row.label} className="flex items-center gap-3">
                  <span className="w-5 text-xs font-bold text-muted-foreground text-right shrink-0">{i + 1}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-foreground truncate">{row.label}</span>
                      <span className="text-xs font-black tabular-nums ml-2 shrink-0" style={{ color: row.color }}>{row.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: row.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 10 & 11. Pie + Donut ── */}
          <div className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[
              { title: "10 — Pie Chart", type: "pie" },
              { title: "11 — Donut Chart", type: "donut" },
            ].map(({ title, type }) => {
              const pieData = [
                { name: "Hadir",  value: 245, color: "#10B981" },
                { name: "Telat",  value: 17,  color: "#17C3D4" },
                { name: "Sakit",  value: 4,   color: "#F59E0B" },
                { name: "Izin",   value: 8,   color: "#3B82F6" },
                { name: "Alpa",   value: 2,   color: "#EF4444" },
              ];
              return (
                <div key={type}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">{title}</p>
                  <div className="bg-card rounded-[1.5rem] border border-border p-5">
                    <p className="text-sm font-bold text-foreground mb-1">Komposisi Status Presensi</p>
                    <p className="text-xs text-muted-foreground mb-4">Total 276 santri · Hari ini</p>
                    <div className="flex items-center gap-4">
                      <PieChart width={140} height={140}>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={type === "donut" ? 38 : 0}
                          outerRadius={60} dataKey="value" paddingAngle={2}>
                          {pieData.map((e) => <Cell key={`${type}-${e.name}`} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: "10px", fontSize: 11 }} />
                      </PieChart>
                      <div className="flex flex-col gap-1.5 flex-1">
                        {pieData.map((e) => (
                          <div key={e.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.color }} />
                              <span className="text-xs text-foreground">{e.name}</span>
                            </div>
                            <span className="text-xs font-bold tabular-nums" style={{ color: e.color }}>{e.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 13 & 14. Heatmap / Calendar Heatmap ── */}
          <div className="mb-10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">13 & 14 — Calendar Heatmap (Presensi Bulanan)</p>
            <div className="bg-card rounded-[1.5rem] border border-border p-5">
              <p className="text-sm font-bold text-foreground mb-1">Ahmad Rizki Maulana — Juni 2025</p>
              <p className="text-xs text-muted-foreground mb-4">Hijau = Hadir · Kuning = Telat · Merah = Alpa · Abu = Libur</p>
              <div className="flex gap-1 mb-2 pl-8">
                {["Sen","Sel","Rab","Kam","Jum","Sab"].map((d) => (
                  <div key={d} className="flex-1 text-center text-[9px] text-muted-foreground font-semibold">{d}</div>
                ))}
              </div>
              {(() => {
                const status: Record<number, string> = {
                  1:"H",2:"H",3:"T",4:"H",5:"H",
                  8:"H",9:"A",10:"H",11:"H",12:"H",
                  15:"S",16:"H",17:"H",18:"T",19:"H",
                  22:"H",23:"H",24:"H",25:"H",26:"I",
                  29:"H",30:"H",
                };
                const colorMap: Record<string,{bg:string;text:string}> = {
                  H:{ bg:"#10B981", text:"#fff" },
                  T:{ bg:"#17C3D4", text:"#fff" },
                  S:{ bg:"#F59E0B", text:"#fff" },
                  I:{ bg:"#3B82F6", text:"#fff" },
                  A:{ bg:"#EF4444", text:"#fff" },
                };
                const weeks = [[1,2,3,4,5,null],[8,9,10,11,12,null],[15,16,17,18,19,null],[22,23,24,25,26,null],[29,30,null,null,null,null]];
                return weeks.map((week, wi) => (
                  <div key={wi} className="flex gap-1 mb-1 items-center">
                    <div className="w-6 text-[9px] text-muted-foreground text-right shrink-0">{week[0] ?? ""}</div>
                    {week.map((day, di) => {
                      const s = day ? status[day] : null;
                      const c = s ? colorMap[s] : null;
                      return (
                        <div key={di} title={day && s ? `${day} Jun — ${STATUS_META[s as StatusKey]?.label}` : ""}
                          className="flex-1 aspect-square rounded-md flex items-center justify-center text-[9px] font-bold transition-transform hover:scale-110 cursor-default"
                          style={{
                            background: c ? c.bg : day ? "#EEF3FB" : "transparent",
                            color: c ? c.text : "#94A3B8",
                          }}>
                          {day ? (s ?? "") : ""}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                {[["#10B981","Hadir"],["#17C3D4","Telat"],["#F59E0B","Sakit"],["#3B82F6","Izin"],["#EF4444","Alpa"],["#EEF3FB","Libur/Kosong"]].map(([bg,label]) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded" style={{ background: bg }} />
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 15. Status Distribution ── */}
          <div className="mb-10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">15 — Status Distribution</p>
            <div className="bg-card rounded-[1.5rem] border border-border p-5">
              <p className="text-sm font-bold text-foreground mb-4">Distribusi Status — Sesi Isya · Hari Ini</p>
              <div className="space-y-3">
                {[
                  { key:"H" as StatusKey, count: 245, total: 276 },
                  { key:"T" as StatusKey, count: 17,  total: 276 },
                  { key:"S" as StatusKey, count: 4,   total: 276 },
                  { key:"I" as StatusKey, count: 8,   total: 276 },
                  { key:"A" as StatusKey, count: 2,   total: 276 },
                ].map(({ key, count, total }) => {
                  const s = STATUS_META[key]; const pct = Math.round(count / total * 100);
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-16 shrink-0">
                        <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: s.color }}>
                          {s.icon}{s.label}
                        </span>
                      </div>
                      <div className="flex-1 h-5 rounded-full overflow-hidden bg-muted relative">
                        <div className="h-full rounded-full flex items-center pl-2 transition-all duration-500"
                          style={{ width: `${pct}%`, background: s.color, minWidth: "2rem" }}>
                          <span className="text-[10px] font-bold text-white">{pct}%</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold tabular-nums text-muted-foreground w-8 text-right shrink-0">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── 17. Comparison Card + 20. Sparkline ── */}
          <div className="mb-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">17 — Comparison Card</p>
              <div className="bg-card rounded-[1.5rem] border border-border p-5 space-y-4">
                {[
                  { label: "Kehadiran", curr: 94, prev: 89, unit: "%" },
                  { label: "Total Alpa", curr: 6, prev: 11, unit: " kasus", invert: true },
                ].map((item) => {
                  const up = item.curr > item.prev;
                  const good = item.invert ? !up : up;
                  const diff = item.curr - item.prev;
                  return (
                    <div key={item.label} className="flex items-center justify-between p-4 rounded-[1rem] bg-muted/40">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
                        <p className="text-2xl font-black text-foreground tabular-nums mt-0.5">{item.curr}{item.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Bulan lalu</p>
                        <p className="text-sm font-semibold text-muted-foreground tabular-nums">{item.prev}{item.unit}</p>
                        <div className={cx("flex items-center justify-end gap-1 mt-1 text-xs font-bold", good ? "text-emerald-600" : "text-red-500")}>
                          {good ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {diff > 0 ? "+" : ""}{diff}{item.unit}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">20 — Sparkline Card</p>
              <div className="bg-card rounded-[1.5rem] border border-border p-5 space-y-4">
                {[
                  { label: "Hadir Hari Ini",  dk: "hadir",  value: 245, color: "#10B981", data: [220,235,228,242,238,245,245] },
                  { label: "Telat Minggu Ini", dk: "telat",  value: 17,  color: "#17C3D4", data: [22,19,21,18,20,16,17] },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground font-medium">{item.label}</p>
                      <p className="text-2xl font-black tabular-nums" style={{ color: item.color }}>{item.value}</p>
                    </div>
                    <div className="w-28 h-12">
                      <SparklineChart data={item.data} dk={item.dk} color={item.color} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── 18. Leaderboard ── */}
          <div className="mb-10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">18 — Leaderboard</p>
            <div className="bg-card rounded-[1.5rem] border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <p className="text-sm font-bold text-foreground">Kehadiran Terbaik — Bulan Juni</p>
              </div>
              {[
                { rank: 1, name: "Ahmad Rizki Maulana",  kelas: "12A", pct: 100, streak: 28, icon: <Trophy size={14} className="text-yellow-500" /> },
                { rank: 2, name: "Budi Santoso Wijaya",  kelas: "10A", pct: 98,  streak: 25, icon: <Medal size={14} className="text-slate-400" /> },
                { rank: 3, name: "Cahya Ramadhan Putra", kelas: "11A", pct: 97,  streak: 24, icon: <Medal size={14} className="text-amber-600" /> },
                { rank: 4, name: "Daffa Arya Pratama",   kelas: "12B", pct: 96,  streak: 22, icon: <Star size={14} className="text-muted-foreground" /> },
                { rank: 5, name: "Eka Wirawan Santosa",  kelas: "10B", pct: 95,  streak: 21, icon: <Star size={14} className="text-muted-foreground" /> },
              ].map((row) => (
                <div key={row.rank} className={cx("flex items-center gap-4 px-5 py-3.5 border-b border-border/50 hover:bg-muted/30 transition-colors", row.rank === 1 && "bg-yellow-50/60")}>
                  <div className="flex items-center gap-1.5 w-8 shrink-0">
                    {row.icon}
                    <span className="text-xs font-bold text-muted-foreground">{row.rank}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#0C81E4] flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {row.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{row.name}</p>
                    <p className="text-xs text-muted-foreground">Kelas {row.kelas} · 🔥 {row.streak} hari streak</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-sm font-black tabular-nums text-emerald-600">{row.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 23. Insight Card ── */}
          <div className="mb-10">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">23 — Insight Card</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: <TrendingUp size={18} />, color: "#10B981", bg: "rgba(16,185,129,0.10)", title: "Kehadiran meningkat", body: "Kehadiran naik 8% dibanding bulan lalu. Sesi Shubuh paling konsisten." },
                { icon: <AlertTriangle size={18} />, color: "#F59E0B", bg: "rgba(245,158,11,0.10)", title: "3 santri perlu perhatian", body: "Ahmad, Budi, dan Cahya memiliki >5 alpa bulan ini. Segera tindak lanjuti." },
                { icon: <Clock size={18} />, color: "#17C3D4", bg: "rgba(23,195,212,0.10)", title: "Pola keterlambatan", body: "Telat tertinggi terjadi di sesi Shubuh (06:00). Rata-rata 8 menit terlambat." },
              ].map((card) => (
                <div key={card.title} className="bg-card rounded-[1.5rem] border border-border p-5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: card.bg, color: card.color }}>
                    {card.icon}
                  </div>
                  <p className="text-sm font-bold text-foreground">{card.title}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{card.body}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 21. Data Table Analytics ── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">21 — Data Table Analytics</p>
            <div className="bg-card rounded-[1.5rem] border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <p className="text-sm font-bold text-foreground">Rekap per Kelas — Juni 2025</p>
                <button className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0C81E4] hover:underline">
                  <Download size={12} />Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Kelas","Musyrif","Hadir","Telat","Sakit","Izin","Alpa","% Hadir","Grade"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { kelas:"12A", musyrif:"Fadhil",  H:97, T:1, S:1, I:1, A:0, pct:98, grade:"A" },
                      { kelas:"10A", musyrif:"Hamid",   H:95, T:2, S:1, I:1, A:1, pct:96, grade:"A" },
                      { kelas:"11A", musyrif:"Rizal",   H:92, T:3, S:2, I:2, A:1, pct:93, grade:"A-" },
                      { kelas:"10B", musyrif:"Doni",    H:88, T:4, S:3, I:3, A:2, pct:88, grade:"B+" },
                      { kelas:"12B", musyrif:"Fauzan",  H:84, T:5, S:3, I:4, A:4, pct:84, grade:"B" },
                      { kelas:"11B", musyrif:"Andika",  H:79, T:8, S:4, I:5, A:4, pct:79, grade:"B-" },
                    ].map((row, i) => {
                      const gradeColor = row.pct >= 95 ? "#10B981" : row.pct >= 85 ? "#0C81E4" : row.pct >= 75 ? "#F59E0B" : "#EF4444";
                      return (
                        <tr key={row.kelas} className={cx("border-b border-border/50 hover:bg-muted/30 transition-colors", i % 2 === 1 && "bg-muted/10")}>
                          <td className="px-4 py-3 font-bold text-foreground">{row.kelas}</td>
                          <td className="px-4 py-3 text-muted-foreground">{row.musyrif}</td>
                          <td className="px-4 py-3"><span className="font-semibold text-emerald-600">{row.H}%</span></td>
                          <td className="px-4 py-3"><span className="font-semibold text-cyan-500">{row.T}%</span></td>
                          <td className="px-4 py-3"><span className="font-semibold text-amber-500">{row.S}%</span></td>
                          <td className="px-4 py-3"><span className="font-semibold text-blue-500">{row.I}%</span></td>
                          <td className="px-4 py-3"><span className="font-semibold text-red-500">{row.A}%</span></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[48px]">
                                <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: gradeColor }} />
                              </div>
                              <span className="text-xs font-bold tabular-nums" style={{ color: gradeColor }}>{row.pct}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-black" style={{ color: gradeColor, background: `${gradeColor}15` }}>{row.grade}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* 13 — STREAK */}
        <section id="streak">
          <SectionHeader number="13" title="🔥 Streak" description="Komponen visual streak kehadiran — motivasi konsistensi santri melalui gamifikasi api." />

          {/* ── Streak Tiers ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Tier Streak</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { tier: "Pemula",    range: "1–6 hari",    days: 3,   emoji: "🔥",    from: "#FB923C", to: "#F97316", shadow: "rgba(249,115,22,0.35)" },
                { tier: "Konsisten", range: "7–29 hari",   days: 14,  emoji: "🔥🔥",  from: "#F97316", to: "#EA580C", shadow: "rgba(234,88,12,0.40)" },
                { tier: "Legenda",   range: "30–99 hari",  days: 47,  emoji: "🔥🔥🔥", from: "#EA580C", to: "#C2410C", shadow: "rgba(194,65,12,0.45)" },
                { tier: "Dewa Api",  range: "100+ hari",   days: 128, emoji: "💎",    from: "#7C3AED", to: "#4F46E5", shadow: "rgba(124,58,237,0.45)" },
              ].map((t) => (
                <div key={t.tier} className="rounded-[1.5rem] p-5 text-white relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})`, boxShadow: `0 12px 32px -8px ${t.shadow}` }}>
                  <div className="absolute -right-3 -top-3 text-5xl opacity-20 select-none">{t.emoji}</div>
                  <p className="text-3xl font-black tabular-nums">{t.days}</p>
                  <p className="text-white/60 text-[10px] font-semibold uppercase tracking-wider mt-0.5">hari</p>
                  <div className="mt-3 pt-3 border-t border-white/20">
                    <p className="text-white font-bold text-sm">{t.tier}</p>
                    <p className="text-white/60 text-[10px] mt-0.5">{t.range}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Streak Counter variants ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Streak Counter — Variants</p>
            <div className="flex flex-wrap gap-3 items-center">
              {/* Inline compact */}
              {[3, 14, 47, 128].map((days) => (
                <div key={days} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm"
                  style={{ background: days >= 100 ? "linear-gradient(135deg,#7C3AED,#4F46E5)" : "linear-gradient(135deg,#FB923C,#EA580C)", color: "#fff", boxShadow: `0 4px 12px -2px ${days >= 100 ? "rgba(124,58,237,0.4)" : "rgba(234,88,12,0.4)"}` }}>
                  <Flame size={14} strokeWidth={2.5} />
                  <span className="tabular-nums">{days}</span>
                </div>
              ))}

              {/* Broken streak */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-sm bg-muted text-muted-foreground">
                <Flame size={14} strokeWidth={2.5} />
                <span className="tabular-nums line-through">21</span>
                <span className="text-[10px] font-semibold ml-1">putus</span>
              </div>
            </div>
          </div>

          {/* ── Streak Profile Card ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Streak Profile Card</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Active streak card */}
              <div className="bg-card rounded-[1.5rem] border border-border overflow-hidden">
                <div className="p-5" style={{ background: "linear-gradient(135deg, #FB923C 0%, #EA580C 100%)" }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">Streak Hadir</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-5xl font-black text-white tabular-nums">47</span>
                        <span className="text-white/70 text-sm font-semibold">hari</span>
                      </div>
                    </div>
                    <div className="text-4xl">🔥</div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-white/70 text-xs">Menuju Legenda (30 hari)</span>
                      <span className="text-white text-xs font-bold">Selesai!</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/20">
                      <div className="h-full rounded-full bg-white" style={{ width: "100%" }} />
                    </div>
                    <p className="text-white/60 text-[10px] mt-1.5">Target berikutnya: 100 hari</p>
                  </div>
                </div>
                <div className="px-5 py-4 grid grid-cols-3 divide-x divide-border">
                  {[
                    { label: "Terbaik",   value: "62 hari" },
                    { label: "Bulan ini", value: "28 hari" },
                    { label: "Rata-rata", value: "94%" },
                  ].map((s) => (
                    <div key={s.label} className="text-center px-2 first:pl-0 last:pr-0">
                      <p className="text-base font-black text-foreground">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Broken streak card */}
              <div className="bg-card rounded-[1.5rem] border border-border overflow-hidden">
                <div className="p-5 bg-slate-100 dark:bg-slate-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Streak Putus</p>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-5xl font-black text-foreground tabular-nums line-through opacity-40">21</span>
                        <span className="text-muted-foreground text-sm font-semibold">hari</span>
                      </div>
                    </div>
                    <div className="text-4xl grayscale opacity-30">🔥</div>
                  </div>
                  <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 flex items-start gap-2">
                    <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-600">Alpa kemarin menyebabkan streak putus. Mulai lagi hari ini!</p>
                  </div>
                </div>
                <div className="px-5 py-4">
                  <p className="text-xs text-muted-foreground mb-2">Streak terbaik sebelumnya</p>
                  <div className="flex items-center gap-2">
                    <Flame size={16} className="text-orange-500" />
                    <span className="text-lg font-black text-foreground">21 hari</span>
                    <span className="text-xs text-muted-foreground">— Konsisten</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Streak Calendar ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Streak Calendar — 4 Minggu Terakhir</p>
            <div className="bg-card rounded-[1.5rem] border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Flame size={18} className="text-orange-500" />
                  <span className="font-bold text-foreground">Ahmad Rizki Maulana</span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: "linear-gradient(135deg,#FB923C,#EA580C)" }}>
                  <Flame size={11} />47 hari
                </div>
              </div>

              {/* Week grid */}
              <div className="flex gap-1 mb-2">
                {["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map((d) => (
                  <div key={d} className="flex-1 text-center text-[9px] text-muted-foreground font-semibold">{d}</div>
                ))}
              </div>
              {[
                ["H","H","H","H","H","H","H"],
                ["H","H","A","H","H","H","H"],
                ["H","H","H","H","H","H","H"],
                ["H","H","H","H","H","-","-"],
              ].map((week, wi) => (
                <div key={wi} className="flex gap-1 mb-1">
                  {week.map((s, di) => {
                    const isStreak = s === "H";
                    const isFuture = s === "-";
                    const isAlpa = s === "A";
                    return (
                      <div key={di}
                        className="flex-1 aspect-square rounded-lg flex items-center justify-center transition-transform hover:scale-110 cursor-default"
                        style={{
                          background: isStreak ? "linear-gradient(135deg,#FB923C,#EA580C)" : isAlpa ? "#EF4444" : isFuture ? "transparent" : "#EEF3FB",
                        }}>
                        {isStreak && <Flame size={10} className="text-white" />}
                        {isAlpa && <X size={9} className="text-white" strokeWidth={3} />}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="flex items-center gap-4 mt-4 flex-wrap">
                {[
                  { bg: "linear-gradient(135deg,#FB923C,#EA580C)", icon: <Flame size={10} className="text-white" />, label: "Hadir (streak)" },
                  { bg: "#EF4444", icon: <X size={9} className="text-white" strokeWidth={3} />, label: "Alpa (putus)" },
                  { bg: "#EEF3FB", icon: null, label: "Libur/Kosong" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={{ background: item.bg }}>{item.icon}</div>
                    <span className="text-[10px] text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Streak Milestones ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Milestone Badges</p>
            <div className="bg-card rounded-[1.5rem] border border-border p-5">
              <div className="flex flex-wrap gap-3">
                {[
                  { days: 3,   label: "3 Hari",    unlocked: true,  from: "#FB923C", to: "#F97316" },
                  { days: 7,   label: "1 Minggu",  unlocked: true,  from: "#F97316", to: "#EA580C" },
                  { days: 14,  label: "2 Minggu",  unlocked: true,  from: "#EA580C", to: "#DC2626" },
                  { days: 30,  label: "1 Bulan",   unlocked: true,  from: "#EA580C", to: "#C2410C" },
                  { days: 47,  label: "47 Hari",   unlocked: true,  from: "#7C3AED", to: "#4F46E5", current: true },
                  { days: 60,  label: "2 Bulan",   unlocked: false, from: "#94A3B8", to: "#64748B" },
                  { days: 100, label: "100 Hari",  unlocked: false, from: "#94A3B8", to: "#64748B" },
                  { days: 365, label: "1 Tahun",   unlocked: false, from: "#94A3B8", to: "#64748B" },
                ].map((m) => (
                  <div key={m.days}
                    className={cx("flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all", m.current ? "border-violet-400" : m.unlocked ? "border-orange-200" : "border-border opacity-50")}
                    style={{ minWidth: "72px" }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                      style={{ background: `linear-gradient(135deg, ${m.from}, ${m.to})`, boxShadow: m.unlocked ? `0 4px 12px -2px ${m.from}60` : "none" }}>
                      <Flame size={18} strokeWidth={m.unlocked ? 2 : 1.5} />
                    </div>
                    <span className="text-[10px] font-bold text-foreground text-center leading-tight">{m.label}</span>
                    {m.current && <span className="text-[9px] font-bold text-violet-600 bg-violet-100 px-1.5 py-0.5 rounded-full">Saat ini</span>}
                    {!m.unlocked && <span className="text-[9px] text-muted-foreground">🔒</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Streak Notification / Toast ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Streak Toast & Notifikasi</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
              {/* New streak */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl border"
                style={{ background: "#FFF7ED", borderColor: "#FED7AA" }}>
                <span className="text-lg">🔥</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-orange-800">Streak 47 hari!</p>
                  <p className="text-xs text-orange-600 mt-0.5">Ahmad Rizki hadir sempurna hari ini. Terus jaga konsistensinya!</p>
                </div>
              </div>
              {/* Milestone reached */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl border"
                style={{ background: "#F5F3FF", borderColor: "#DDD6FE" }}>
                <span className="text-lg">🏆</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-violet-800">Milestone tercapai!</p>
                  <p className="text-xs text-violet-600 mt-0.5">Ahmad Rizki meraih badge <strong>Legenda 30 Hari</strong>. Luar biasa!</p>
                </div>
              </div>
              {/* Streak at risk */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl border"
                style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}>
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800">Streak hampir putus!</p>
                  <p className="text-xs text-amber-600 mt-0.5">Budi Santoso belum presensi hari ini. Streak 14 hari terancam.</p>
                </div>
              </div>
              {/* Streak broken */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl border"
                style={{ background: "#FEF2F2", borderColor: "#FECACA" }}>
                <span className="text-lg">💔</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-800">Streak putus</p>
                  <p className="text-xs text-red-600 mt-0.5">Cahya Ramadhan alpa kemarin. Streak 21 hari berakhir. Mulai lagi hari ini!</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Streak Leaderboard ── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Streak Leaderboard</p>
            <div className="bg-card rounded-[1.5rem] border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-orange-500" />
                  <p className="text-sm font-bold text-foreground">Top Streak — Kelas 10A</p>
                </div>
                <span className="text-xs text-muted-foreground">Juni 2025</span>
              </div>
              {[
                { rank: 1, name: "Ahmad Rizki Maulana",  days: 47,  tier: "Legenda",   from: "#EA580C", to: "#C2410C" },
                { rank: 2, name: "Budi Santoso Wijaya",  days: 28,  tier: "Konsisten", from: "#F97316", to: "#EA580C" },
                { rank: 3, name: "Cahya Ramadhan Putra", days: 14,  tier: "Konsisten", from: "#F97316", to: "#EA580C" },
                { rank: 4, name: "Daffa Arya Pratama",   days: 7,   tier: "Konsisten", from: "#FB923C", to: "#F97316" },
                { rank: 5, name: "Eka Wirawan Santosa",  days: 3,   tier: "Pemula",    from: "#FB923C", to: "#F97316" },
              ].map((row, i) => (
                <div key={row.rank}
                  className={cx("flex items-center gap-4 px-5 py-3.5 border-b border-border/50 hover:bg-muted/30 transition-colors", i === 0 && "bg-orange-50/60")}>
                  <div className="w-7 text-center shrink-0">
                    {i === 0 ? <span className="text-lg">🥇</span> : i === 1 ? <span className="text-lg">🥈</span> : i === 2 ? <span className="text-lg">🥉</span> :
                      <span className="text-sm font-bold text-muted-foreground">{row.rank}</span>}
                  </div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: `linear-gradient(135deg, ${row.from}, ${row.to})` }}>
                    {row.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.tier}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white"
                      style={{ background: `linear-gradient(135deg, ${row.from}, ${row.to})` }}>
                      <Flame size={11} />
                      <span className="tabular-nums">{row.days}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 14 — AL-QUR'AN */}
        <section id="quran">
          <SectionHeader number="14" title="Al-Qur'an" description="Komponen UI untuk tampilan ayat, surah, juz, tahfizh setoran, dan progres hafalan." />

          {/* Warm hero */}
          <div className="rounded-[1.5rem] p-6 mb-8 flex items-center justify-between gap-4 overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #7C2D12 0%, #C2410C 40%, #F97316 75%, #FCD34D 100%)" }}>
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 50%, #fff 0%, transparent 60%)" }} />
            <div className="relative">
              <p className="text-xs text-white/60 font-semibold uppercase tracking-widest mb-1">Modul</p>
              <h3 className="text-2xl font-black text-white">Al-Qur'an & Tahfizh</h3>
              <p className="text-white/70 text-sm mt-1">Rubik · RTL · Warm palette</p>
            </div>
            <p dir="rtl" lang="ar" className="relative text-white/80 text-right leading-loose hidden sm:block"
              style={{ fontFamily: "'Rubik', sans-serif", fontSize: "32px", fontWeight: 600 }}>
              بِسْمِ اللَّهِ
            </p>
          </div>

          {/* ── Arabic Typography ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Arabic Typography — Rubik</p>
            <div className="bg-card rounded-[1.5rem] border border-orange-100 divide-y divide-orange-50 overflow-hidden">
              {[
                { label: "Display", size: "48px", weight: "700", text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
                { label: "H1",      size: "36px", weight: "600", text: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ" },
                { label: "H2",      size: "28px", weight: "500", text: "ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ" },
                { label: "Body",    size: "22px", weight: "400", text: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ" },
                { label: "Caption", size: "16px", weight: "400", text: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ" },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-4 px-5 py-4">
                  <span style={{ fontFamily: "'DM Mono', monospace" }} className="w-14 shrink-0 text-[10px] text-muted-foreground">{row.label}</span>
                  <p dir="rtl" lang="ar" className="flex-1 text-right leading-loose text-foreground"
                    style={{ fontFamily: "'Rubik', sans-serif", fontSize: row.size, fontWeight: row.weight }}>
                    {row.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Ayat Display ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Ayat Display</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Full ayat card */}
              <div className="bg-card rounded-[1.5rem] border border-orange-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black text-white" style={{ background: "#F97316" }}>1</div>
                    <span className="text-xs font-semibold text-muted-foreground">Al-Fatihah · Ayat 1</span>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Makkiyah</span>
                </div>
                <div className="p-5">
                  <p dir="rtl" lang="ar" className="text-right leading-[2.2] text-foreground mb-4"
                    style={{ fontFamily: "'Rubik', sans-serif", fontSize: "28px", fontWeight: 400 }}>
                    بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                  </p>
                  <p className="text-sm text-muted-foreground italic mb-2">Bismillāhir-raḥmānir-raḥīm</p>
                  <p className="text-sm text-foreground font-medium">Dengan nama Allah Yang Maha Pengasih, Maha Penyayang.</p>
                </div>
              </div>

              {/* Compact ayat — mode hafalan */}
              <div className="bg-card rounded-[1.5rem] border border-orange-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Al-Baqarah · Ayat 2–3</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <Check size={9} strokeWidth={3} />Hafal
                  </span>
                </div>
                <div className="p-5 space-y-4">
                  {[
                    { no: 2, ar: "ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِّلْمُتَّقِينَ", id: "Kitab (Al-Qur'an) ini tidak ada keraguan padanya; petunjuk bagi mereka yang bertakwa." },
                    { no: 3, ar: "الَّذِينَ يُؤْمِنُونَ بِالْغَيْبِ وَيُقِيمُونَ الصَّلَاةَ وَمِمَّا رَزَقْنَاهُمْ يُنفِقُونَ", id: "(yaitu) mereka yang beriman kepada yang gaib, melaksanakan shalat, dan menginfakkan sebagian rezeki yang Kami berikan kepada mereka." },
                  ].map((a) => (
                    <div key={a.no} className="border-b border-border/50 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="w-6 h-6 rounded-full border-2 border-[#F97316] flex items-center justify-center text-[10px] font-black text-[#F97316] shrink-0 mt-1">{a.no}</div>
                        <p dir="rtl" lang="ar" className="flex-1 text-right leading-loose text-foreground"
                          style={{ fontFamily: "'Rubik', sans-serif", fontSize: "20px" }}>{a.ar}</p>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{a.id}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Surah List Item ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Surah List Item</p>
            <div className="bg-card rounded-[1.5rem] border border-border overflow-hidden">
              {[
                { no: 1,  name: "Al-Fatihah",  ar: "الفَاتِحَة", ayat: 7,   type: "Makkiyah", juz: "1",  status: "hafal",   pct: 100 },
                { no: 2,  name: "Al-Baqarah",  ar: "البَقَرَة",   ayat: 286, type: "Madaniyah", juz: "1–3", status: "proses",  pct: 42 },
                { no: 3,  name: "Ali 'Imran",  ar: "آل عِمرَان", ayat: 200, type: "Madaniyah", juz: "3–4", status: "belum",   pct: 0 },
                { no: 36, name: "Ya-Sin",      ar: "يس",          ayat: 83,  type: "Makkiyah", juz: "22–23", status: "hafal", pct: 100 },
                { no: 67, name: "Al-Mulk",     ar: "المُلك",      ayat: 30,  type: "Makkiyah", juz: "29",  status: "hafal",   pct: 100 },
              ].map((s, i) => {
                const statusStyle = s.status === "hafal"
                  ? { color: "#10B981", bg: "rgba(16,185,129,0.10)", label: "Hafal" }
                  : s.status === "proses"
                  ? { color: "#F59E0B", bg: "rgba(245,158,11,0.10)", label: "Proses" }
                  : { color: "#64748B", bg: "rgba(100,116,139,0.10)", label: "Belum" };
                return (
                  <div key={s.no} className={`flex items-center gap-4 px-5 py-3.5 border-b border-border/50 hover:bg-muted/30 transition-colors ${i % 2 === 1 ? "bg-muted/10" : ""}`}>
                    {/* Nomor surah */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: statusStyle.bg, color: statusStyle.color }}>
                      {s.no}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-foreground">{s.name}</p>
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{s.type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{s.ayat} ayat · Juz {s.juz}</p>
                    </div>
                    {/* Arabic name */}
                    <p dir="rtl" lang="ar" className="text-lg text-muted-foreground hidden sm:block"
                      style={{ fontFamily: "'Rubik', sans-serif" }}>{s.ar}</p>
                    {/* Progress */}
                    <div className="w-20 shrink-0 hidden sm:block">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-semibold" style={{ color: statusStyle.color }}>{s.pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: statusStyle.color }} />
                      </div>
                    </div>
                    {/* Status badge */}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ color: statusStyle.color, background: statusStyle.bg }}>
                      {statusStyle.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Juz Map ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Juz Map — Peta 30 Juz</p>
            <div className="bg-card rounded-[1.5rem] border border-orange-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-foreground">Progres Hafalan</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#10B981" }} />Hafal</span>
                  <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: "#F59E0B" }} />Proses</span>
                  <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-muted border border-border" />Belum</span>
                </div>
              </div>
              {(() => {
                const juzStatus: Record<number, "hafal" | "proses" | "belum"> = {
                  1:"hafal", 2:"hafal", 3:"hafal", 4:"hafal", 5:"hafal",
                  6:"proses", 7:"proses", 8:"belum", 9:"belum", 10:"belum",
                  11:"belum", 12:"belum", 13:"belum", 14:"belum", 15:"belum",
                  16:"belum", 17:"belum", 18:"belum", 19:"belum", 20:"belum",
                  21:"belum", 22:"hafal", 23:"hafal", 24:"belum", 25:"belum",
                  26:"belum", 27:"belum", 28:"belum", 29:"hafal", 30:"hafal",
                };
                const colorMap = { hafal: "#10B981", proses: "#F59E0B", belum: "var(--muted)" };
                const textMap = { hafal: "#fff", proses: "#fff", belum: "var(--muted-foreground)" };
                return (
                  <div className="grid grid-cols-6 sm:grid-cols-10 gap-2">
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((juz) => {
                      const s = juzStatus[juz];
                      return (
                        <div key={juz}
                          className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 hover:scale-110 transition-transform cursor-default"
                          style={{ background: colorMap[s], color: textMap[s] }}>
                          <span className="text-[10px] font-bold leading-none">{juz}</span>
                          <span className="text-[8px] opacity-70 leading-none">{s === "hafal" ? "✓" : s === "proses" ? "…" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
                {[
                  { label: "Hafal", count: 9, color: "#10B981" },
                  { label: "Proses", count: 2, color: "#F59E0B" },
                  { label: "Belum", count: 19, color: "#64748B" },
                ].map((s) => (
                  <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: `${s.color}10` }}>
                    <p className="text-2xl font-black tabular-nums" style={{ color: s.color }}>{s.count}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.label} / 30 juz</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Setoran Card ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Setoran Tahfizh</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Input setoran */}
              <div className="bg-card rounded-[1.5rem] border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <p className="text-sm font-bold text-foreground">Form Setoran</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ahmad Rizki Maulana · Kamis, 12 Jun 2025</p>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Surah & Ayat</label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-10 rounded-[0.875rem] border px-3 flex items-center text-sm text-muted-foreground" style={{ background: "var(--input-background)", borderColor: "var(--border)" }}>
                        Al-Baqarah (2)
                      </div>
                      <div className="h-10 rounded-[0.875rem] border px-3 flex items-center text-sm text-muted-foreground" style={{ background: "var(--input-background)", borderColor: "var(--border)" }}>
                        1 – 20
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-2">Nilai Setoran</label>
                    <div className="flex gap-2">
                      {[
                        { label: "Lancar", color: "#10B981", bg: "rgba(16,185,129,0.12)" },
                        { label: "Kurang", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
                        { label: "Ulang",  color: "#EF4444", bg: "rgba(239,68,68,0.12)"  },
                      ].map((v, vi) => (
                        <button key={v.label}
                          className="flex-1 h-9 rounded-[0.875rem] text-xs font-bold transition-all"
                          style={{
                            color: v.color,
                            background: vi === 0 ? v.bg : "var(--muted)",
                            border: vi === 0 ? `1.5px solid ${v.color}` : "1.5px solid transparent",
                          }}>
                          {v.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1.5">Catatan musyrif</label>
                    <div className="h-16 rounded-[0.875rem] border px-3 py-2 text-xs text-muted-foreground flex items-start" style={{ background: "var(--input-background)", borderColor: "var(--border)" }}>
                      Bacaan sudah lancar, tajwid perlu diperbaiki di ayat 7–9.
                    </div>
                  </div>
                </div>
              </div>

              {/* Riwayat setoran */}
              <div className="bg-card rounded-[1.5rem] border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <p className="text-sm font-bold text-foreground">Riwayat Setoran</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ahmad Rizki Maulana · Juni 2025</p>
                </div>
                {[
                  { date: "12 Jun", surah: "Al-Baqarah", ayat: "1–20",  nilai: "Lancar", color: "#10B981", bg: "rgba(16,185,129,0.10)" },
                  { date: "10 Jun", surah: "Al-Fatihah", ayat: "1–7",   nilai: "Lancar", color: "#10B981", bg: "rgba(16,185,129,0.10)" },
                  { date: "8 Jun",  surah: "An-Nas",     ayat: "1–6",   nilai: "Kurang", color: "#F59E0B", bg: "rgba(245,158,11,0.10)" },
                  { date: "6 Jun",  surah: "Al-Falaq",   ayat: "1–5",   nilai: "Ulang",  color: "#EF4444", bg: "rgba(239,68,68,0.10)"  },
                  { date: "5 Jun",  surah: "Al-Ikhlas",  ayat: "1–4",   nilai: "Lancar", color: "#10B981", bg: "rgba(16,185,129,0.10)" },
                ].map((r) => (
                  <div key={r.date + r.surah} className="flex items-center gap-4 px-5 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <span style={{ fontFamily: "'DM Mono', monospace" }} className="text-[11px] text-muted-foreground w-12 shrink-0">{r.date}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{r.surah}</p>
                      <p className="text-xs text-muted-foreground">Ayat {r.ayat}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{ color: r.color, background: r.bg }}>{r.nilai}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Hafalan Progress Card ── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Hafalan Progress Card</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

              {/* Compact progress */}
              {[
                { name: "Ahmad Rizki",  juz: 9,  ayat: 2847, target: 30, color: "#F97316" },
                { name: "Budi Santoso", juz: 5,  ayat: 1672, target: 15, color: "#F59E0B" },
                { name: "Cahya Rahman", juz: 14, ayat: 4428, target: 30, color: "#EA580C" },
              ].map((s) => {
                const r = 36; const c = 2 * Math.PI * r;
                const pct = Math.round(s.juz / s.target * 100);
                const offset = c - (pct / 100) * c;
                return (
                  <div key={s.name} className="bg-card rounded-[1.5rem] border border-border p-5">
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 shrink-0">
                        <svg width="80" height="80" viewBox="0 0 96 96" className="-rotate-90">
                          <circle cx="48" cy="48" r={r} fill="none" strokeWidth="8" stroke={`${s.color}20`} />
                          <circle cx="48" cy="48" r={r} fill="none" strokeWidth="8"
                            stroke={s.color} strokeLinecap="round"
                            strokeDasharray={c} strokeDashoffset={offset} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-base font-black tabular-nums" style={{ color: s.color }}>{s.juz}</span>
                          <span className="text-[9px] text-muted-foreground">juz</span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.juz}/{s.target} juz · {pct}%</p>
                        <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-[10px] text-muted-foreground mt-1">{s.ayat.toLocaleString()} ayat</p>
                        <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 15 — ROLE ICONS */}
        <section id="roles">
          <SectionHeader number="15" title="Role Icons" description="Icon khusus per role dan kelas — konsisten, color-coded, berbasis SVG inline." />

          {/* ── Icon grid ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Semua Role</p>
            <div className="bg-card rounded-[1.5rem] border border-border p-6">
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-6">
                {ROLE_ICONS.map((role) => (
                  <div key={role.id} className="flex flex-col items-center gap-2 group cursor-default">
                    <div className="relative transition-transform duration-200 group-hover:scale-110">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                        style={{ background: role.bg, color: role.color }}>
                        {role.icon}
                      </div>
                      {role.badge && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white border-2 border-white"
                          style={{ background: role.color }}>
                          {role.badge}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] font-semibold text-center text-muted-foreground leading-tight">{role.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sizes ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Size Scale</p>
            <div className="bg-card rounded-[1.5rem] border border-border p-6 flex flex-wrap items-end gap-8">
              {[
                { iconSize: 10, boxSize: "w-5 h-5",   radius: "rounded-md",   label: "20px", use: "Badge list" },
                { iconSize: 14, boxSize: "w-8 h-8",   radius: "rounded-xl",   label: "32px", use: "Row item" },
                { iconSize: 18, boxSize: "w-12 h-12", radius: "rounded-2xl",  label: "48px", use: "Card" },
                { iconSize: 22, boxSize: "w-14 h-14", radius: "rounded-2xl",  label: "56px", use: "Profile" },
                { iconSize: 28, boxSize: "w-20 h-20", radius: "rounded-3xl",  label: "80px", use: "Detail page" },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-2">
                  <div className={`${s.boxSize} ${s.radius} flex items-center justify-center`}
                    style={{ background: ROLE_ICONS[0].bg, color: ROLE_ICONS[0].color }}>
                    <GraduationCap size={s.iconSize} />
                  </div>
                  <div className="text-center">
                    <p style={{ fontFamily: "'DM Mono', monospace" }} className="text-[10px] font-semibold text-foreground">{s.label}</p>
                    <p className="text-[9px] text-muted-foreground">{s.use}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Role colors ── */}
          <div className="mb-8">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Color System per Role</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Santri Kelas 1–6", colors: ["#2563EB","#7C3AED","#059669","#D97706","#0891B2","#4F46E5"] },
                { label: "Program Khusus",   colors: ["#B45309","#0C81E4"] },
                { label: "Pengajar",         colors: ["#0C4E8C","#78350F","#374151","#1D4ED8"] },
                { label: "Support",          colors: ["#0C1F3D","#1F2937","#0891B2","#BE185D"] },
              ].map((group) => (
                <div key={group.label} className="bg-card rounded-[1.5rem] border border-border p-4">
                  <p className="text-[10px] font-semibold text-muted-foreground mb-3">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.colors.map((c) => (
                      <div key={c} className="w-8 h-8 rounded-lg" style={{ background: c }} title={c} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── In context: student row ── */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Contoh — Dalam Konteks Presensi</p>
            <div className="bg-card rounded-[1.5rem] border border-border overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Daftar Hadir — Sesi Isya</p>
              </div>
              {[
                { name: "Ahmad Rizki Maulana",  role: ROLE_ICONS[0],  kelas: "Kelas 1 / Kamar 3A", status: "H" as StatusKey },
                { name: "Budi Santoso Wijaya",  role: ROLE_ICONS[4],  kelas: "Kelas 5 / Kamar 7B", status: "T" as StatusKey },
                { name: "Cahya Ramadhan Putra", role: ROLE_ICONS[6],  kelas: "Program Unggulan",    status: "S" as StatusKey },
                { name: "Ust. Daffa Pratama",   role: ROLE_ICONS[8],  kelas: "Musyrif Kamar 3",     status: "H" as StatusKey },
                { name: "Dr. Eka Wirawan",       role: ROLE_ICONS[14], kelas: "Dokter Klinik",       status: "H" as StatusKey },
              ].map((row) => {
                const meta = STATUS_META[row.status];
                return (
                  <div key={row.name} className="flex items-center gap-3 sm:gap-4 px-5 py-3 border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: row.role.bg, color: row.role.color }}>
                        {row.role.icon}
                      </div>
                      {row.role.badge && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white border-2 border-white"
                          style={{ background: row.role.color }}>
                          {row.role.badge}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.kelas}</p>
                    </div>
                    <StatusBadge statusKey={row.status} />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 16 — RADIUS & ELEVATION */}
        <section id="spacing">
          <SectionHeader number="16" title="Radius & Elevation" description="Skala radius dan shadow yang distandarisasi." />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Radius Scale</p>
              <div className="space-y-4">
                {[
                  { name: "Chip",       value: "0.5rem (8px)",  cls: "rounded" },
                  { name: "Control",    value: "0.875rem (14px)", cls: "rounded-[0.875rem]" },
                  { name: "Panel",      value: "1.5rem (24px)",  cls: "rounded-[1.5rem]" },
                  { name: "Full / Pill", value: "999px",         cls: "rounded-full" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center gap-4">
                    <div className={cx("w-16 h-8 bg-[#0C81E4] shrink-0", item.cls)} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">Elevation Scale</p>
              <div className="space-y-4">
                {[
                  { name: "Elevation 0", shadow: "none",                                        desc: "Flat / table row" },
                  { name: "Elevation 1", shadow: "0 2px 8px -2px rgba(15,23,42,0.08)",          desc: "Card resting" },
                  { name: "Elevation 2", shadow: "0 14px 40px -24px rgba(15,23,42,0.28)",       desc: "Card default" },
                  { name: "Elevation 3", shadow: "0 18px 46px -26px rgba(12,78,140,0.32)",      desc: "Card hover" },
                  { name: "Floating",    shadow: "0 10px 35px rgba(0,0,0,0.12)",                desc: "Bottom controls" },
                ].map((item) => (
                  <div key={item.name} className="flex items-center gap-4">
                    <div className="w-16 h-10 bg-card rounded-[0.875rem] shrink-0" style={{ boxShadow: item.shadow, border: "1px solid var(--border)" }} />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-border mt-16 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={syamsaLogo} alt="Syamsa" className="h-6 w-auto object-contain" />
            <span className="text-sm text-muted-foreground">Design System v2.0</span>
          </div>
          <p className="text-xs text-muted-foreground">illuminate every presence · Plus Jakarta Sans · Lucide Icons</p>
        </div>
      </footer>
    </div>
  );
}
