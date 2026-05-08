import { useState, useEffect } from 'react'
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy, writeBatch } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase.js'
import { useAuth, useTheme } from '../App.jsx'
import { type, R } from '../theme.js'
import { SEED_LESSONS, SEED_VOCAB, SEED_MOMENTS, SEED_NUMBERS } from '../seed.js'

const TABS = [
  { id:'lessons',  label:'Lessons',  icon:'📖' },
  { id:'vocab',    label:'Vocab',    icon:'語' },
  { id:'moments',  label:'Culture',  icon:'🎌' },
  { id:'students', label:'Students', icon:'👥' },
]

const XP_PRESETS = [
  { label:'Easy',     xp:50,  hint:'50 XP — simple vocab review' },
  { label:'Moderate', xp:80,  hint:'80 XP — standard lesson' },
  { label:'Hard',     xp:120, hint:'120 XP — complex grammar' },
  { label:'Custom',   xp:null },
]

function recalcXpRequired(orderedLessons) {
  let cum = 0
  return orderedLessons.map(l => {
    const xpRequired = cum
    cum += l.xpReward ?? 80
    return { ...l, xpRequired }
  })
}

export default function TeacherApp() {
  const { profile, signOut } = useAuth()
  const { T, isDark, toggleTheme } = useTheme()
  const [tab, setTab] = useState('lessons')

  return (
    <div style={{ minHeight:'100vh', background:T.bg, display:'flex', flexDirection:'column' }}>
      <header style={{ background:T.surface, borderBottom:`1px solid ${T.outline}`, padding:'0 28px', display:'flex', alignItems:'center', justifyContent:'space-between', height:60, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:20, color:T.primary, fontWeight:700 }}>日本語</span>
          <span style={{ ...type.labelSm, color:T.primary, background:T.primaryDim, padding:'3px 10px', borderRadius:R.full }}>Teacher Dashboard</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ ...type.bodySm, color:T.textSecondary }}>{profile?.displayName}</span>
          <button onClick={toggleTheme} style={{ padding:'7px 10px', borderRadius:R.r8, border:`1px solid ${T.outline}`, background:'none', color:T.textSecondary, cursor:'pointer', fontSize:15 }}>{isDark?'☀️':'🌙'}</button>
          <button onClick={signOut} style={{ padding:'7px 16px', borderRadius:R.r8, border:`1px solid ${T.outline}`, background:T.surface2, color:T.textSecondary, cursor:'pointer', ...type.label, fontWeight:500, display:'flex', alignItems:'center', gap:6 }}>
            <span>⎋</span> Sign out
          </button>
        </div>
      </header>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <nav style={{ width:200, background:T.surface, borderRight:`1px solid ${T.outline}`, padding:'16px 12px', flexShrink:0, display:'flex', flexDirection:'column', gap:4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ width:'100%', padding:'10px 14px', borderRadius:R.r10, border:'none', background:tab===t.id?T.primaryDim:'none', color:tab===t.id?T.primary:T.textSecondary, cursor:'pointer', textAlign:'left', display:'flex', gap:10, alignItems:'center', ...type.bodySm, fontWeight:tab===t.id?600:400, transition:'all 0.15s' }}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>
        <main style={{ flex:1, overflowY:'auto', padding:'28px 32px' }}>
          {tab==='lessons'  && <LessonsPanel  T={T} />}
          {tab==='vocab'    && <VocabPanel    T={T} />}
          {tab==='moments'  && <MomentsPanel  T={T} />}
          {tab==='students' && <StudentsPanel T={T} />}
        </main>
      </div>
    </div>
  )
}

// ─── Lessons Panel ─────────────────────────────────────────────────────────────
function LessonsPanel({ T }) {
  const [lessons,    setLessons]    = useState([])
  const [showNew,    setShowNew]    = useState(false)
  const [editLesson, setEditLesson] = useState(null)
  const [seeding,    setSeeding]    = useState(false)
  const [dragIdx,    setDragIdx]    = useState(null)
  const [dropIdx,    setDropIdx]    = useState(null)

  useEffect(() => onSnapshot(query(collection(db,'lessons'),orderBy('order')), s =>
    setLessons(s.docs.map(d=>({id:d.id,...d.data()})))), [])

  const del = async (id) => { if (!confirm('Delete this lesson?')) return; await deleteDoc(doc(db,'lessons',id)) }

  const seedAll = async () => {
    if (!confirm(`This will add all ${SEED_LESSONS.length} lessons from Matiasさん.pdf. Continue?`)) return
    setSeeding(true)
    try {
      const b = writeBatch(db)
      SEED_LESSONS.forEach(l => b.set(doc(collection(db,'lessons')), { ...l, createdAt: serverTimestamp() }))
      await b.commit()
    } finally { setSeeding(false) }
  }

  const reorder = async (from, to) => {
    const arr = [...lessons]
    const [item] = arr.splice(from, 1)
    arr.splice(to, 0, item)
    const updated = recalcXpRequired(arr).map((l, i) => ({ ...l, order: i + 1 }))
    const b = writeBatch(db)
    updated.forEach(l => b.update(doc(db,'lessons',l.id), { order: l.order, xpRequired: l.xpRequired }))
    await b.commit()
  }

  return (
    <div>
      <PanelHeader T={T} title="Lessons" sub={`${lessons.length} lessons · drag to reorder`}>
        <div style={{ display:'flex', gap:8 }}>
          {lessons.length===0 && <Btn T={T} onClick={seedAll} secondary disabled={seeding}>{seeding?'Seeding…':'⚡ Seed from PDF'}</Btn>}
          <Btn T={T} onClick={() => setShowNew(true)}>+ New Lesson</Btn>
        </div>
      </PanelHeader>

      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {lessons.map((l, i) => (
          <div
            key={l.id}
            draggable
            onDragStart={e => { setDragIdx(i); e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={e => { e.preventDefault(); if (dropIdx !== i) setDropIdx(i) }}
            onDrop={e => { e.preventDefault(); const from = Number(e.dataTransfer.getData('text/plain')); setDragIdx(null); setDropIdx(null); if (from !== i) reorder(from, i) }}
            onDragEnd={() => { setDragIdx(null); setDropIdx(null) }}
            style={{ ...cardStyle(T), display:'flex', gap:14, alignItems:'center', userSelect:'none', cursor:'grab',
              opacity: dragIdx === i ? 0.35 : 1,
              border: `${dropIdx===i && dragIdx!==i ? 2 : 1}px solid ${dropIdx===i && dragIdx!==i ? T.primary : T.outline}`,
              transition:'opacity 0.15s, border-color 0.15s' }}
          >
            <span style={{ color:T.textDisabled, fontSize:20, lineHeight:1, flexShrink:0 }}>⠿</span>
            {l.coverImageUrl
              ? <img src={l.coverImageUrl} alt="" style={{ width:52, height:52, borderRadius:R.r10, objectFit:'cover', flexShrink:0 }} />
              : <span style={{ fontSize:26, flexShrink:0 }}>{l.emoji||'📖'}</span>
            }
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ ...type.titleSm, color:T.textPrimary }}>{l.title}</div>
              <div style={{ ...type.labelSm, color:T.textSecondary, marginTop:2, fontFamily:"'Noto Sans JP', sans-serif" }}>{l.titleJp} · Unit {l.unit} · {l.challenges?.length??0} challenges</div>
              <div style={{ display:'flex', gap:12, marginTop:3 }}>
                <span style={{ ...type.labelSm, color:T.primary }}>+{l.xpReward??80} XP reward</span>
                <span style={{ ...type.labelSm, color:T.textDisabled }}>🔒 {l.xpRequired??0} XP to unlock</span>
              </div>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setEditLesson(l)} style={ghostSmBtn(T)}>Edit</button>
              <button onClick={() => del(l.id)} style={{ ...ghostSmBtn(T), color:T.red }}>Delete</button>
            </div>
          </div>
        ))}
        {lessons.length===0 && <Empty T={T} en="No lessons yet. Click '+ New Lesson' or '⚡ Seed from PDF' to start." />}
      </div>

      {showNew     && <LessonModal T={T} lessons={lessons} onClose={() => setShowNew(false)} />}
      {editLesson  && <LessonModal T={T} lesson={editLesson} lessons={lessons} onClose={() => setEditLesson(null)} />}
    </div>
  )
}

