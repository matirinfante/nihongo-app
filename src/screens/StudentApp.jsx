import { useState, useEffect, useCallback } from 'react'
import {
  collection, doc, onSnapshot, getDoc,
  updateDoc, arrayUnion, increment, serverTimestamp,
  query, orderBy,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../App.jsx'
import { T, type } from '../theme.js'

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

// ─── Top-level tabs ────────────────────────────────────────────────────────────
const TABS = [
  { id: 'lessons',  label: 'Lessons',   icon: '学' },
  { id: 'vocab',    label: 'Words',     icon: '語' },
  { id: 'moments',  label: 'Culture',   icon: '🎌' },
]

export default function StudentApp() {
  const { user, profile, signOut } = useAuth()
  const [tab,      setTab]      = useState('lessons')
  const [lessons,  setLessons]  = useState([])
  const [vocab,    setVocab]    = useState([])
  const [moments,  setMoments]  = useState([])
  const [progress, setProgress] = useState({ xp: 0, completedLessons: [], streak: 0 })
  const [active,   setActive]   = useState(null)   // lesson being played
  const [screen,   setScreen]   = useState('home') // 'home'|'lesson'|'results'
  const [result,   setResult]   = useState(null)

  useEffect(() => {
    const unsubL = onSnapshot(query(collection(db, 'lessons'), orderBy('order')), s =>
      setLessons(s.docs.map(d => ({ id: d.id, ...d.data() }))))
    const unsubV = onSnapshot(collection(db, 'vocabulary'), s =>
      setVocab(s.docs.map(d => ({ id: d.id, ...d.data() }))))
    const unsubM = onSnapshot(collection(db, 'moments'), s =>
      setMoments(s.docs.map(d => ({ id: d.id, ...d.data() }))))
    if (user) {
      const unsubP = onSnapshot(doc(db, 'studentProgress', user.uid), s => {
        if (s.exists()) setProgress(s.data())
      })
      return () => { unsubL(); unsubV(); unsubM(); unsubP() }
    }
    return () => { unsubL(); unsubV(); unsubM() }
  }, [user])

  const finishLesson = useCallback(async ({ lessonId, xpEarned }) => {
    if (!user) return
    await updateDoc(doc(db, 'studentProgress', user.uid), {
      xp: increment(xpEarned),
      completedLessons: arrayUnion(lessonId),
      lastActive: serverTimestamp(),
    })
  }, [user])

  if (screen === 'lesson' && active)
    return <LessonPlayer
      lesson={active} progress={progress}
      onFinish={res => { finishLesson(res); setResult(res); setScreen('results') }}
      onExit={() => setScreen('home')}
    />
  if (screen === 'results' && result)
    return <ResultScreen result={result} onContinue={() => { setScreen('home'); setResult(null) }} />

  const xp = progress.xp ?? 0
  const level = Math.floor(xp / 100) + 1
  const xpInLevel = xp % 100

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      {/* Header */}
      <header style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...type.jpMd, color: T.textPrimary, lineHeight: 1 }}>日本語</div>
          <div style={{ ...type.labelSm, color: T.textSecondary, marginTop: 3 }}>
            {profile?.displayName}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...type.titleLg, color: '#FF8F40', fontWeight: 700 }}>🔥 {progress.streak ?? 0}</div>
            <div style={{ ...type.labelSm, color: T.textSecondary }}>streak</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...type.titleLg, color: T.primary, fontWeight: 700 }}>⚡ {xp}</div>
            <div style={{ ...type.labelSm, color: T.textSecondary }}>XP</div>
          </div>
          <button onClick={signOut} style={{ background: 'none', border: 'none', color: T.textSecondary, cursor: 'pointer', fontSize: 20, padding: 4 }} title="Sign out">⎋</button>
        </div>
      </header>

      {/* Level bar */}
      <div style={{ padding: '12px 20px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
          <span style={{ ...type.label, color: T.textSecondary }}>Level {level}</span>
          <span style={{ ...type.label, color: T.textSecondary }}>{xpInLevel}/100 XP</span>
        </div>
        <div style={{ height: 5, background: T.outline, borderRadius: 99 }}>
          <div style={{ height: '100%', width: `${xpInLevel}%`, background: `linear-gradient(90deg, ${T.primary}, ${T.secondary})`, borderRadius: 99, transition: 'width 0.6s ease' }} />
        </div>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0 80px' }}>
        {tab === 'lessons' && (
          <LessonsTab lessons={lessons} progress={progress}
            onStart={lesson => { setActive(lesson); setScreen('lesson') }} />
        )}
        {tab === 'vocab'   && <VocabTab vocab={vocab} xp={xp} />}
        {tab === 'moments' && <MomentsTab moments={moments} />}
      </div>

      {/* Bottom Nav */}
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480,
        background: T.surface, borderTop: `1px solid ${T.outline}`,
        display: 'flex', paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '10px 0 12px', border: 'none',
            background: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3,
            opacity: tab === t.id ? 1 : 0.45,
          }}>
            <span style={{ fontSize: t.icon.length > 1 ? 20 : 18, fontFamily: T.jp, color: tab === t.id ? T.primary : T.textSecondary }}>{t.icon}</span>
            <span style={{ ...type.labelSm, color: tab === t.id ? T.primary : T.textSecondary }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

// ── Lessons Tab ───────────────────────────────────────────────────────────────
function LessonsTab({ lessons, progress, onStart }) {
  const units = [...new Set(lessons.map(l => l.unit))].sort()
  return (
    <div style={{ padding: '8px 20px' }}>
      {units.map(unit => {
        const unitLessons = lessons.filter(l => l.unit === unit)
        const unitName = unitLessons[0]?.unitName || `Unit ${unit}`
        return (
          <div key={unit} style={{ marginBottom: 28 }}>
            <div style={{ ...type.label, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Unit {unit} — {unitName}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {unitLessons.map(lesson => {
                const unlocked = (progress.xp ?? 0) >= (lesson.xpRequired ?? 0)
                const done = (progress.completedLessons ?? []).includes(lesson.id)
                return <LessonCard key={lesson.id} lesson={lesson} unlocked={unlocked} done={done} onStart={() => onStart(lesson)} />
              })}
            </div>
          </div>
        )
      })}
      {lessons.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ ...type.jpMd, color: T.textSecondary, marginBottom: 8 }}>授業なし</div>
          <div style={{ ...type.bodySm, color: T.textSecondary }}>No lessons yet — check back soon</div>
        </div>
      )}
    </div>
  )
}

