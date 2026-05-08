import { useState, useEffect, useCallback } from 'react'
import { collection, doc, onSnapshot, updateDoc, arrayUnion, increment, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth, useTheme } from '../App.jsx'
import { type, R } from '../theme.js'

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

const TABS = [
  { id:'lessons', label:'Lessons',  icon:'学' },
  { id:'vocab',   label:'Words',    icon:'語' },
  { id:'moments', label:'Culture',  icon:'🎌' },
]

// ─── Responsive hook ───────────────────────────────────────────────────────────
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768)
  useEffect(() => {
    const h = () => setIsDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return isDesktop
}

export default function StudentApp() {
  const { user, profile, signOut } = useAuth()
  const { T, isDark, toggleTheme } = useTheme()
  const isDesktop = useIsDesktop()

  const [tab,      setTab]      = useState('lessons')
  const [lessons,  setLessons]  = useState([])
  const [vocab,    setVocab]    = useState([])
  const [moments,  setMoments]  = useState([])
  const [progress, setProgress] = useState({ xp:0, completedLessons:[], streak:0 })
  const [active,   setActive]   = useState(null)
  const [screen,   setScreen]   = useState('home')
  const [result,   setResult]   = useState(null)

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db,'lessons'), orderBy('order')), s => setLessons(s.docs.map(d=>({id:d.id,...d.data()}))))
    const u2 = onSnapshot(collection(db,'vocabulary'), s => setVocab(s.docs.map(d=>({id:d.id,...d.data()}))))
    const u3 = onSnapshot(collection(db,'moments'), s => setMoments(s.docs.map(d=>({id:d.id,...d.data()}))))
    let u4 = ()=>{}
    if (user) {
      u4 = onSnapshot(doc(db,'studentProgress',user.uid), s => { if (s.exists()) setProgress(s.data()) })
    }
    return () => { u1(); u2(); u3(); u4() }
  }, [user])

  const finishLesson = useCallback(async ({ lessonId, xpEarned }) => {
    if (!user) return
    await updateDoc(doc(db,'studentProgress',user.uid), { xp:increment(xpEarned), completedLessons:arrayUnion(lessonId), lastActive:serverTimestamp() })
  }, [user])

  if (screen === 'lesson' && active)
    return <LessonPlayer T={T} lesson={active} onFinish={r => { finishLesson(r); setResult(r); setScreen('results') }} onExit={() => setScreen('home')} />
  if (screen === 'results' && result)
    return <ResultScreen T={T} result={result} onContinue={() => { setScreen('home'); setResult(null) }} />

  const xp       = progress.xp ?? 0
  const level    = Math.floor(xp / 100) + 1
  const xpInLev  = xp % 100

  // ── Sidebar (desktop) / Header (mobile) ───────────────────────────────────
  const Sidebar = () => (
    <aside style={{ width:240, background:T.surface, borderRight:`1px solid ${T.outline}`, display:'flex', flexDirection:'column', flexShrink:0, height:'100vh', position:'sticky', top:0 }}>
      {/* Logo */}
      <div style={{ padding:'24px 20px 16px', borderBottom:`1px solid ${T.outline}` }}>
        <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:28, color:T.primary, fontWeight:700, lineHeight:1 }}>日本語</div>
        <div style={{ ...type.labelSm, color:T.textSecondary, marginTop:4 }}>{profile?.displayName}</div>
      </div>

      {/* XP + level */}
      <div style={{ padding:'16px 20px', borderBottom:`1px solid ${T.outline}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
          <span style={{ ...type.label, color:T.primary, fontWeight:700 }}>Level {level}</span>
          <span style={{ ...type.labelSm, color:T.textSecondary }}>{xpInLev}/100 XP</span>
        </div>
        <div style={{ height:5, background:T.surface3, borderRadius:99 }}>
          <div style={{ height:'100%', width:`${xpInLev}%`, background:`linear-gradient(90deg,${T.primary},${T.secondary})`, borderRadius:99, transition:'width 0.5s' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:10 }}>
          <Stat T={T} label="Total XP" value={`⚡ ${xp}`} color={T.primary} />
          <Stat T={T} label="Streak"   value={`🔥 ${progress.streak??0}`} color='#FF8F40' />
          <Stat T={T} label="Done"     value={`✅ ${(progress.completedLessons??[]).length}`} color={T.green} />
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'12px 12px' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ width:'100%', padding:'11px 14px', borderRadius:R.r10, border:'none', background:tab===t.id?T.primaryDim:'none', color:tab===t.id?T.primary:T.textSecondary, cursor:'pointer', textAlign:'left', display:'flex', gap:12, alignItems:'center', ...type.bodySm, fontWeight:tab===t.id?700:400, marginBottom:2, transition:'all 0.15s' }}>
            <span style={{ fontFamily:t.icon.length>2?"'Noto Sans JP', sans-serif":'inherit', fontSize:18, color:tab===t.id?T.primary:T.textSecondary }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Bottom controls */}
      <div style={{ padding:'12px 16px', borderTop:`1px solid ${T.outline}`, display:'flex', gap:8 }}>
        <button onClick={toggleTheme} style={{ flex:1, padding:'9px', borderRadius:R.r8, border:`1px solid ${T.outline}`, background:'none', color:T.textSecondary, cursor:'pointer', fontSize:16 }} title="Toggle theme">{isDark?'☀️':'🌙'}</button>
        <button onClick={signOut} style={{ flex:2, padding:'9px 14px', borderRadius:R.r8, border:`1px solid ${T.outline}`, background:'none', color:T.textSecondary, cursor:'pointer', ...type.bodySm, display:'flex', gap:6, alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:14 }}>⎋</span> Sign out
        </button>
      </div>
    </aside>
  )

  const MobileHeader = () => (
    <header style={{ background:T.surface, borderBottom:`1px solid ${T.outline}`, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
      <div>
        <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:22, color:T.primary, fontWeight:700, lineHeight:1 }}>日本語</div>
        <div style={{ ...type.labelSm, color:T.textSecondary, marginTop:2 }}>{profile?.displayName}</div>
      </div>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <div style={{ textAlign:'right' }}>
          <div style={{ ...type.bodySm, color:T.primary, fontWeight:700 }}>⚡ {xp} XP</div>
          <div style={{ ...type.labelSm, color:'#FF8F40' }}>🔥 {progress.streak??0} days</div>
        </div>
        <button onClick={toggleTheme} style={{ padding:'8px', borderRadius:R.r8, border:`1px solid ${T.outline}`, background:'none', fontSize:16, cursor:'pointer' }}>{isDark?'☀️':'🌙'}</button>
        <button onClick={signOut} style={{ padding:'8px 12px', borderRadius:R.r8, border:`1px solid ${T.outline}`, background:'none', color:T.textSecondary, cursor:'pointer', ...type.label }}>Sign out</button>
      </div>
    </header>
  )

  const MobileXPBar = () => (
    <div style={{ padding:'10px 16px 0', borderBottom:`1px solid ${T.outline}`, background:T.surface }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
        <span style={{ ...type.labelSm, color:T.textSecondary }}>Level {level}</span>
        <span style={{ ...type.labelSm, color:T.textSecondary }}>{xpInLev}/100</span>
      </div>
      <div style={{ height:4, background:T.surface3, borderRadius:99, marginBottom:10 }}>
        <div style={{ height:'100%', width:`${xpInLev}%`, background:`linear-gradient(90deg,${T.primary},${T.secondary})`, borderRadius:99, transition:'width 0.5s' }} />
      </div>
    </div>
  )

  const content = (
    <div style={{ flex:1, overflowY:'auto', padding: isDesktop ? '28px 36px' : '16px 0 80px' }}>
      {tab === 'lessons' && <LessonsTab T={T} lessons={lessons} progress={progress} isDesktop={isDesktop} onStart={l => { setActive(l); setScreen('lesson') }} />}
      {tab === 'vocab'   && <VocabTab   T={T} vocab={vocab} xp={xp} isDesktop={isDesktop} />}
      {tab === 'moments' && <MomentsTab T={T} moments={moments} isDesktop={isDesktop} />}
    </div>
  )

  if (isDesktop) return (
    <div style={{ display:'flex', minHeight:'100vh', background:T.bg }}>
      <Sidebar />
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:'100vh' }}>
        {content}
      </main>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:T.bg }}>
      <MobileHeader />
      <MobileXPBar />
      <div style={{ flex:1, overflow:'hidden' }}>{content}</div>
      <nav style={{ position:'fixed', bottom:0, left:0, right:0, background:T.surface, borderTop:`1px solid ${T.outline}`, display:'flex', paddingBottom:'env(safe-area-inset-bottom,0px)', zIndex:100 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, padding:'10px 0 12px', border:'none', background:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, opacity:tab===t.id?1:0.45 }}>
            <span style={{ fontSize:18, fontFamily:t.icon.length>2?"'Noto Sans JP', sans-serif":'inherit', color:tab===t.id?T.primary:T.textSecondary }}>{t.icon}</span>
            <span style={{ ...type.labelSm, color:tab===t.id?T.primary:T.textSecondary }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

// ── Lessons Tab ───────────────────────────────────────────────────────────────
function LessonsTab({ T, lessons, progress, isDesktop, onStart }) {
  const units = [...new Set(lessons.map(l=>l.unit))].sort()
  const pad = isDesktop ? '0' : '0 16px'
  return (
    <div style={{ padding: isDesktop ? 0 : '8px 0' }}>
      {units.map(unit => {
        const ul = lessons.filter(l=>l.unit===unit)
        const unitName = ul[0]?.unitName || `Unit ${unit}`
        return (
          <div key={unit} style={{ marginBottom:32 }}>
            <div style={{ ...type.label, color:T.textSecondary, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12, padding: isDesktop?0:'0 16px' }}>
              Unit {unit} — {unitName}
            </div>
            <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(340px,1fr))' : '1fr', gap:10, padding: isDesktop ? 0 : '0 16px' }}>
              {ul.map(lesson => {
                const unlocked = (progress.xp??0) >= (lesson.xpRequired??0)
                const done     = (progress.completedLessons??[]).includes(lesson.id)
                return <LessonCard key={lesson.id} T={T} lesson={lesson} unlocked={unlocked} done={done} onStart={() => onStart(lesson)} />
              })}
            </div>
          </div>
        )
      })}
      {lessons.length === 0 && <Empty T={T} jp="授業なし" en="No lessons yet — your teacher will add them soon" />}
    </div>
  )
}

function LessonCard({ T, lesson, unlocked, done, onStart }) {
  return (
    <div onClick={() => unlocked && onStart()} style={{ background:T.surface, borderRadius:R.r16, border:`1.5px solid ${done?T.green+'55':unlocked?T.outline:T.outline}`, padding:'16px 18px', cursor:unlocked?'pointer':'default', opacity:unlocked?1:0.45, display:'flex', gap:14, alignItems:'center', transition:'border-color 0.2s', position:'relative', overflow:'hidden' }}>
      {lesson.coverImageUrl && (
        <div style={{ position:'absolute', inset:0, backgroundImage:`url(${lesson.coverImageUrl})`, backgroundSize:'cover', backgroundPosition:'center', opacity:0.06 }} />
      )}
      <div style={{ width:52, height:52, borderRadius:R.r12, flexShrink:0, background:done?T.greenDim:unlocked?T.primaryDim:T.surface2, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, zIndex:1 }}>
        {lesson.emoji || '📖'}
      </div>
      <div style={{ flex:1, minWidth:0, zIndex:1 }}>
        <div style={{ ...type.titleSm, color:done?T.green:T.textPrimary }}>{lesson.title}</div>
        <div style={{ ...type.labelSm, color:T.textSecondary, marginTop:2, fontFamily:"'Noto Sans JP', sans-serif" }}>{lesson.titleJp}</div>
        <div style={{ ...type.labelSm, color:T.textSecondary, marginTop:4 }}>{(lesson.challenges??[]).length} challenges</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0, zIndex:1 }}>
        {done && <div style={{ fontSize:22 }}>✅</div>}
        {!done && unlocked  && <div style={{ ...type.label, color:T.primary, fontWeight:700 }}>+{lesson.xpReward??80} XP</div>}
        {!unlocked && <div style={{ ...type.labelSm, color:T.textSecondary }}>🔒 {lesson.xpRequired}</div>}
      </div>
    </div>
  )
}

// ── Vocab Tab ─────────────────────────────────────────────────────────────────
function VocabTab({ T, vocab, xp, isDesktop }) {
  const packs = [...new Set(vocab.map(v=>v.packLabel).filter(Boolean))]
  const [pack, setPack] = useState(0)
  const current = packs[pack]
  const words = vocab.filter(v=>v.packLabel===current)
  const lockedPacks = [...new Set(vocab.filter(v=>(v.xpRequired??0)>xp).map(v=>v.packLabel))].filter(Boolean)

  return (
    <div style={{ padding: isDesktop ? 0 : '8px 16px' }}>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
        {packs.map((p,i) => (
          <button key={p} onClick={() => setPack(i)} style={{ padding:'6px 16px', borderRadius:R.full, border:'none', cursor:'pointer', background:pack===i?T.primary:T.surface2, color:pack===i?T.onPrimary:T.textSecondary, ...type.label, fontWeight:600, transition:'background 0.15s' }}>{p}</button>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns: isDesktop ? 'repeat(auto-fill, minmax(280px,1fr))' : '1fr', gap:8 }}>
        {words.map((w,i) => (
          <div key={i} style={{ background:T.surface, borderRadius:R.r12, border:`1px solid ${T.outline}`, padding:'14px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:22, color:T.textPrimary }}>{w.jp}</div>
              <div style={{ ...type.labelSm, color:T.primary, marginTop:2 }}>{w.romaji}</div>
            </div>
            <div style={{ ...type.bodySm, color:T.textSecondary, textAlign:'right', maxWidth:160 }}>{w.en}</div>
          </div>
        ))}
      </div>
      {lockedPacks.length > 0 && <>
        <div style={{ ...type.label, color:T.textSecondary, textTransform:'uppercase', letterSpacing:'0.1em', margin:'24px 0 10px' }}>Locked packs</div>
        {lockedPacks.map(p => (
          <div key={p} style={{ background:T.surface, borderRadius:R.r12, border:`1px solid ${T.outline}`, padding:'12px 16px', marginBottom:8, display:'flex', justifyContent:'space-between', opacity:0.5 }}>
            <span style={{ ...type.bodySm, color:T.textSecondary }}>{p}</span>
            <span style={{ ...type.label, color:T.textSecondary }}>🔒 {Math.min(...vocab.filter(v=>v.packLabel===p).map(v=>v.xpRequired??0))} XP</span>
          </div>
        ))}
      </>}
      {vocab.length === 0 && <Empty T={T} jp="語彙なし" en="No vocabulary added yet" />}
    </div>
  )
}

// ── Moments Tab ───────────────────────────────────────────────────────────────
function MomentsTab({ T, moments, isDesktop }) {
  const [idx, setIdx] = useState(0)
  if (moments.length === 0) return <div style={{ padding: isDesktop?0:'0 16px' }}><Empty T={T} jp="文化なし" en="No culture moments added yet" /></div>
  const m = moments[idx]
  return (
    <div style={{ padding: isDesktop?0:'0 16px', maxWidth: isDesktop?640:undefined }}>
      <div style={{ background:T.surface, borderRadius:R.r20, border:`1px solid ${T.outline}`, padding:'32px 28px', marginBottom:16 }}>
        <div style={{ fontSize:48, textAlign:'center', marginBottom:16 }}>{m.emoji||'🎌'}</div>
        <h2 style={{ ...type.headlineSm, color:T.textPrimary, textAlign:'center', marginBottom:18 }}>{m.title}</h2>
        <p style={{ ...type.bodyLg, color:T.textSecondary, lineHeight:1.85 }}>{m.fact}</p>
      </div>
      {m.vocab?.length > 0 && <>
        <div style={{ ...type.label, color:T.textSecondary, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:10 }}>Words from this moment</div>
        {m.vocab.map((v,i) => (
          <div key={i} style={{ background:T.surface, borderRadius:R.r12, border:`1px solid ${T.outline}`, padding:'12px 16px', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:20, color:T.textPrimary }}>{v.jp}</div>
              <div style={{ ...type.labelSm, color:T.primary }}>{v.romaji}</div>
            </div>
            <div style={{ ...type.bodySm, color:T.textSecondary }}>{v.en}</div>
          </div>
        ))}
      </>}
      <div style={{ display:'flex', gap:10, marginTop:20 }}>
        <button onClick={() => setIdx(i=>(i-1+moments.length)%moments.length)} style={ghostBtn(T)}>← Prev</button>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ ...type.label, color:T.textSecondary }}>{idx+1} / {moments.length}</span>
        </div>
        <button onClick={() => setIdx(i=>(i+1)%moments.length)} style={ghostBtn(T)}>Next →</button>
      </div>
    </div>
  )
}

// ── Lesson Player ─────────────────────────────────────────────────────────────
function LessonPlayer({ T, lesson, onFinish, onExit }) {
  const challenges = lesson.challenges ?? []
  const [idx,      setIdx]      = useState(0)
  const [answered, setAnswered] = useState(false)
  const [correct,  setCorrect]  = useState(null)
  const [selected, setSelected] = useState(null)
  const [tapBuilt, setTapBuilt] = useState([])
  const [tapBank,  setTapBank]  = useState([])
  const [errors,   setErrors]   = useState(0)
  const [score,    setScore]    = useState(0)

  const challenge = challenges[idx]
  const isTap     = challenge?.type === 'tap'
  const progress  = (idx / challenges.length) * 100

  useEffect(() => {
    if (challenge?.type === 'tap') { setTapBuilt([]); setTapBank(shuffle(challenge.bank??[])) }
  }, [idx])

  if (!challenge) {
    const xpEarned = Math.max(20, (lesson.xpReward??80) - errors * 10)
    onFinish({ lessonId:lesson.id, xpEarned, errors, score, total:challenges.length })
    return null
  }

  const submit = (ans) => {
    if (answered) return
    let ok = isTap ? JSON.stringify(tapBuilt)===JSON.stringify(challenge.answer) : ans===challenge.answer
    if (!isTap) setSelected(ans)
    setAnswered(true); setCorrect(ok)
    if (!ok) setErrors(e=>e+1); else setScore(s=>s+1)
  }

  const advance = () => { setIdx(i=>i+1); setAnswered(false); setCorrect(null); setSelected(null); setTapBuilt([]); setTapBank([]) }

  const tapWord = (word, fromBank) => {
    if (answered) return
    if (fromBank) { setTapBuilt(b=>[...b,word]); setTapBank(a=>{const i=a.indexOf(word);return [...a.slice(0,i),...a.slice(i+1)]}) }
    else           { setTapBank(a=>[...a,word]);  setTapBuilt(b=>{const i=b.lastIndexOf(word);return [...b.slice(0,i),...b.slice(i+1)]}) }
  }

  const typeLabel = { 'mc-jp-en':'Japanese → English','mc-en-jp':'English → Japanese','fill':'Fill the blank','tap':'Build the sentence' }[challenge.type]??'Challenge'
  const isJpOpts  = challenge.type==='mc-en-jp'

  return (
    <div style={{ minHeight:'100vh', background:T.bg, maxWidth:580, margin:'0 auto', display:'flex', flexDirection:'column' }}>
      <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:12, borderBottom:`1px solid ${T.outline}`, background:T.surface }}>
        <button onClick={onExit} style={{ background:'none', border:`1px solid ${T.outline}`, borderRadius:R.r8, color:T.textSecondary, cursor:'pointer', fontSize:13, padding:'6px 12px', ...type.label }}>✕ Exit</button>
        <div style={{ flex:1, height:6, background:T.surface3, borderRadius:99, overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${progress}%`, background:`linear-gradient(90deg,${T.primary},${T.secondary})`, borderRadius:99, transition:'width 0.35s ease' }} />
        </div>
        <span style={{ ...type.label, color:T.primary, fontWeight:700, minWidth:52, textAlign:'right' }}>⚡ {score*10}</span>
      </div>

      <div style={{ flex:1, padding:'16px 20px', display:'flex', flexDirection:'column' }}>
        <div style={{ ...type.label, color:T.textSecondary, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>{typeLabel}</div>
        <p style={{ ...type.titleSm, color:T.textSecondary, marginBottom:20, lineHeight:1.6 }}>{challenge.prompt}</p>

        {challenge.type==='mc-jp-en' && (
          <div style={{ background:T.surface, borderRadius:R.r20, padding:'32px 24px', textAlign:'center', marginBottom:24, border:`1px solid ${T.outline}` }}>
            <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:42, color:T.textPrimary, fontWeight:500 }}>{challenge.jp}</div>
            <div style={{ ...type.label, color:T.textSecondary, marginTop:10 }}>{challenge.romaji}</div>
          </div>
        )}

        {challenge.type==='fill' && (
          <div style={{ background:T.surface, borderRadius:R.r20, padding:'24px', textAlign:'center', marginBottom:24, border:`1px solid ${T.outline}` }}>
            <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:26, color:T.textPrimary, lineHeight:2.2, display:'flex', flexWrap:'wrap', justifyContent:'center', gap:4, alignItems:'center' }}>
              {(challenge.sentence??[]).map((part,i) =>
                part==='___'
                  ? <span key={i} style={{ display:'inline-block', minWidth:64, borderBottom:`2.5px solid ${answered?(correct?T.green:T.red):T.primary}`, color:answered?(correct?T.green:T.red):T.primary, padding:'0 8px' }}>{answered?selected:'\u3000'}</span>
                  : <span key={i} style={{ fontFamily:"'Noto Sans JP', sans-serif" }}>{part}</span>
              )}
            </div>
            {challenge.hint && !answered && <div style={{ ...type.bodySm, color:T.textSecondary, marginTop:12 }}>💡 {challenge.hint}</div>}
          </div>
        )}

        {isTap && (
          <div style={{ marginBottom:20 }}>
            <div style={{ background:T.surface, borderRadius:R.r16, minHeight:66, padding:14, marginBottom:14, display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-start', border:`2px solid ${answered?(correct?T.green:T.red):T.outline}`, transition:'border-color 0.2s' }}>
              {tapBuilt.length===0 && <span style={{ ...type.bodySm, color:T.textSecondary, fontStyle:'italic' }}>Tap words to build the sentence…</span>}
              {tapBuilt.map((w,i) => <button key={i} onClick={()=>tapWord(w,false)} style={{ background:T.primarySub, border:`1px solid ${T.primary}44`, borderRadius:R.r8, padding:'8px 14px', fontFamily:"'Noto Sans JP', sans-serif", fontSize:17, color:T.primary, cursor:answered?'default':'pointer' }}>{w}</button>)}
            </div>
            {!answered && <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
              {tapBank.map((w,i) => <button key={i} onClick={()=>tapWord(w,true)} style={{ background:T.surface2, border:`1px solid ${T.outline}`, borderRadius:R.r8, padding:'8px 14px', fontFamily:"'Noto Sans JP', sans-serif", fontSize:17, color:T.textPrimary, cursor:'pointer' }}>{w}</button>)}
            </div>}
          </div>
        )}

        {!isTap && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(challenge.options??[]).map((opt,i) => {
              const isRight  = opt===challenge.answer
              const isChosen = opt===selected
              let border=T.outline, bg=T.surface, color=T.textPrimary
              if (answered) {
                if (isRight)       { border=T.green; bg=T.greenDim; color=T.green }
                else if (isChosen) { border=T.red;   bg=T.redDim;   color=T.red   }
              }
              return (
                <button key={i} onClick={()=>!answered&&submit(opt)} style={{ padding:'14px 16px', borderRadius:R.r12, border:`2px solid ${border}`, background:bg, color, cursor:answered?'default':'pointer', textAlign:'left', width:'100%', fontFamily:isJpOpts?"'Noto Sans JP', sans-serif":'inherit', fontSize:isJpOpts?20:15, lineHeight:1.5, transition:'border-color 0.18s, background 0.18s' }}>
                  {opt}
                  {isJpOpts && challenge.romaji?.[i] && <div style={{ ...type.labelSm, color:answered?(isRight?T.green:isChosen?T.red:T.textSecondary):T.textSecondary, marginTop:3, fontFamily:'inherit' }}>{challenge.romaji[i]}</div>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ padding:'12px 20px 32px', background:T.bg }}>
        {answered && (
          <div style={{ padding:'14px 18px', borderRadius:R.r12, marginBottom:14, background:correct?T.greenDim:T.redDim, border:`1px solid ${correct?T.green+'55':T.red+'55'}`, display:'flex', gap:14, alignItems:'flex-start' }}>
            <div style={{ fontSize:22 }}>{correct?'✅':'❌'}</div>
            <div>
              <div style={{ ...type.titleSm, fontWeight:700, color:correct?T.green:T.red }}>{correct?'Correct!':'Not quite'}</div>
              {!correct && <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:15, color:T.textSecondary, marginTop:4 }}>{Array.isArray(challenge.answer)?challenge.answer.join(' '):challenge.answer}</div>}
            </div>
          </div>
        )}
        {!answered && isTap && <button onClick={()=>tapBuilt.length>0&&submit()} disabled={tapBuilt.length===0} style={{ width:'100%', padding:15, borderRadius:R.r12, border:'none', ...type.titleSm, fontWeight:700, cursor:tapBuilt.length>0?'pointer':'default', background:tapBuilt.length>0?T.primary:T.surface3, color:tapBuilt.length>0?T.onPrimary:T.textSecondary }}>Check</button>}
        {answered && <button onClick={advance} style={{ width:'100%', padding:15, borderRadius:R.r12, border:'none', ...type.titleSm, fontWeight:700, cursor:'pointer', background:correct?T.green:T.primary, color:'#0d1f14' }}>Continue →</button>}
      </div>
    </div>
  )
}

// ── Results ───────────────────────────────────────────────────────────────────
function ResultScreen({ T, result, onContinue }) {
  const pct = Math.round((result.score/result.total)*100)
  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'48px 24px' }}>
      <div style={{ fontSize:64, marginBottom:16 }}>{pct>=80?'🎉':pct>=60?'👍':'💪'}</div>
      <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:26, color:T.textPrimary, marginBottom:4 }}>{pct>=80?'すごい！':pct>=60?'いいですね！':'がんばれ！'}</div>
      <div style={{ ...type.bodySm, color:T.textSecondary, marginBottom:40 }}>{pct>=80?'Excellent!':pct>=60?'Good work!':'Keep practicing!'}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, width:'100%', maxWidth:400, marginBottom:32 }}>
        {[{label:'XP Earned',value:`+${result.xpEarned}`,color:T.primary},{label:'Accuracy',value:`${pct}%`,color:pct>=70?T.green:T.red},{label:'Mistakes',value:result.errors,color:result.errors===0?T.green:T.textSecondary}].map((s,i) => (
          <div key={i} style={{ background:T.surface, borderRadius:R.r16, padding:'18px 12px', textAlign:'center', border:`1px solid ${T.outline}` }}>
            <div style={{ ...type.headlineLg, color:s.color }}>{s.value}</div>
            <div style={{ ...type.labelSm, color:T.textSecondary, marginTop:6 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <button onClick={onContinue} style={{ width:'100%', maxWidth:400, padding:15, borderRadius:R.r12, border:'none', background:T.primary, color:T.onPrimary, ...type.titleSm, fontWeight:700, cursor:'pointer' }}>Back to lessons →</button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Empty({ T, jp: jpText, en }) {
  return (
    <div style={{ textAlign:'center', padding:'60px 20px' }}>
      <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:18, color:T.textSecondary, marginBottom:8 }}>{jpText}</div>
      <div style={{ ...type.bodySm, color:T.textSecondary }}>{en}</div>
    </div>
  )
}

function Stat({ T, label, value, color }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ ...type.titleSm, color, fontWeight:700 }}>{value}</div>
      <div style={{ ...type.labelSm, color:T.textSecondary }}>{label}</div>
    </div>
  )
}

const ghostBtn = T => ({ flex:1, padding:'11px 0', borderRadius:R.r10, border:`1px solid ${T.outline}`, background:'none', color:T.textSecondary, cursor:'pointer', ...type.bodySm })