function LessonModal({ T, lesson, lessons, onClose }) {
  const editing = !!lesson
  const [title,        setTitle]        = useState(lesson?.title       ?? '')
  const [titleJp,      setTitleJp]      = useState(lesson?.titleJp     ?? '')
  const [emoji,        setEmoji]        = useState(lesson?.emoji        ?? '')
  const [unit,         setUnit]         = useState(lesson?.unit         ?? 1)
  const [unitName,     setUnitName]     = useState(lesson?.unitName     ?? '')
  const [xpReward,     setXpReward]     = useState(lesson?.xpReward    ?? 80)
  const [xpPreset,     setXpPreset]     = useState(() => XP_PRESETS.find(p => p.xp === (lesson?.xpReward ?? 80))?.label ?? 'Custom')
  const [challenges,   setChallenges]   = useState(lesson?.challenges   ?? [])
  const [coverImageUrl,setCoverImageUrl]= useState(lesson?.coverImageUrl ?? '')
  const [imageFile,    setImageFile]    = useState(null)
  const [imagePreview, setImagePreview] = useState(lesson?.coverImageUrl ?? '')
  const [saving,       setSaving]       = useState(false)
  const [addingCh,     setAddingCh]     = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null)

  // XP students need to reach this lesson (read-only — determined by position)
  const xpRequired = editing
    ? (lesson.xpRequired ?? 0)
    : lessons.reduce((sum, l) => sum + (l.xpReward ?? 80), 0)

  const pickPreset = p => {
    setXpPreset(p.label)
    if (p.xp !== null) setXpReward(p.xp)
  }

  const handleImagePick = e => {
    const f = e.target.files[0]; if (!f) return
    setImageFile(f); setImagePreview(URL.createObjectURL(f))
  }

  const save = async () => {
    if (!title) return
    setSaving(true)
    try {
      let finalCover = coverImageUrl
      if (imageFile) {
        setUploadProgress('Uploading image…')
        const r = ref(storage, `lesson-covers/${Date.now()}-${imageFile.name}`)
        await uploadBytes(r, imageFile)
        finalCover = await getDownloadURL(r)
        setUploadProgress(null)
      }
      const b = writeBatch(db)
      if (editing) {
        b.update(doc(db,'lessons',lesson.id), {
          title, titleJp, emoji, unit:Number(unit), unitName,
          xpReward:Number(xpReward), challenges,
          coverImageUrl:finalCover, updatedAt:serverTimestamp()
        })
        // Recalculate xpRequired for all lessons after this one's reward changed
        const updated = lessons.map(l => l.id===lesson.id ? { ...l, xpReward:Number(xpReward) } : l)
        recalcXpRequired(updated).forEach(l => {
          const orig = lessons.find(o => o.id===l.id)
          if (orig && orig.xpRequired !== l.xpRequired)
            b.update(doc(db,'lessons',l.id), { xpRequired:l.xpRequired })
        })
      } else {
        const nextOrder = lessons.length ? Math.max(...lessons.map(l => l.order ?? 0)) + 1 : 1
        b.set(doc(collection(db,'lessons')), {
          title, titleJp, emoji, unit:Number(unit), unitName,
          order:nextOrder, xpRequired, xpReward:Number(xpReward),
          challenges, coverImageUrl:finalCover,
          createdAt:serverTimestamp(), updatedAt:serverTimestamp()
        })
      }
      await b.commit(); onClose()
    } finally { setSaving(false); setUploadProgress(null) }
  }

  return (
    <Modal T={T} title={editing?`Edit: ${lesson.title}`:'New Lesson'} onClose={onClose} wide>
      {/* Unlock XP reference */}
      <div style={{ background:T.primaryDim, borderRadius:R.r10, padding:'10px 16px', marginBottom:20, display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontSize:16 }}>🔒</span>
        <span style={{ ...type.bodySm, color:T.textPrimary }}>
          {xpRequired === 0
            ? 'First lesson — always unlocked, no XP required'
            : <><strong style={{ color:T.primary }}>{xpRequired} XP</strong> required to unlock this lesson</>
          }
        </span>
        {editing && <span style={{ ...type.labelSm, color:T.textSecondary, marginLeft:'auto' }}>position-based · set by lesson order</span>}
      </div>

      {/* Cover image */}
      <div style={{ marginBottom:20 }}>
        <label style={labelStyle(T)}>Cover image (optional)</label>
        <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginTop:8 }}>
          {imagePreview && <img src={imagePreview} alt="cover" style={{ width:100, height:64, objectFit:'cover', borderRadius:R.r8, flexShrink:0, border:`1px solid ${T.outline}` }} />}
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'9px 16px', borderRadius:R.r8, border:`1px solid ${T.outline}`, background:T.surface2, color:T.textSecondary, cursor:'pointer', ...type.label }}>
            📷 {imagePreview?'Change image':'Upload image'}
            <input type="file" accept="image/*" onChange={handleImagePick} style={{ display:'none' }} />
          </label>
          {imagePreview && <button onClick={() => { setImageFile(null); setImagePreview(''); setCoverImageUrl('') }} style={{ ...ghostSmBtn(T), color:T.red }}>Remove</button>}
        </div>
        {uploadProgress && <div style={{ ...type.label, color:T.secondary, marginTop:6 }}>{uploadProgress}</div>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        <ModalField T={T} label="Title (English)" value={title} onChange={setTitle} placeholder="At the Station" />
        <ModalField T={T} label="Title (Japanese)" value={titleJp} onChange={setTitleJp} placeholder="えきで" jp />
        <ModalField T={T} label="Emoji" value={emoji} onChange={setEmoji} placeholder="🚃" />
        <ModalField T={T} label="Unit number" value={unit} onChange={setUnit} type="number" />
        <ModalField T={T} label="Unit name" value={unitName} onChange={setUnitName} placeholder="Getting Around" />
      </div>

      {/* XP Reward */}
      <div style={{ marginBottom:20 }}>
        <label style={{ ...labelStyle(T), marginBottom:8 }}>XP Reward</label>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:6 }}>
          {XP_PRESETS.map(p => (
            <button key={p.label} onClick={() => pickPreset(p)} style={{
              padding:'7px 16px', borderRadius:R.full, cursor:'pointer',
              border:`1.5px solid ${xpPreset===p.label?T.primary:T.outline}`,
              background:xpPreset===p.label?T.primaryDim:'none',
              color:xpPreset===p.label?T.primary:T.textSecondary,
              ...type.label, fontWeight:xpPreset===p.label?700:500,
              transition:'all 0.15s',
            }}>
              {p.hint ?? p.label}
            </button>
          ))}
        </div>
        {xpPreset==='Custom' && (
          <div style={{ marginTop:12, maxWidth:200 }}>
            <ModalField T={T} label="Custom XP amount" value={xpReward} onChange={v => setXpReward(Number(v)||0)} type="number" />
          </div>
        )}
        {editing && (
          <div style={{ ...type.labelSm, color:T.textSecondary, marginTop:8 }}>
            Changing the reward will recalculate unlock XP for all lessons that come after this one.
          </div>
        )}
      </div>

      <div style={{ borderTop:`1px solid ${T.outline}`, paddingTop:20, marginBottom:16 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <span style={{ ...type.titleSm, color:T.textPrimary }}>Challenges ({challenges.length})</span>
          <button onClick={() => setAddingCh(true)} style={ghostSmBtn(T)}>+ Add challenge</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {challenges.map((ch,i) => (
            <div key={i} style={{ background:T.surface2, borderRadius:R.r10, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <span style={{ ...type.label, color:T.primary, textTransform:'uppercase', letterSpacing:'0.08em' }}>{ch.type}</span>
                <span style={{ ...type.bodySm, color:T.textSecondary, marginLeft:10 }}>{ch.prompt?.slice(0,60)}</span>
              </div>
              <button onClick={() => setChallenges(c=>c.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', color:T.red, cursor:'pointer', fontSize:16, padding:4 }}>✕</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onClose} style={ghostSmBtn(T)}>Cancel</button>
        <Btn T={T} onClick={save} disabled={saving||!title}>{saving?(uploadProgress||'Saving…'):editing?'Save Changes':'Create Lesson'}</Btn>
      </div>

      {addingCh && <ChallengeModal T={T} onClose={() => setAddingCh(false)} onAdd={ch => { setChallenges(c=>[...c,ch]); setAddingCh(false) }} />}
    </Modal>
  )
}

function ChallengeModal({ T, onClose, onAdd }) {
  const TYPES = [{ id:'mc-jp-en', label:'MC: JP → EN' }, { id:'mc-en-jp', label:'MC: EN → JP' }, { id:'fill', label:'Fill blank' }, { id:'tap', label:'Build sentence' }]
  const [t, setT] = useState('mc-jp-en')
  const [prompt,setPrompt] = useState('')
  const [jp,setJp] = useState(''); const [romaji,setRomaji] = useState('')
  const [opts, setOpts] = useState(['','','',''])
  const [roms, setRoms] = useState(['','','',''])
  const [correctIdx, setCorrectIdx] = useState(0)
  const [sentBefore,setSentBefore]=useState(''); const [sentAfter,setSentAfter]=useState(''); const [hint,setHint]=useState('')
  const [answer,setAnswer]=useState(''); const [bank,setBank]=useState('')

  const setOpt = (i,v) => setOpts(o => o.map((x,j)=>j===i?v:x))
  const setRom = (i,v) => setRoms(r => r.map((x,j)=>j===i?v:x))

  const build = () => {
    if (t==='mc-jp-en') return { type:t, prompt, jp, romaji, options:opts, answer:opts[correctIdx] }
    if (t==='mc-en-jp') return { type:t, prompt, options:opts, romaji:roms, answer:opts[correctIdx] }
    if (t==='fill')     return { type:t, prompt, sentence:[sentBefore,'___',sentAfter], options:opts, answer:opts[correctIdx], hint }
    if (t==='tap')      return { type:t, prompt, answer:answer.split(',').map(s=>s.trim()), bank:bank.split(',').map(s=>s.trim()) }
  }

  const submit = () => {
    if (!prompt) return alert('Please add a prompt.')
    onAdd(build())
  }

  return (
    <Modal T={T} title="Add Challenge" onClose={onClose}>
      <div style={{ marginBottom:16 }}>
        <div style={{ ...type.label, color:T.textSecondary, marginBottom:8 }}>Challenge type</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {TYPES.map(tp => <button key={tp.id} onClick={()=>setT(tp.id)} style={{ padding:'6px 14px', borderRadius:R.full, border:'none', cursor:'pointer', background:t===tp.id?T.primary:T.surface3, color:t===tp.id?T.onPrimary:T.textSecondary, ...type.label }}>{tp.label}</button>)}
        </div>
      </div>
      <ModalField T={T} label="Prompt (shown to student)" value={prompt} onChange={setPrompt} placeholder="What does this mean?" />
      {t==='mc-jp-en' && <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}><ModalField T={T} label="Japanese" value={jp} onChange={setJp} placeholder="たべます" jp /><ModalField T={T} label="Romaji" value={romaji} onChange={setRomaji} placeholder="tabemasu" /></div>}
      {t==='fill'     && <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}><ModalField T={T} label="Before blank" value={sentBefore} onChange={setSentBefore} jp /><ModalField T={T} label="After blank" value={sentAfter} onChange={setSentAfter} jp /><ModalField T={T} label="Hint (optional)" value={hint} onChange={setHint} /></div>}
      {t==='tap'      && <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:12 }}><ModalField T={T} label="Answer (comma-separated, in order)" value={answer} onChange={setAnswer} placeholder="わたしは,がくせいです。" jp /><ModalField T={T} label="Word bank (comma-separated, include distractors)" value={bank} onChange={setBank} placeholder="わたしは,がくせいです。,せんせいです。" jp /></div>}
      {t!=='tap' && (
        <div style={{ marginTop:16 }}>
          <div style={{ ...type.label, color:T.textSecondary, marginBottom:10 }}>Options — select the correct one</div>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ display:'flex', gap:10, alignItems:'center', marginBottom:10 }}>
              <button onClick={() => setCorrectIdx(i)} style={{ width:28, height:28, borderRadius:'50%', border:`2px solid ${correctIdx===i?T.green:T.outline}`, background:correctIdx===i?T.greenDim:'none', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color:correctIdx===i?T.green:T.textSecondary, fontSize:13 }}>{correctIdx===i?'✓':i+1}</button>
              <input value={opts[i]} onChange={e=>setOpt(i,e.target.value)} placeholder={`Option ${i+1}`} style={{ flex:1, ...inputStyle(T), fontFamily:t==='mc-en-jp'?"'Noto Sans JP', sans-serif":'inherit', fontSize:t==='mc-en-jp'?17:14 }} />
              {t==='mc-en-jp' && <input value={roms[i]} onChange={e=>setRom(i,e.target.value)} placeholder="romaji" style={{ width:120, ...inputStyle(T) }} />}
            </div>
          ))}
        </div>
      )}
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:12 }}>
        <button onClick={onClose} style={ghostSmBtn(T)}>Cancel</button>
        <Btn T={T} onClick={submit}>Add Challenge</Btn>
      </div>
    </Modal>
  )
}

