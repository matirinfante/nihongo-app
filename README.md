# 日本語 Nihongo App

A Japanese learning app for Matias with a **student view** and a **teacher dashboard** for his Tokyo tutor.

---

## Stack

- **React 18** + **Vite** — frontend
- **Firebase** — Auth (email/password) + Firestore (real-time database)
- **Vercel** — hosting

---

## Setup

### 1. Clone & install
```bash
npm install
```

### 2. Create a Firebase project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (e.g. `nihongo-app`)
3. Enable **Authentication → Email/Password**
4. Create a **Firestore Database** (start in production mode)
5. Go to **Project Settings → Your Apps → Add Web App**
6. Copy the config values

### 3. Configure environment variables
```bash
cp .env.example .env.local
```
Fill in your Firebase values in `.env.local`.

Also set a teacher invite code:
```
VITE_TEACHER_CODE=SENSEI2024
```
Change this to something only your tutor knows.

### 4. Firestore security rules
Paste this in Firebase Console → Firestore → Rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read their own profile
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    // Students can read/write their own progress
    match /studentProgress/{uid} {
      allow read, write: if request.auth.uid == uid;
      allow read: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
    // Teachers can write content, everyone authenticated can read
    match /lessons/{id} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
    match /vocabulary/{id} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
    match /moments/{id} {
      allow read: if request.auth != null;
      allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
  }
}
```

### 5. Run locally
```bash
npm run dev
```

---

## How roles work

| Role    | How to get it                                    |
|---------|--------------------------------------------------|
| Student | Register normally — no code needed               |
| Teacher | Register with the teacher code in the invite field |

The teacher code is set in `VITE_TEACHER_CODE` (default: `SENSEI2024`).

---

## Deploy to Vercel

### Option A — Vercel CLI
```bash
npm install -g vercel
vercel
```

### Option B — Vercel Dashboard
1. Push this repo to GitHub
2. Import it in [vercel.com/new](https://vercel.com/new)
3. Set all `VITE_*` environment variables in the Vercel project settings
4. Deploy

The `vercel.json` file already handles SPA routing.

---

## Teacher: how to add content

1. Sign in with your teacher account
2. **Lessons tab** → Create lessons with title, emoji, unit, and XP values → then add challenges of these types:
   - **MC: Japanese → English** — show a Japanese word, pick the English meaning
   - **MC: English → Japanese** — show an English prompt, pick the correct Japanese
   - **Fill the blank** — complete a sentence by choosing the right particle/word
   - **Build the sentence** — tap words from a bank to form a Japanese sentence
3. **Vocab tab** → Add words grouped by pack (e.g. "Daily Life", "Food & Drinks")
4. **Culture tab** → Add Japan cultural moments with attached vocabulary
5. **Students tab** → See student XP, level, streak, and completed lessons

---

## Challenge JSON reference

If you ever need to pre-seed lessons via a script:

```json
{
  "type": "mc-jp-en",
  "prompt": "What does this word mean?",
  "jp": "たべます",
  "romaji": "tabemasu",
  "options": ["eat", "drink", "sleep", "walk"],
  "answer": "eat"
}
```

```json
{
  "type": "tap",
  "prompt": "Build the sentence: 'I go to school by bus.'",
  "answer": ["バスで", "がっこうに", "いきます。"],
  "bank":   ["バスで", "がっこうに", "いきます。", "たべます。", "でんしゃで"]
}
```

```json
{
  "type": "fill",
  "prompt": "Choose the correct particle:",
  "sentence": ["バス", "___", "いきます。"],
  "options": ["で", "は", "を", "に"],
  "answer": "で",
  "hint": "で = by means of"
}
```
