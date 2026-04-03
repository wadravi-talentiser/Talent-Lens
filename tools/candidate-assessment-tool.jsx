const { useState, useCallback } = React;
const mammoth = window.mammoth;

const MODEL = "claude-sonnet-4-20250514";

// ── File extraction ────────────────────────────────────────────────────────
async function extractText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ type: "pdf", base64: e.target.result.split(",")[1], name: file.name });
      reader.readAsDataURL(file);
    });
  } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const r = await mammoth.extractRawText({ arrayBuffer: e.target.result });
          resolve({ type: "text", content: r.value, name: file.name });
        } catch (err) { reject(err); }
      };
      reader.readAsArrayBuffer(file);
    });
  } else {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve({ type: "text", content: e.target.result, name: file.name });
      reader.readAsText(file);
    });
  }
}

function buildMessages(jdData, cvData, notes) {
  const parts = [];
  const addDoc = (label, data) => {
    if (!data) return;
    if (data.type === "pdf") {
      parts.push({ type: "text", text: `--- ${label} (${data.name}) ---` });
      parts.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: data.base64 } });
    } else {
      parts.push({ type: "text", text: `--- ${label} ---\n${data.content}` });
    }
  };
  addDoc("JOB DESCRIPTION", jdData);
  addDoc("CANDIDATE CV", cvData);
  if (notes) parts.push({ type: "text", text: `--- NOTES ---\n${notes}` });
  parts.push({
    type: "text", text: `You are a senior recruitment consultant. Analyse the CV vs the JD. Return ONLY valid JSON (no markdown, no preamble):
{
  "candidateName": "string",
  "roleApplied": "string",
  "overallScore": number,
  "fitVerdict": "Strong Fit"|"Good Fit"|"Partial Fit"|"Weak Fit",
  "executiveSummary": "string",
  "dimensions": [
    {"name":"Technical Skills","score":number,"comment":"string"},
    {"name":"Experience Level","score":number,"comment":"string"},
    {"name":"Industry Background","score":number,"comment":"string"},
    {"name":"Career Trajectory","score":number,"comment":"string"},
    {"name":"Education & Certs","score":number,"comment":"string"}
  ],
  "strengths": ["string","string","string"],
  "gaps": ["string","string"],
  "redFlags": ["string"],
  "interviewQuestions": ["string","string","string","string","string"],
  "salaryRange": "string",
  "noticePeriod": "string",
  "recommendation": "string"
}`
  });
  return parts;
}

// ── Design tokens ─────────────────────────────────────────────────────────
const C = {
  bg: "#080d18", card: "#0f1623", border: "#1c2840",
  accent: "#00e5a0", yellow: "#f5c842", red: "#ff5c5c", blue: "#4d9de0",
  text: "#e2e8f0", muted: "#8892a4", dim: "#4a5568"
};

function verdictColor(v) {
  if (!v) return C.blue;
  if (v.includes("Strong") || v.includes("Good")) return C.accent;
  if (v.includes("Partial")) return C.yellow;
  return C.red;
}

// ── ScoreRing ──────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 110 }) {
  const r = size * 0.4, circ = 2 * Math.PI * r, fill = (score / 100) * circ;
  const color = score >= 75 ? C.accent : score >= 55 ? C.yellow : C.red;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1c2840" strokeWidth="8" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dasharray 1s ease" }} />
      <text x={size/2} y={size/2 - 5} textAnchor="middle" fill={color} fontSize={size * 0.22} fontWeight="800" fontFamily="'DM Mono',monospace">{score}</text>
      <text x={size/2} y={size/2 + 12} textAnchor="middle" fill={C.muted} fontSize={size * 0.09} fontFamily="'DM Sans',sans-serif">/ 100</text>
    </svg>
  );
}

function DimBar({ name, score, comment }) {
  const color = score >= 75 ? C.accent : score >= 55 ? C.yellow : C.red;
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: C.muted }}>{name}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{score}</span>
      </div>
      <div style={{ background: "#1c2840", borderRadius: 4, height: 5 }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 4, transition: "width 1s ease" }} />
      </div>
      {comment && <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{comment}</div>}
    </div>
  );
}