// ─── Vocab Panel ───────────────────────────────────────────────────────────────
const JLPT_COLORS  = { N5:'#4ADE80', N4:'#34D399', N3:'#FBBF24', N2:'#F97316', N1:'#EF4444' }
const TENSE_PRESETS = [
  'Dictionary (plain)', 'て-form', 'Past (た-form)', 'Negative (ない)', 'Past negative (なかった)',
  'Polite past (ました)', 'Polite negative (ません)', 'て-いる (ongoing)',
  'Potential', 'Passive', 'Causative', 'Volitional (〜よう)',
]
const NUMBER_CATEGORIES = [
  { id:'basic',           label:'Basic Numbers',      note:'Core counting' },
  { id:'counter-minutes', label:'Minutes 〜分',        note:'Irregular forms: 1,3,4,6,8,10' },
  { id:'counter-hours',   label:'Hours 〜時',          note:'よじ (4), くじ (9) are irregular' },
  { id:'calendar-days',   label:'Days of Month 〜日',  note:'1–10, 14, 20, 24 are irregular' },
  { id:'calendar-months', label:'Months 〜月',         note:'しがつ (4), くがつ (9) are irregular' },
  { id:'days-of-week',    label:'Days of Week',       note:'〜ようび pattern' },
  { id:'counter-people',  label:'People 〜人',         note:'ひとり / ふたり are irregular' },
  { id:'counter-objects', label:'Objects 〜つ',        note:'Native Japanese counting 1–10' },
]

// ─── VocabPanel: sub-tab container ────────────────────────────────────────────
function VocabPanel({ T }) {
  const [words,    setWords]    = useState([])
  const [vocabTab, setVocabTab] = useState('words')

  useEffect(() => onSnapshot(collection(db,'vocabulary'), s => setWords(s.docs.map(d=>({id:d.id,...d.data()})))), [])

  const regularWords = words.filter(w => !['verb','number'].includes(w.type))
  const verbWords    = words.filter(w => w.type === 'verb')
  const numberWords  = words.filter(w => w.type === 'number')

  const VOCAB_TABS = [
    { id:'words',   label:'Words',   count:regularWords.length },
    { id:'verbs',   label:'Verbs',   count:verbWords.length },
    { id:'numbers', label:'Numbers', count:numberWords.length },
  ]

  return (
    <div>
      <div style={{ display:'flex', borderBottom:`2px solid ${T.outline}`, marginBottom:28 }}>
        {VOCAB_TABS.map(t => (
          <button key={t.id} onClick={() => setVocabTab(t.id)} style={{
            padding:'10px 22px', border:'none', cursor:'pointer', background:'none',
            color:vocabTab===t.id ? T.primary : T.textSecondary,
            borderBottom:`2px solid ${vocabTab===t.id ? T.primary : 'transparent'}`,
            marginBottom:-2, ...type.titleSm, fontWeight:vocabTab===t.id?700:400, transition:'all 0.15s',
          }}>
            {t.label}
            <span style={{ ...type.labelSm, color:vocabTab===t.id?T.primary:T.textDisabled, marginLeft:8 }}>{t.count}</span>
          </button>
        ))}
      </div>
      {vocabTab==='words'   && <WordsSubPanel   T={T} words={regularWords} allWords={words} />}
      {vocabTab==='verbs'   && <VerbsSubPanel   T={T} words={verbWords}    allWords={words} />}
      {vocabTab==='numbers' && <NumbersSubPanel T={T} words={numberWords}  allWords={words} />}
    </div>
  )
}

// ─── Words Sub-Panel ───────────────────────────────────────────────────────────
function WordsSubPanel({ T, words, allWords }) {
  const [editWord,    setEditWord]    = useState(undefined)
  const [hoveredId,   setHoveredId]   = useState(null)
  const [collapsed,   setCollapsed]   = useState(new Set())
  const [extraPacks,  setExtraPacks]  = useState([])
  const [addingPack,  setAddingPack]  = useState(false)
  const [newPackName, setNewPackName] = useState('')
  const [seeding,     setSeeding]     = useState(false)
  const [syncing,     setSyncing]     = useState(false)

  const del = async id => { if (!confirm('Delete word?')) return; await deleteDoc(doc(db,'vocabulary',id)) }
  const duplicate = async w => { const { id, ...d } = w; await addDoc(collection(db,'vocabulary'), { ...d, createdAt:serverTimestamp() }) }

  const seedVocab = async () => {
    if (!confirm(`Seed ${SEED_VOCAB.length} vocabulary items?`)) return
    setSeeding(true)
    try {
      const b = writeBatch(db)
      SEED_VOCAB.forEach(v => b.set(doc(collection(db,'vocabulary')), { ...v, createdAt:serverTimestamp() }))
      await b.commit()
    } finally { setSeeding(false) }
  }

  const syncKanji = async () => {
    const toUpdate = allWords.filter(w => {
      const seed = SEED_VOCAB.find(s => s.jp === w.jp)
      return seed?.kanji && !w.kanji
    })
    if (!toUpdate.length) { alert('All matching words already have kanji data.'); return }
    if (!confirm(`Add kanji data to ${toUpdate.length} words from seed?`)) return
    setSyncing(true)
    try {
      const b = writeBatch(db)
      toUpdate.forEach(w => {
        const seed = SEED_VOCAB.find(s => s.jp === w.jp)
        b.update(doc(db,'vocabulary',w.id), { kanji:seed.kanji, kanjiDifficulty:seed.kanjiDifficulty })
      })
      await b.commit()
    } finally { setSyncing(false) }
  }

  const toggleCollapse = pack => setCollapsed(s => { const n=new Set(s); n.has(pack)?n.delete(pack):n.add(pack); return n })
  const wordPacks = [...new Set(words.map(w=>w.packLabel).filter(Boolean))]
  const allPacks  = [...new Set([...wordPacks, ...extraPacks])]

  const confirmNewPack = () => {
    const name = newPackName.trim()
    if (name) setExtraPacks(p => [...new Set([...p, name])])
    setNewPackName(''); setAddingPack(false)
  }

  return (
    <div>
      <PanelHeader T={T} title="Words" sub={`${words.length} words · ${allPacks.length} packs`}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>
          {allWords.length===0 && <Btn T={T} onClick={seedVocab} secondary disabled={seeding}>{seeding?'Seeding…':'⚡ Seed from PDF'}</Btn>}
          {allWords.length>0  && <Btn T={T} onClick={syncKanji} secondary disabled={syncing}>{syncing?'Syncing…':'↻ Sync kanji'}</Btn>}
          <Btn T={T} onClick={() => setAddingPack(true)} secondary>+ New Pack</Btn>
          <Btn T={T} onClick={() => setEditWord(null)}>+ Add Word</Btn>
        </div>
      </PanelHeader>

      {addingPack && (
        <div style={{ display:'flex', gap:8, marginBottom:20, alignItems:'center' }}>
          <input autoFocus value={newPackName} onChange={e=>setNewPackName(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') confirmNewPack(); if(e.key==='Escape') setAddingPack(false) }}
            placeholder="Pack name…" style={{ ...inputStyle(T), flex:1, maxWidth:260 }} />
          <Btn T={T} onClick={confirmNewPack} disabled={!newPackName.trim()}>Add Pack</Btn>
          <button onClick={() => setAddingPack(false)} style={ghostSmBtn(T)}>Cancel</button>
        </div>
      )}

      {allPacks.map(pack => {
        const packWords = words.filter(w => w.packLabel === pack)
        const isCollapsed = collapsed.has(pack)
        return (
          <div key={pack} style={{ marginBottom:20 }}>
            <button onClick={() => toggleCollapse(pack)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderRadius:R.r10, border:`1px solid ${T.outline}`, background:T.surface2, color:T.textSecondary, cursor:'pointer', marginBottom:isCollapsed?0:10, ...type.label, textTransform:'uppercase', letterSpacing:'0.1em' }}>
              <span>{pack} <span style={{ opacity:0.6 }}>· {packWords.length} words</span></span>
              <span style={{ fontSize:18, lineHeight:1, color:T.textSecondary, display:'inline-block', transition:'transform 0.2s', transform:isCollapsed?'rotate(0deg)':'rotate(90deg)' }}>▸</span>
            </button>
            {!isCollapsed && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:8 }}>
                {packWords.map(w => (
                  <VocabCard key={w.id} T={T} word={w} hovered={hoveredId===w.id}
                    onHover={() => setHoveredId(w.id)}
                    onLeave={() => setHoveredId(id => id===w.id ? null : id)}
                    onEdit={() => setEditWord(w)}
                    onDuplicate={() => duplicate(w)}
                    onDelete={() => del(w.id)}
                  />
                ))}
                {packWords.length===0 && <div style={{ ...type.bodySm, color:T.textDisabled, padding:'14px 16px', fontStyle:'italic' }}>No words yet — add a word and assign it to this pack.</div>}
              </div>
            )}
          </div>
        )
      })}
      {allPacks.length===0 && <Empty T={T} en="No words yet. Click '+ Add Word' or '⚡ Seed from PDF' to get started." />}
      {editWord !== undefined && <VocabWordModal T={T} word={editWord} existingPacks={allPacks} onClose={() => setEditWord(undefined)} />}
    </div>
  )
}

