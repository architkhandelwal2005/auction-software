# Auction Software - Technical Handover Document

Hello Claude! This document is designed to give you a complete overview of the Auction Software project. It outlines the architecture, the technology stack, the file structure, and all the recent features we've implemented, so you have full context to continue development.

## 🏗️ Architecture & Tech Stack

This is a **Lightweight Monolith** application. There is no Node.js backend or bundler (no Webpack/Vite) to keep deployment as simple as possible.

*   **Frontend Framework**: React 18 (using Functional Components & Hooks)
*   **Frontend Delivery**: Loaded directly in the browser via CDN. JSX is compiled on the fly in the browser using Babel (`@babel/standalone`).
*   **Styling**: Tailwind CSS (loaded via CDN) + custom CSS keyframe animations.
*   **Backend Framework**: Python Flask (`app.py`).
*   **Database**: SQLite (`auction.db`).
*   **Real-time Updates**: Client-side polling (`setInterval` fetching from `/api/live_data` every 2 seconds).

## 📁 Project Structure

The project is structured entirely within this directory (`F:\auction software` or `E:\auction software`).

```text
📁 auction software/
├── 📄 app.py                     # The main Flask Backend server
├── 📄 requirements.txt           # Python dependencies (Flask, Werkzeug)
├── 📄 Procfile                   # For Render.com deployment
├── 📁 static/
│   ├── 📄 app.jsx                # THE ENTIRE ADMIN FRONTEND (React Code)
│   ├── 📄 team_app.jsx           # The Team Owner Dashboard (React Code)
│   └── 📁 uploads/               # Temporary storage for Excel/CSV uploads
├── 📁 templates/
│   ├── 📄 index.html             # The Admin Portal (loads app.jsx)
│   ├── 📄 login.html             # Role-based login screen
│   ├── 📄 live_view.html         # The Spectator/Public Screen (React in HTML)
│   └── 📄 team_view.html         # The Team Owner Portal (loads team_app.jsx)
```

## 🧠 Key Files & Their Responsibilities

### 1. `static/app.jsx` (The Beating Heart - ~1600 lines)
This is the main admin dashboard. It is a single massive React file containing multiple components:
*   **`SetupWizard`**: Handles the 4-step creation process (Event Name -> Upload Excel -> Configure Categories -> Define Teams). Includes a "Smart Analysis" algorithm that evenly divides budget quotas.
*   **`App`**: The main state container holding `soldPlayers`, `unsoldPlayers`, `teams`, `auction_state`.
*   **Dashboard Views**: Contains the logic for the "Player Pool" grid, category filters, and the "Unsold Bin" (handling Passed players and Reviving them).
*   **Auction Stage (Cinematic)**: The full-screen stage where players are auctioned. See the "Recent Updates" section for details on the new cinematic reveal.
*   **Sound/Voice Engine**: Contains the `SFX` object (Web Audio API oscillators) and `speakCommentary` (Web Speech API).

### 2. `app.py` (The Backend - ~1800 lines)
*   Manages the SQLite database schema (`config`, `teams`, `players`, `category_rules`, `auction_state`).
*   **Role-Based Access**: Uses Flask sessions (`session['role'] = 'admin' | 'team' | 'viewer'`). The password for admin is hardcoded as `'admin'`. Team owners log in using their exact team name (lowercase, spaces stripped).
*   **Endpoints**: Everything routes through REST APIs (e.g., `/api/sell_player`, `/api/action/pass`, `/api/live_data`).
*   **File Uploads**: Processes incoming Excel (`.xlsx`) or `.csv` files and converts columns to a JSON `attributes` column in the database.

### 3. `templates/live_view.html` (The Public Screen)
*   A standalone React app embedded directly inside the HTML file using Babel script tags.
*   Polls `/api/live_data` every 2 seconds.
*   Displays the active player on the hammer, live bid, remaining squad purses, and a scrolling news ticker.
*   Fully syncs with the Admin's cinematic animations and sport themes.

## 🚀 Recent Major Updates (What we just built)

We recently transformed the basic admin stage into a **Sport-Themed Cinematic Experience**. If you are modifying the stage, be aware of these systems:

1.  **Sport Themes (`SPORT_THEMES`)**:
    *   Defined at the top of `app.jsx` and `live_view.html`.
    *   Supports: Cricket, Football, Badminton, Pickleball, Basketball, Esports, Art, and Multi-Sport.
    *   Each theme defines custom CSS gradients (`bg`), accent colors (`accent`), and watermarks (`emoji`).
    *   Saved in the DB `config` table as `sport_theme`.

2.  **Staggered Player Reveal (`revealPhase`)**:
    *   Instead of instantly showing a player when drawn, there is a 6-stage suspense reveal over ~4 seconds.
    *   `Phase 0`: Trigger `SFX.reveal()` (tension building sound).
    *   `Phase 1-4`: Sequentially slide in the Category, Attributes, Photo (with `dramaticZoom`), and Name (with `slamIn`).
    *   `Phase 5`: Base price and bid controls fade in.
    *   *Note*: The user can toggle **"Quick Mode"** (⚡ icon) in the header to skip these animations.

3.  **Unsold Bin & Revive System**:
    *   Players can be "Passed". They move to a "Passed" state.
    *   Admins can review them in the Dashboard and choose to "Auction @ 50%" (halves their base price and puts them back on stage) or throw them into a "Random Spin" wheel for teams to fight over.

## 🛠️ How to Make Changes Safely

1.  **`app.jsx` is huge.** Because it's one large file without a bundler, you must use precise line targeting if replacing code.
2.  **No Build Step.** You don't need to run `npm run build`. Just edit the `.jsx` or `.py` files, save, and hit refresh in the browser.
3.  **Tailwind JIT.** Tailwind is running via a CDN script in development mode. Any valid Tailwind class you add to a `className` will automatically work.
4.  **Database Resets.** If you get the database into a weird state, the admin can click "Wipe All Data & Start Fresh" in the dashboard, which completely clears the SQLite tables.

## 🎯 Current User Goals

The user is actively showing this software to sports management firms. The focus is on making the interface look **lucrative, highly professional, and cinematic** (like a broadcast overlay). Ensure any new UI features respect the dark `zinc-*` palette and use the `currentTheme.accent` for highlights.

Good luck! You have a great codebase to work with.
