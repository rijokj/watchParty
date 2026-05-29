# Watch Party Deployment Guide

This guide explains how to host the **CafeSync Watch Party** application so that the frontend and backend can connect seamlessly.

---

## Method 1: Host Frontend & Backend Together (Recommended & Simplest)

In this approach, you compile the React frontend into static assets, and let the Node/Express backend serve them on the same domain and port.
* **Benefits:** Single deployment, zero CORS configuration, automatic connection without setting any environment variables.

### Steps to Host Together (e.g. on Render/Railway/Fly.io)

1. **Install dependencies in both directories:**
   Make sure all dependencies are installed before building. Run from the root folder:
   ```bash
   npm run install:all
   ```

2. **Build the frontend:**
   This compiles your React + Vite project into `frontend/dist`.
   ```bash
   npm run build:frontend
   ```

3. **Configure your hosting provider:**
   * **Build Command:** `npm run install:all && npm run build:frontend`
   * **Start Command:** `npm run start:backend`
   * **Environment Variables:** Set `NODE_ENV=production`

4. Once deployed, visit your app URL. The Express server will serve the frontend, and it will automatically connect to its own socket server!

---

## Method 2: Host Separately (Frontend on Vercel/Netlify, Backend on Render/Railway)

If you prefer to host your frontend statically on **Vercel** and the backend on **Render/Railway**:

### Step 1: Deploy the Backend
1. Host the `backend` folder on Render or Railway.
2. Note down your backend server URL (e.g., `https://my-watch-party-backend.onrender.com`).

### Step 2: Deploy the Frontend
There are two ways to connect your Vercel frontend to the backend server:

#### Option A: Build-Time Environment Variable (Best for all users)
When importing code to **Vercel**:
1. Go to the project settings in Vercel.
2. Under **Environment Variables**, add:
   * **Key:** `VITE_BACKEND_URL`
   * **Value:** `https://my-watch-party-backend.onrender.com` (your hosted backend URL)
3. Redeploy the Vercel app. Vite will inject the URL at build time.

#### Option B: Live UI Customization (No rebuild required)
If you already deployed your frontend to Vercel and it is showing connection errors:
1. Open the hosted Vercel URL in your browser.
2. You will see a red indicator in the top-right header: `Server Disconnected 🔴`.
3. Click the **Settings (⚙️) icon** next to it.
4. Type your hosted backend URL (e.g., `https://my-watch-party-backend.onrender.com`) into the **Backend Socket URL** input.
5. Click **Save & Connect**.
6. The app will immediately connect to your backend, and save the settings locally in your browser so you don't need to configure it again!