// ─── Verbs Sub-Panel ──────────────────────────────────────────────────────────
function VerbsSubPanel({ T, words, allWords }) {
  const [editVerb,  setEditVerb]  = useState(undefined)
  const [hoveredId, setHoveredId] = useState(null)
  const [seeding,   setSeeding]   = useState(false)
  const [syncing,   setSyncing]   = useState(false)

  const del = async id => { if (!confirm('Delete verb?')) return; await deleteDoc(doc(db,'vocabulary',id)) }
  const duplicate = async w => { const { id, ...d } = w; await addDoc(collection(db,'vocabulary'), { ...d, createdAt:serverTimestamp() }) }

  const seedVerbs = async () => {
    const verbSeeds = SEED_VOCAB.filter(v => v.type === 'verb')
    if (!confirm(`Seed ${verbSeeds.length} verbs from PDF?`)) return
    setSeeding(true)
    try {
      const b = writeBatch(db)
      verbSeeds.forEach(v => b.set(doc(collection(db,'vocabulary')), { ...v, createdAt:serverTimestamp() }))
      await b.commit()
    } finally { setSeeding(false) }
  }

  const syncKanji = async () => {
    const toUpdate = words.filter(w => { const s = SEED_VOCAB.find(x => x.jp===w.jp); return s?.kanji && !w.kanji })
    if (!toUpdate.length) { alert('All verbs already have kanji data.'); return }
    if (!confirm(`Add kanji data to ${toUpdate.length} verbs?`)) return
    setSyncing(true)
    try {
      const b = writeBatch(db)
      toUpdate.forEach(w => { const s = SEED_VOCAB.find(x => x.jp===w.jp); b.update(doc(db,'vocabulary',w.id), { kanji:s.kanji, kanjiDifficulty:s.kanjiDifficulty }) })
      await b.commit()
    } finally { setSyncing(false) }
  }

  const allPacks = [...new Set(allWords.filter(w=>w.type!=='number').map(w=>w.packLabel).filter(Boolean))]

  return (
    <div>
      <PanelHeader T={T} title="Verbs" sub={`${words.length} verbs · click a row to expand conjugations`}>
        <div style={{ display:'flex', gap:8 }}>
          {words.length===0 && <Btn T={T} onClick={seedVerbs} secondary disabled={seeding}>{seeding?'Seeding…':'⚡ Seed from PDF'}</Btn>}
          {words.length>0  && <Btn T={T} onClick={syncKanji} secondary disabled={syncing}>{syncing?'Syncing…':'↻ Sync kanji'}</Btn>}
          <Btn T={T} onClick={() => setEditVerb(null)}>+ Add Verb</Btn>
        </div>
      </PanelHeader>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {words.map(w => (
          <VerbRow key={w.id} T={T} word={w}
            hovered={hoveredId===w.id}
            onHover={() => setHoveredId(w.id)}
            onLeave={() => setHoveredId(id => id===w.id ? null : id)}
            onEdit={() => setEditVerb(w)}
            onDuplicate={() => duplicate(w)}
            onDelete={() => del(w.id)}
          />
        ))}
        {words.length===0 && <Empty T={T} en="No verbs yet. Click '⚡ Seed from PDF' or '+ Add Verb' to get started." />}
      </div>
      {editVerb !== undefined && <VocabWordModal T={T} word={editVerb} existingPacks={allPacks} isVerbMode onClose={() => setEditVerb(undefined)} />}
    </div>
  )
}

function VerbRow({ T, word, hovered, onHover, onLeave, onEdit, onDuplicate, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const hasTenses = (word.tenses?.length ?? 0) > 0

  return (
    <div onMouseEnter={onHover} onMouseLeave={onLeave}
      style={{ background:T.surface, borderRadius:R.r12, border:`1.5px solid ${hovered ? T.primary+'80' : T.outline}`, padding:'14px 20px', position:'relative', transition:'border-color 0.15s' }}>
      <div style={{ display:'flex', gap:20, alignItems:'center' }}>
        {/* JP + kanji column */}
        <div style={{ minWidth:170, flexShrink:0 }}>
          <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:22, color:T.textPrimary, lineHeight:1.25 }}>{word.jp}</div>
          {word.kanji && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:4 }}>
              <span style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:15, color:T.secondary }}>{word.kanji}</span>
              {word.kanjiDifficulty && (
                <span style={{ ...type.labelSm, background:JLPT_COLORS[word.kanjiDifficulty]+'22', color:JLPT_COLORS[word.kanjiDifficulty], padding:'2px 7px', borderRadius:R.r4, fontWeight:700 }}>
                  {word.kanjiDifficulty}
                </span>
              )}
            </div>
          )}
        </div>
        {/* Romaji + EN */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ ...type.label, color:T.primary, fontWeight:600 }}>{word.romaji}</div>
          <div style={{ ...type.bodyLg, color:T.textPrimary, marginTop:2 }}>{word.en}</div>
          {word.packLabel && <div style={{ ...type.labelSm, color:T.textDisabled, marginTop:2 }}>{word.packLabel}</div>}
        </div>
        {/* Conjugation toggle */}
        <div style={{ flexShrink:0 }}>
          {hasTenses
            ? <button onClick={e => { e.stopPropagation(); setExpanded(v=>!v) }} style={{ padding:'6px 14px', borderRadius:R.r8, border:`1px solid ${expanded?T.secondary:T.outline}`, background:expanded?T.secondaryDim:'none', color:T.secondary, cursor:'pointer', ...type.label, transition:'all 0.15s' }}>
                {expanded ? 'Hide forms ▴' : `${word.tenses.length} forms ▾`}
              </button>
            : <span style={{ ...type.labelSm, color:T.textDisabled }}>No conjugations yet</span>
          }
        </div>
      </div>
      {/* Expanded tenses grid */}
      {expanded && hasTenses && (
        <div style={{ marginTop:14, paddingTop:12, borderTop:`1px solid ${T.outline}`, display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))', gap:8 }}>
          {word.tenses.map((tense, i) => (
            <div key={i} style={{ background:T.surface2, borderRadius:R.r8, padding:'8px 12px' }}>
              <div style={{ ...type.labelSm, color:T.textDisabled, marginBottom:3 }}>{tense.label}</div>
              <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:17, color:T.textPrimary }}>{tense.form}</div>
              {tense.romaji && <div style={{ ...type.label, color:T.textSecondary, marginTop:2 }}>{tense.romaji}</div>}
            </div>
          ))}
        </div>
      )}
      {hovered && (
        <div style={{ position:'absolute', top:12, right:12, display:'flex', gap:3, background:T.surface, border:`1px solid ${T.outline}`, borderRadius:R.r10, padding:4, boxShadow:'0 4px 12px rgba(0,0,0,0.25)', zIndex:10 }}>
          <button onClick={e => { e.stopPropagation(); onEdit() }}      style={menuBtn(T)}>Edit</button>
          <button onClick={e => { e.stopPropagation(); onDuplicate() }} style={menuBtn(T)}>Copy</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }}    style={{ ...menuBtn(T), color:T.red }}>Delete</button>
        </div>
      )}
    </div>
  )
}

