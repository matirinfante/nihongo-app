import { useState, useEffect, createContext, useContext } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase.js'
import { darkTheme, lightTheme } from './theme.js'
import LoginScreen from './screens/LoginScreen.jsx'
import StudentApp  from './screens/StudentApp.jsx'
import TeacherApp  from './screens/TeacherApp.jsx'

// ─── Contexts ──────────────────────────────────────────────────────────────────
export const AuthCtx  = createContext(null)
export const ThemeCtx = createContext(null)

export const useAuth  = () => useContext(AuthCtx)
export const useTheme = () => useContext(ThemeCtx)

export default function App() {
  const [user,    setUser]    = useState(undefined)
  const [role,    setRole]    = useState(null)
  const [profile, setProfile] = useState(null)
  const [isDark,  setIsDark]  = useState(() => {
    const saved = localStorage.getItem('nihongo_theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  const T = isDark ? darkTheme : lightTheme

  const toggleTheme = () => setIsDark(prev => {
    localStorage.setItem('nihongo_theme', !prev ? 'dark' : 'light')
    return !prev
  })

  useEffect(() => {
    document.body.style.background = T.bg
    document.body.style.color      = T.textPrimary
  }, [T])

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      if (!u) { setUser(null); setRole(null); return }
      setUser(u)
      const snap = await getDoc(doc(db, 'users', u.uid))
      if (snap.exists()) {
        const d = snap.data()
        setRole(d.role)
        setProfile(d)
      } else {
        setRole('student')
        setProfile({ displayName: u.displayName || u.email?.split('@')[0], role: 'student' })
      }
    })
  }, [])

  const authCtx = {
    user, role, profile,
    signOut: () => signOut(auth),
  }

  const themeCtx = { T, isDark, toggleTheme }

  if (user === undefined) return (
    <ThemeCtx.Provider value={themeCtx}>
      <Splash T={T} />
    </ThemeCtx.Provider>
  )

  return (
    <ThemeCtx.Provider value={themeCtx}>
      <AuthCtx.Provider value={authCtx}>
        <div style={{ minHeight: '100vh', background: T.bg, color: T.textPrimary, fontFamily: "'Roboto', 'Noto Sans JP', sans-serif", transition: 'background 0.2s, color 0.2s' }}>
          {!user              && <LoginScreen />}
          {user && role === 'teacher' && <TeacherApp />}
          {user && role !== 'teacher' && <StudentApp />}
        </div>
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
  )
}

function Splash({ T }) {
  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:48, fontFamily:"'Noto Sans JP', sans-serif", color:T.textPrimary }}>日本語</div>
      <div style={{ width:48, height:3, background:T.primary, borderRadius:99 }} />
    </div>
  )
}
