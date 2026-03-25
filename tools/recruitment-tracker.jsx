const { useState, useMemo, useRef } = React;
const XLSX = window.XLSX;
const mammoth = window.mammoth;

const MODEL = "gemini-2.0-flash";

const C = {
  bg: "#f7f5f0", card: "#ffffff", border: "#e8e2d9",
  ink: "#1a1a1a", muted: "#6b6560", dim: "#a09b95",
  accent: "#2d6a4f", accent2: "#52b788", red: "#c1440e",
  yellow: "#e9c46a", blue: "#2196a4", tag: "#f0ece4",
  aiPurple: "#6c3fcf", aiLight: "#f3eeff"
};

const STATUS_OPTIONS = ["New","Contacted","Screening","Submitted","Interview","Offer","Placed","Rejected","On Hold"];
const SOURCE_OPTIONS = ["LinkedIn","Naukri","Indeed","Referral","Job Portal","Direct","Database","Other"];
const STATUS_COLORS = {
  "New":       { bg:"#e8f4fd", text:"#1565c0", border:"#90caf9" },
  "Contacted": { bg:"#fff8e1", text:"#e65100", border:"#ffcc80" },
  "Screening": { bg:"#f3e5f5", text:"#6a1b9a", border:"#ce93d8" },
  "Submitted": { bg:"#e8eaf6", text:"#283593", border:"#9fa8da" },
  "Interview": { bg:"#fff3e0", text:"#bf360c", border:"#ffab91" },
  "Offer":     { bg:"#e0f2f1", text:"#004d40", border:"#80cbc4" },
  "Placed":    { bg:"#e8f5e9", text:"#1b5e20", border:"#a5d6a7" },
  "Rejected":  { bg:"#fce4ec", text:"#880e4f", border:"#f48fb1" },
  "On Hold":   { bg:"#f5f5f5", text:"#424242", border:"#bdbdbd" },
};

let nextId = 1;
const makeId = () => nextId++;
const today = () => new Date().toISOString().split("T")[0];
const EMPTY = { date: today(), source:"", name:"", currentCompany:"", clientName:"", jobTitle:"", skills:"", contact:"", email:"", city:"", salary:"", linkedin:"", experience:"", status:"New", remark:"", cvName:"", cvBase64:"", cvType:"" };

// ── CV text extraction ────────────────────────────────────────────────────
async function extractCVData(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = e => res({ type:"pdf", base64: e.target.result.split(",")[1], name: file.name, dataUrl: e.target.result });
      r.readAsDataURL(file);
    });
  } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = async e => {
        try {
          const out = await mammoth.extractRawText({ arrayBuffer: e.target.result });
          res({ type:"text", content: out.value, name: file.name });
        } catch(err) { rej(err); }
      };
      r.readAsArrayBuffer(file);
    });
  } else {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = e => res({ type:"text", content: e.target.result, name: file.name });
      r.readAsText(file);
    });
  }
}

// ── AI extract candidate info from CV ────────────────────────────────────
async function aiExtractFromCV(cvData) {
  const content = [];
  if (cvData.type === "pdf") {
    content.push({ text:"Extract candidate information from this CV/Resume. Return ONLY valid JSON, no markdown:" });
    content.push({ inline_data:{ mime_type:"application/pdf", data: cvData.base64 } });
  } else {
    content.push({ text:`Extract candidate information from this CV/Resume text. Return ONLY valid JSON, no markdown:\n\n${cvData.content}` });
  }
  content.push({ text:`Return this exact JSON structure (use empty string if not found):
{"name":"","currentCompany":"","jobTitle":"","skills":"comma separated skills","contact":"","email":"","city":"","salary":"current or expected CTC if mentioned","linkedin":"","experience":"total years as number only"}` });
  return window.TalentLensRuntime.generateJson({ model: MODEL, parts: content });
}

// ── Helpers ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS["New"];
  return <span style={{ background:s.bg, color:s.text, border:`1px solid ${s.border}`, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{status}</span>;
}

function CVPill({ name, onView, onRemove }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:8, background:C.aiLight, border:`1px solid ${C.aiPurple}33`, borderRadius:8, padding:"7px 12px" }}>
      <span style={{ fontSize:16 }}>📄</span>
      <span style={{ fontSize:12, color:C.aiPurple, fontWeight:600, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</span>
      {onView && <button onClick={onView} style={{ background:"transparent", border:"none", color:C.blue, fontSize:11, cursor:"pointer", fontWeight:700, padding:0 }}>View</button>}
      {onRemove && <button onClick={onRemove} style={{ background:"transparent", border:"none", color:C.red, fontSize:14, cursor:"pointer", padding:0, lineHeight:1 }}>×</button>}
    </div>
  );
}