// ─── Numbers Sub-Panel ─────────────────────────────────────────────────────────
function NumbersSubPanel({ T, words, allWords }) {
  const [editEntry,  setEditEntry]  = useState(undefined)
  const [hoveredId,  setHoveredId]  = useState(null)
  const [collapsed,  setCollapsed]  = useState(new Set())
  const [seeding,    setSeeding]    = useState(false)

  const del = async id => { if (!confirm('Delete entry?')) return; await deleteDoc(doc(db,'vocabulary',id)) }
  const duplicate = async e => { const { id, ...d } = e; await addDoc(collection(db,'vocabulary'), { ...d, createdAt:serverTimestamp() }) }

  const seedNumbers = async () => {
    if (!confirm(`Seed ${SEED_NUMBERS.length} number entries?`)) return
    setSeeding(true)
    try {
      const b = writeBatch(db)
      SEED_NUMBERS.forEach(n => b.set(doc(collection(db,'vocabulary')), { ...n, createdAt:serverTimestamp() }))
      await b.commit()
    } finally { setSeeding(false) }
  }

  const toggleCollapse = id => setCollapsed(s => { const n=new Set(s); n.has(id)?n.delete(id):n.add(id); return n })

  return (
    <div>
      <PanelHeader T={T} title="Numbers & Counters" sub={`${words.length} entries · pronunciation reference`}>
        <div style={{ display:'flex', gap:8 }}>
          {words.length===0 && <Btn T={T} onClick={seedNumbers} secondary disabled={seeding}>{seeding?'Seeding…':'⚡ Seed numbers'}</Btn>}
          <Btn T={T} onClick={() => setEditEntry(null)}>+ Add Entry</Btn>
        </div>
      </PanelHeader>

      {NUMBER_CATEGORIES.map(cat => {
        const entries = words.filter(w => w.category === cat.id).sort((a,b) => (a.number??0)-(b.number??0))
        const isCollapsed = collapsed.has(cat.id)
        return (
          <div key={cat.id} style={{ marginBottom:20 }}>
            <button onClick={() => toggleCollapse(cat.id)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderRadius:R.r10, border:`1px solid ${T.outline}`, background:T.surface2, cursor:'pointer', marginBottom:isCollapsed?0:10, transition:'border-radius 0.15s' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ ...type.titleSm, color:T.textPrimary }}>{cat.label}</span>
                <span style={{ ...type.labelSm, color:T.textDisabled }}>{cat.note}</span>
                <span style={{ ...type.labelSm, color:T.textSecondary }}>· {entries.length} entries</span>
              </div>
              <span style={{ fontSize:18, lineHeight:1, color:T.textSecondary, display:'inline-block', transition:'transform 0.2s', transform:isCollapsed?'rotate(0deg)':'rotate(90deg)' }}>▸</span>
            </button>
            {!isCollapsed && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:6 }}>
                {entries.map(entry => (
                  <div key={entry.id} onMouseEnter={() => setHoveredId(entry.id)} onMouseLeave={() => setHoveredId(id => id===entry.id?null:id)}
                    style={{ background:T.surface, borderRadius:R.r10, border:`1px solid ${hoveredId===entry.id?T.outlineVar:T.outline}`, padding:'10px 12px', position:'relative', transition:'border-color 0.15s' }}>
                    {entry.number != null && <div style={{ ...type.labelSm, color:T.textDisabled, marginBottom:3 }}>{entry.number}</div>}
                    <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:19, color:T.textPrimary, lineHeight:1.3 }}>{entry.jp}</div>
                    {entry.kanji && <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:13, color:T.secondary, marginTop:2 }}>{entry.kanji}</div>}
                    <div style={{ ...type.label, color:T.primary, marginTop:3 }}>{entry.romaji}</div>
                    <div style={{ ...type.bodySm, color:T.textSecondary }}>{entry.en}</div>
                    {hoveredId===entry.id && (
                      <div style={{ position:'absolute', top:6, right:6, display:'flex', gap:2, background:T.surface, border:`1px solid ${T.outline}`, borderRadius:R.r8, padding:3, boxShadow:'0 4px 12px rgba(0,0,0,0.25)', zIndex:10 }}>
                        <button onClick={e => { e.stopPropagation(); setEditEntry(entry) }} style={menuBtn(T)}>Edit</button>
                        <button onClick={e => { e.stopPropagation(); duplicate(entry) }}   style={menuBtn(T)}>Copy</button>
                        <button onClick={e => { e.stopPropagation(); del(entry.id) }}      style={{ ...menuBtn(T), color:T.red }}>Del</button>
                      </div>
                    )}
                  </div>
                ))}
                {entries.length===0 && (
                  <div style={{ ...type.bodySm, color:T.textDisabled, padding:14, fontStyle:'italic', gridColumn:'1/-1' }}>No entries — click "+ Add Entry" and select this category.</div>
                )}
              </div>
            )}
          </div>
        )
      })}
      {words.length===0 && <Empty T={T} en="No number entries yet. Click '⚡ Seed numbers' to load all counters and reference tables." />}

      {editEntry !== undefined && <NumberModal T={T} entry={editEntry} onClose={() => setEditEntry(undefined)} />}
    </div>
  )
}

function NumberModal({ T, entry, onClose }) {
  const editing   = !!entry?.id
  const [category,  setCategory]  = useState(entry?.category ?? NUMBER_CATEGORIES[0].id)
  const [number,    setNumber]    = useState(entry?.number   ?? '')
  const [jp,        setJp]        = useState(entry?.jp       ?? '')
  const [romaji,    setRomaji]    = useState(entry?.romaji   ?? '')
  const [en,        setEn]        = useState(entry?.en       ?? '')
  const [kanji,     setKanji]     = useState(entry?.kanji    ?? '')
  const [kanjiDiff, setKanjiDiff] = useState(entry?.kanjiDifficulty ?? 'N5')
  const [saving,    setSaving]    = useState(false)

  const save = async () => {
    if (!jp || !en) return
    setSaving(true)
    const data = { type:'number', category, number:number!==''?Number(number):null, jp, romaji, en, kanji:kanji.trim()||null, kanjiDifficulty:kanji.trim()?kanjiDiff:null, updatedAt:serverTimestamp() }
    if (editing) await updateDoc(doc(db,'vocabulary',entry.id), data)
    else await addDoc(collection(db,'vocabulary'), { ...data, createdAt:serverTimestamp() })
    setSaving(false); onClose()
  }

  return (
    <Modal T={T} title={editing ? 'Edit Number Entry' : 'Add Number Entry'} onClose={onClose} wide>
      <div style={{ marginBottom:18 }}>
        <label style={labelStyle(T)}>Category</label>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginTop:8 }}>
          {NUMBER_CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCategory(c.id)} style={{ padding:'5px 12px', borderRadius:R.full, cursor:'pointer', border:`1.5px solid ${category===c.id?T.primary:T.outline}`, background:category===c.id?T.primaryDim:'none', color:category===c.id?T.primary:T.textSecondary, ...type.label, fontWeight:category===c.id?700:500 }}>{c.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'70px 1fr 1fr', gap:14, marginBottom:14 }}>
        <ModalField T={T} label="#" value={number} onChange={setNumber} type="number" placeholder="1" />
        <ModalField T={T} label="Japanese" value={jp} onChange={setJp} placeholder="いち" jp />
        <ModalField T={T} label="Romaji" value={romaji} onChange={setRomaji} placeholder="ichi" />
      </div>
      <div style={{ marginBottom:14 }}>
        <ModalField T={T} label="English" value={en} onChange={setEn} placeholder="one" />
      </div>
      <div style={{ background:T.surface2, borderRadius:R.r12, padding:'14px 16px', marginBottom:18 }}>
        <div style={{ ...type.label, color:T.textSecondary, marginBottom:10 }}>Kanji — optional</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:14, alignItems:'start' }}>
          <ModalField T={T} label="Kanji" value={kanji} onChange={setKanji} placeholder="一" jp />
          <div>
            <label style={labelStyle(T)}>JLPT</label>
            <div style={{ display:'flex', gap:6, marginTop:6 }}>
              {Object.entries(JLPT_COLORS).map(([lvl, color]) => (
                <button key={lvl} onClick={() => setKanjiDiff(lvl)} disabled={!kanji.trim()} style={{ width:34, padding:'5px 0', borderRadius:R.r8, cursor:kanji.trim()?'pointer':'default', border:`1.5px solid ${kanjiDiff===lvl&&kanji.trim()?color:T.outline}`, background:kanjiDiff===lvl&&kanji.trim()?color+'22':'none', color:kanjiDiff===lvl&&kanji.trim()?color:T.textDisabled, ...type.labelSm, fontWeight:700, transition:'all 0.15s' }}>{lvl}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onClose} style={ghostSmBtn(T)}>Cancel</button>
        <Btn T={T} onClick={save} disabled={saving||!jp||!en}>{saving?'Saving…':editing?'Save Changes':'Add Entry'}</Btn>
      </div>
    </Modal>
  )
}

