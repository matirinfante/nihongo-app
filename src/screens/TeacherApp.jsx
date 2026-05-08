import { useState, useEffect } from 'react'
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy, getDoc,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { useAuth } from '../App.jsx'
import { T, type } from '../theme.js'

// ─── Teacher App Shell ─────────────────────────────────────────────────────────
const TABS = [
  { id: 'lessons',  label: 'Lessons',  icon: '📖' },
  { id: 'vocab',    label: 'Vocab',    icon: '語' },
  { id: 'moments',  label: 'Culture',  icon: '🎌' },
  { id: 'students', label: 'Students', icon: '👥' },
]

export default function TeacherApp() {
  const { profile, signOut } = useAuth()
  const [tab, setTab] = useState('lessons')

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{
        background: T.surface, borderBottom: `1px solid ${T.outline}`,
        padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 60, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ ...type.jpSm, color: T.primary }}>日本語</span>
          <span style={{ ...type.label, color: T.textSecondary, background: T.primaryDim, padding: '3px 10px', borderRadius: T.rFull, color: T.primary }}>Teacher</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ ...type.bodySm, color: T.textSecondary }}>{profile?.displayName}</span>
          <button onClick={signOut} style={iconBtnStyle} title="Sign out">⎋</button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Side nav */}
        <nav style={{ width: 200, background: T.surface, borderRight: `1px solid ${T.outline}`, padding: '16px 12px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              width: '100%', padding: '10px 14px', borderRadius: T.r10, border: 'none',
              background: tab === t.id ? T.primaryDim : 'none',
              color: tab === t.id ? T.primary : T.textSecondary,
              cursor: 'pointer', textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center',
              ...type.bodySm, fontWeight: tab === t.id ? 600 : 400, transition: 'all 0.15s',
            }}>
              <span style={{ fontFamily: t.icon.length > 2 ? T.jp : 'inherit' }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
          {tab === 'lessons'  && <LessonsPanel />}
          {tab === 'vocab'    && <VocabPanel />}
          {tab === 'moments'  && <MomentsPanel />}
          {tab === 'students' && <StudentsPanel />}
        </main>
      </div>
    </div>
  )
}

// ─── Lessons Panel ─────────────────────────────────────────────────────────────
function LessonsPanel() {
  const [lessons,   setLessons]   = useState([])
  const [modal,     setModal]     = useState(null) // null | 'new' | lesson object
  const [editLesson, setEditLesson] = useState(null)

  useEffect(() => onSnapshot(query(collection(db, 'lessons'), orderBy('order')), s =>
    setLessons(s.docs.map(d => ({ id: d.id, ...d.data() })))), [])

  const del = async (id) => {
    if (!confirm('Delete this lesson?')) return
    await deleteDoc(doc(db, 'lessons', id))
  }

  return (
    <div>
      <PanelHeader title="Lessons" sub={`${lessons.length} lessons published`}>
        <Btn onClick={() => setModal('new')}>+ New Lesson</Btn>
      </PanelHeader>

      <div style={{ display: 'grid', gap: 10 }}>
        {lessons.map(l => (
          <div key={l.id} style={{ ...cardStyle, display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>{l.emoji || '📖'}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...type.titleSm, color: T.textPrimary }}>{l.title}</div>
              <div style={{ ...type.labelSm, color: T.textSecondary, marginTop: 2, fontFamily: T.jp }}>{l.titleJp} · Unit {l.unit} · {l.challenges?.length ?? 0} challenges · +{l.xpReward ?? 80} XP</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setEditLesson(l)} style={ghostSmBtn}>Edit</button>
              <button onClick={() => del(l.id)} style={{ ...ghostSmBtn, color: T.red }}>Delete</button>
            </div>
          </div>
        ))}
        {lessons.length === 0 && <Empty en="No lessons yet. Create your first lesson!" />}
      </div>

      {modal === 'new' && <LessonModal onClose={() => setModal(null)} />}
      {editLesson && <LessonModal lesson={editLesson} onClose={() => setEditLesson(null)} />}
    </div>
  )
}