function LessonCard({ lesson, unlocked, done, onStart }) {
  return (
    <div onClick={() => unlocked && onStart()} style={{
      background: T.surface, borderRadius: T.r16,
      border: `1.5px solid ${done ? T.green + '55' : unlocked ? T.outline : T.outline}`,
      padding: '16px 18px', cursor: unlocked ? 'pointer' : 'default',
      opacity: unlocked ? 1 : 0.45, display: 'flex', gap: 16, alignItems: 'center',
      transition: 'border-color 0.2s',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: T.r12, flexShrink: 0,
        background: done ? T.greenDim : unlocked ? T.primaryDim : T.surface2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
      }}>
        {lesson.emoji || '📖'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...type.titleSm, color: done ? T.green : T.textPrimary }}>{lesson.title}</div>
        <div style={{ ...type.labelSm, color: T.textSecondary, marginTop: 2, fontFamily: T.jp }}>{lesson.titleJp}</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {done && <div style={{ fontSize: 22 }}>✅</div>}
        {!done && unlocked && <div style={{ ...type.label, color: T.primary, fontWeight: 700 }}>+{lesson.xpReward ?? 80} XP</div>}
        {!unlocked && <div style={{ ...type.labelSm, color: T.textSecondary }}>🔒 {lesson.xpRequired} XP</div>}
      </div>
    </div>
  )
}