function VocabCard({ T, word, hovered, onHover, onLeave, onEdit, onDuplicate, onDelete }) {
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{ ...cardStyle(T), position:'relative', display:'flex', gap:12, alignItems:'center', transition:'border-color 0.15s',
        border:`1px solid ${hovered ? T.outlineVar : T.outline}` }}
    >
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:20, color:T.textPrimary }}>{word.jp}</div>
        {word.kanji && (
          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
            <span style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:17, color:T.secondary }}>{word.kanji}</span>
            {word.kanjiDifficulty && (
              <span style={{ ...type.labelSm, background:JLPT_COLORS[word.kanjiDifficulty]+'22', color:JLPT_COLORS[word.kanjiDifficulty], padding:'1px 6px', borderRadius:R.r4, fontWeight:700 }}>
                {word.kanjiDifficulty}
              </span>
            )}
          </div>
        )}
        <div style={{ ...type.labelSm, color:T.primary, marginTop:2 }}>{word.romaji}</div>
        <div style={{ ...type.bodySm, color:T.textSecondary }}>{word.en}</div>
      </div>
      {word.imageUrl && (
        <img src={word.imageUrl} alt="" style={{ width:44, height:44, borderRadius:R.r8, objectFit:'cover', flexShrink:0, opacity: hovered ? 0.4 : 1, transition:'opacity 0.15s' }} />
      )}
      {hovered && (
        <div style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
          display:'flex', gap:3, background:T.surface, border:`1px solid ${T.outline}`,
          borderRadius:R.r10, padding:4, boxShadow:'0 4px 12px rgba(0,0,0,0.25)', zIndex:10 }}>
          <button onClick={e => { e.stopPropagation(); onEdit() }}      style={menuBtn(T)}>Edit</button>
          <button onClick={e => { e.stopPropagation(); onDuplicate() }} style={menuBtn(T)}>Copy</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }}    style={{ ...menuBtn(T), color:T.red }}>Delete</button>
        </div>
      )}
    </div>
  )
}

