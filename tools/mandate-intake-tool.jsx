const { useState } = React;

const MODEL = "claude-sonnet-4-20250514";

const C = {
  bg: "#0c0f1a",
  surface: "#131929",
  card: "#1a2235",
  border: "#243050",
  borderHover: "#3a4f7a",
  accent: "#f0a500",
  accentDim: "rgba(240,165,0,0.12)",
  accentBorder: "rgba(240,165,0,0.35)",
  teal: "#00c2a8",
  tealDim: "rgba(0,194,168,0.1)",
  blue: "#4a9eff",
  blueDim: "rgba(74,158,255,0.1)",
  red: "#ff5f5f",
  green: "#3ecf8e",
  text: "#e8edf5",
  muted: "#7a8aaa",
  dim: "#3d4f6e",
};

const SAMPLE_BRIEF = `We are looking for a Senior React Developer for our fintech startup in Bangalore. The candidate should have 5-8 years of experience with React.js, TypeScript, and Node.js. They should have worked in a product-based company, preferably in banking or payments domain. 

Must have: React, Redux, TypeScript, REST APIs, Git
Good to have: GraphQL, AWS, Microservices

Budget is 25-40 LPA. We need someone who can join within 30 days. The role is hybrid (3 days from office). Team size is 12 engineers. They will report to the CTO.`;

async function parseMandate(briefText) {
  const prompt = `You are a senior recruitment consultant. Parse this client mandate brief and extract structured information. Return ONLY valid JSON, no markdown, no preamble:

BRIEF:
${briefText}

Return this exact JSON structure:
{
  "jobTitle": "string",
  "clientType": "Product" | "Service" | "Startup" | "MNC" | "Unknown",
  "location": "string",
  "workMode": "Remote" | "Hybrid" | "On-site" | "Not specified",
  "experienceMin": number or null,
  "experienceMax": number or null,
  "salaryMin": "string or null",
  "salaryMax": "string or null",
  "noticePeriod": "string or null",
  "teamSize": "string or null",
  "reportingTo": "string or null",
  "industry": "string",
  "mustHaveSkills": ["string"],
  "goodToHaveSkills": ["string"],
  "responsibilities": ["string"],
  "qualifications": ["string"],
  "structuredJD": "Full structured job description in 200-250 words as a readable paragraph",
  "sourcingKeywords": {
    "boolean": "string (LinkedIn/Naukri boolean search string)",
    "primary": ["string"],
    "secondary": ["string"],
    "exclude": ["string"]
  },
  "targetCompanies": ["string"],
  "candidatePersona": "2-3 sentence description of the ideal candidate profile",
  "pitchPoints": ["string (why a candidate would want this role)"],
  "redFlags": ["string (things to watch out for in screening)"],
  "urgency": "Low" | "Medium" | "High"
}`;

  return window.TalentLensRuntime.generateJson({
    model: MODEL,
    parts: [{ text: prompt }]
  });
}

// ── Chip ─────────────────────────────────────────────────────────────────
function Chip({ text, color = "blue", size = "md" }) {
  const palettes = {
    blue: { bg: "rgba(74,158,255,0.12)", text: "#4a9eff", border: "rgba(74,158,255,0.3)" },
    teal: { bg: "rgba(0,194,168,0.12)", text: "#00c2a8", border: "rgba(0,194,168,0.3)" },
    amber: { bg: "rgba(240,165,0,0.12)", text: "#f0a500", border: "rgba(240,165,0,0.35)" },
    red: { bg: "rgba(255,95,95,0.12)", text: "#ff5f5f", border: "rgba(255,95,95,0.3)" },
    green: { bg: "rgba(62,207,142,0.12)", text: "#3ecf8e", border: "rgba(62,207,142,0.3)" },
    gray: { bg: "rgba(122,138,170,0.1)", text: "#7a8aaa", border: "rgba(122,138,170,0.25)" },
  };
  const p = palettes[color] || palettes.blue;
  return (
    <span style={{
      background: p.bg, color: p.text, border: `1px solid ${p.border}`,
      borderRadius: 20, padding: size === "sm" ? "2px 8px" : "4px 12px",
      fontSize: size === "sm" ? 10 : 12, fontWeight: 600,
      fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap", display: "inline-block"
    }}>{text}</span>
  );
}

// ── Section ───────────────────────────────────────────────────────────────
function Section({ icon, title, children, accent }) {
  return (
    <div style={{
      background: C.card, borderRadius: 14,
      border: `1px solid ${accent ? C.accentBorder : C.border}`,
      padding: 20, marginBottom: 16
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: accent ? C.accent : C.muted, letterSpacing: "1px", textTransform: "uppercase" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// ── InfoRow ───────────────────────────────────────────────────────────────
function InfoRow({ label, value, color }) {
  if (!value && value !== 0) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.muted }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: color || C.text }}>{value}</span>
    </div>
  );
}