// ── Vocab Tab ─────────────────────────────────────────────────────────────────
function VocabTab({ vocab, xp }) {
  const packs = [...new Set(vocab.map(v => v.packLabel))].filter(Boolean)
  const [pack, setPack] = useState(0)

  const current = packs[pack]
  const words = vocab.filter(v => v.packLabel === current)
  const locked = vocab.filter(v => (v.xpRequired ?? 0) > xp && v.packLabel !== current)
  const lockedPacks = [...new Set(locked.map(v => v.packLabel))].filter(Boolean)

  return (
    <div style={{ padding: '8px 20px' }}>
      {/* Pack selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {packs.map((p, i) => (
          <button key={p} onClick={() => setPack(i)} style={{
            padding: '6px 16px', borderRadius: T.rFull, border: 'none', cursor: 'pointer',
            background: pack === i ? T.primary : T.surface2,
            color: pack === i ? T.onPrimary : T.textSecondary,
            ...type.label, fontWeight: 600, transition: 'background 0.15s',
          }}>{p}</button>
        ))}
      </div>

      {/* Words */}
      {words.map((w, i) => (
        <div key={i} style={{
          background: T.surface, borderRadius: T.r12, border: `1px solid ${T.outline}`,
          padding: '14px 16px', marginBottom: 8,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ ...type.jpSm, color: T.textPrimary }}>{w.jp}</div>
            <div style={{ ...type.labelSm, color: T.primary, marginTop: 2 }}>{w.romaji}</div>
          </div>
          <div style={{ ...type.bodySm, color: T.textSecondary, textAlign: 'right', maxWidth: 160 }}>{w.en}</div>
        </div>
      ))}

      {/* Locked packs */}
      {lockedPacks.length > 0 && (
        <>
          <div style={{ ...type.label, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '24px 0 12px' }}>Locked</div>
          {lockedPacks.map(p => {
            const minXp = Math.min(...vocab.filter(v => v.packLabel === p).map(v => v.xpRequired ?? 0))
            return (
              <div key={p} style={{ background: T.surface, borderRadius: T.r12, border: `1px solid ${T.outline}`, padding: '14px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', opacity: 0.5 }}>
                <span style={{ ...type.bodySm, color: T.textSecondary }}>{p}</span>
                <span style={{ ...type.label, color: T.textSecondary }}>🔒 {minXp} XP</span>
              </div>
            )
          })}
        </>
      )}
      {vocab.length === 0 && <Empty jp="語彙なし" en="No vocabulary added yet" />}
    </div>
  )
}

// ── Moments Tab ───────────────────────────────────────────────────────────────
function MomentsTab({ moments }) {
  const [idx, setIdx] = useState(0)
  if (moments.length === 0) return <div style={{ padding: '0 20px' }}><Empty jp="文化なし" en="No culture moments added yet" /></div>
  const m = moments[idx]
  return (
    <div style={{ padding: '8px 20px' }}>
      <div style={{ background: T.surface, borderRadius: T.r20, border: `1px solid ${T.outline}`, padding: '28px 24px', marginBottom: 16 }}>
        <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 16 }}>{m.emoji || '🎌'}</div>
        <h2 style={{ ...type.headlineSm, color: T.textPrimary, textAlign: 'center', marginBottom: 16 }}>{m.title}</h2>
        <p style={{ ...type.bodyLg, color: T.textSecondary, lineHeight: 1.8 }}>{m.fact}</p>
      </div>

      {m.vocab?.length > 0 && (
        <>
          <div style={{ ...type.label, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Words from this moment</div>
          {m.vocab.map((v, i) => (
            <div key={i} style={{ background: T.surface, borderRadius: T.r12, border: `1px solid ${T.outline}`, padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ ...type.jpSm, color: T.textPrimary }}>{v.jp}</div>
                <div style={{ ...type.labelSm, color: T.primary }}>{v.romaji}</div>
              </div>
              <div style={{ ...type.bodySm, color: T.textSecondary }}>{v.en}</div>
            </div>
          ))}
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={() => setIdx(i => (i - 1 + moments.length) % moments.length)}
          style={ghostBtnStyle}>← Prev</button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ ...type.label, color: T.textSecondary }}>{idx + 1} / {moments.length}</span>
        </div>
        <button onClick={() => setIdx(i => (i + 1) % moments.length)}
          style={ghostBtnStyle}>Next →</button>
      </div>
    </div>
  )
}