function VocabWordModal({ T, word, existingPacks, onClose, isVerbMode }) {
  const editing = !!word?.id
  const [jp,         setJp]         = useState(word?.jp          ?? '')
  const [romaji,     setRomaji]     = useState(word?.romaji      ?? '')
  const [en,         setEn]         = useState(word?.en          ?? '')
  const [packLabel,  setPackLabel]  = useState(word?.packLabel   ?? existingPacks[0] ?? '')
  const [xpRequired, setXpRequired] = useState(word?.xpRequired ?? 0)
  const [kanji,      setKanji]      = useState(word?.kanji       ?? '')
  const [kanjiDiff,  setKanjiDiff]  = useState(word?.kanjiDifficulty ?? 'N5')
  const [isVerb,     setIsVerb]     = useState(isVerbMode || word?.type === 'verb' || false)
  const [tenses,     setTenses]     = useState(word?.tenses ?? [])
  const [imageUrl,   setImageUrl]   = useState(word?.imageUrl    ?? '')
  const [imageFile,  setImageFile]  = useState(null)
  const [imagePreview,setImagePreview]= useState(word?.imageUrl  ?? '')
  const [saving,     setSaving]     = useState(false)
  const [uploadProgress,setUploadProgress]= useState(null)
  const [newPackInput,setNewPackInput]= useState('')
  const [addingPack, setAddingPack] = useState(false)
  const [allPacks,   setAllPacks]   = useState(existingPacks)

  const [customTenseLabel,   setCustomTenseLabel]   = useState('')
  const [addingCustomTense,  setAddingCustomTense]  = useState(false)

  const updateTense = (i, field, val) => setTenses(arr => arr.map((t,j) => j===i ? {...t,[field]:val} : t))
  const addTensePreset = label => { if (!tenses.find(t=>t.label===label)) setTenses(arr => [...arr, {label, form:'', romaji:''}]) }
  const removeTense = i => setTenses(arr => arr.filter((_,j) => j!==i))
  const confirmCustomTense = () => {
    const l = customTenseLabel.trim()
    if (l) addTensePreset(l)
    setCustomTenseLabel(''); setAddingCustomTense(false)
  }

  const confirmNewPack = () => {
    const name = newPackInput.trim()
    if (!name) return
    setAllPacks(p => [...new Set([...p, name])])
    setPackLabel(name)
    setNewPackInput(''); setAddingPack(false)
  }

  const handleImagePick = e => {
    const f = e.target.files[0]; if (!f) return
    setImageFile(f); setImagePreview(URL.createObjectURL(f))
  }

  const save = async () => {
    if (!jp || !en) return
    setSaving(true)
    try {
      let finalImageUrl = imageUrl
      if (imageFile) {
        setUploadProgress('Uploading image…')
        const r = ref(storage, `vocab-images/${Date.now()}-${imageFile.name}`)
        await uploadBytes(r, imageFile)
        finalImageUrl = await getDownloadURL(r)
        setUploadProgress(null)
      }
      const data = {
        jp, romaji, en, packLabel, xpRequired:Number(xpRequired),
        imageUrl: finalImageUrl,
        kanji: kanji.trim() || null,
        kanjiDifficulty: kanji.trim() ? kanjiDiff : null,
        type: isVerb ? 'verb' : 'word',
        tenses: isVerb ? tenses.filter(t => t.form) : [],
        updatedAt: serverTimestamp()
      }
      if (editing) await updateDoc(doc(db,'vocabulary',word.id), data)
      else await addDoc(collection(db,'vocabulary'), { ...data, createdAt:serverTimestamp() })
      onClose()
    } finally { setSaving(false); setUploadProgress(null) }
  }

  return (
    <Modal T={T} title={editing ? (isVerb?'Edit Verb':'Edit Word') : (isVerb?'Add Verb':'Add Word')} onClose={onClose} wide>
      {/* Word / Verb toggle */}
      <div style={{ display:'flex', gap:8, marginBottom:18 }}>
        <button onClick={() => setIsVerb(false)} style={{ padding:'6px 14px', borderRadius:R.full, cursor:'pointer', border:`1.5px solid ${!isVerb?T.primary:T.outline}`, background:!isVerb?T.primaryDim:'none', color:!isVerb?T.primary:T.textSecondary, ...type.label, fontWeight:!isVerb?700:500 }}>Word</button>
        <button onClick={() => setIsVerb(true)}  style={{ padding:'6px 14px', borderRadius:R.full, cursor:'pointer', border:`1.5px solid ${isVerb?T.primary:T.outline}`,  background:isVerb?T.primaryDim:'none',  color:isVerb?T.primary:T.textSecondary,  ...type.label, fontWeight:isVerb?700:500  }}>Verb</button>
      </div>

      {/* Pack selector */}
      <div style={{ marginBottom:18 }}>
        <label style={labelStyle(T)}>Pack</label>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:8 }}>
          {allPacks.map(p => (
            <button key={p} onClick={() => { setPackLabel(p); setAddingPack(false) }} style={{
              padding:'6px 14px', borderRadius:R.full, cursor:'pointer',
              border:`1.5px solid ${packLabel===p ? T.primary : T.outline}`,
              background:packLabel===p ? T.primaryDim : 'none',
              color:packLabel===p ? T.primary : T.textSecondary,
              ...type.label, fontWeight:packLabel===p?700:500, transition:'all 0.15s'
            }}>{p}</button>
          ))}
          <button onClick={() => setAddingPack(true)} style={{ padding:'6px 14px', borderRadius:R.full, cursor:'pointer', border:`1.5px dashed ${T.outline}`, background:'none', color:T.textSecondary, ...type.label }}>+ New pack</button>
        </div>
        {addingPack && (
          <div style={{ display:'flex', gap:8, marginTop:10, alignItems:'center' }}>
            <input autoFocus value={newPackInput} onChange={e=>setNewPackInput(e.target.value)}
              onKeyDown={e=>{ if(e.key==='Enter') confirmNewPack(); if(e.key==='Escape') setAddingPack(false) }}
              placeholder="Pack name…" style={{ ...inputStyle(T), flex:1, maxWidth:220 }} />
            <button onClick={confirmNewPack} disabled={!newPackInput.trim()} style={{ padding:'8px 14px', borderRadius:R.r8, border:'none', background:T.primary, color:T.onPrimary, cursor:'pointer', ...type.label }}>Add</button>
          </div>
        )}
      </div>

      {/* Core fields */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:18 }}>
        <ModalField T={T} label={isVerb ? 'ます-form (polite present)' : 'Japanese'} value={jp} onChange={setJp} placeholder={isVerb?'たべます':'たべもの'} jp />
        <ModalField T={T} label="Romaji" value={romaji} onChange={setRomaji} placeholder={isVerb?'tabemasu':'tabemono'} />
        <ModalField T={T} label="English" value={en} onChange={setEn} placeholder={isVerb?'to eat':'food'} />
        <ModalField T={T} label="XP to unlock" value={xpRequired} onChange={setXpRequired} type="number" />
      </div>

      {/* Kanji section */}
      <div style={{ background:T.surface2, borderRadius:R.r12, padding:'14px 16px', marginBottom:18 }}>
        <div style={{ ...type.label, color:T.textSecondary, marginBottom:10 }}>Kanji — optional</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:14, alignItems:'start' }}>
          <ModalField T={T} label="Kanji writing" value={kanji} onChange={setKanji} placeholder={isVerb?'食べます':'食べ物'} jp />
          <div>
            <label style={labelStyle(T)}>JLPT difficulty</label>
            <div style={{ display:'flex', gap:6, marginTop:6 }}>
              {Object.entries(JLPT_COLORS).map(([lvl, color]) => (
                <button key={lvl} onClick={() => setKanjiDiff(lvl)} disabled={!kanji.trim()} style={{
                  width:34, padding:'5px 0', borderRadius:R.r8, cursor:kanji.trim()?'pointer':'default',
                  border:`1.5px solid ${kanjiDiff===lvl && kanji.trim() ? color : T.outline}`,
                  background:kanjiDiff===lvl && kanji.trim() ? color+'22' : 'none',
                  color:kanjiDiff===lvl && kanji.trim() ? color : T.textDisabled,
                  ...type.labelSm, fontWeight:700, transition:'all 0.15s'
                }}>{lvl}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Conjugations section — verb only */}
      {isVerb && (
        <div style={{ background:T.surface2, borderRadius:R.r12, padding:'14px 16px', marginBottom:18 }}>
          <div style={{ ...type.label, color:T.textSecondary, marginBottom:10 }}>Conjugations</div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:tenses.length?12:0 }}>
            {TENSE_PRESETS.filter(t => !tenses.find(x => x.label===t)).map(t => (
              <button key={t} onClick={() => addTensePreset(t)} style={{ padding:'4px 10px', borderRadius:R.full, border:`1px dashed ${T.outline}`, background:'none', color:T.textSecondary, cursor:'pointer', ...type.labelSm }}>+ {t}</button>
            ))}
            {!addingCustomTense && (
              <button onClick={() => setAddingCustomTense(true)} style={{ padding:'4px 10px', borderRadius:R.full, border:`1px dashed ${T.primary}`, background:'none', color:T.primary, cursor:'pointer', ...type.labelSm }}>+ Custom…</button>
            )}
            {addingCustomTense && (
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <input autoFocus value={customTenseLabel} onChange={e=>setCustomTenseLabel(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter') confirmCustomTense(); if(e.key==='Escape'){ setAddingCustomTense(false); setCustomTenseLabel('') } }}
                  placeholder="Tense label…" style={{ ...inputStyle(T), width:150, padding:'4px 8px' }} />
                <button onClick={confirmCustomTense} style={{ padding:'4px 10px', borderRadius:R.r8, border:'none', background:T.primary, color:T.onPrimary, cursor:'pointer', ...type.labelSm }}>Add</button>
                <button onClick={() => { setAddingCustomTense(false); setCustomTenseLabel('') }} style={{ background:'none', border:'none', color:T.textSecondary, cursor:'pointer', ...type.label }}>✕</button>
              </div>
            )}
          </div>
          {tenses.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
              {tenses.map((tense, i) => (
                <div key={i} style={{ display:'grid', gridTemplateColumns:'110px 1fr 1fr 24px', gap:8, alignItems:'center' }}>
                  <span style={{ ...type.label, color:T.textSecondary, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tense.label}</span>
                  <input value={tense.form}   onChange={e => updateTense(i,'form',e.target.value)}   placeholder="たべる" style={{ ...inputStyle(T), fontFamily:"'Noto Sans JP', sans-serif", fontSize:15 }} />
                  <input value={tense.romaji} onChange={e => updateTense(i,'romaji',e.target.value)} placeholder="taberu" style={inputStyle(T)} />
                  <button onClick={() => removeTense(i)} style={{ background:'none', border:'none', color:T.red, cursor:'pointer', fontSize:14, padding:0 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          {tenses.length===0 && <div style={{ ...type.bodySm, color:T.textDisabled, fontStyle:'italic', marginTop:8 }}>Click a tense button above to add conjugation forms.</div>}
        </div>
      )}

      {/* Image */}
      <div style={{ marginBottom:20 }}>
        <label style={labelStyle(T)}>Image — optional</label>
        <div style={{ display:'flex', gap:14, alignItems:'flex-start', marginTop:8 }}>
          {imagePreview && <img src={imagePreview} alt="preview" style={{ width:80, height:56, objectFit:'cover', borderRadius:R.r8, border:`1px solid ${T.outline}`, flexShrink:0 }} />}
          <label style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'9px 16px', borderRadius:R.r8, border:`1px solid ${T.outline}`, background:T.surface2, color:T.textSecondary, cursor:'pointer', ...type.label }}>
            📷 {imagePreview ? 'Change image' : 'Upload image'}
            <input type="file" accept="image/*" onChange={handleImagePick} style={{ display:'none' }} />
          </label>
          {imagePreview && <button onClick={() => { setImageFile(null); setImagePreview(''); setImageUrl('') }} style={{ ...ghostSmBtn(T), color:T.red }}>Remove</button>}
        </div>
        {uploadProgress && <div style={{ ...type.label, color:T.secondary, marginTop:6 }}>{uploadProgress}</div>}
      </div>

      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onClose} style={ghostSmBtn(T)}>Cancel</button>
        <Btn T={T} onClick={save} disabled={saving||!jp||!en}>{saving?(uploadProgress||'Saving…'):editing?'Save Changes':isVerb?'Add Verb':'Add Word'}</Btn>
      </div>
    </Modal>
  )
}

// ─── Moments Panel ─────────────────────────────────────────────────────────────
function MomentCard({ T, moment, hovered, onHover, onLeave, onEdit, onDuplicate, onDelete, vocabExpanded, onVocabToggle }) {
  return (
    <div onMouseEnter={onHover} onMouseLeave={onLeave}
      style={{ ...cardStyle(T), position:'relative', transition:'border-color 0.15s', border:`1px solid ${hovered ? T.outlineVar : T.outline}` }}>
      <div style={{ fontSize:32, marginBottom:8 }}>{moment.emoji}</div>
      <div style={{ ...type.titleSm, color:T.textPrimary, marginBottom:6 }}>{moment.title}</div>
      <div style={{ ...type.bodySm, color:T.textSecondary, lineHeight:1.7, marginBottom:10 }}>
        {moment.fact?.slice(0,120)}{moment.fact?.length > 120 ? '…' : ''}
      </div>
      <button onClick={e => { e.stopPropagation(); onVocabToggle() }}
        style={{ ...type.labelSm, color:T.primary, background:T.primaryDim, border:'none', borderRadius:R.r8, padding:'3px 10px', cursor:'pointer' }}>
        {vocabExpanded ? 'Hide words ▴' : `${moment.vocab?.length ?? 0} vocab words ▾`}
      </button>
      {vocabExpanded && (moment.vocab?.length ?? 0) > 0 && (
        <div style={{ marginTop:10, borderTop:`1px solid ${T.outline}`, paddingTop:8, display:'flex', flexDirection:'column', gap:5 }}>
          {moment.vocab.map((v, i) => (
            <div key={i} style={{ display:'flex', gap:8, alignItems:'baseline' }}>
              <span style={{ fontFamily:"'Noto Sans JP', sans-serif", fontSize:15, color:T.textPrimary, minWidth:80 }}>{v.jp}</span>
              <span style={{ ...type.labelSm, color:T.primary }}>{v.romaji}</span>
              <span style={{ ...type.bodySm, color:T.textSecondary }}>{v.en}</span>
            </div>
          ))}
        </div>
      )}
      {vocabExpanded && (moment.vocab?.length ?? 0) === 0 && (
        <div style={{ marginTop:8, ...type.bodySm, color:T.textDisabled, fontStyle:'italic' }}>No vocab words attached.</div>
      )}
      {hovered && (
        <div style={{ position:'absolute', top:12, right:12,
          display:'flex', gap:3, background:T.surface, border:`1px solid ${T.outline}`,
          borderRadius:R.r10, padding:4, boxShadow:'0 4px 12px rgba(0,0,0,0.25)', zIndex:10 }}>
          <button onClick={e => { e.stopPropagation(); onEdit() }}      style={menuBtn(T)}>Edit</button>
          <button onClick={e => { e.stopPropagation(); onDuplicate() }} style={menuBtn(T)}>Copy</button>
          <button onClick={e => { e.stopPropagation(); onDelete() }}    style={{ ...menuBtn(T), color:T.red }}>Delete</button>
        </div>
      )}
    </div>
  )
}

function MomentModal({ T, moment, onClose }) {
  const editing = !!moment?.id
  const [emoji,    setEmoji]    = useState(moment?.emoji ?? '')
  const [title,    setTitle]    = useState(moment?.title ?? '')
  const [fact,     setFact]     = useState(moment?.fact  ?? '')
  const [vocabRaw, setVocabRaw] = useState(() => {
    if (!moment?.vocab?.length) return ''
    return moment.vocab.map(v => `${v.jp} | ${v.romaji} | ${v.en}`).join('\n')
  })
  const [saving, setSaving] = useState(false)

  const parseVocab = raw => raw.split('\n').filter(Boolean).map(line => {
    const [jp,romaji,en] = line.split('|').map(s=>s.trim()); return { jp,romaji,en }
  }).filter(v=>v.jp&&v.en)

  const save = async () => {
    if (!title || !fact) return
    setSaving(true)
    const data = { emoji, title, fact, vocab: parseVocab(vocabRaw) }
    if (editing) await updateDoc(doc(db,'moments',moment.id), { ...data, updatedAt:serverTimestamp() })
    else         await addDoc(collection(db,'moments'), { ...data, createdAt:serverTimestamp() })
    setSaving(false); onClose()
  }

  return (
    <Modal T={T} title={editing ? `Edit: ${moment.title}` : 'New Culture Moment'} onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:14, marginBottom:14 }}>
        <ModalField T={T} label="Emoji" value={emoji} onChange={setEmoji} placeholder="🌸" />
        <ModalField T={T} label="Title" value={title} onChange={setTitle} placeholder="Cherry Blossom Season" />
      </div>
      <ModalField T={T} label="Cultural fact / description" value={fact} onChange={setFact} placeholder="Write a few sentences…" multiline />
      <div style={{ marginTop:14 }}>
        <label style={labelStyle(T)}>Vocabulary (one per line: japanese | romaji | english)</label>
        <textarea value={vocabRaw} onChange={e=>setVocabRaw(e.target.value)}
          placeholder={'さくら | sakura | cherry blossom\nはなみ | hanami | flower viewing'}
          rows={4} style={{ ...inputStyle(T), width:'100%', marginTop:6, resize:'vertical', fontFamily:"'Noto Sans JP', sans-serif", fontSize:14 }} />
      </div>
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:14 }}>
        <button onClick={onClose} style={ghostSmBtn(T)}>Cancel</button>
        <Btn T={T} onClick={save} disabled={saving||!title||!fact}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Moment'}</Btn>
      </div>
    </Modal>
  )
}

