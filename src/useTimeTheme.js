import * as React from "react";

// useTimeTheme.js — Time-based spiritual themes for Dharma AI

export function getTimeTheme(override) {
  if (override && THEMES[override]) return THEMES[override];

  const hour = new Date().getHours();
  const min  = new Date().getMinutes();
  const time = hour + min / 60;

  if (time >= 4 && time < 6) return THEMES.brahma;
  if (time >= 6 && time < 8) return THEMES.sunrise;
  if (time >= 8 && time < 16) return THEMES.day;
  if (time >= 16 && time < 18.5) return THEMES.sunset;
  return THEMES.night;
}

export function useTimeTheme() {
  const [override, setOverride] = React.useState(localStorage.getItem('spiritualAtmosphere') || 'auto');
  const [theme, setTheme] = React.useState(getTimeTheme(override === 'auto' ? null : override));

  React.useEffect(() => {
    const updateTheme = () => setTheme(getTimeTheme(override === 'auto' ? null : override));
    updateTheme();
    const interval = setInterval(updateTheme, 60000);
    return () => clearInterval(interval);
  }, [override]);

  const changeTheme = (newTheme) => {
    setOverride(newTheme);
    localStorage.setItem('spiritualAtmosphere', newTheme);
  };

  return { theme, override, changeTheme };
}