// ─── Lesson Player ─────────────────────────────────────────────────────────────
function LessonPlayer({ lesson, onFinish, onExit }) {
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
  const isTap = challenge?.type === 'tap'
  const progress = (idx / challenges.length) * 100

  useEffect(() => {
    if (challenge?.type === 'tap') {
      setTapBuilt([])
      setTapBank(shuffle(challenge.bank ?? []))
    }
  }, [idx, challenge])

  if (!challenge) {
    onFinish({ lessonId: lesson.id, xpEarned: lesson.xpReward ?? 80, errors, score, total: challenges.length })
    return null
  }

  const submit = (ans) => {
    if (answered) return
    let ok
    if (isTap) {
      ok = JSON.stringify(tapBuilt) === JSON.stringify(challenge.answer)
    } else {
      setSelected(ans); ok = ans === challenge.answer
    }
    setAnswered(true); setCorrect(ok)
    if (!ok) setErrors(e => e + 1); else setScore(s => s + 1)
  }

  const advance = () => {
    setIdx(i => i + 1); setAnswered(false); setCorrect(null); setSelected(null)
    setTapBuilt([]); setTapBank([])
  }

  const tapWord = (word, fromBank) => {
    if (answered) return
    if (fromBank) {
      setTapBuilt(b => [...b, word])
      setTapBank(a => { const i = a.indexOf(word); return [...a.slice(0, i), ...a.slice(i + 1)] })
    } else {
      setTapBank(a => [...a, word])
      setTapBuilt(b => { const i = b.lastIndexOf(word); return [...b.slice(0, i), ...b.slice(i + 1)] })
    }
  }

  const typeLabel = { 'mc-jp-en': 'Japanese → English', 'mc-en-jp': 'English → Japanese', fill: 'Fill the blank', tap: 'Build the sentence' }[challenge.type] ?? 'Challenge'
  const isJpOptions = challenge.type === 'mc-en-jp'

  return (
    <div style={{ minHeight: '100vh', background: T.bg, maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onExit} style={{ background: 'none', border: 'none', color: T.textSecondary, cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>✕</button>
        <div style={{ flex: 1, height: 6, background: T.surface2, borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg,${T.primary},${T.secondary})`, borderRadius: 99, transition: 'width 0.35s ease' }} />
        </div>
        <span style={{ ...type.label, color: T.primary, fontWeight: 700, minWidth: 48, textAlign: 'right' }}>
          ⚡ {score * 10}
        </span>
      </div>

      <div style={{ flex: 1, padding: '8px 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ ...type.label, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
          {typeLabel}
        </div>
        <p style={{ ...type.titleSm, color: T.textSecondary, marginBottom: 20, lineHeight: 1.6 }}>{challenge.prompt}</p>

        {/* Japanese word card */}
        {challenge.type === 'mc-jp-en' && (
          <div style={{ background: T.surface, borderRadius: T.r20, padding: '32px 24px', textAlign: 'center', marginBottom: 24, border: `1px solid ${T.outline}` }}>
            <div style={{ ...type.jpLg, color: T.textPrimary }}>{challenge.jp}</div>
            <div style={{ ...type.label, color: T.textSecondary, marginTop: 10 }}>{challenge.romaji}</div>
          </div>
        )}

        {/* Fill blank sentence */}
        {challenge.type === 'fill' && (
          <div style={{ background: T.surface, borderRadius: T.r20, padding: '24px', textAlign: 'center', marginBottom: 24, border: `1px solid ${T.outline}` }}>
            <div style={{ ...type.jpSm, color: T.textPrimary, lineHeight: 2.2, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4, alignItems: 'center' }}>
              {(challenge.sentence ?? []).map((part, i) =>
                part === '___'
                  ? <span key={i} style={{ display: 'inline-block', minWidth: 64, borderBottom: `2.5px solid ${answered ? (correct ? T.green : T.red) : T.primary}`, color: answered ? (correct ? T.green : T.red) : T.primary, padding: '0 8px' }}>
                    {answered ? selected : '\u3000'}
                  </span>
                  : <span key={i} style={{ fontFamily: T.jp }}>{part}</span>
              )}
            </div>
            {challenge.hint && !answered && (
              <div style={{ ...type.bodySm, color: T.textSecondary, marginTop: 12 }}>💡 {challenge.hint}</div>
            )}
          </div>
        )}

        {/* Tap — built area */}
        {isTap && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              background: T.surface, borderRadius: T.r16, minHeight: 66, padding: 14,
              marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start',
              border: `2px solid ${answered ? (correct ? T.green : T.red) : T.outline}`,
              transition: 'border-color 0.2s',
            }}>
              {tapBuilt.length === 0 && <span style={{ ...type.bodySm, color: T.textSecondary, fontStyle: 'italic' }}>Tap words to build the sentence…</span>}
              {tapBuilt.map((w, i) => (
                <button key={i} onClick={() => tapWord(w, false)} style={{
                  background: T.primarySub, border: `1px solid ${T.primary}44`, borderRadius: T.r8,
                  padding: '8px 14px', fontFamily: T.jp, fontSize: 17, color: T.primary,
                  cursor: answered ? 'default' : 'pointer',
                }}>{w}</button>
              ))}
            </div>
            {!answered && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {tapBank.map((w, i) => (
                  <button key={i} onClick={() => tapWord(w, true)} style={{
                    background: T.surface2, border: `1px solid ${T.outline}`, borderRadius: T.r8,
                    padding: '8px 14px', fontFamily: T.jp, fontSize: 17, color: T.textPrimary, cursor: 'pointer',
                  }}>{w}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Multiple choice options */}
        {!isTap && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(challenge.options ?? []).map((opt, i) => {
              const isRight   = opt === challenge.answer
              const isChosen  = opt === selected
              let border = T.outline, bg = T.surface, color = T.textPrimary
              if (answered) {
                if (isRight)       { border = T.green; bg = T.greenDim; color = T.green }
                else if (isChosen) { border = T.red;   bg = T.redDim;   color = T.red   }
              }
              return (
                <button key={i} onClick={() => !answered && submit(opt)} style={{
                  padding: isJpOptions ? '14px 16px' : '14px 16px',
                  borderRadius: T.r12, border: `2px solid ${border}`,
                  background: bg, color, cursor: answered ? 'default' : 'pointer',
                  textAlign: 'left', width: '100%',
                  fontFamily: isJpOptions ? T.jp : T.sans,
                  fontSize: isJpOptions ? 20 : 15,
                  lineHeight: 1.5, transition: 'border-color 0.18s, background 0.18s',
                }}>
                  {opt}
                  {isJpOptions && challenge.romaji?.[i] && (
                    <div style={{ ...type.labelSm, color: answered ? (isRight ? T.green : isChosen ? T.red : T.textSecondary) : T.textSecondary, marginTop: 3, fontFamily: T.sans }}>
                      {challenge.romaji[i]}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Bottom action area */}
      <div style={{ padding: '12px 20px 32px' }}>
        {answered && (
          <div style={{
            padding: '14px 18px', borderRadius: T.r12, marginBottom: 14,
            background: correct ? T.greenDim : T.redDim,
            border: `1px solid ${correct ? T.green + '55' : T.red + '55'}`,
            display: 'flex', gap: 14, alignItems: 'flex-start',
          }}>
            <div style={{ fontSize: 22 }}>{correct ? '✅' : '❌'}</div>
            <div>
              <div style={{ ...type.titleSm, fontWeight: 700, color: correct ? T.green : T.red }}>
                {correct ? 'Correct!' : 'Not quite'}
              </div>
              {!correct && (
                <div style={{ ...type.jpSm, color: T.textSecondary, marginTop: 4 }}>
                  {Array.isArray(challenge.answer) ? challenge.answer.join(' ') : challenge.answer}
                </div>
              )}
            </div>
          </div>
        )}
        {!answered && isTap && (
          <button onClick={() => tapBuilt.length > 0 && submit()} disabled={tapBuilt.length === 0}
            style={{ width: '100%', padding: 15, borderRadius: T.r12, border: 'none', ...type.titleSm, fontWeight: 700, cursor: tapBuilt.length > 0 ? 'pointer' : 'default', background: tapBuilt.length > 0 ? T.primary : T.surface3, color: tapBuilt.length > 0 ? T.onPrimary : T.textSecondary }}>
            Check
          </button>
        )}
        {answered && (
          <button onClick={advance}
            style={{ width: '100%', padding: 15, borderRadius: T.r12, border: 'none', ...type.titleSm, fontWeight: 700, cursor: 'pointer', background: correct ? T.green : T.primary, color: '#0d1f14' }}>
            Continue →
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Result Screen ─────────────────────────────────────────────────────────────
function ResultScreen({ result, onContinue }) {
  const pct = Math.round((result.score / result.total) * 100)
  return (
    <div style={{ minHeight: '100vh', background: T.bg, maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
      <div style={{ fontSize: 60, marginBottom: 16 }}>{pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪'}</div>
      <div style={{ ...type.jpMd, color: T.textPrimary, marginBottom: 4 }}>
        {pct >= 80 ? 'すごい！' : pct >= 60 ? 'いいですね！' : 'がんばれ！'}
      </div>
      <div style={{ ...type.bodySm, color: T.textSecondary, marginBottom: 40 }}>
        {pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good work!' : 'Keep practicing!'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, width: '100%', marginBottom: 32 }}>
        {[
          { label: 'XP Earned', value: `+${result.xpEarned}`, color: T.primary },
          { label: 'Accuracy',  value: `${pct}%`,             color: pct >= 70 ? T.green : T.red },
          { label: 'Mistakes',  value: result.errors,         color: result.errors === 0 ? T.green : T.textSecondary },
        ].map((s, i) => (
          <div key={i} style={{ background: T.surface, borderRadius: T.r16, padding: '18px 12px', textAlign: 'center', border: `1px solid ${T.outline}` }}>
            <div style={{ ...type.headlineLg, color: s.color }}>{s.value}</div>
            <div style={{ ...type.labelSm, color: T.textSecondary, marginTop: 6 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <button onClick={onContinue} style={{ width: '100%', padding: 15, borderRadius: T.r12, border: 'none', background: T.primary, color: T.onPrimary, ...type.titleSm, fontWeight: 700, cursor: 'pointer' }}>
        Back to lessons →
      </button>
    </div>
  )
}

// ─── Shared ────────────────────────────────────────────────────────────────────
function Empty({ jp, en }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ ...type.jpSm, color: T.textSecondary, marginBottom: 8 }}>{jp}</div>
      <div style={{ ...type.bodySm, color: T.textSecondary }}>{en}</div>
    </div>
  )
}
const ghostBtnStyle = {
  flex: 1, padding: '11px 0', borderRadius: T.r10, border: `1px solid ${T.outline}`,
  background: 'none', color: T.textSecondary, cursor: 'pointer', ...type.bodySm,
}
