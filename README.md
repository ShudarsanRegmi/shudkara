# Shudkara Hub — Azure Static Web App Developer Workspace

Shudkara Hub is a multi-feature web application designed to run entirely on **Azure Static Web Apps (SWA)**. It is built using **React (Vite) + TypeScript + Tailwind CSS (v4)** for the frontend, and **Azure Functions (NodeJS)** for serverless backend API features.

---

## 🚀 Features

### 1. LeetCode Blind 75 Revision Tracker
* **Direct LeetCode Links:** Access all classic Blind 75 questions grouped by topic (Arrays, Graphs, Trees, etc.).
* **Revision History:** Log how many times you've solved or revised a question. Track the exact last revised date.
* **Topic-specific Notes:** Capture your approaches, space/time complexity details, or custom solution links in a collapsible markdown/code editor.
* **Offline First & Secure:** All progress, stars, and notes are saved directly in your browser's `localStorage` (your data stays yours).
* **Backup & Restore:** Easily export all progress as a JSON file and import it back anytime to sync across devices.

### 2. Serverless P2P Airdrop File Share
* **WebRTC Direct Link:** Connects two browsers directly using **PeerJS** via a free, public signaling server.
* **No File Size Limit:** Files do not touch any server, bypassing the Azure SWA 4MB API limit. You can transfer gigabyte-sized files.
* **ACK-based Chunking Protocol:** Splices files into 16KB packets and waits for receiver ACKs. This guarantees stability and displays an accurate progress bar without crashing the browser's RAM.
* **Interactive Radar UI:** Generates a 6-character connection code. Simply copy/enter the code to establish a peer connection and drop files.

### 3. Shared Text Rooms
* **Zero Login Collaboration:** Spin up an online collaborative notepad instantly by choosing a room name (or generating a random slug) and a custom passcode.
* **Permission Model:** Anyone with the room name can fetch and read the content. Modifications require entering the passcode.
* **Dual Persistence Engine:**
  * **Development / Local Fallback:** Persists data inside `api/rooms-db.json` locally so text rooms survive server restarts. If writing fails, it falls back to an in-memory map.
  * **Production Persistence (Optional):** Define a MongoDB connection string in the environment, and the backend automatically connects and persists rooms permanently.
* **Direct Routing:** Share direct links in the format `?room=roomId`. The SWA router will parse it, redirect to the Text Room view, and fetch the room automatically.
* **Smart Credential Caching:** Recalls correct passcodes for rooms you created or successfully edited, sparing you from re-typing passcodes when returning.

---

## 📂 Project Directory Structure

```text
├── api/                             # Azure Functions SWA API (Backend)
│   ├── dist/                        # Compiled JavaScript functions
│   ├── src/
│   │   └── functions/
│   │       └── rooms.ts             # Main handler for shared text rooms
│   ├── host.json                    # Azure Functions configuration
│   ├── local.settings.json          # Local dev environment settings
│   ├── package.json                 # Backend dependencies (mongodb, azure/functions)
│   └── tsconfig.json                # TypeScript settings for backend
├── src/                             # React Vite Application (Frontend)
│   ├── assets/                      # Static logo assets
│   ├── components/                  # React views
│   │   ├── Airdrop.tsx              # WebRTC file share UI and transfer logic
│   │   ├── Dashboard.tsx            # Main landing view and Leetcode stats
│   │   ├── LeetCodeTracker.tsx      # Blind75 questions, notes, and progress
│   │   └── TextRoom.tsx             # Shared text rooms API interface
│   ├── data/
│   │   └── blind75.ts               # Blind 75 static questions list
│   ├── App.css                      # App shell CSS overrides
│   ├── App.tsx                      # Main shell router and dark mode manager
│   ├── index.css                    # Tailwind CSS v4 entrypoint
│   └── main.tsx                     # React root mount
├── index.html                       # HTML Template
├── package.json                     # Frontend dependencies (peerjs, lucide-react)
├── staticwebapp.config.json         # Azure SWA navigation fallback & node runtime config
├── tsconfig.json                    # Workspace TS project config
└── vite.config.ts                   # Vite configuration (with Tailwind CSS v4)
```

---

## 🛠️ Local Development

You can run the frontend and backend concurrently to test locally.

### Prerequisites
1. **NodeJS (v20+)** installed.
2. **Azure Functions Core Tools** installed (optional, only if you want to run the local API).
   ```bash
   npm install -g azure-functions-core-tools@4 --unsafe-perm true
   ```

### Running the Frontend
From the root directory:
```bash
# Install dependencies
npm install

# Run Vite dev server
npm run dev
```
The React frontend will be running on `http://localhost:5173`.

### Running the Backend API
In a new terminal window:
```bash
# Move to api directory
cd api

# Install dependencies
npm install

# Compile TypeScript and start Azure Functions local host
npm start
```
The API server will run locally on `http://localhost:7071`.

### Running with SWA CLI (Emulating SWA Environment)
You can run both at the same time using the Azure Static Web Apps CLI:
```bash
# Install SWA CLI globally
npm install -g @azure/static-web-apps-cli

# Start SWA emulator proxying frontend (5173) and backend (7071)
swa start http://localhost:5173 --api-location http://localhost:7071
```
Open `http://localhost:4280` to interact with the full app with SWA emulation.

---

## ☁️ Deployment to Azure Static Web Apps

Deploying Shudkara Hub to Azure SWA is easy. You can configure it to build from your GitHub repository automatically.

### 1. Deployment Settings in GitHub Actions / Azure SWA
When setting up your Static Web App, configure the build settings as follows:
* **App location:** `/`
* **API location:** `api`
* **Output location:** `dist` (this is the folder built by Vite)

### 2. Setting Up Database (Optional)
By default, text rooms will store in-memory in production SWA (and disappear when SWA instances recycle). To persist text rooms forever:
1. Spin up a **MongoDB** or **Azure Cosmos DB for MongoDB API** cluster (both have excellent free tiers).
2. Grab the connection string (e.g. `mongodb+srv://<user>:<password>@cluster.mongodb.net/shudkara`).
3. Go to the Azure Portal -> Navigate to your **Static Web App** -> **Settings** -> **Configuration**.
4. Add a new **Application Setting**:
   * **Name:** `MONGODB_URI`
   * **Value:** `<your-connection-string>`
5. Click **Save**. The SWA API will automatically restart and securely persist all text rooms.

---

## 🔒 Security & Privacy Notes
* **WebRTC Transfer:** Your files never reach any server during P2P file drop. The signaling server is only used to establish connection metadata, and then the direct browser-to-browser data channel is utilized.
* **Data Privacy:** LeetCode progress notes and favorites are stored entirely in local browser sandboxes. No logs are shared.
* **Hash Encryption:** Shared text rooms check passcodes by hashing them with `SHA-256` on the server. The raw edit passcode is never saved in the database.
