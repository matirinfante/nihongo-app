# 日本語 Nihongo App v2

Teacher dashboard + Student learning app. Built with React, Firebase, and Vite. Deploy-ready for Vercel.

## What's new in v2
- 🌗 **Light / Dark theme toggle** — respects system preference, persists across sessions
- 🖥️ **Responsive desktop layout** — student view uses a sidebar on desktop (768px+) and tabs on mobile
- 📷 **Image upload** — teachers can attach a cover image to any lesson (stored in Firebase Storage)
- ⚡ **Seed button** — one-click seeding of all 13 lessons, 60+ vocab words, and 8 culture moments from Matiasさん.pdf
- 🔑 **Sign out** — clearly labeled, always visible

---

## Setup

### 1. Install
```bash
npm install
```

### 2. Firebase project
1. [Firebase Console](https://console.firebase.google.com/) → New project
2. **Authentication** → Enable Email/Password
3. **Firestore** → Create database (production mode)
4. **Storage** → Get started (production mode)
5. **Project Settings** → Your apps → Add web app → copy config

### 3. Environment variables
```bash
cp .env.example .env.local
```
Fill in your Firebase values. Also set:
```
VITE_TEACHER_CODE=SENSEI2024   # change this to something only your tutor knows
```

### 4. Firestore security rules
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth.uid == uid;
    }
    match /studentProgress/{uid} {
      allow read, write: if request.auth.uid == uid;
      allow read: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher';
    }
    match /lessons/{id}   { allow read: if request.auth != null; allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher'; }
    match /vocabulary/{id} { allow read: if request.auth != null; allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher'; }
    match /moments/{id}    { allow read: if request.auth != null; allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'teacher'; }
  }
}
```

### 5. Firebase Storage rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /lesson-covers/{file} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && get(/databases/(default)/documents/users/$(request.auth.uid)).data.role == 'teacher'
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### 6. Run locally
```bash
npm run dev
```

---

## Seeding data from Matiasさん.pdf

After the teacher signs in for the first time:
1. Go to **Lessons** tab → click **⚡ Seed from PDF** (visible when no lessons exist)
2. Go to **Vocab** tab → click **⚡ Seed from PDF**
3. Go to **Culture** tab → click **⚡ Seed from PDF**

This loads:
- **13 lessons** across 5 units (No.1–No.3 + travel + food from June–September sessions)
- **60+ vocabulary words** in 6 packs with XP unlock gates matching lesson progress
- **8 culture moments** (trains, konbini, cherry blossoms, meals, bowing, izakaya, gifts, hanakin)

---

## Deploy to Vercel

### Option A — Vercel Dashboard
1. Push repo to GitHub
2. Import at [vercel.com/new](https://vercel.com/new)
3. Add all `VITE_*` env vars in project settings
4. Deploy

### Option B — CLI
```bash
npx vercel
```

---

## Roles

| Role    | How to register                                         |
|---------|---------------------------------------------------------|
| Student | Register normally — no code needed                      |
| Teacher | Register with teacher code in the "Teacher code" field  |

Teacher code is `VITE_TEACHER_CODE` in your env (default: `SENSEI2024`).

---

## Challenge types reference

```json
{ "type": "mc-jp-en", "prompt": "What does this mean?", "jp": "たべます", "romaji": "tabemasu",
  "options": ["eat","drink","sleep","walk"], "answer": "eat" }

{ "type": "mc-en-jp", "prompt": "How do you say 'I go to school'?",
  "options": ["がっこうにいきます。","がっこうでたべます。"], "romaji": ["...", "..."], "answer": "がっこうにいきます。" }

{ "type": "fill", "prompt": "Choose the particle:", "sentence": ["バス","___","いきます。"],
  "options": ["で","は","を","に"], "answer": "で", "hint": "で = by means of" }

{ "type": "tap", "prompt": "Build: 'I go to school by bus.'",
  "answer": ["バスで","がっこうに","いきます。"],
  "bank":   ["バスで","がっこうに","いきます。","たべます。","でんしゃで"] }
```