// ── CV Preview Modal ──────────────────────────────────────────────────────
function CVPreviewModal({ candidate, onClose }) {
  if (!candidate?.cvBase64 && !candidate?.cvContent) return null;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:C.card, borderRadius:16, width:"100%", maxWidth:780, maxHeight:"90vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 24px 80px rgba(0,0,0,0.25)" }} onClick={e=>e.stopPropagation()}>
        <div style={{ padding:"16px 24px", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", background:C.aiPurple }}>
          <span style={{ fontWeight:700, color:"#fff", fontSize:15 }}>📄 {candidate.cvName}</span>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:8, width:30, height:30, color:"#fff", fontSize:18, cursor:"pointer" }}>×</button>
        </div>
        <div style={{ flex:1, overflow:"auto" }}>
          {candidate.cvType === "pdf" ? (
            <iframe src={`data:application/pdf;base64,${candidate.cvBase64}`} style={{ width:"100%", height:"70vh", border:"none" }} title="CV Preview" />
          ) : (
            <pre style={{ padding:24, fontSize:13, color:C.ink, lineHeight:1.8, whiteSpace:"pre-wrap", wordBreak:"break-word", fontFamily:"'DM Sans',sans-serif", margin:0 }}>{candidate.cvContent}</pre>
          )}
        </div>
        <div style={{ padding:"12px 24px", borderTop:`1px solid ${C.border}`, display:"flex", justifyContent:"flex-end" }}>
          {candidate.cvType === "pdf" && (
            <a href={`data:application/pdf;base64,${candidate.cvBase64}`} download={candidate.cvName}
              style={{ padding:"8px 18px", borderRadius:8, background:C.accent, color:"#fff", fontSize:12, fontWeight:700, textDecoration:"none" }}>⬇ Download</a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Candidate Modal ───────────────────────────────────────────────────────
function CandidateModal({ candidate, onSave, onClose, sno }) {
  const [form, setForm] = useState(candidate ? { ...candidate } : { ...EMPTY });
  const [cvFile, setCvFile] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDone, setAiDone] = useState(false);
  const [previewCV, setPreviewCV] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  async function handleCVFile(file) {
    if (!file) return;
    setCvFile(file);
    setAiLoading(true); setAiDone(false);
    try {
      const cvData = await extractCVData(file);
      // Store CV for viewing/downloading
      if (cvData.type === "pdf") {
        set("cvBase64", cvData.base64); set("cvType","pdf"); set("cvName", file.name);
      } else {
        set("cvContent", cvData.content); set("cvType","text"); set("cvName", file.name);
      }
      // AI extract
      const extracted = await aiExtractFromCV(cvData);
      setForm(f => ({
        ...f,
        name:          extracted.name          || f.name,
        currentCompany:extracted.currentCompany|| f.currentCompany,
        jobTitle:      extracted.jobTitle      || f.jobTitle,
        skills:        extracted.skills        || f.skills,
        contact:       extracted.contact       || f.contact,
        email:         extracted.email         || f.email,
        city:          extracted.city          || f.city,
        salary:        extracted.salary        || f.salary,
        linkedin:      extracted.linkedin      || f.linkedin,
        experience:    extracted.experience    || f.experience,
        cvBase64:      cvData.type==="pdf" ? cvData.base64 : f.cvBase64,
        cvContent:     cvData.type!=="pdf" ? cvData.content : f.cvContent,
        cvType:        cvData.type,
        cvName:        file.name,
      }));
      setAiDone(true);
    } catch(e) { console.error(e); }
    setAiLoading(false);
  }

  function onDrop(e) { e.preventDefault(); setDragOver(false); const f=e.dataTransfer.files[0]; if(f) handleCVFile(f); }

  const Field = ({ label, k, type="text", options, wide }) => (
    <div style={{ gridColumn: wide ? "1/-1" : "span 1", display:"flex", flexDirection:"column", gap:4 }}>
      <label style={{ fontSize:10, fontWeight:800, color:C.muted, letterSpacing:"0.6px", textTransform:"uppercase" }}>{label}</label>
      {options ? (
        <select value={form[k]} onChange={e=>set(k,e.target.value)} style={inputSt}><option value="">Select…</option>{options.map(o=><option key={o}>{o}</option>)}</select>
      ) : type==="textarea" ? (
        <textarea value={form[k]} onChange={e=>set(k,e.target.value)} rows={3} style={{ ...inputSt, resize:"vertical" }} />
      ) : (
        <input type={type} value={form[k]} onChange={e=>set(k,e.target.value)} style={inputSt} />
      )}
    </div>
  );

  const inputSt = { padding:"9px 12px", borderRadius:8, border:`1.5px solid ${C.border}`, background:C.bg, color:C.ink, fontSize:13, outline:"none", fontFamily:"inherit", width:"100%" };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }} onClick={onClose}>
      <div style={{ background:C.card, borderRadius:18, width:"100%", maxWidth:740, maxHeight:"94vh", overflow:"hidden", display:"flex", flexDirection:"column", boxShadow:"0 24px 80px rgba(0,0,0,0.2)" }} onClick={e=>e.stopPropagation()}>
        
        {/* Header */}
        <div style={{ padding:"20px 28px", background:C.accent, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:19, fontWeight:700, color:"#fff" }}>{candidate?"Edit Candidate":"Add New Candidate"}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.65)", marginTop:2 }}>Entry #{sno} · Upload CV to auto-fill fields with AI</div>
          </div>
          <button onClick={onClose} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:8, width:32, height:32, color:"#fff", fontSize:18, cursor:"pointer" }}>×</button>
        </div>

        <div style={{ overflowY:"auto", flex:1 }}>
          {/* ── CV UPLOAD ZONE ── */}
          <div style={{ padding:"20px 28px 0" }}>
            <div style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:"0.6px", textTransform:"uppercase", marginBottom:8 }}>
              Step 1 — Upload CV <span style={{ color:C.aiPurple, fontWeight:700 }}>✦ AI Auto-Fill</span>
            </div>

            {!form.cvName ? (
              <div
                onDragOver={e=>{e.preventDefault();setDragOver(true)}} onDragLeave={()=>setDragOver(false)} onDrop={onDrop}
                onClick={()=>fileRef.current.click()}
                style={{ border:`2px dashed ${dragOver?C.aiPurple:C.border}`, borderRadius:12, padding:"24px 20px", textAlign:"center", cursor:"pointer", background:dragOver?C.aiLight:C.bg, transition:"all 0.2s" }}>
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display:"none" }} onChange={e=>e.target.files[0]&&handleCVFile(e.target.files[0])} />
                <div style={{ fontSize:32, marginBottom:8 }}>📄</div>
                <div style={{ fontSize:13, fontWeight:700, color:C.ink, marginBottom:4 }}>Drop CV here or click to upload</div>
                <div style={{ fontSize:11, color:C.muted }}>PDF · DOCX · TXT · AI will auto-fill all fields below</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {aiLoading && (
                  <div style={{ background:C.aiLight, border:`1px solid ${C.aiPurple}44`, borderRadius:10, padding:"12px 16px", display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:18, height:18, border:`2px solid ${C.aiPurple}`, borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />
                    <span style={{ fontSize:12, color:C.aiPurple, fontWeight:600 }}>AI is reading CV and filling fields…</span>
                  </div>
                )}
                {aiDone && (
                  <div style={{ background:"#e8f5e9", border:"1px solid #a5d6a7", borderRadius:10, padding:"10px 16px", display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:16 }}>✅</span>
                    <span style={{ fontSize:12, color:"#1b5e20", fontWeight:600 }}>Fields auto-filled from CV — review and edit below</span>
                  </div>
                )}
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <CVPill name={form.cvName} onView={()=>setPreviewCV(true)} />
                  <button onClick={()=>{ setForm(f=>({...f,cvName:"",cvBase64:"",cvContent:"",cvType:""})); setCvFile(null); setAiDone(false); }}
                    style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${C.border}`, background:"transparent", color:C.red, fontSize:12, fontWeight:700, cursor:"pointer", whiteSpace:"nowrap" }}>
                    Replace CV
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── FIELDS ── */}
          <div style={{ padding:"20px 28px 4px" }}>
            <div style={{ fontSize:11, fontWeight:800, color:C.muted, letterSpacing:"0.6px", textTransform:"uppercase", marginBottom:14 }}>Step 2 — Candidate Details</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:13 }}>
              <Field label="Date" k="date" type="date" />
              <Field label="Source" k="source" options={SOURCE_OPTIONS} />
              <Field label="Candidate Name *" k="name" />
              <Field label="Current Company" k="currentCompany" />
              <Field label="Client Name" k="clientName" />
              <Field label="Job Title" k="jobTitle" />
              <Field label="Skills (comma separated)" k="skills" wide />
              <Field label="Contact Number" k="contact" type="tel" />
              <Field label="Email" k="email" type="email" />
              <Field label="City" k="city" />
              <Field label="Salary (CTC)" k="salary" />
              <Field label="Experience (Years)" k="experience" />
              <Field label="LinkedIn URL" k="linkedin" wide />
              <Field label="Status" k="status" options={STATUS_OPTIONS} />
              <Field label="Remark (for recruiter)" k="remark" type="textarea" wide />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"16px 28px", borderTop:`1px solid ${C.border}`, display:"flex", gap:10, justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:11, color:C.dim }}>{form.cvName ? `📎 CV attached: ${form.cvName}` : "No CV attached"}</div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose} style={{ padding:"10px 22px", borderRadius:10, border:`1.5px solid ${C.border}`, background:"transparent", color:C.muted, fontSize:13, fontWeight:600, cursor:"pointer" }}>Cancel</button>
            <button onClick={()=>{ if(!form.name.trim()) return alert("Candidate name is required"); onSave(form); onClose(); }}
              disabled={aiLoading}
              style={{ padding:"10px 28px", borderRadius:10, border:"none", background:aiLoading?C.dim:C.accent, color:"#fff", fontSize:13, fontWeight:700, cursor:aiLoading?"not-allowed":"pointer" }}>
              {candidate?"Save Changes":"Add Candidate"}
            </button>
          </div>
        </div>
      </div>

      {previewCV && <CVPreviewModal candidate={form} onClose={()=>setPreviewCV(false)} />}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── Stats Bar ─────────────────────────────────────────────────────────────
function StatsBar({ data }) {
  const stats = [
    { label:"Total",      value: data.length,                                              color: C.accent },
    { label:"Active",     value: data.filter(d=>!["Placed","Rejected"].includes(d.status)).length, color: C.blue },
    { label:"Interviews", value: data.filter(d=>d.status==="Interview").length,            color: C.yellow },
    { label:"Placed",     value: data.filter(d=>d.status==="Placed").length,               color: C.accent2 },
    { label:"With CV",    value: data.filter(d=>d.cvName).length,                          color: C.aiPurple },
  ];
  return (
    <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
      {stats.map(s => (
        <div key={s.label} style={{ background:C.card, borderRadius:12, padding:"12px 18px", border:`1px solid ${C.border}`, flex:1, minWidth:90 }}>
          <div style={{ fontSize:10, color:C.muted, fontWeight:700, letterSpacing:"0.5px", textTransform:"uppercase", marginBottom:3 }}>{s.label}</div>
          <div style={{ fontSize:24, fontWeight:800, color:s.color, fontFamily:"'Playfair Display',serif" }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────
function exportToExcel(data) {
  const rows = data.map((d,i) => ({
    "S.No": i+1, "Date": d.date, "Source": d.source, "Name": d.name,
    "Current Company": d.currentCompany, "Client Name": d.clientName,
    "Job Title": d.jobTitle, "Skills": d.skills, "Contact Number": d.contact,
    "Email": d.email, "City": d.city, "Salary": d.salary,
    "LinkedIn Link": d.linkedin, "Experience": d.experience,
    "Candidate Status": d.status, "Remark (For Recruiter)": d.remark,
    "CV Attached": d.cvName ? "Yes" : "No",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [6,12,12,20,22,20,20,28,16,28,12,14,32,12,14,36,12].map(w=>({wch:w}));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Recruitment Tracker");
  XLSX.writeFile(wb, `Recruitment_${new Date().toISOString().split("T")[0]}.xlsx`);
}

// ── Main App ──────────────────────────────────────────────────────────────
function App() {
  const [candidates, setCandidates]   = useState([]);
  const [modal, setModal]             = useState(null);
  const [previewCand, setPreviewCand] = useState(null);
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [sortCol, setSortCol]         = useState("date");
  const [sortDir, setSortDir]         = useState("desc");
  const [viewMode, setViewMode]       = useState("table");

  const add  = form => setCandidates(p=>[...p, {...form, id:makeId()}]);
  const edit = (id,form) => setCandidates(p=>p.map(c=>c.id===id?{...form,id}:c));
  const del  = id => { if(window.confirm("Delete this candidate?")) setCandidates(p=>p.filter(c=>c.id!==id)); };

  const filtered = useMemo(()=>{
    let d = [...candidates];
    if(search){ const q=search.toLowerCase(); d=d.filter(c=>[c.name,c.currentCompany,c.clientName,c.jobTitle,c.skills,c.city,c.email].some(v=>v?.toLowerCase().includes(q))); }
    if(filterStatus) d=d.filter(c=>c.status===filterStatus);
    if(filterSource) d=d.filter(c=>c.source===filterSource);
    d.sort((a,b)=>{ let va=a[sortCol]||"",vb=b[sortCol]||""; return sortDir==="asc"?va.localeCompare(vb):vb.localeCompare(va); });
    return d;
  },[candidates,search,filterStatus,filterSource,sortCol,sortDir]);

  const toggleSort = col => { if(sortCol===col) setSortDir(d=>d==="asc"?"desc":"asc"); else{ setSortCol(col); setSortDir("asc"); } };

  const thSt = col => ({ padding:"9px 12px", textAlign:"left", fontSize:10, fontWeight:800, color:sortCol===col?C.accent:C.muted, letterSpacing:"0.6px", textTransform:"uppercase", cursor:"pointer", whiteSpace:"nowrap", borderBottom:`2px solid ${sortCol===col?C.accent:C.border}`, background:C.tag, userSelect:"none" });
  const tdSt = { padding:"10px 12px", fontSize:12, color:C.ink, borderBottom:`1px solid ${C.border}`, verticalAlign:"middle" };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'DM Sans',sans-serif", color:C.ink }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box}@keyframes slideIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}} select,input,textarea{font-family:'DM Sans',sans-serif!important}`}</style>

      {previewCand && <CVPreviewModal candidate={previewCand} onClose={()=>setPreviewCand(null)} />}

      {/* Header */}
      <div style={{ background:C.accent, padding:"18px 32px", display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:800, color:"#fff" }}>Recruitment Tracker</div>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)", marginTop:2 }}>CV Upload · AI Auto-Fill · Pipeline Management · Excel Export</div>
        </div>
        <button onClick={()=>exportToExcel(filtered)} disabled={!filtered.length}
          style={{ padding:"9px 18px", borderRadius:10, border:"2px solid rgba(255,255,255,0.4)", background:"transparent", color:"#fff", fontSize:12, fontWeight:700, cursor:filtered.length?"pointer":"not-allowed", opacity:filtered.length?1:0.5 }}>
          📥 Export Excel
        </button>
        <button onClick={()=>setModal("add")}
          style={{ padding:"10px 22px", borderRadius:10, border:"none", background:"#fff", color:C.accent, fontSize:13, fontWeight:800, cursor:"pointer" }}>
          + Add Candidate
        </button>
      </div>

      <div style={{ padding:"22px 32px" }}>
        <StatsBar data={candidates} />

        {/* Filters */}
        <div style={{ marginTop:18, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍  Search name, company, skill, city…"
            style={{ flex:2, minWidth:200, padding:"9px 14px", borderRadius:10, border:`1.5px solid ${C.border}`, background:C.card, fontSize:13, outline:"none" }} />
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
            style={{ flex:1, minWidth:130, padding:"9px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, background:C.card, fontSize:13, outline:"none" }}>
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
          </select>
          <select value={filterSource} onChange={e=>setFilterSource(e.target.value)}
            style={{ flex:1, minWidth:130, padding:"9px 12px", borderRadius:10, border:`1.5px solid ${C.border}`, background:C.card, fontSize:13, outline:"none" }}>
            <option value="">All Sources</option>
            {SOURCE_OPTIONS.map(s=><option key={s}>{s}</option>)}
          </select>
          <div style={{ display:"flex", gap:4 }}>
            {[["table","☰"],["cards","⊞"]].map(([v,icon])=>(
              <button key={v} onClick={()=>setViewMode(v)} style={{ padding:"8px 14px", borderRadius:8, border:`1.5px solid ${C.border}`, background:viewMode===v?C.accent:C.card, color:viewMode===v?"#fff":C.muted, fontSize:15, cursor:"pointer" }}>{icon}</button>
            ))}
          </div>
          {(search||filterStatus||filterSource) && (
            <button onClick={()=>{setSearch("");setFilterStatus("");setFilterSource("");}} style={{ padding:"9px 14px", borderRadius:10, border:`1.5px solid ${C.border}`, background:"transparent", color:C.red, fontSize:12, fontWeight:700, cursor:"pointer" }}>✕ Clear</button>
          )}
        </div>

        <div style={{ margin:"10px 0 8px", fontSize:12, color:C.muted }}>
          Showing <strong style={{ color:C.ink }}>{filtered.length}</strong> of {candidates.length} candidates
        </div>

        {/* Empty state */}
        {candidates.length===0 && (
          <div style={{ background:C.card, borderRadius:16, border:`2px dashed ${C.border}`, padding:"56px 40px", textAlign:"center", marginTop:8 }}>
            <div style={{ fontSize:44, marginBottom:14 }}>📋</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, fontWeight:700, marginBottom:8 }}>No candidates yet</div>
            <div style={{ color:C.muted, fontSize:14, marginBottom:10 }}>Upload a CV — AI will automatically fill in all the details for you</div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:C.aiLight, border:`1px solid ${C.aiPurple}33`, borderRadius:20, padding:"6px 14px", marginBottom:24, fontSize:12, color:C.aiPurple, fontWeight:600 }}>
              ✦ AI Auto-Fill from CV
            </div>
            <br />
            <button onClick={()=>setModal("add")} style={{ padding:"12px 28px", borderRadius:12, border:"none", background:C.accent, color:"#fff", fontSize:14, fontWeight:700, cursor:"pointer" }}>+ Add First Candidate</button>
          </div>
        )}

        {/* TABLE */}
        {filtered.length>0 && viewMode==="table" && (
          <div style={{ background:C.card, borderRadius:16, border:`1px solid ${C.border}`, overflow:"hidden" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:960 }}>
                <thead>
                  <tr>
                    {[["#",""],["Date","date"],["Name","name"],["Current Co.","currentCompany"],["Client","clientName"],["Job Title","jobTitle"],["Skills","skills"],["City","city"],["Salary","salary"],["Exp.","experience"],["Status","status"],["CV",""],["Actions",""]].map(([l,k])=>(
                      <th key={l} style={thSt(k)} onClick={()=>k&&toggleSort(k)}>{l}{k&&sortCol===k?(sortDir==="asc"?"↑":"↓"):""}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c,i)=>(
                    <tr key={c.id} style={{ animation:"slideIn 0.3s ease", background:i%2===0?"#fff":C.bg }}
                      onMouseEnter={e=>e.currentTarget.style.background="#f0f7f4"}
                      onMouseLeave={e=>e.currentTarget.style.background=i%2===0?"#fff":C.bg}>
                      <td style={{...tdSt,color:C.dim,fontWeight:700,width:40}}>{i+1}</td>
                      <td style={{...tdSt,whiteSpace:"nowrap"}}>{c.date}</td>
                      <td style={{...tdSt,fontWeight:700,color:C.accent,whiteSpace:"nowrap"}}>
                        {c.name}
                        {c.linkedin&&<a href={c.linkedin} target="_blank" rel="noreferrer" style={{marginLeft:5,fontSize:11,color:C.blue}} onClick={e=>e.stopPropagation()}>🔗</a>}
                        {c.email&&<a href={`mailto:${c.email}`} style={{marginLeft:4,fontSize:11,color:C.muted}} onClick={e=>e.stopPropagation()}>✉</a>}
                      </td>
                      <td style={tdSt}>{c.currentCompany||"—"}</td>
                      <td style={tdSt}>{c.clientName||"—"}</td>
                      <td style={tdSt}>{c.jobTitle||"—"}</td>
                      <td style={{...tdSt,maxWidth:140}}>
                        <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                          {(c.skills||"").split(",").filter(Boolean).slice(0,3).map(s=>(
                            <span key={s} style={{background:C.tag,color:C.muted,borderRadius:5,padding:"1px 6px",fontSize:10,fontWeight:600}}>{s.trim()}</span>
                          ))}
                          {(c.skills||"").split(",").filter(Boolean).length>3&&<span style={{fontSize:10,color:C.dim}}>+{(c.skills||"").split(",").filter(Boolean).length-3}</span>}
                        </div>
                      </td>
                      <td style={tdSt}>{c.city||"—"}</td>
                      <td style={{...tdSt,whiteSpace:"nowrap"}}>{c.salary||"—"}</td>
                      <td style={{...tdSt,whiteSpace:"nowrap"}}>{c.experience?`${c.experience}y`:"—"}</td>
                      <td style={tdSt}><StatusBadge status={c.status}/></td>
                      <td style={tdSt}>
                        {c.cvName ? (
                          <button onClick={()=>setPreviewCand(c)} style={{background:C.aiLight,border:`1px solid ${C.aiPurple}33`,borderRadius:6,padding:"3px 8px",fontSize:10,color:C.aiPurple,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
                            📄 View
                          </button>
                        ) : <span style={{color:C.dim,fontSize:11}}>—</span>}
                      </td>
                      <td style={tdSt}>
                        <div style={{display:"flex",gap:5}}>
                          <button onClick={()=>setModal({candidate:c})} style={{padding:"4px 10px",borderRadius:7,border:`1px solid ${C.border}`,background:"transparent",color:C.accent,fontSize:11,fontWeight:700,cursor:"pointer"}}>Edit</button>
                          <button onClick={()=>del(c.id)} style={{padding:"4px 10px",borderRadius:7,border:"1px solid #f5c6c6",background:"transparent",color:C.red,fontSize:11,fontWeight:700,cursor:"pointer"}}>Del</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CARDS */}
        {filtered.length>0 && viewMode==="cards" && (
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:16}}>
            {filtered.map((c,i)=>(
              <div key={c.id} style={{background:C.card,borderRadius:14,border:`1px solid ${C.border}`,padding:20,animation:"slideIn 0.3s ease",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:15,color:C.accent,marginBottom:2}}>{c.name}</div>
                    <div style={{fontSize:12,color:C.muted}}>{c.jobTitle||"—"}{c.clientName?` @ ${c.clientName}`:""}</div>
                  </div>
                  <StatusBadge status={c.status}/>
                </div>
                {c.cvName && (
                  <div onClick={()=>setPreviewCand(c)} style={{cursor:"pointer",marginBottom:10}}>
                    <CVPill name={c.cvName}/>
                  </div>
                )}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:10}}>
                  {[["🏢",c.currentCompany],["📍",c.city],["💰",c.salary],["⏱",c.experience?`${c.experience} yr`:null],["📅",c.date],["📡",c.source]].filter(([,v])=>v).map(([icon,val])=>(
                    <div key={icon} style={{fontSize:11,color:C.muted}}><span style={{marginRight:4}}>{icon}</span>{val}</div>
                  ))}
                </div>
                {c.skills&&<div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>{c.skills.split(",").filter(Boolean).map(s=><span key={s} style={{background:C.tag,color:C.muted,borderRadius:6,padding:"2px 7px",fontSize:10,fontWeight:600}}>{s.trim()}</span>)}</div>}
                {c.remark&&<div style={{fontSize:11,color:C.dim,background:C.bg,borderRadius:8,padding:"6px 10px",marginBottom:10,fontStyle:"italic"}}>"{c.remark}"</div>}
                <div style={{display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap"}}>
                  {c.linkedin&&<a href={c.linkedin} target="_blank" rel="noreferrer" style={{fontSize:11,color:C.blue,textDecoration:"none"}}>🔗</a>}
                  {c.email&&<a href={`mailto:${c.email}`} style={{fontSize:11,color:C.muted,textDecoration:"none"}}>✉</a>}
                  <button onClick={()=>setModal({candidate:c})} style={{padding:"5px 12px",borderRadius:7,border:`1px solid ${C.border}`,background:"transparent",color:C.accent,fontSize:11,fontWeight:700,cursor:"pointer"}}>Edit</button>
                  <button onClick={()=>del(c.id)} style={{padding:"5px 10px",borderRadius:7,border:"1px solid #f5c6c6",background:"transparent",color:C.red,fontSize:11,cursor:"pointer"}}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal==="add"&&<CandidateModal onSave={add} onClose={()=>setModal(null)} sno={candidates.length+1}/>}
      {modal?.candidate&&<CandidateModal candidate={modal.candidate} onSave={form=>edit(modal.candidate.id,form)} onClose={()=>setModal(null)}/>}
    </div>
  );
}

window.TalentLensApp = App;
