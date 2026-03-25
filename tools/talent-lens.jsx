import { useState, useCallback } from "react";
import * as mammoth from "mammoth";

const MODEL = "claude-sonnet-4-20250514";

const C = {
  bg: "#080d18", card: "#0f1623", card2: "#121b2e", border: "#1c2840",
  accent: "#00e5a0", yellow: "#f5c842", red: "#ff5c5c", blue: "#4d9de0",
  text: "#e2e8f0", muted: "#8892a4", dim: "#4a5568"
};

// ── File extraction ──────────────────────────────────────────────────────
async function extractText(file) {
  const n = file.name.toLowerCase();
  if (n.endsWith(".pdf")) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = e => res({ type: "pdf", base64: e.target.result.split(",")[1], name: file.name });
      r.readAsDataURL(file);
    });
  } else if (n.endsWith(".docx") || n.endsWith(".doc")) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = async e => {
        try { const out = await mammoth.extractRawText({ arrayBuffer: e.target.result }); res({ type: "text", content: out.value, name: file.name }); }
        catch (err) { rej(err); }
      };
      r.readAsArrayBuffer(file);
    });
  } else {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = e => res({ type: "text", content: e.target.result, name: file.name });
      r.readAsText(file);
    });
  }
}

function buildContent(jdData, cvData, notes) {
  const parts = [];
  const add = (label, d) => {
    if (!d) return;
    if (d.type === "pdf") {
      parts.push({ type: "text", text: `--- ${label} (${d.name}) ---` });
      parts.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: d.base64 } });
    } else {
      parts.push({ type: "text", text: `--- ${label} ---\n${d.content}` });
    }
  };
  add("JOB DESCRIPTION", jdData);
  add("CANDIDATE CV", cvData);
  if (notes) parts.push({ type: "text", text: `--- NOTES ---\n${notes}` });
  parts.push({ type: "text", text: `You are a senior recruitment consultant. Analyse CV vs JD. Return ONLY valid JSON, no markdown, no preamble:
{"candidateName":"string","roleApplied":"string","overallScore":number,"fitVerdict":"Strong Fit"|"Good Fit"|"Partial Fit"|"Weak Fit","executiveSummary":"string","dimensions":[{"name":"Technical Skills","score":number,"comment":"string"},{"name":"Experience Level","score":number,"comment":"string"},{"name":"Industry Background","score":number,"comment":"string"},{"name":"Career Trajectory","score":number,"comment":"string"},{"name":"Education & Certs","score":number,"comment":"string"}],"strengths":["string","string","string"],"gaps":["string","string"],"redFlags":["string"],"interviewQuestions":["string","string","string","string","string"],"salaryRange":"string","noticePeriod":"string","recommendation":"string"}` });
  return parts;
}

async function assessCandidate(jdData, cvData, notes) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: "user", content: buildContent(jdData, cvData, notes) }] })
  });
  const data = await resp.json();
  const raw = data.content.map(b => b.text || "").join("");
  return JSON.parse(raw.replace(/```json|```/g, "").trim());
}

// ── Helpers ──────────────────────────────────────────────────────────────
function verdictColor(v) {
  if (!v) return C.blue;
  if (v.includes("Strong") || v.includes("Good")) return C.accent;
  if (v.includes("Partial")) return C.yellow;
  return C.red;
}
function scoreColor(s) { return s >= 75 ? C.accent : s >= 55 ? C.yellow : C.red; }
const MEDALS = ["🥇", "🥈", "🥉"];

// ── ScoreRing ────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 100 }) {
  const r = size * 0.38, circ = 2 * Math.PI * r, fill = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1c2840" strokeWidth="7" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dasharray 1.2s ease" }} />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fill={color} fontSize={size * 0.21} fontWeight="800" fontFamily="'DM Mono',monospace">{score}</text>
      <text x={size / 2} y={size / 2 + 11} textAnchor="middle" fill={C.muted} fontSize={size * 0.09} fontFamily="'DM Sans',sans-serif">/ 100</text>
    </svg>
  );
}

