# 🕉️ Dharma AI — Vedic Wisdom & Sadhana Companion

**Dharma AI** is an intelligent spiritual companion and daily Sadhana (spiritual practice) tracker grounded in classical Vedic wisdom, including the *Bhagavad Gita*, the *Mahabharata*, and classical philosophical traditions (Advaita Vedanta, Karma Yoga, Bhakti Yoga, and Jnana Yoga).

---

## ✨ Features

### 1. 🤖 AI Spiritual Guidance & Scripture RAG
- **Scripture-Grounded Dialogue**: Contextual philosophical and practical answers cited directly from verses of the Bhagavad Gita and Mahabharata.
- **Semantic Vector Search (RAG)**: Integrates OpenAI embeddings with Supabase `pgvector` for scripture retrieval with a bundled local fallback.
- **Dual AI Engine Support**: Connects with Grok / xAI models or OpenAI for spiritual guidance and philosophical inquiry.
- **Rich Verse Cards**: Interactive Sanskrit Devanagari verses with IAST transliteration, word-for-word breakdown, contextual translations, and philosophical commentaries.

### 2. 📖 Sacred Scripture Library
- **Comprehensive Reader**: Explore chapters across the Bhagavad Gita and Mahabharata Parvas.
- **Mood & Context-Based Shlokas**: Dynamic recommendations tailored to current emotional or life states (e.g., anxiety, decision paralysis, peace, courage, grief, devotion).
- **Search & Filter**: Filter by tradition, chapter, parva, and theme.

### 3. 📿 Daily Sadhana Tracker
- **Japa & Mantra Chanting Counter**: Interactive digital Mala counter with round tracking (108 beads per mala), target goals, and session metrics.
- **Meditation Timer**: Built-in mindful meditation timer with bell chimes and ambient focus states.
- **Daily Swadhyaya (Study) & Reflection**: Track daily reading habits and save spiritual reflections.
- **Consistency & Streak Metrics**: Track your spiritual momentum with daily streaks, practice logs, and weekly habit charts.

### 4. 🌅 Time-Adaptive Vedic Themes
- Dynamic UI palette transitions honoring the sacred divisions of the day (*Sandhyas*):
  - **Brahma Muhurta** (Early Morning / Dawn)
  - **Madhyahna** (Midday Sun)
  - **Sandhya** (Twilight / Sunset)
  - **Ratri** (Night & Contemplation)

### 5. 🎨 Shareable Wisdom Cards
- Export and download verse cards with typography and traditional artwork presets for social sharing and personal keepsakes.

### 6. 🔐 Authentication & Cloud Sync
- Sync progress, bookmarks, and Sadhana history across devices via **Supabase Auth & Database**.
- Works offline/locally with `localStorage` fallback if backend credentials are not provided.

---

## 🛠️ Tech Stack

- **Frontend**: [React 19](https://react.dev/), [Vite](https://vite.dev/)
- **Styling**: CSS custom properties with responsive typography and Vedic aesthetic themes
- **Fonts**: Noto Sans Devanagari, Crimson Pro, Inter
- **Database & Auth**: [Supabase](https://supabase.com/) (`@supabase/supabase-js`, PostgreSQL + `pgvector`)
- **AI & Embeddings**: [OpenAI SDK](https://github.com/openai/openai-node) / [xAI Grok](https://x.ai/)
- **Linter & Tools**: [Oxlint](https://oxc.rs/)

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** (or **pnpm** / **yarn**)

### 1. Clone the Repository
```bash
git clone https://github.com/Cubix33/dharma-ai.git
cd dharma-ai
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and fill in your API keys:
```env
# Supabase Configuration (Optional - fallback to local storage if blank)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# OpenAI API Key (For vector embeddings search)
VITE_OPENAI_API_KEY=your-openai-api-key

# xAI / Grok API Key (For chat completions)
VITE_GROK_API_KEY=your-grok-api-key
```

> **Note**: The app includes bundled offline scriptures and fallback mock responses, allowing it to run and render the full UI even without external API credentials.

---

## 💻 Running the Application

### Development Server
Run the local Vite dev server on `http://localhost:3000`:
```bash
npm run dev
```

### Production Build
Create an optimized production bundle in `dist/`:
```bash
npm run build
```

### Preview Production Build
Preview the production build locally:
```bash
npm run preview
```

### Code Linting
Run Oxlint to check for code quality and syntax issues:
```bash
npm run lint
```

---

## 📁 Project Structure

```
├── public/                  # Static assets and icons
├── src/
│   ├── assets/              # Images, illustrations, and logos
│   ├── App.css              # App-specific animations and styles
│   ├── App.jsx              # Main Dharma AI application container & router
│   ├── Auth.jsx             # User authentication and profile modals
│   ├── Onboarding.jsx       # Spiritual intent & onboarding questionnaire
│   ├── SadhanaTracker.jsx   # Japa mala, meditation timer, and sadhana dashboard
│   ├── ShareCard.jsx        # Verse card generator & export module
│   ├── scriptures.js        # Bundled scripture library & dataset
│   ├── supabaseClient.js    # Supabase client initialization & helpers
│   ├── useAuth.js           # Auth state & user profile hook
│   ├── useScriptures.js     # Vector search hook for scripture retrieval
│   ├── useTimeTheme.js      # Dynamic Sandhya/Muhurta day-phase hook
│   ├── index.css            # Global typography and color variables
│   └── main.jsx             # React DOM root entry point
├── .env.example             # Environment variables template
├── metadata.json            # Application metadata
├── package.json             # Scripts and dependency manifest
└── vite.config.js           # Vite build and proxy configuration
```

---

## 📜 License

This project is open-source and available under the [MIT License](LICENSE).