function Badge({ text, color }) {
  return (
    <span style={{
      background: `${color}18`, color, border: `1px solid ${color}44`,
      borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 600, fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap"
    }}>{text}</span>
  );
}

// ── FileDropzone ───────────────────────────────────────────────────────────
function FileDropzone({ label, icon, file, onFile, small }) {
  const [drag, setDrag] = useState(false);
  const id = `fi-${label.replace(/\W/g, "")}`;
  const onDrop = useCallback((e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }, [onFile]);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={onDrop} onClick={() => document.getElementById(id).click()}
      style={{
        border: `2px dashed ${drag ? C.accent : file ? C.accent : "#1c2840"}`,
        borderRadius: 10, padding: small ? "12px" : "18px 14px", textAlign: "center", cursor: "pointer",
        background: file ? "rgba(0,229,160,0.03)" : C.bg, transition: "all 0.2s", flex: 1
      }}>
      <input id={id} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: "none" }}
        onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      {!small && <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>}
      <div style={{ fontSize: 11, color: file ? C.accent : C.dim, fontWeight: 600 }}>
        {file ? `✓ ${file.name.length > 22 ? file.name.slice(0, 20) + "…" : file.name}` : label}
      </div>
      {!small && <div style={{ fontSize: 10, color: "#2a3a50", marginTop: 2 }}>PDF · DOCX · TXT</div>}
    </div>
  );
}

// ── CandidateCard (in comparison view) ────────────────────────────────────
function CandidateCard({ r, rank, onView, onRemove }) {
  const vc = verdictColor(r.fitVerdict);
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
  return (
    <div style={{
      background: C.card, borderRadius: 14,
      border: `1px solid ${rank === 1 ? C.accent + "55" : C.border}`,
      padding: 20, position: "relative", transition: "transform 0.2s",
    }}>
      {rank <= 3 && (
        <div style={{ position: "absolute", top: -10, left: 16, fontSize: 20 }}>{medal}</div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 16, fontWeight: 700, marginTop: 8 }}>{r.candidateName}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{r.roleApplied}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <ScoreRing score={r.overallScore} size={72} />
          <Badge text={r.fitVerdict} color={vc} />
        </div>
      </div>
      <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.55, margin: "0 0 14px" }}>{r.executiveSummary}</p>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        {r.salaryRange && <div style={{ fontSize: 11, color: C.dim }}>💰 <span style={{ color: C.text }}>{r.salaryRange}</span></div>}
        {r.noticePeriod && <div style={{ fontSize: 11, color: C.dim }}>⏱ <span style={{ color: C.text }}>{r.noticePeriod}</span></div>}
      </div>
      <div style={{ marginBottom: 14 }}>
        {r.dimensions?.slice(0, 3).map(d => <DimBar key={d.name} name={d.name} score={d.score} />)}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onView(r)} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: C.accent, color: "#080d18", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>View Full Report</button>
        <button onClick={() => onRemove(r.candidateName)} style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontSize: 12, cursor: "pointer" }}>✕</button>
      </div>
    </div>
  );
}