function Badge({ text, color }) {
  return <span style={{ background: `${color}18`, color, border: `1px solid ${color}40`, borderRadius: 20, padding: "2px 9px", fontSize: 10, fontWeight: 700, fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>{text}</span>;
}

function DimBar({ name, score, comment }) {
  const color = scoreColor(score);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: C.muted }}>{name}</span>
        <span style={{ fontSize: 11, color, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>{score}</span>
      </div>
      <div style={{ background: "#1c2840", borderRadius: 3, height: 5 }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 3, transition: "width 1s ease" }} />
      </div>
      {comment && <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{comment}</div>}
    </div>
  );
}

// ── FileDropzone ─────────────────────────────────────────────────────────
function FileDropzone({ label, icon, file, onFile, compact }) {
  const [drag, setDrag] = useState(false);
  const id = `fi${label.replace(/\W/g, "")}`;
  const drop = useCallback(e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) onFile(f); }, [onFile]);
  return (
    <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={drop} onClick={() => document.getElementById(id).click()}
      style={{
        border: `2px dashed ${drag ? C.accent : file ? C.accent : C.border}`,
        borderRadius: 10, padding: compact ? "10px 12px" : "18px 14px",
        textAlign: "center", cursor: "pointer", flex: 1,
        background: file ? "rgba(0,229,160,0.04)" : C.bg, transition: "all 0.2s"
      }}>
      <input id={id} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: "none" }}
        onChange={e => e.target.files[0] && onFile(e.target.files[0])} />
      {!compact && <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>}
      <div style={{ fontSize: 11, color: file ? C.accent : C.dim, fontWeight: 600 }}>
        {file ? `✓ ${file.name.length > 24 ? file.name.slice(0, 22) + "…" : file.name}` : label}
      </div>
      {!compact && <div style={{ fontSize: 9, color: "#1e3050", marginTop: 2 }}>PDF · DOCX · TXT</div>}
    </div>
  );
}