// ── Copy button ───────────────────────────────────────────────────────────
function CopyBtn({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ padding: "5px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: copied ? C.tealDim : "transparent", color: copied ? C.teal : C.muted, fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
      {copied ? "✓ Copied" : label}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
function App() {
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState("jd");

  async function handleParse() {
    if (!brief.trim()) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const parsed = await parseMandate(brief);
      setResult(parsed);
      setActiveView("jd");
    } catch (e) {
      setError("Failed to parse: " + e.message);
    }
    setLoading(false);
  }

  const urgencyColor = { "High": "red", "Medium": "amber", "Low": "green" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'DM Sans', sans-serif", color: C.text, paddingBottom: 60 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes spin{to{transform:rotate(360deg)}}textarea:focus,button:focus,input:focus{outline:none}textarea{font-family:'DM Sans',sans-serif !important}`}</style>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "18px 32px", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 12, background: C.accentDim, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
        <div>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 20, fontWeight: 400, letterSpacing: "-0.2px" }}>Client Mandate Intake</div>
          <div style={{ fontSize: 10, color: C.dim, letterSpacing: "1.5px", textTransform: "uppercase", marginTop: 1 }}>AI Brief Parser · JD Generator · Sourcing Engine</div>
        </div>
        {result && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Chip text={result.urgency + " Urgency"} color={urgencyColor[result.urgency] || "gray"} />
            <Chip text={result.clientType} color="blue" />
          </div>
        )}
      </div>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "28px 24px" }}>
        {/* Input Panel */}
        <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>Client Brief / Mandate</div>
            <button onClick={() => setBrief(SAMPLE_BRIEF)} style={{ fontSize: 11, color: C.teal, background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}>
              Load Sample Brief ↗
            </button>
          </div>
          <textarea
            value={brief}
            onChange={e => setBrief(e.target.value)}
            placeholder={`Paste your client brief here — emails, WhatsApp messages, call notes, anything. For example:\n\n"Looking for a React developer, 5+ years, Bangalore, 30L budget, product company, join in 1 month..."`}
            style={{
              width: "100%", height: 180, background: C.bg, border: `1px solid ${C.border}`,
              borderRadius: 10, color: C.text, padding: "14px 16px", fontSize: 13, lineHeight: 1.7,
              resize: "vertical"
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
            <div style={{ fontSize: 12, color: C.dim }}>{brief.length} characters · {brief.trim() ? brief.trim().split(/\s+/).length : 0} words</div>
            <button
              onClick={handleParse}
              disabled={!brief.trim() || loading}
              style={{
                padding: "12px 32px", borderRadius: 12, border: "none",
                background: brief.trim() && !loading ? `linear-gradient(135deg, ${C.accent}, #e08800)` : C.dim,
                color: brief.trim() && !loading ? "#0c0f1a" : "#3d4f6e",
                fontSize: 13, fontWeight: 800, cursor: brief.trim() && !loading ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", gap: 8
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: 14, height: 14, border: "2px solid #3d4f6e", borderTopColor: "#7a8aaa", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
                  Parsing Brief…
                </>
              ) : "⚡ Parse & Generate"}
            </button>
          </div>
          {error && <div style={{ marginTop: 10, color: C.red, fontSize: 12 }}>{error}</div>}
        </div>

        {/* Results */}
        {result && (
          <div style={{ animation: "fadeUp 0.5s ease" }}>

            {/* Top stats strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Role", value: result.jobTitle, color: C.accent },
                { label: "Location", value: result.location || "Not specified", color: C.text },
                { label: "Experience", value: result.experienceMin != null ? `${result.experienceMin}${result.experienceMax ? `–${result.experienceMax}` : "+"} yrs` : "Not specified", color: C.teal },
                { label: "Salary", value: result.salaryMin ? `${result.salaryMin}${result.salaryMax ? ` – ${result.salaryMax}` : "+"}` : "Not specified", color: C.green },
                { label: "Notice", value: result.noticePeriod || "Not specified", color: C.text },
                { label: "Work Mode", value: result.workMode, color: result.workMode === "Remote" ? C.teal : C.text },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "14px 16px" }}>
                  <div style={{ fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color, lineHeight: 1.3 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Tab Nav */}
            <div style={{ display: "flex", gap: 4, marginBottom: 18, background: C.surface, borderRadius: 12, padding: 4, border: `1px solid ${C.border}` }}>
              {[["jd", "📄 Structured JD"], ["sourcing", "🔍 Sourcing"], ["screening", "🎯 Screening"], ["pitch", "💬 Pitch"]].map(([k, label]) => (
                <button key={k} onClick={() => setActiveView(k)} style={{
                  flex: 1, padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer",
                  background: activeView === k ? C.card : "transparent",
                  color: activeView === k ? C.accent : C.muted,
                  fontSize: 12, fontWeight: 700,
                  borderBottom: activeView === k ? `2px solid ${C.accent}` : "2px solid transparent",
                  transition: "all 0.2s"
                }}>{label}</button>
              ))}
            </div>

            {/* ── JD Tab ── */}
            {activeView === "jd" && (
              <div style={{ animation: "fadeUp 0.3s ease" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Full JD */}
                  <div style={{ gridColumn: "1/-1", background: C.card, borderRadius: 14, border: `1px solid ${C.accentBorder}`, padding: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: "1px", textTransform: "uppercase" }}>📄 Generated Job Description</span>
                      <CopyBtn text={result.structuredJD} label="Copy JD" />
                    </div>
                    <p style={{ fontSize: 14, color: C.text, lineHeight: 1.8, margin: 0 }}>{result.structuredJD}</p>
                  </div>

                  {/* Must Have */}
                  <Section icon="✅" title="Must-Have Skills" accent>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {result.mustHaveSkills?.map(s => <Chip key={s} text={s} color="teal" />)}
                    </div>
                  </Section>

                  {/* Good to Have */}
                  <Section icon="➕" title="Good-to-Have Skills">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {result.goodToHaveSkills?.map(s => <Chip key={s} text={s} color="blue" />)}
                      {(!result.goodToHaveSkills || result.goodToHaveSkills.length === 0) && <span style={{ fontSize: 12, color: C.dim }}>None specified</span>}
                    </div>
                  </Section>

                  {/* Responsibilities */}
                  {result.responsibilities?.length > 0 && (
                    <Section icon="📌" title="Key Responsibilities">
                      {result.responsibilities.map((r, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                          <span style={{ color: C.accent, fontSize: 12, flexShrink: 0, marginTop: 1 }}>→</span>
                          <span style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{r}</span>
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Qualifications */}
                  {result.qualifications?.length > 0 && (
                    <Section icon="🎓" title="Qualifications">
                      {result.qualifications.map((q, i) => (
                        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                          <span style={{ color: C.muted, fontSize: 12, flexShrink: 0 }}>•</span>
                          <span style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>{q}</span>
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Role details */}
                  <Section icon="ℹ️" title="Role Details">
                    <InfoRow label="Industry" value={result.industry} />
                    <InfoRow label="Client Type" value={result.clientType} color={C.blue} />
                    <InfoRow label="Team Size" value={result.teamSize} />
                    <InfoRow label="Reporting To" value={result.reportingTo} />
                    <InfoRow label="Work Mode" value={result.workMode} color={result.workMode === "Remote" ? C.teal : C.text} />
                  </Section>
                </div>
              </div>
            )}

            {/* ── Sourcing Tab ── */}
            {activeView === "sourcing" && (
              <div style={{ animation: "fadeUp 0.3s ease" }}>
                {/* Boolean */}
                <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.accentBorder}`, padding: 22, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.accent, letterSpacing: "1px", textTransform: "uppercase" }}>🔎 Boolean Search String</span>
                    <CopyBtn text={result.sourcingKeywords?.boolean || ""} label="Copy Boolean" />
                  </div>
                  <div style={{ background: C.bg, borderRadius: 10, padding: "14px 16px", fontFamily: "'DM Mono', monospace", fontSize: 12, color: C.teal, lineHeight: 1.7, wordBreak: "break-all" }}>
                    {result.sourcingKeywords?.boolean || "—"}
                  </div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 10 }}>↑ Paste directly into LinkedIn Recruiter, Naukri, or any ATS search bar</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Section icon="🎯" title="Primary Keywords" accent>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {result.sourcingKeywords?.primary?.map(k => <Chip key={k} text={k} color="amber" />)}
                    </div>
                  </Section>

                  <Section icon="🔁" title="Secondary Keywords">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {result.sourcingKeywords?.secondary?.map(k => <Chip key={k} text={k} color="blue" />)}
                    </div>
                  </Section>

                  <Section icon="🚫" title="Exclude Keywords">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {result.sourcingKeywords?.exclude?.map(k => <Chip key={k} text={k} color="red" size="sm" />)}
                      {(!result.sourcingKeywords?.exclude || result.sourcingKeywords.exclude.length === 0) && <span style={{ fontSize: 12, color: C.dim }}>None</span>}
                    </div>
                  </Section>

                  <Section icon="🏢" title="Target Companies">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                      {result.targetCompanies?.map(c => <Chip key={c} text={c} color="gray" />)}
                      {(!result.targetCompanies || result.targetCompanies.length === 0) && <span style={{ fontSize: 12, color: C.dim }}>Not specified</span>}
                    </div>
                  </Section>
                </div>
              </div>
            )}

            {/* ── Screening Tab ── */}
            {activeView === "screening" && (
              <div style={{ animation: "fadeUp 0.3s ease" }}>
                {/* Candidate Persona */}
                <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.tealDim}`, borderColor: "rgba(0,194,168,0.35)", padding: 22, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.teal, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 10 }}>👤 Ideal Candidate Persona</div>
                  <p style={{ fontSize: 14, color: C.text, lineHeight: 1.8, margin: 0 }}>{result.candidatePersona}</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Must Have skills again for screening */}
                  <Section icon="✅" title="Screen For (Must Have)" accent>
                    {result.mustHaveSkills?.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}`, alignItems: "center" }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.teal, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: C.text }}>{s}</span>
                      </div>
                    ))}
                  </Section>

                  {/* Red Flags */}
                  <Section icon="🚩" title="Red Flags to Watch">
                    {result.redFlags?.map((f, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10, background: "rgba(255,95,95,0.06)", borderRadius: 8, padding: "9px 12px" }}>
                        <span style={{ color: C.red, fontSize: 14, flexShrink: 0 }}>!</span>
                        <span style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{f}</span>
                      </div>
                    ))}
                    {(!result.redFlags || result.redFlags.length === 0) && <span style={{ fontSize: 12, color: C.dim }}>None identified</span>}
                  </Section>
                </div>
              </div>
            )}

            {/* ── Pitch Tab ── */}
            {activeView === "pitch" && (
              <div style={{ animation: "fadeUp 0.3s ease" }}>
                <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 22, marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 4 }}>💬 Why Candidates Should Apply</div>
                  <div style={{ fontSize: 11, color: C.dim, marginBottom: 16 }}>Use these points when calling candidates to generate interest</div>
                  {result.pitchPoints?.map((p, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, background: C.accentDim, borderRadius: 10, padding: "12px 16px", border: `1px solid ${C.accentBorder}` }}>
                      <span style={{ background: C.accentBorder, color: C.accent, width: 22, height: 22, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, fontFamily: "'DM Mono',monospace", flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{p}</span>
                    </div>
                  ))}
                </div>

                {/* Quick summary card for candidate call */}
                <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 22 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.muted, letterSpacing: "1px", textTransform: "uppercase" }}>📞 Quick Call Script</span>
                    <CopyBtn text={`Hi, I have a ${result.jobTitle} opportunity at a ${result.clientType} company in ${result.location}. ${result.experienceMin ? `Looking for ${result.experienceMin}${result.experienceMax ? `-${result.experienceMax}` : "+"}` : ""} years exp, ${result.salaryMin ? `salary ${result.salaryMin}${result.salaryMax ? `-${result.salaryMax}` : "+"}` : ""}. Work mode: ${result.workMode}. Key skills: ${result.mustHaveSkills?.slice(0, 3).join(", ")}. Would you be interested?`} label="Copy Script" />
                  </div>
                  <div style={{ background: C.bg, borderRadius: 10, padding: "14px 16px", fontSize: 13, color: C.text, lineHeight: 1.8, fontStyle: "italic" }}>
                    "Hi [Candidate Name], I have a <strong style={{ color: C.accent, fontStyle: "normal" }}>{result.jobTitle}</strong> opportunity at a <strong style={{ color: C.accent, fontStyle: "normal" }}>{result.clientType}</strong> company based in <strong style={{ color: C.accent, fontStyle: "normal" }}>{result.location}</strong>.
                    {result.experienceMin != null && ` They're looking for ${result.experienceMin}${result.experienceMax ? `–${result.experienceMax}` : "+"} years of experience.`}
                    {result.salaryMin && ` Budget is ${result.salaryMin}${result.salaryMax ? `–${result.salaryMax}` : "+"}.`}
                    {` Work mode is ${result.workMode}.`}
                    {result.mustHaveSkills?.length > 0 && ` Key skills needed: ${result.mustHaveSkills.slice(0, 3).join(", ")}.`}
                    {` Would you be open to exploring this?"`}
                  </div>
                </div>
              </div>
            )}

            {/* Reset */}
            <button onClick={() => { setResult(null); setBrief(""); }}
              style={{ marginTop: 20, padding: "9px 22px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 12, cursor: "pointer" }}>
              ← Parse New Brief
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

window.TalentLensApp = App;
