# ⚡ Talent-Lens — AI Recruitment Automation Suite

> A complete AI-powered recruitment toolkit built for agencies and independent recruiters. Parse client mandates, assess candidates, compare shortlists, and track your pipeline — all in one place.

🔗 **Live App:** [https://wadravi-talentiser.github.io/Talent-Lens](https://wadravi-talentiser.github.io/Talent-Lens)

---

## 🚀 Tools Included

### 1. 📋 Client Mandate Intake
Paste any raw client brief — email, WhatsApp message, call notes — and instantly get:
- Structured Job Description (200-250 words, ready to post)
- Must-have vs good-to-have skills separated
- Boolean search string for LinkedIn / Naukri
- Primary, secondary & exclude keywords
- Target companies to poach from
- Candidate persona + red flags
- Ready-made candidate call script

### 2. ⚡ TalentLens — AI Candidate Assessment
Upload a JD and a CV (PDF, DOCX, or TXT) and get a full scorecard:
- Overall fit score (0–100)
- 5-dimension skill breakdown
- Strengths, gaps & red flags
- AI-generated interview questions
- Salary estimate & notice period
- Recruiter recommendation

### 3. 👥 TalentLens — Multi-Candidate Comparison
Assess multiple candidates against the same JD and rank them:
- Live leaderboard ranked by fit score
- 🥇🥈🥉 medals for top candidates
- Side-by-side table view with dimension scores
- Full report modal for each candidate
- Score distribution chart

### 4. 📊 Recruitment Tracker
Full candidate pipeline tracker replacing your Excel sheet:
- All standard columns: S.No, Date, Source, Name, Company, Client, JD, Skills, Contact, Email, City, Salary, LinkedIn, Experience, Status, Remark
- Search, filter by status & source
- Table and card views
- One-click Excel export (.xlsx)
- Status pipeline: New → Contacted → Screening → Submitted → Interview → Offer → Placed

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React (JSX) |
| AI Engine | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| File Parsing | mammoth.js (DOCX), native FileReader (PDF/TXT) |
| Excel Export | SheetJS (xlsx) |
| Fonts | DM Sans, DM Mono, Fraunces, Instrument Serif |
| Hosting | GitHub Pages |

---

## 📁 Project Structure

```
Talent-Lens/
├── index.html                  # Landing page & tool hub
├── README.md                   # This file
├── tools/
│   ├── mandate-intake-tool.jsx      # Client brief parser
│   ├── talent-lens.jsx              # Multi-candidate comparison
│   ├── candidate-assessment-tool.jsx # Single CV assessor
│   └── recruitment-tracker.jsx      # Pipeline tracker
```

---

## 🔑 API Key Setup

These tools use the Anthropic Claude API. The API key is handled by Claude.ai when running inside the Claude artifact environment.

If deploying standalone, add your key to each tool's fetch header:
```js
headers: {
  "Content-Type": "application/json",
  "x-api-key": "YOUR_ANTHROPIC_API_KEY",
  "anthropic-version": "2023-06-01"
}
```

---

## 📞 About

Built by **Wadravi Talentiser** — a recruitment agency automating their workflow with AI.

For queries, reach out via GitHub Issues.

---

## 📄 License

MIT License — free to use, modify, and distribute.