function LessonModal({ lesson, onClose }) {
  const editing = !!lesson
  const [title,       setTitle]       = useState(lesson?.title       ?? '')
  const [titleJp,     setTitleJp]     = useState(lesson?.titleJp     ?? '')
  const [emoji,       setEmoji]       = useState(lesson?.emoji       ?? '')
  const [unit,        setUnit]        = useState(lesson?.unit        ?? 1)
  const [unitName,    setUnitName]    = useState(lesson?.unitName    ?? '')
  const [order,       setOrder]       = useState(lesson?.order       ?? 99)
  const [xpRequired,  setXpRequired]  = useState(lesson?.xpRequired  ?? 0)
  const [xpReward,    setXpReward]    = useState(lesson?.xpReward    ?? 80)
  const [challenges,  setChallenges]  = useState(lesson?.challenges  ?? [])
  const [saving,      setSaving]      = useState(false)
  const [addingCh,    setAddingCh]    = useState(false)

  const save = async () => {
    if (!title) return
    setSaving(true)
    const data = { title, titleJp, emoji, unit: Number(unit), unitName, order: Number(order), xpRequired: Number(xpRequired), xpReward: Number(xpReward), challenges, updatedAt: serverTimestamp() }
    if (editing) {
      await updateDoc(doc(db, 'lessons', lesson.id), data)
    } else {
      await addDoc(collection(db, 'lessons'), { ...data, createdAt: serverTimestamp() })
    }
    setSaving(false); onClose()
  }

  const removeChallenge = (idx) => setChallenges(c => c.filter((_, i) => i !== idx))

  return (
    <Modal title={editing ? `Edit: ${lesson.title}` : 'New Lesson'} onClose={onClose} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <ModalField label="Title (English)" value={title} onChange={setTitle} placeholder="At the Station" />
        <ModalField label="Title (Japanese)" value={titleJp} onChange={setTitleJp} placeholder="えきで" jp />
        <ModalField label="Emoji" value={emoji} onChange={setEmoji} placeholder="🚃" />
        <ModalField label="Unit number" value={unit} onChange={setUnit} type="number" placeholder="1" />
        <ModalField label="Unit name" value={unitName} onChange={setUnitName} placeholder="Getting Around" />
        <ModalField label="Order (within unit)" value={order} onChange={setOrder} type="number" placeholder="1" />
        <ModalField label="XP required to unlock" value={xpRequired} onChange={setXpRequired} type="number" placeholder="0" />
        <ModalField label="XP reward on completion" value={xpReward} onChange={setXpReward} type="number" placeholder="80" />
      </div>

      <div style={{ borderTop: `1px solid ${T.outline}`, paddingTop: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ ...type.titleSm, color: T.textPrimary }}>Challenges ({challenges.length})</span>
          <button onClick={() => setAddingCh(true)} style={ghostSmBtn}>+ Add challenge</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {challenges.map((ch, i) => (
            <div key={i} style={{ background: T.surface2, borderRadius: T.r10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ ...type.label, color: T.primary, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{ch.type}</span>
                <span style={{ ...type.bodySm, color: T.textSecondary, marginLeft: 10 }}>{ch.prompt?.slice(0, 60)}</span>
              </div>
              <button onClick={() => removeChallenge(i)} style={{ ...iconBtnStyle, color: T.red }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={ghostSmBtn}>Cancel</button>
        <Btn onClick={save} disabled={saving || !title}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Lesson'}</Btn>
      </div>

      {addingCh && <ChallengeModal onClose={() => setAddingCh(false)} onAdd={ch => { setChallenges(c => [...c, ch]); setAddingCh(false) }} />}
    </Modal>
  )
}

function ChallengeModal({ onClose, onAdd }) {
  const TYPES = [
    { id: 'mc-jp-en',  label: 'MC: Japanese → English' },
    { id: 'mc-en-jp',  label: 'MC: English → Japanese' },
    { id: 'fill',      label: 'Fill the blank' },
    { id: 'tap',       label: 'Build the sentence' },
  ]
  const [t, setT] = useState('mc-jp-en')
  // Shared
  const [prompt,    setPrompt]    = useState('')
  const [opt0,setOpt0] = useState(''); const [opt1,setOpt1] = useState(''); const [opt2,setOpt2] = useState(''); const [opt3,setOpt3] = useState('')
  const [r0,setR0] = useState(''); const [r1,setR1] = useState(''); const [r2,setR2] = useState(''); const [r3,setR3] = useState('')
  const [correctIdx, setCorrectIdx] = useState(0)
  // mc-jp-en specific
  const [jp,     setJp]     = useState('')
  const [romaji, setRomaji] = useState('')
  // fill
  const [sentBefore, setSentBefore] = useState('')
  const [sentAfter,  setSentAfter]  = useState('')
  const [hint,       setHint]       = useState('')
  // tap
  const [answer,  setAnswer]  = useState('')   // comma-separated words in order
  const [bank,    setBank]    = useState('')   // comma-separated all bank words

  const opts = [opt0,opt1,opt2,opt3]
  const romajis = [r0,r1,r2,r3]
  const setOpts = [setOpt0,setOpt1,setOpt2,setOpt3]
  const setRoms = [setR0,setR1,setR2,setR3]

  const build = () => {
    const base = { type: t, prompt }
    if (t === 'mc-jp-en') return { ...base, jp, romaji, options: opts, answer: opts[correctIdx] }
    if (t === 'mc-en-jp') return { ...base, options: opts, romaji: romajis, answer: opts[correctIdx] }
    if (t === 'fill')     return { ...base, sentence: [sentBefore, '___', sentAfter], options: opts, answer: opts[correctIdx], hint }
    if (t === 'tap')      return { ...base, answer: answer.split(',').map(s=>s.trim()), bank: bank.split(',').map(s=>s.trim()) }
  }

  const submit = () => {
    const ch = build()
    if (!ch.prompt) return alert('Please fill in the prompt.')
    onAdd(ch)
  }

  return (
    <Modal title="Add Challenge" onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ ...type.label, color: T.textSecondary, marginBottom: 8 }}>Challenge type</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TYPES.map(tp => (
            <button key={tp.id} onClick={() => setT(tp.id)} style={{
              padding: '6px 14px', borderRadius: T.rFull, border: 'none', cursor: 'pointer',
              background: t === tp.id ? T.primary : T.surface3,
              color: t === tp.id ? T.onPrimary : T.textSecondary,
              ...type.label,
            }}>{tp.label}</button>
          ))}
        </div>
      </div>

      <ModalField label="Prompt (instruction shown to student)" value={prompt} onChange={setPrompt} placeholder="What does this word mean?" />

      {t === 'mc-jp-en' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <ModalField label="Japanese" value={jp} onChange={setJp} placeholder="たべます" jp />
          <ModalField label="Romaji" value={romaji} onChange={setRomaji} placeholder="tabemasu" />
        </div>
      )}

      {t === 'fill' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          <ModalField label="Sentence — before blank" value={sentBefore} onChange={setSentBefore} placeholder="わたし" jp />
          <ModalField label="Sentence — after blank" value={sentAfter} onChange={setSentAfter} placeholder="がくせいです。" jp />
          <ModalField label="Hint (optional)" value={hint} onChange={setHint} placeholder="Topic marker" />
        </div>
      )}

      {t === 'tap' && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ModalField label="Correct answer (comma-separated words in order)" value={answer} onChange={setAnswer} placeholder="わたしは,がくせいです。" jp />
          <ModalField label="Word bank (comma-separated, include distractors)" value={bank} onChange={setBank} placeholder="わたしは,がくせいです。,せんせいです。,あなたは" jp />
        </div>
      )}

      {t !== 'tap' && (
        <div style={{ marginTop: 16 }}>
          <div style={{ ...type.label, color: T.textSecondary, marginBottom: 10 }}>
            Options — mark the correct one
          </div>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
              <button onClick={() => setCorrectIdx(i)} style={{
                width: 28, height: 28, borderRadius: '50%', border: `2px solid ${correctIdx === i ? T.green : T.outline}`,
                background: correctIdx === i ? T.greenDim : 'none', cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: correctIdx === i ? T.green : T.textSecondary, fontSize: 13,
              }}>{correctIdx === i ? '✓' : i + 1}</button>
              <input value={opts[i]} onChange={e => setOpts[i](e.target.value)}
                placeholder={`Option ${i + 1}`}
                style={{ flex: 1, ...inputStyle, fontFamily: (t === 'mc-en-jp') ? T.jp : T.sans, fontSize: (t === 'mc-en-jp') ? 17 : 14 }} />
              {t === 'mc-en-jp' && (
                <input value={romajis[i]} onChange={e => setRoms[i](e.target.value)}
                  placeholder="romaji" style={{ width: 120, ...inputStyle }} />
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={onClose} style={ghostSmBtn}>Cancel</button>
        <Btn onClick={submit}>Add Challenge</Btn>
      </div>
    </Modal>
  )
}

// ─── Vocab Panel ───────────────────────────────────────────────────────────────
function VocabPanel() {
  const [words,  setWords]  = useState([])
  const [modal,  setModal]  = useState(false)
  const [jp,     setJp]     = useState('')
  const [romaji, setRomaji] = useState('')
  const [en,     setEn]     = useState('')
  const [packLabel, setPackLabel] = useState('')
  const [xpRequired, setXpRequired] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => onSnapshot(collection(db, 'vocabulary'), s =>
    setWords(s.docs.map(d => ({ id: d.id, ...d.data() })))), [])

  const save = async () => {
    if (!jp || !en) return
    setSaving(true)
    await addDoc(collection(db, 'vocabulary'), { jp, romaji, en, packLabel, xpRequired: Number(xpRequired), createdAt: serverTimestamp() })
    setJp(''); setRomaji(''); setEn(''); setSaving(false); setModal(false)
  }

  const del = async (id) => { if (!confirm('Delete word?')) return; await deleteDoc(doc(db, 'vocabulary', id)) }

  const packs = [...new Set(words.map(w => w.packLabel).filter(Boolean))]

  return (
    <div>
      <PanelHeader title="Vocabulary" sub={`${words.length} words across ${packs.length} packs`}>
        <Btn onClick={() => setModal(true)}>+ Add Word</Btn>
      </PanelHeader>

      {packs.map(p => (
        <div key={p} style={{ marginBottom: 28 }}>
          <div style={{ ...type.label, color: T.textSecondary, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            {p} ({words.filter(w => w.packLabel === p).length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {words.filter(w => w.packLabel === p).map(w => (
              <div key={w.id} style={{ ...cardStyle, display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ ...type.jpSm, color: T.textPrimary, fontSize: 20 }}>{w.jp}</div>
                  <div style={{ ...type.labelSm, color: T.primary }}>{w.romaji}</div>
                  <div style={{ ...type.bodySm, color: T.textSecondary }}>{w.en}</div>
                </div>
                <button onClick={() => del(w.id)} style={{ ...iconBtnStyle, color: T.red }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {words.length === 0 && <Empty en="No vocabulary yet. Add words for your student!" />}

      {modal && (
        <Modal title="Add Vocabulary Word" onClose={() => setModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <ModalField label="Japanese" value={jp} onChange={setJp} placeholder="たべます" jp />
            <ModalField label="Romaji" value={romaji} onChange={setRomaji} placeholder="tabemasu" />
            <ModalField label="English meaning" value={en} onChange={setEn} placeholder="to eat" />
            <ModalField label="Pack label" value={packLabel} onChange={setPackLabel} placeholder="Daily Life" />
            <ModalField label="XP required to unlock" value={xpRequired} onChange={setXpRequired} type="number" placeholder="0" />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setModal(false)} style={ghostSmBtn}>Cancel</button>
            <Btn onClick={save} disabled={saving || !jp || !en}>{saving ? 'Saving…' : 'Add Word'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Moments Panel ─────────────────────────────────────────────────────────────
function MomentsPanel() {
  const [moments, setMoments] = useState([])
  const [modal,   setModal]   = useState(false)
  const [emoji,   setEmoji]   = useState('')
  const [title,   setTitle]   = useState('')
  const [fact,    setFact]    = useState('')
  const [vocabRaw,setVocabRaw]= useState('') // JSON-ish: jp|romaji|en per line
  const [saving,  setSaving]  = useState(false)

  useEffect(() => onSnapshot(collection(db, 'moments'), s =>
    setMoments(s.docs.map(d => ({ id: d.id, ...d.data() })))), [])

  const parseVocab = (raw) => raw.split('\n').filter(Boolean).map(line => {
    const [jp, romaji, en] = line.split('|').map(s => s.trim())
    return { jp, romaji, en }
  }).filter(v => v.jp && v.en)

  const save = async () => {
    if (!title || !fact) return
    setSaving(true)
    await addDoc(collection(db, 'moments'), { emoji, title, fact, vocab: parseVocab(vocabRaw), createdAt: serverTimestamp() })
    setEmoji(''); setTitle(''); setFact(''); setVocabRaw(''); setSaving(false); setModal(false)
  }

  const del = async (id) => { if (!confirm('Delete moment?')) return; await deleteDoc(doc(db, 'moments', id)) }

  return (
    <div>
      <PanelHeader title="Culture Moments" sub={`${moments.length} moments`}>
        <Btn onClick={() => setModal(true)}>+ New Moment</Btn>
      </PanelHeader>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {moments.map(m => (
          <div key={m.id} style={{ ...cardStyle, position: 'relative' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{m.emoji}</div>
            <div style={{ ...type.titleSm, color: T.textPrimary, marginBottom: 6 }}>{m.title}</div>
            <div style={{ ...type.bodySm, color: T.textSecondary, lineHeight: 1.7, marginBottom: 10 }}>{m.fact?.slice(0, 120)}…</div>
            <div style={{ ...type.labelSm, color: T.primary }}>{m.vocab?.length ?? 0} vocab words attached</div>
            <button onClick={() => del(m.id)} style={{ position: 'absolute', top: 12, right: 12, ...iconBtnStyle, color: T.red }}>✕</button>
          </div>
        ))}
        {moments.length === 0 && <Empty en="No cultural moments yet. Share Japan with your student!" />}
      </div>

      {modal && (
        <Modal title="New Culture Moment" onClose={() => setModal(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, marginBottom: 14 }}>
            <ModalField label="Emoji" value={emoji} onChange={setEmoji} placeholder="🌸" />
            <ModalField label="Title" value={title} onChange={setTitle} placeholder="Cherry Blossom Season" />
          </div>
          <ModalField label="Cultural fact / description" value={fact} onChange={setFact} placeholder="Write a few sentences about this Japanese cultural moment…" multiline />
          <div style={{ marginTop: 14 }}>
            <label style={labelStyle}>Vocabulary (one per line: japanese | romaji | english)</label>
            <textarea value={vocabRaw} onChange={e => setVocabRaw(e.target.value)}
              placeholder={'さくら | sakura | cherry blossom\nはなみ | hanami | flower viewing'}
              rows={4}
              style={{ ...inputStyle, width: '100%', marginTop: 6, resize: 'vertical', fontFamily: T.jp, fontSize: 14 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
            <button onClick={() => setModal(false)} style={ghostSmBtn}>Cancel</button>
            <Btn onClick={save} disabled={saving || !title || !fact}>{saving ? 'Saving…' : 'Create Moment'}</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── Students Panel ────────────────────────────────────────────────────────────
function StudentsPanel() {
  const [students, setStudents] = useState([])

  useEffect(() => onSnapshot(collection(db, 'studentProgress'), s =>
    setStudents(s.docs.map(d => ({ uid: d.id, ...d.data() })))), [])

  return (
    <div>
      <PanelHeader title="Students" sub={`${students.length} students enrolled`} />
      <div style={{ display: 'grid', gap: 10 }}>
        {students.map(s => {
          const xp    = s.xp ?? 0
          const level = Math.floor(xp / 100) + 1
          const done  = (s.completedLessons ?? []).length
          return (
            <div key={s.uid} style={{ ...cardStyle, display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: T.primaryDim, display: 'flex', alignItems: 'center', justifyContent: 'center', ...type.titleLg, color: T.primary, fontWeight: 700, flexShrink: 0 }}>
                {(s.displayName?.[0] || '?').toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ ...type.titleSm, color: T.textPrimary }}>{s.displayName || 'Student'}</div>
                <div style={{ ...type.labelSm, color: T.textSecondary, marginTop: 2 }}>{s.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <Stat label="Level" value={level} color={T.primary} />
                <Stat label="XP"    value={xp}    color={T.secondary} />
                <Stat label="Done"  value={done}   color={T.green} />
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...type.label, color: T.textSecondary }}>Streak</div>
                  <div style={{ ...type.titleSm, color: '#FF8F40' }}>🔥 {s.streak ?? 0}</div>
                </div>
              </div>
            </div>
          )
        })}
        {students.length === 0 && <Empty en="No students enrolled yet. Share the app link with your student!" />}
      </div>
    </div>
  )
}

// ─── Shared components ─────────────────────────────────────────────────────────
function PanelHeader({ title, sub, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
      <div>
        <h1 style={{ ...type.headlineSm, color: T.textPrimary }}>{title}</h1>
        <p style={{ ...type.bodySm, color: T.textSecondary, marginTop: 3 }}>{sub}</p>
      </div>
      {children}
    </div>
  )
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 }}>
      <div style={{ background: T.surface, borderRadius: T.r20, padding: '28px', width: '100%', maxWidth: wide ? 680 : 480, maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${T.outline}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ ...type.titleLg, color: T.textPrimary }}>{title}</h2>
          <button onClick={onClose} style={iconBtnStyle}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalField({ label, value, onChange, placeholder, type: t = 'text', jp: isJp, multiline }) {
  const [focused, setFocused] = useState(false)
  const commonStyle = { ...inputStyle, width: '100%', marginTop: 6, fontFamily: isJp ? T.jp : T.sans, fontSize: isJp ? 17 : 14 }
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4}
            style={{ ...commonStyle, border: `1.5px solid ${focused ? T.primary : T.outline}`, resize: 'vertical' }}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
        : <input type={t} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={{ ...commonStyle, border: `1.5px solid ${focused ? T.primary : T.outline}` }}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      }
    </div>
  )
}

function Btn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '9px 20px', borderRadius: T.r10, border: 'none',
      background: disabled ? T.surface3 : T.primary, color: disabled ? T.textSecondary : T.onPrimary,
      cursor: disabled ? 'default' : 'pointer', ...type.label, fontWeight: 700,
      letterSpacing: 0.3, transition: 'background 0.15s',
    }}>{children}</button>
  )
}

function Stat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ ...type.label, color: T.textSecondary }}>{label}</div>
      <div style={{ ...type.titleSm, color, fontWeight: 700 }}>{value}</div>
    </div>
  )
}

function Empty({ en }) {
  return (
    <div style={{ padding: '48px 0', textAlign: 'center' }}>
      <div style={{ ...type.bodySm, color: T.textSecondary }}>{en}</div>
    </div>
  )
}

// ─── Shared styles ─────────────────────────────────────────────────────────────
const cardStyle = { background: T.surface, borderRadius: T.r14, border: `1px solid ${T.outline}`, padding: '16px 18px' }
const ghostSmBtn = { padding: '7px 14px', borderRadius: T.r8, border: `1px solid ${T.outline}`, background: 'none', color: T.textSecondary, cursor: 'pointer', ...type.label, fontWeight: 500 }
const iconBtnStyle = { background: 'none', border: 'none', color: T.textSecondary, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4 }
const inputStyle = { padding: '10px 12px', borderRadius: T.r8, background: T.surface2, color: T.textPrimary, outline: 'none', transition: 'border-color 0.15s' }
const labelStyle = { ...type.label, color: T.textSecondary, fontWeight: 500, display: 'block' }