function MomentsPanel({ T }) {
  const [moments,         setMoments]         = useState([])
  const [editMoment,      setEditMoment]      = useState(undefined)
  const [hoveredId,       setHoveredId]       = useState(null)
  const [expandedVocabId, setExpandedVocabId] = useState(null)
  const [seeding,         setSeeding]         = useState(false)

  useEffect(() => onSnapshot(collection(db,'moments'), s => setMoments(s.docs.map(d=>({id:d.id,...d.data()})))), [])

  const del = async id => { if (!confirm('Delete moment?')) return; await deleteDoc(doc(db,'moments',id)) }

  const duplicate = async moment => {
    const { id, ...data } = moment
    await addDoc(collection(db,'moments'), { ...data, createdAt:serverTimestamp() })
  }

  const seedMoments = async () => {
    if (!confirm(`Seed ${SEED_MOMENTS.length} culture moments from the lesson doc?`)) return
    setSeeding(true)
    try {
      const b = writeBatch(db)
      SEED_MOMENTS.forEach(m => b.set(doc(collection(db,'moments')), { ...m, createdAt:serverTimestamp() }))
      await b.commit()
    } finally { setSeeding(false) }
  }

  return (
    <div>
      <PanelHeader T={T} title="Culture Moments" sub={`${moments.length} moments`}>
        <div style={{ display:'flex', gap:8 }}>
          {moments.length===0 && <Btn T={T} onClick={seedMoments} secondary disabled={seeding}>{seeding?'Seeding…':'⚡ Seed from PDF'}</Btn>}
          <Btn T={T} onClick={() => setEditMoment(null)}>+ New Moment</Btn>
        </div>
      </PanelHeader>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:12 }}>
        {moments.map(m => (
          <MomentCard key={m.id} T={T} moment={m}
            hovered={hoveredId===m.id}
            onHover={() => setHoveredId(m.id)}
            onLeave={() => setHoveredId(id => id===m.id ? null : id)}
            onEdit={() => setEditMoment(m)}
            onDuplicate={() => duplicate(m)}
            onDelete={() => del(m.id)}
            vocabExpanded={expandedVocabId===m.id}
            onVocabToggle={() => setExpandedVocabId(id => id===m.id ? null : m.id)}
          />
        ))}
        {moments.length===0 && <Empty T={T} en="No moments yet." />}
      </div>

      {editMoment !== undefined && <MomentModal T={T} moment={editMoment} onClose={() => setEditMoment(undefined)} />}
    </div>
  )
}

// ─── Students Panel ────────────────────────────────────────────────────────────
function StudentsPanel({ T }) {
  const [progress, setProgress] = useState([])
  const [userMap,  setUserMap]  = useState({})

  useEffect(() => {
    const u1 = onSnapshot(collection(db,'studentProgress'), s =>
      setProgress(s.docs.map(d=>({uid:d.id,...d.data()}))))
    const u2 = onSnapshot(collection(db,'users'), s => {
      const map = {}
      s.docs.forEach(d => { map[d.id] = d.data() })
      setUserMap(map)
    })
    return () => { u1(); u2() }
  }, [])

  const students = progress.filter(s => (userMap[s.uid]?.role ?? 'student') !== 'teacher')

  return (
    <div>
      <PanelHeader T={T} title="Students" sub={`${students.length} enrolled`} />
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {students.map(s => {
          const user = userMap[s.uid] ?? {}
          const name = user.displayName || s.displayName || 'Unnamed student'
          const email = user.email || s.email || ''
          const xp=s.xp??0; const level=Math.floor(xp/100)+1; const done=(s.completedLessons??[]).length
          return (
            <div key={s.uid} style={{ ...cardStyle(T), display:'flex', gap:16, alignItems:'center' }}>
              <div style={{ width:44, height:44, borderRadius:'50%', background:T.primaryDim, display:'flex', alignItems:'center', justifyContent:'center', ...type.titleLg, color:T.primary, fontWeight:700, flexShrink:0 }}>
                {name[0]?.toUpperCase() ?? '?'}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ ...type.titleSm, color:T.textPrimary }}>{name}</div>
                {email && <div style={{ ...type.labelSm, color:T.textSecondary, marginTop:2 }}>{email}</div>}
              </div>
              <div style={{ display:'flex', gap:24 }}>
                <StatCell T={T} label="Level" value={level} color={T.primary} />
                <StatCell T={T} label="XP"    value={xp}    color={T.secondary} />
                <StatCell T={T} label="Done"  value={done}  color={T.green} />
                <StatCell T={T} label="Streak" value={`🔥 ${s.streak??0}`} color='#FF8F40' />
              </div>
            </div>
          )
        })}
        {students.length===0 && <Empty T={T} en="No students yet." />}
      </div>
    </div>
  )
}

// ─── Shared ────────────────────────────────────────────────────────────────────
function PanelHeader({ T, title, sub, children }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
      <div>
        <h1 style={{ ...type.headlineSm, color:T.textPrimary }}>{title}</h1>
        <p style={{ ...type.bodySm, color:T.textSecondary, marginTop:3 }}>{sub}</p>
      </div>
      {children}
    </div>
  )
}

function Modal({ T, title, onClose, children, wide }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999, padding:20 }}>
      <div style={{ background:T.surface, borderRadius:R.r20, padding:28, width:'100%', maxWidth:wide?700:480, maxHeight:'90vh', overflowY:'auto', border:`1px solid ${T.outline}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <h2 style={{ ...type.titleLg, color:T.textPrimary }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', color:T.textSecondary, cursor:'pointer', fontSize:18, padding:4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ModalField({ T, label, value, onChange, placeholder, type:t='text', jp:isJp, multiline }) {
  const [focused, setFocused] = useState(false)
  const base = { ...inputStyle(T), width:'100%', marginTop:6, fontFamily:isJp?"'Noto Sans JP', sans-serif":'inherit', fontSize:isJp?17:14, border:`1.5px solid ${focused?T.primary:T.outline}` }
  return (
    <div>
      <label style={labelStyle(T)}>{label}</label>
      {multiline
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={4} style={{ ...base, resize:'vertical' }} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} />
        : <input type={t} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} />
      }
    </div>
  )
}

function Btn({ T, children, onClick, disabled, secondary }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding:'9px 20px', borderRadius:R.r10, border:`1px solid ${disabled?T.outline:secondary?T.outline:T.primary}`, background:disabled?T.surface3:secondary?'none':T.primary, color:disabled?T.textSecondary:secondary?T.textSecondary:T.onPrimary, cursor:disabled?'default':'pointer', ...type.label, fontWeight:700, transition:'all 0.15s' }}>
      {children}
    </button>
  )
}

function StatCell({ T, label, value, color }) {
  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ ...type.label, color:T.textSecondary }}>{label}</div>
      <div style={{ ...type.titleSm, color, fontWeight:700 }}>{value}</div>
    </div>
  )
}

function Empty({ T, en }) {
  return <div style={{ padding:'48px 0', textAlign:'center' }}><div style={{ ...type.bodySm, color:T.textSecondary }}>{en}</div></div>
}

const cardStyle   = T => ({ background:T.surface, borderRadius:R.r14, border:`1px solid ${T.outline}`, padding:'16px 18px' })
const ghostSmBtn  = T => ({ padding:'7px 14px', borderRadius:R.r8, border:`1px solid ${T.outline}`, background:'none', color:T.textSecondary, cursor:'pointer', ...type.label, fontWeight:500 })
const menuBtn     = T => ({ padding:'6px 10px', borderRadius:R.r8, border:'none', background:'none', color:T.textSecondary, cursor:'pointer', ...type.label, fontWeight:500, whiteSpace:'nowrap' })
const inputStyle  = T => ({ padding:'10px 12px', borderRadius:R.r8, background:T.surface2, color:T.textPrimary, outline:'none', transition:'border-color 0.15s', fontFamily:'inherit', border:`1px solid ${T.outline}` })
const labelStyle  = T => ({ ...type.label, color:T.textSecondary, fontWeight:500, display:'block' })
