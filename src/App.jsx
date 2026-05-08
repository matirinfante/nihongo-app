import { useState, useEffect, createContext, useContext } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from './firebase.js'
import LoginScreen  from './screens/LoginScreen.jsx'
import StudentApp   from './screens/StudentApp.jsx'
import TeacherApp   from './screens/TeacherApp.jsx'
import { T } from './theme.js'
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

export default function App() {
  const [user, setUser]       = useState(undefined)  // undefined = loading
  const [role, setRole]       = useState(null)
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) { setUser(null); setRole(null); return }
      setUser(u)
      const snap = await getDoc(doc(db, 'users', u.uid))
      if (snap.exists()) {
        const data = snap.data()
        setRole(data.role)
        setProfile(data)
      } else {
        setRole('student')
        setProfile({ displayName: u.displayName || u.email, role: 'student' })
      }
    })
  }, [])

  if (user === undefined) return <Splash />

  const ctx = { user, role, profile, signOut: () => signOut(auth) }

  return (
    <AuthCtx.Provider value={ctx}>
      <div style={{ minHeight: '100vh', background: T.bg, color: T.textPrimary, fontFamily: T.sans }}>
        {!user    && <LoginScreen />}
        {user && role === 'teacher'  && <TeacherApp />}
        {user && role !== 'teacher'  && <StudentApp />}
      </div>
    </AuthCtx.Provider>
  )
}

function Splash() {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 42, fontFamily: T.jp }}>日本語</div>
      <div style={{ width: 48, height: 3, background: T.primary, borderRadius: 99, animation: 'pulse 1.4s ease-in-out infinite', opacity: 0.8 }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }`}</style>
    </div>
  )
}