export const THEMES = {

  brahma: {
    name: "Brahma Muhurta",
    nameHindi: "ब्रह्म मुहूर्त",
    time: "4:00 – 6:00 AM",
    bgGradient: "linear-gradient(160deg, #0d0820 0%, #1a0d35 40%, #2d1540 100%)",
    navBg: "rgba(13,8,32,0.92)",
    cardBg: "rgba(255,255,255,0.09)",
    cardBorder: "rgba(180,120,255,0.25)",
    inputBg: "rgba(255,255,255,0.08)",
    textPrimary: "#f2e8ff",
    textSecondary: "#d4b8f8",
    textMuted: "#a888d8",
    accent: "#c89aff",
    accentBg: "rgba(180,120,255,0.18)",
    accentBorder: "rgba(180,120,255,0.4)",
    orb1: { color: "rgba(180,120,255,0.2)", size: 300, top: -80, right: -60 },
    orb2: { color: "rgba(255,180,100,0.08)", size: 200, bottom: 100, left: -40 },
    celestial: "moon",
    celestialStyle: {
      position: "fixed", top: 82, right: 28,
      width: 36, height: 36, borderRadius: "50%",
      background: "radial-gradient(circle at 38% 35%, #fff8e0, #c8a840)",
      boxShadow: "0 0 24px rgba(200,168,64,0.4), 0 0 60px rgba(200,140,40,0.15)",
    },
    showStars: true,
    starOpacity: 0.7,
    navGlow: "rgba(180,120,255,0.12)",
    greeting: "Good early morning",
    greetingHindi: "सुप्रभातम्",
  },

  sunrise: {
    name: "Sunrise",
    nameHindi: "उषाकाल",
    time: "6:00 – 8:00 AM",
    bgGradient: "linear-gradient(170deg, #0f0400 0%, #3d1000 18%, #8b2800 38%, #c85a00 58%, #e88820 76%, #f5b84a 100%)",
    navBg: "rgba(15,4,0,0.88)",
    cardBg: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(255,160,60,0.22)",
    inputBg: "rgba(255,255,255,0.07)",
    textPrimary: "#fff6ec",
    textSecondary: "#ffc878",
    textMuted: "#c07830",
    accent: "#ffaa44",
    accentBg: "rgba(255,160,60,0.14)",
    accentBorder: "rgba(255,160,60,0.38)",
    orb1: { color: "rgba(255,150,30,0.28)", size: 380, bottom: -80, right: -60 },
    orb2: { color: "rgba(255,80,10,0.14)", size: 240, bottom: -40, right: 20 },
    celestial: "sun-rising",
    celestialStyle: {
      position: "fixed", top: 82, right: 28,
      width: 58, height: 58, borderRadius: "50%",
      background: "radial-gradient(circle at 40% 38%, #fffff0, #ffd050, #ff8818)",
      boxShadow: "0 0 52px rgba(255,185,40,0.65), 0 0 110px rgba(255,120,20,0.30), 0 0 180px rgba(255,80,10,0.14)",
    },
    showStars: false,
    isLight: false,
    navGlow: "rgba(255,160,40,0.14)",
    greeting: "Good morning",
    greetingHindi: "सुप्रभातम्",
  },

  day: {
    name: "Madhyahna",
    nameHindi: "दिवस",
    time: "8:00 AM – 4:00 PM",
    bgGradient: "linear-gradient(180deg, #071828 0%, #0c2d50 28%, #0f4278 58%, #1258a0 100%)",
    navBg: "rgba(5,14,26,0.92)",
    cardBg: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(100,180,255,0.20)",
    inputBg: "rgba(255,255,255,0.07)",
    textPrimary: "#e8f4ff",
    textSecondary: "#90c8f0",
    textMuted: "#4888b8",
    accent: "#60b8ff",
    accentBg: "rgba(80,170,255,0.14)",
    accentBorder: "rgba(80,170,255,0.35)",
    orb1: { color: "rgba(80,160,255,0.16)", size: 320, top: -60, right: -20 },
    orb2: { color: "rgba(255,240,160,0.09)", size: 260, bottom: -70, left: -40 },
    celestial: "sun-high",
    celestialStyle: {
      position: "fixed", top: 82, right: 28,
      width: 52, height: 52, borderRadius: "50%",
      background: "radial-gradient(circle at 38% 35%, #fffff8, #ffe858, #ffc820)",
      boxShadow: "0 0 38px rgba(255,225,60,0.55), 0 0 80px rgba(255,185,30,0.24), 0 0 140px rgba(255,160,20,0.10)",
    },
    showStars: false,
    isLight: false,
    navGlow: "rgba(80,170,255,0.14)",
    greeting: "Good day",
    greetingHindi: "नमस्ते",
  },

  sunset: {
    name: "Sandhyakaal",
    nameHindi: "सन्ध्याकाल",
    time: "4:00 – 6:30 PM",
    bgGradient: "linear-gradient(165deg, #0c0200 0%, #3a0c00 18%, #8a2c08 38%, #c05a18 56%, #e08840 76%, #f0b868 100%)",
    navBg: "rgba(12,2,0,0.90)",
    cardBg: "rgba(255,255,255,0.08)",
    cardBorder: "rgba(240,140,50,0.22)",
    inputBg: "rgba(255,255,255,0.07)",
    textPrimary: "#fff2e0",
    textSecondary: "#ffb860",
    textMuted: "#b86820",
    accent: "#ff9a38",
    accentBg: "rgba(255,140,50,0.14)",
    accentBorder: "rgba(255,140,50,0.38)",
    orb1: { color: "rgba(240,130,40,0.32)", size: 360, bottom: -70, left: -50 },
    orb2: { color: "rgba(200,50,10,0.18)", size: 220, bottom: -30, left: 30 },
    celestial: "sun-setting",
    celestialStyle: {
      position: "fixed", top: 82, left: 28,
      width: 54, height: 54, borderRadius: "50%",
      background: "radial-gradient(circle at 42% 40%, #fff0a8, #ffb030, #ff5c08)",
      boxShadow: "0 0 50px rgba(255,148,28,0.60), 0 0 100px rgba(255,85,10,0.26), 0 0 170px rgba(255,60,8,0.12)",
    },
    showStars: false,
    isLight: false,
    navGlow: "rgba(255,140,50,0.14)",
    greeting: "Good evening",
    greetingHindi: "शुभ सन्ध्या",
  },

  night: {
    name: "Ratri",
    nameHindi: "रात्रि",
    time: "6:30 PM – 4:00 AM",
    bgGradient: "linear-gradient(180deg, #06131f 0%, #0b1f30 24%, #102942 52%, #173a59 100%)",
    navBg: "rgba(8,18,28,0.84)",
    cardBg: "rgba(255,255,255,0.12)",
    cardBorder: "rgba(182,198,224,0.26)",
    inputBg: "rgba(255,255,255,0.08)",
    textPrimary: "#edf5ff",
    textSecondary: "#d4e6ff",
    textMuted: "#9cb8d5",
    accent: "#b7d3ff",
    accentBg: "rgba(164,195,255,0.18)",
    accentBorder: "rgba(184,216,255,0.32)",
    orb1: { color: "rgba(78,120,200,0.12)", size: 350, top: -80, left: -60 },
    orb2: { color: "rgba(120,90,220,0.10)", size: 250, bottom: -60, right: -40 },
    celestial: "moon-clouds",
    celestialStyle: {
      position: "fixed", top: 82, right: 28,
      width: 110, height: 68, borderRadius: 20,
      background: "transparent",
    },
    showStars: true,
    starOpacity: 1.0,
    navGlow: "rgba(165,195,255,0.12)",
    greeting: "Good night",
    greetingHindi: "शुभ रात्रि",
  },
};
