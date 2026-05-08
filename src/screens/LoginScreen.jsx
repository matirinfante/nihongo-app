import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase.js'
import { T, type } from '../theme.js'

export default function LoginScreen() {
  const [mode,    setMode]    = useState('login')   // 'login' | 'register'
  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [name,    setName]    = useState('')
  const [code,    setCode]    = useState('')        // teacher invite code
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Set VITE_TEACHER_CODE in your .env.local  (e.g. SENSEI2024)
  const TEACHER_CODE = import.meta.env.VITE_TEACHER_CODE || 'SENSEI2024'

  const submit = async () => {
    setError(''); setLoading(true)
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, pass)
      } else {
        const { user } = await createUserWithEmailAndPassword(auth, email, pass)
        const role = code === TEACHER_CODE ? 'teacher' : 'student'
        await setDoc(doc(db, 'users', user.uid), {
          displayName: name || email.split('@')[0],
          email,
          role,
          createdAt: serverTimestamp(),
        })
        if (role === 'student') {
          await setDoc(doc(db, 'studentProgress', user.uid), {
            xp: 0,
            completedLessons: [],
            streak: 0,
            lastActive: serverTimestamp(),
          })
        }
      }
    } catch (e) {
      const msgs = {
        'auth/invalid-credential':      'Incorrect email or password.',
        'auth/email-already-in-use':    'This email is already registered.',
        'auth/weak-password':           'Password must be at least 6 characters.',
        'auth/invalid-email':           'Please enter a valid email address.',
      }
      setError(msgs[e.code] || e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24, background: T.bg,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ ...type.jpLg, color: T.textPrimary, fontSize: 56, lineHeight: 1 }}>日本語</div>
          <div style={{ ...type.label, color: T.textSecondary, marginTop: 8, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            Nihongo Learning
          </div>
        </div>

        {/* Card */}
        <div style={{ background: T.surface, borderRadius: T.r20, padding: '32px 28px', border: `1px solid ${T.outline}` }}>
          <h2 style={{ ...type.headlineSm, color: T.textPrimary, marginBottom: 4 }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={{ ...type.bodySm, color: T.textSecondary, marginBottom: 28 }}>
            {mode === 'login' ? 'Sign in to continue learning' : 'Join as a student or teacher'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && (
              <Field label="Your name" value={name} onChange={setName} placeholder="e.g. Matias" />
            )}
            <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
            <Field label="Password" value={pass} onChange={setPass} placeholder="••••••••" type="password" />
            {mode === 'register' && (
              <Field label="Teacher code (optional)" value={code} onChange={setCode} placeholder="Leave blank if you're a student" />
            )}
          </div>

          {error && (
            <div style={{ marginTop: 16, padding: '10px 14px', background: T.redDim, borderRadius: T.r8, border: `1px solid ${T.red}44` }}>
              <p style={{ ...type.bodySm, color: T.red }}>{error}</p>
            </div>
          )}

          <button onClick={submit} disabled={loading} style={{
            marginTop: 24, width: '100%', padding: '14px',
            borderRadius: T.r12, border: 'none',
            background: loading ? T.surface3 : T.primary,
            color: T.onPrimary, cursor: loading ? 'default' : 'pointer',
            ...type.titleSm, fontWeight: 700, letterSpacing: 0.3,
            transition: 'background 0.2s',
          }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <span style={{ ...type.bodySm, color: T.textSecondary }}>
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            </span>
            <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
              style={{ background: 'none', border: 'none', color: T.primary, cursor: 'pointer', ...type.bodySm, fontWeight: 500 }}>
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type: t = 'text' }) {
  const [focused, setFocused] = useState(false)
  return (
    <div>
      <label style={{ ...T.label, fontSize: 12, color: T.textSecondary, marginBottom: 6, display: 'block', fontWeight: 500 }}>
        {label}
      </label>
      <input
        type={t} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: T.r8,
          border: `1.5px solid ${focused ? T.primary : T.outline}`,
          background: T.surface2, color: T.textPrimary,
          fontSize: 15, outline: 'none', transition: 'border-color 0.15s',
          fontFamily: T.sans,
        }}
      />
    </div>
  )
}