// ── Candidate Card (in comparison grid) ──────────────────────────────────
function CandidateCard({ r, rank, onView, onRemove }) {
  const vc = verdictColor(r.fitVerdict);
  return (
    <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${rank === 1 ? C.accent + "44" : C.border}`, padding: 20, position: "relative", transition: "transform 0.15s", cursor: "pointer" }}
      onClick={() => onView(r)}>
      {rank <= 3 && (
        <div style={{ position: "absolute", top: -10, left: 14, fontSize: 20 }}>{MEDALS[rank - 1]}</div>
      )}
      <button onClick={e => { e.stopPropagation(); onRemove(r.candidateName); }}
        style={{ position: "absolute", top: 10, right: 12, background: "transparent", border: "none", color: C.dim, cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 4 }}>
        <ScoreRing score={r.overallScore} size={80} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: C.text, fontFamily: "'Fraunces',serif" }}>{r.candidateName}</div>
          <Badge text={r.fitVerdict} color={vc} />
          <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>💰 {r.salaryRange || "—"}</div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>⏱ {r.noticePeriod || "—"}</div>
        </div>
      </div>
      <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
        {r.dimensions?.slice(0, 3).map(d => (
          <div key={d.name} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: C.muted }}>{d.name}</span>
            <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", fontWeight: 700, color: scoreColor(d.score) }}>{d.score}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: C.blue, textAlign: "right" }}>View full report →</div>
    </div>
  );
}

// ── Compare Table ─────────────────────────────────────────────────────────
function CompareTable({ results, onView }) {
  const dims = ["Technical Skills", "Experience Level", "Industry Background", "Career Trajectory", "Education & Certs"];
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "10px 12px", color: C.muted, fontWeight: 600, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>Dimension</th>
            {results.map((r, i) => (
              <th key={r.candidateName} style={{ textAlign: "center", padding: "10px 12px", color: i === 0 ? C.accent : C.text, fontWeight: 700, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap", cursor: "pointer" }}
                onClick={() => onView(r)}>
                {MEDALS[i] || `#${i + 1}`} {r.candidateName.split(" ")[0]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr style={{ background: "rgba(0,229,160,0.04)" }}>
            <td style={{ padding: "10px 12px", color: C.muted, fontWeight: 700 }}>Overall Score</td>
            {results.map(r => (
              <td key={r.candidateName} style={{ textAlign: "center", padding: "10px 12px" }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 800, color: scoreColor(r.overallScore) }}>{r.overallScore}</span>
              </td>
            ))}
          </tr>
          <tr>
            <td style={{ padding: "8px 12px", color: C.muted }}>Verdict</td>
            {results.map(r => (
              <td key={r.candidateName} style={{ textAlign: "center", padding: "8px 12px" }}>
                <Badge text={r.fitVerdict} color={verdictColor(r.fitVerdict)} />
              </td>
            ))}
          </tr>
          {dims.map((dim, di) => {
            const best = Math.max(...results.map(r => r.dimensions?.[di]?.score || 0));
            return (
              <tr key={dim} style={{ background: di % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                <td style={{ padding: "8px 12px", color: C.muted }}>{dim}</td>
                {results.map(r => {
                  const sc = r.dimensions?.[di]?.score || 0;
                  return (
                    <td key={r.candidateName} style={{ textAlign: "center", padding: "8px 12px" }}>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: sc === best ? C.accent : scoreColor(sc), fontSize: sc === best ? 14 : 12 }}>
                        {sc}{sc === best && results.length > 1 ? " ★" : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr style={{ borderTop: `1px solid ${C.border}` }}>
            <td style={{ padding: "8px 12px", color: C.muted }}>Salary Range</td>
            {results.map(r => <td key={r.candidateName} style={{ textAlign: "center", padding: "8px 12px", fontSize: 11, color: C.muted }}>{r.salaryRange || "—"}</td>)}
          </tr>
          <tr>
            <td style={{ padding: "8px 12px", color: C.muted }}>Notice Period</td>
            {results.map(r => <td key={r.candidateName} style={{ textAlign: "center", padding: "8px 12px", fontSize: 11, color: C.muted }}>{r.noticePeriod || "—"}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Add Candidate Panel ───────────────────────────────────────────────────
function AddCandidatePanel({ jdData, jdText, inputMode, onAdded }) {
  const [cvFile, setCvFile] = useState(null);
  const [cvText, setCvText] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  const canRun = inputMode === "file" ? !!cvFile : !!cvText.trim();

  async function run() {
    setLoading(true); setErr(null);
    try {
      const jd = jdData || { type: "text", content: jdText, name: "JD" };
      const cv = inputMode === "file" ? await extractText(cvFile) : { type: "text", content: cvText, name: "CV" };
      const result = await assessCandidate(jd, cv, notes);
      onAdded(result);
      setCvFile(null); setCvText(""); setNotes("");
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 20 }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, fontWeight: 700, letterSpacing: "0.5px" }}>➕ ADD CANDIDATE</div>
      {inputMode === "file" ? (
        <FileDropzone label="Upload CV (PDF / DOCX / TXT)" icon="👤" file={cvFile} onFile={setCvFile} compact />
      ) : (
        <textarea value={cvText} onChange={e => setCvText(e.target.value)} placeholder="Paste candidate CV..."
          style={{ width: "100%", height: 120, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: 10, fontSize: 11, resize: "vertical", outline: "none", fontFamily: "'DM Sans',sans-serif", boxSizing: "border-box" }} />
      )}
      <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)…"
        style={{ width: "100%", height: 48, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: 10, fontSize: 11, resize: "none", outline: "none", fontFamily: "'DM Sans',sans-serif", marginTop: 10, boxSizing: "border-box" }} />
      <button onClick={run} disabled={!canRun || loading} style={{
        marginTop: 12, width: "100%", padding: "11px", borderRadius: 10, border: "none",
        background: canRun && !loading ? "linear-gradient(135deg,#00e5a0,#0077ff)" : "#1c2840",
        color: canRun && !loading ? "#080d18" : C.dim,
        fontSize: 13, fontWeight: 700, cursor: canRun && !loading ? "pointer" : "not-allowed"
      }}>
        {loading ? "⏳ Assessing…" : "⚡ Assess & Add"}
      </button>
      {err && <div style={{ marginTop: 8, color: C.red, fontSize: 11 }}>{err}</div>}
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────
function DetailModal({ r, onClose }) {
  const [tab, setTab] = useState("score");
  const tabs = [["score", "📊 Scorecard"], ["dims", "📐 Dimensions"], ["insights", "💡 Insights"], ["qs", "🎯 Interview Qs"]];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, width: "100%", maxWidth: 640, maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div style={{ padding: "20px 24px 0", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <ScoreRing score={r.overallScore} size={80} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 700 }}>{r.candidateName}</div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{r.roleApplied}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                <Badge text={r.fitVerdict} color={verdictColor(r.fitVerdict)} />
                {r.salaryRange && <Badge text={`💰 ${r.salaryRange}`} color={C.blue} />}
                {r.noticePeriod && <Badge text={`⏱ ${r.noticePeriod}`} color={C.muted} />}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "transparent", border: "none", color: C.muted, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            {tabs.map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding: "7px 14px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                background: tab === k ? C.bg : "transparent", color: tab === k ? C.accent : C.muted,
                borderBottom: tab === k ? `2px solid ${C.accent}` : "2px solid transparent"
              }}>{label}</button>
            ))}
          </div>
        </div>
        {/* Modal body */}
        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
          {tab === "score" && (
            <div>
              <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 20 }}>{r.executiveSummary}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: C.bg, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 700 }}>✅ STRENGTHS</div>
                  {r.strengths?.map((s, i) => <div key={i} style={{ fontSize: 12, color: C.text, marginBottom: 7, paddingLeft: 10, borderLeft: `2px solid ${C.accent}` }}>{s}</div>)}
                </div>
                <div style={{ background: C.bg, borderRadius: 12, padding: 16 }}>
                  <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 700 }}>⚠️ GAPS</div>
                  {r.gaps?.map((g, i) => <div key={i} style={{ fontSize: 12, color: C.text, marginBottom: 7, paddingLeft: 10, borderLeft: `2px solid ${C.yellow}` }}>{g}</div>)}
                </div>
              </div>
              {r.redFlags?.length > 0 && (
                <div style={{ background: "rgba(255,92,92,0.06)", border: `1px solid ${C.red}33`, borderRadius: 12, padding: 16, marginTop: 14 }}>
                  <div style={{ fontSize: 11, color: C.red, marginBottom: 10, fontWeight: 700 }}>🚩 RED FLAGS</div>
                  {r.redFlags.map((f, i) => <div key={i} style={{ fontSize: 12, color: C.text, marginBottom: 6 }}>• {f}</div>)}
                </div>
              )}
            </div>
          )}
          {tab === "dims" && r.dimensions?.map(d => <DimBar key={d.name} {...d} />)}
          {tab === "insights" && (
            <div>
              <div style={{ background: "rgba(0,229,160,0.06)", border: `1px solid ${C.accent}30`, borderRadius: 12, padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: C.accent, marginBottom: 8, fontWeight: 700 }}>RECOMMENDATION</div>
                <p style={{ fontSize: 13, color: C.text, lineHeight: 1.7, margin: 0 }}>{r.recommendation}</p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[["Overall Score", `${r.overallScore}/100`, scoreColor(r.overallScore)], ["Verdict", r.fitVerdict, verdictColor(r.fitVerdict)], ["Salary", r.salaryRange || "—", C.blue], ["Notice", r.noticePeriod || "—", C.muted]].map(([l, v, c]) => (
                  <div key={l} style={{ background: C.bg, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9, color: C.dim, marginBottom: 4, letterSpacing: "1px" }}>{l.toUpperCase()}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "qs" && r.interviewQuestions?.map((q, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", marginBottom: 10, background: C.bg, borderRadius: 10 }}>
              <span style={{ background: `${C.accent}20`, color: C.accent, width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>Q{i + 1}</span>
              <span style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{q}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("setup"); // setup | compare
  const [inputMode, setInputMode] = useState("file");
  const [jdFile, setJdFile] = useState(null);
  const [jdText, setJdText] = useState("");
  const [jdData, setJdData] = useState(null);
  const [jdLoading, setJdLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [detail, setDetail] = useState(null);
  const [compView, setCompView] = useState("cards");

  const sorted = [...results].sort((a, b) => b.overallScore - a.overallScore);
  const canLock = inputMode === "file" ? !!jdFile : !!jdText.trim();

  async function lockJD() {
    setJdLoading(true);
    try {
      if (inputMode === "file") { const d = await extractText(jdFile); setJdData(d); }
      else setJdData(null);
      setView("compare");
    } catch (e) { alert("Error processing JD: " + e.message); }
    setJdLoading(false);
  }

  function reset() { setView("setup"); setResults([]); setJdFile(null); setJdText(""); setJdData(null); setCompView("cards"); }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans',sans-serif", color: C.text, paddingBottom: 60 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;700&family=DM+Sans:wght@300;400;600;700&family=Fraunces:wght@700&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box}@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}} textarea:focus,button:focus{outline:none}`}</style>

      {detail && <DetailModal r={detail} onClose={() => setDetail(null)} />}

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "15px 28px", display: "flex", alignItems: "center", gap: 14, background: "rgba(8,13,24,0.97)", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#00e5a0,#0077ff)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>⚡</div>
        <div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: 17, fontWeight: 700 }}>TalentLens</div>
          <div style={{ fontSize: 9, color: C.dim, letterSpacing: "1.5px", textTransform: "uppercase" }}>AI Candidate Assessment & Comparison</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {view === "compare" && (
            <>
              <span style={{ fontSize: 12, color: C.muted }}>{results.length} candidate{results.length !== 1 ? "s" : ""} assessed</span>
              <button onClick={reset} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 11, cursor: "pointer" }}>← New Session</button>
            </>
          )}
          {view === "setup" && ["file", "text"].map(m => (
            <button key={m} onClick={() => setInputMode(m)} style={{ padding: "5px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, background: inputMode === m ? C.accent : "#1c2840", color: inputMode === m ? "#080d18" : C.dim }}>
              {m === "file" ? "📁 Upload" : "✏️ Paste"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>

        {/* ── SETUP ── */}
        {view === "setup" && (
          <div style={{ maxWidth: 580, margin: "0 auto", animation: "fadeUp 0.4s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 700, marginBottom: 10 }}>Start a Comparison Session</div>
              <div style={{ color: C.muted, fontSize: 14, lineHeight: 1.6 }}>Upload the Job Description once — then assess as many<br />candidates as you like and rank them side by side.</div>
            </div>
            <div style={{ background: C.card, borderRadius: 18, border: `1px solid ${C.border}`, padding: 30 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16, fontWeight: 700, letterSpacing: "0.5px" }}>STEP 1 OF 2 — JOB DESCRIPTION</div>
              {inputMode === "file" ? (
                <FileDropzone label="Upload Job Description (PDF / DOCX / TXT)" icon="📋" file={jdFile} onFile={setJdFile} />
              ) : (
                <textarea value={jdText} onChange={e => setJdText(e.target.value)} placeholder="Paste the full job description here..."
                  style={{ width: "100%", height: 200, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, padding: 14, fontSize: 12, resize: "vertical", outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
              )}
              <div style={{ display: "flex", gap: 10, marginTop: 16, padding: "12px 14px", background: "rgba(0,229,160,0.05)", borderRadius: 10, border: `1px solid ${C.accent}22` }}>
                <span style={{ fontSize: 18 }}>💡</span>
                <span style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>Once you set the JD, you can keep adding candidate CVs one by one and compare all their scores in a live leaderboard.</span>
              </div>
              <button onClick={lockJD} disabled={!canLock || jdLoading} style={{
                marginTop: 18, width: "100%", padding: 14, borderRadius: 12, border: "none",
                background: canLock && !jdLoading ? "linear-gradient(135deg,#00e5a0,#0077ff)" : "#1c2840",
                color: canLock && !jdLoading ? "#080d18" : C.dim, fontSize: 14, fontWeight: 700,
                cursor: canLock && !jdLoading ? "pointer" : "not-allowed", transition: "all 0.2s"
              }}>
                {jdLoading ? "Processing…" : "Continue → Add Candidates ⚡"}
              </button>
            </div>
          </div>
        )}

        {/* ── COMPARE VIEW ── */}
        {view === "compare" && (
          <div style={{ animation: "fadeUp 0.4s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 700 }}>Candidate Leaderboard</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 2 }}>Ranked by AI fit score · Highest first · Click any card for full report</div>
              </div>
              {results.length >= 2 && (
                <div style={{ display: "flex", gap: 6 }}>
                  {[["cards", "🃏 Cards"], ["table", "📊 Table"]].map(([v, l]) => (
                    <button key={v} onClick={() => setCompView(v)} style={{
                      padding: "7px 16px", borderRadius: 8, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 12, fontWeight: 600,
                      background: compView === v ? C.accent : "transparent", color: compView === v ? "#080d18" : C.muted
                    }}>{l}</button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 22, alignItems: "start" }}>
              {/* Left: results area */}
              <div>
                {results.length === 0 && (
                  <div style={{ background: C.card, borderRadius: 14, border: `2px dashed ${C.border}`, padding: 60, textAlign: "center" }}>
                    <div style={{ fontSize: 40, marginBottom: 14 }}>👥</div>
                    <div style={{ color: C.muted, fontSize: 14 }}>Add your first candidate CV using the panel on the right</div>
                  </div>
                )}

                {results.length > 0 && compView === "cards" && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16 }}>
                    {sorted.map((r, i) => (
                      <div key={r.candidateName} style={{ animation: "fadeUp 0.4s ease" }}>
                        <CandidateCard r={r} rank={i + 1} onView={setDetail}
                          onRemove={name => setResults(prev => prev.filter(x => x.candidateName !== name))} />
                      </div>
                    ))}
                  </div>
                )}

                {results.length >= 2 && compView === "table" && (
                  <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 24 }}>
                    <CompareTable results={sorted} onView={setDetail} />
                  </div>
                )}
              </div>

              {/* Right: sticky panel */}
              <div style={{ position: "sticky", top: 76 }}>
                <AddCandidatePanel jdData={jdData} jdText={jdText} inputMode={inputMode}
                  onAdded={r => setResults(prev => {
                    const exists = prev.find(x => x.candidateName === r.candidateName);
                    return exists ? prev.map(x => x.candidateName === r.candidateName ? r : x) : [...prev, r];
                  })} />

                {results.length >= 2 && (
                  <div style={{ marginTop: 16, background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 18 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 12, fontWeight: 700, letterSpacing: "0.5px" }}>🏆 LIVE RANKING</div>
                    {sorted.map((r, i) => (
                      <div key={r.candidateName} onClick={() => setDetail(r)}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", marginBottom: 7, borderRadius: 9, cursor: "pointer", background: i === 0 ? "rgba(0,229,160,0.07)" : C.bg, border: `1px solid ${i === 0 ? C.accent + "33" : C.border}`, transition: "all 0.15s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ fontSize: 16 }}>{MEDALS[i] || `#${i + 1}`}</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.candidateName}</div>
                            <div style={{ fontSize: 10, color: C.dim }}>{r.fitVerdict}</div>
                          </div>
                        </div>
                        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 800, color: scoreColor(r.overallScore) }}>{r.overallScore}</span>
                      </div>
                    ))}
                  </div>
                )}

                {results.length >= 2 && (
                  <div style={{ marginTop: 12, background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 16 }}>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 700 }}>📊 SCORE DISTRIBUTION</div>
                    {sorted.map(r => (
                      <div key={r.candidateName} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: C.muted }}>{r.candidateName.split(" ")[0]}</span>
                          <span style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: scoreColor(r.overallScore) }}>{r.overallScore}</span>
                        </div>
                        <div style={{ background: "#1c2840", borderRadius: 3, height: 5 }}>
                          <div style={{ width: `${r.overallScore}%`, height: "100%", background: scoreColor(r.overallScore), borderRadius: 3, transition: "width 1s ease" }} />
                        </div>
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