// ── Full detail modal ──────────────────────────────────────────────────────
function DetailModal({ r, onClose }) {
  const [tab, setTab] = useState("score");
  const tabs = ["score", "dimensions", "insights", "interview"];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, width: "100%", maxWidth: 700, maxHeight: "90vh", overflow: "auto", padding: 28 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ScoreRing score={r.overallScore} size={80} />
            <div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 700 }}>{r.candidateName}</div>
              <div style={{ fontSize: 12, color: C.dim }}>{r.roleApplied}</div>
              <div style={{ marginTop: 6 }}><Badge text={r.fitVerdict} color={verdictColor(r.fitVerdict)} /></div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.muted, borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 13 }}>✕ Close</button>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
              background: tab === t ? "#1c2840" : "transparent", color: tab === t ? C.accent : C.dim,
              borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent", transition: "all 0.15s"
            }}>{t === "score" ? "📊 Scorecard" : t === "dimensions" ? "📐 Dimensions" : t === "insights" ? "💡 Insights" : "🎯 Interview Qs"}</button>
          ))}
        </div>
        {tab === "score" && (
          <div>
            <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 16 }}>{r.executiveSummary}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[{ label: "✅ Strengths", items: r.strengths, color: C.accent, bg: "rgba(0,229,160,0.05)" },
                { label: "⚠️ Gaps", items: r.gaps, color: C.yellow, bg: "rgba(245,200,66,0.05)" }
              ].map(({ label, items, color, bg }) => (
                <div key={label} style={{ background: C.bg, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 700 }}>{label}</div>
                  {items?.map((s, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, background: bg, borderRadius: 7, padding: "7px 10px" }}>
                      <span style={{ color, flexShrink: 0 }}>→</span>
                      <span style={{ fontSize: 12, color: C.muted }}>{s}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            {r.redFlags?.length > 0 && (
              <div style={{ marginTop: 14, background: C.bg, borderRadius: 12, padding: 16, border: "1px solid #2a1515" }}>
                <div style={{ fontSize: 11, color: C.red, marginBottom: 10, fontWeight: 700 }}>🚩 Red Flags</div>
                {r.redFlags.map((f, i) => (
                  <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, background: "rgba(255,92,92,0.05)", borderRadius: 7, padding: "7px 10px" }}>
                    <span style={{ color: C.red }}>!</span><span style={{ fontSize: 12, color: C.muted }}>{f}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {tab === "dimensions" && r.dimensions?.map(d => <DimBar key={d.name} {...d} />)}
        {tab === "insights" && (
          <div>
            <div style={{ background: "rgba(0,229,160,0.05)", border: `1px solid rgba(0,229,160,0.2)`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
              <p style={{ fontSize: 13, color: C.text, lineHeight: 1.8, margin: 0 }}>{r.recommendation}</p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[["SCORE", `${r.overallScore}%`, C.accent], ["VERDICT", r.fitVerdict, C.yellow],
                ["SALARY", r.salaryRange || "—", C.text], ["NOTICE", r.noticePeriod || "—", C.text]
              ].map(([l, v, c]) => (
                <div key={l} style={{ background: C.bg, borderRadius: 10, padding: "12px 16px", flex: 1, minWidth: 100 }}>
                  <div style={{ fontSize: 10, color: C.dim, marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "interview" && r.interviewQuestions?.map((q, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", marginBottom: 10, background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <span style={{ background: "rgba(0,229,160,0.15)", color: C.accent, width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>Q{i + 1}</span>
            <span style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{q}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Comparison table ───────────────────────────────────────────────────────
function CompareTable({ results }) {
  const dims = results[0]?.dimensions?.map(d => d.name) || [];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "10px 14px", color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}`, minWidth: 140 }}>Dimension</th>
            {results.map(r => (
              <th key={r.candidateName} style={{ textAlign: "center", padding: "10px 14px", color: C.text, fontWeight: 700, borderBottom: `1px solid ${C.border}`, minWidth: 120 }}>
                {r.candidateName.split(" ")[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: "rgba(0,229,160,0.04)" }}>
            <td style={{ padding: "10px 14px", color: C.muted, fontWeight: 700 }}>Overall Score</td>
            {results.map(r => {
              const best = Math.max(...results.map(x => x.overallScore));
              return (
                <td key={r.candidateName} style={{ textAlign: "center", padding: "10px 14px" }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 800, fontSize: 15, color: r.overallScore === best ? C.accent : C.text }}>{r.overallScore}</span>
                </td>
              );
            })}
          </tr>
          {dims.map(dim => (
            <tr key={dim} style={{ borderBottom: `1px solid ${C.border}22` }}>
              <td style={{ padding: "9px 14px", color: C.muted }}>{dim}</td>
              {results.map(r => {
                const d = r.dimensions?.find(x => x.name === dim);
                const best = Math.max(...results.map(x => x.dimensions?.find(y => y.name === dim)?.score || 0));
                const score = d?.score || 0;
                const color = score >= 75 ? C.accent : score >= 55 ? C.yellow : C.red;
                return (
                  <td key={r.candidateName} style={{ textAlign: "center", padding: "9px 14px" }}>
                    <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: score === best ? color : C.muted }}>{score}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Add Candidate panel ────────────────────────────────────────────────────
function AddCandidatePanel({ jdData, jdText, inputMode, onAdded }) {
  const [cvFile, setCvFile] = useState(null);
  const [cvText, setCvText] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const canRun = inputMode === "file" ? !!cvFile : !!cvText.trim();

async function assess() {
    setLoading(true); setErr(null);
    try {
      let cvData;
      if (inputMode === "file") cvData = await extractText(cvFile);
      else cvData = { type: "text", content: cvText, name: "Candidate CV" };

      const content = buildMessages(jdData || { type: "text", content: jdText, name: "JD" }, cvData, notes);
      const result = await window.TalentLensRuntime.generateJson({ model: MODEL, parts: content, maxTokens: 8000 });
      onAdded(result);
      setCvFile(null); setCvText(""); setNotes("");
    } catch (e) { setErr("Failed: " + e.message); }
    setLoading(false);
  }

  return (
    <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, fontWeight: 700 }}>➕ ADD CANDIDATE CV</div>
      {inputMode === "file" ? (
        <FileDropzone label="Drop Candidate CV" icon="👤" file={cvFile} onFile={setCvFile} small />
      ) : (
        <textarea value={cvText} onChange={e => setCvText(e.target.value)} placeholder="Paste candidate CV here..."
          style={{ width: "100%", height: 100, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: 10, fontSize: 12, resize: "none", outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans',sans-serif" }} />
      )}
      <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)..."
        style={{ width: "100%", marginTop: 10, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: "8px 12px", fontSize: 12, outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans',sans-serif" }} />
      <button onClick={assess} disabled={!canRun || loading} style={{
        marginTop: 12, width: "100%", padding: "10px", borderRadius: 8, border: "none",
        background: canRun && !loading ? "linear-gradient(135deg,#00e5a0,#0077ff)" : "#1c2840",
        color: canRun && !loading ? "#080d18" : C.dim, fontSize: 12, fontWeight: 700, cursor: canRun && !loading ? "pointer" : "not-allowed"
      }}>
        {loading ? "⏳ Assessing…" : "⚡ Assess & Add"}
      </button>
      {err && <div style={{ marginTop: 8, color: C.red, fontSize: 11 }}>{err}</div>}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────
function App() {
  const [view, setView] = useState("setup"); // setup | compare
  const [inputMode, setInputMode] = useState("file");
  const [jdFile, setJdFile] = useState(null);
  const [jdText, setJdText] = useState("");
  const [jdData, setJdData] = useState(null);
  const [results, setResults] = useState([]);
  const [detail, setDetail] = useState(null);
  const [jdLoading, setJdLoading] = useState(false);
  const [compView, setCompView] = useState("cards"); // cards | table

  async function lockJD() {
    setJdLoading(true);
    if (inputMode === "file" && jdFile) {
      const d = await extractText(jdFile);
      setJdData(d);
    } else {
      setJdData(null); // will use jdText inline
    }
    setJdLoading(false);
    setView("compare");
  }

  const sorted = [...results].sort((a, b) => b.overallScore - a.overallScore);

  const canLock = inputMode === "file" ? !!jdFile : !!jdText.trim();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans',sans-serif", color: C.text, paddingBottom: 60 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;700&family=DM+Sans:wght@300;400;600;700&family=Fraunces:wght@700&display=swap" rel="stylesheet" />

      {detail && <DetailModal r={detail} onClose={() => setDetail(null)} />}

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "16px 28px", display: "flex", alignItems: "center", gap: 14, background: "rgba(8,13,24,0.97)", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#00e5a0,#0077ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
        <div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 700 }}>TalentLens</div>
          <div style={{ fontSize: 9, color: C.dim, letterSpacing: "1.5px", textTransform: "uppercase" }}>AI Candidate Assessment & Comparison</div>
        </div>
        {view === "compare" && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.muted }}>{results.length} candidate{results.length !== 1 ? "s" : ""}</span>
            <button onClick={() => { setView("setup"); setResults([]); setJdFile(null); setJdText(""); setJdData(null); }}
              style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 11, cursor: "pointer" }}>
              ← New Session
            </button>
          </div>
        )}
        {view === "setup" && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {["file", "text"].map(m => (
              <button key={m} onClick={() => setInputMode(m)} style={{
                padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                background: inputMode === m ? C.accent : "#1c2840", color: inputMode === m ? "#080d18" : C.dim
              }}>{m === "file" ? "📁 Upload" : "✏️ Paste"}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>

        {/* ── SETUP STEP ── */}
        {view === "setup" && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Start a Comparison Session</div>
              <div style={{ color: C.muted, fontSize: 14 }}>Set the Job Description once, then assess unlimited candidates against it</div>
            </div>
            <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 28 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, fontWeight: 700, letterSpacing: "0.5px" }}>STEP 1 — JOB DESCRIPTION</div>
              {inputMode === "file" ? (
                <FileDropzone label="Upload Job Description (PDF / DOCX / TXT)" icon="📋" file={jdFile} onFile={setJdFile} />
              ) : (
                <textarea value={jdText} onChange={e => setJdText(e.target.value)} placeholder="Paste the full job description here..."
                  style={{ width: "100%", height: 180, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: 12, fontSize: 12, resize: "vertical", outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" }} />
              )}
              <button onClick={lockJD} disabled={!canLock || jdLoading} style={{
                marginTop: 20, width: "100%", padding: 14, borderRadius: 12, border: "none",
                background: canLock && !jdLoading ? "linear-gradient(135deg,#00e5a0,#0077ff)" : "#1c2840",
                color: canLock && !jdLoading ? "#080d18" : C.dim, fontSize: 14, fontWeight: 700,
                cursor: canLock && !jdLoading ? "pointer" : "not-allowed"
              }}>
                {jdLoading ? "Processing…" : "Continue → Add Candidates"}
              </button>
            </div>
          </div>
        )}

        {/* ── COMPARE VIEW ── */}
        {view === "compare" && (
          <div>
            {/* Top bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 700 }}>Candidate Comparison</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>Ranked by AI fit score · Highest first</div>
              </div>
              {results.length >= 2 && (
                <div style={{ display: "flex", gap: 6 }}>
                  {["cards", "table"].map(v => (
                    <button key={v} onClick={() => setCompView(v)} style={{
                      padding: "6px 16px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      background: compView === v ? C.accent : "transparent", color: compView === v ? "#080d18" : C.muted
                    }}>{v === "cards" ? "🃏 Cards" : "📊 Table"}</button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: results.length > 0 ? "1fr 320px" : "1fr", gap: 20, alignItems: "start" }}>
              {/* Left: results */}
              <div>
                {results.length === 0 && (
                  <div style={{ background: C.card, borderRadius: 14, border: `2px dashed ${C.border}`, padding: 48, textAlign: "center" }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>👥</div>
                    <div style={{ color: C.muted, fontSize: 14 }}>Add your first candidate CV using the panel →</div>
                  </div>
                )}
                {results.length > 0 && compView === "cards" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                    {sorted.map((r, i) => (
                      <CandidateCard key={r.candidateName} r={r} rank={i + 1}
                        onView={setDetail}
                        onRemove={(name) => setResults(prev => prev.filter(x => x.candidateName !== name))} />
                    ))}
                  </div>
                )}
                {results.length >= 2 && compView === "table" && (
                  <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20, overflowX: "auto" }}>
                    <CompareTable results={sorted} />
                  </div>
                )}
              </div>

              {/* Right: add panel */}
              <div style={{ position: "sticky", top: 80 }}>
                <AddCandidatePanel
                  jdData={jdData}
                  jdText={jdText}
                  inputMode={inputMode}
                  onAdded={(r) => setResults(prev => {
                    const exists = prev.find(x => x.candidateName === r.candidateName);
                    return exists ? prev.map(x => x.candidateName === r.candidateName ? r : x) : [...prev, r];
                  })}
                />
                {results.length >= 2 && (
                  <div style={{ marginTop: 16, background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 700 }}>🏆 CURRENT RANKING</div>
                    {sorted.map((r, i) => (
                      <div key={r.candidateName} onClick={() => setDetail(r)} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "8px 10px", marginBottom: 6, borderRadius: 8,
                        background: i === 0 ? "rgba(0,229,160,0.07)" : "transparent",
                        border: `1px solid ${i === 0 ? C.accent + "33" : C.border}`,
                        cursor: "pointer"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14 }}>{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.candidateName.split(" ")[0]}</span>
                        </div>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 800, color: verdictColor(r.fitVerdict) }}>{r.overallScore}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

window.TalentLensApp = App;
