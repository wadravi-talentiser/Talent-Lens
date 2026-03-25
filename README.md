# Talent-Lens

AI-powered recruitment automation suite for agencies and independent recruiters.

**Live App:** [https://wadravi-talentiser.github.io/Talent-Lens/](https://wadravi-talentiser.github.io/Talent-Lens/)

## Tools Included

### 1. Client Mandate Intake
Paste any raw client brief and generate:
- Structured job description
- Must-have and good-to-have skill split
- Boolean search string
- Primary, secondary, and exclude keywords
- Candidate persona and red flags
- Candidate call script

### 2. AI Candidate Assessment
Upload a JD and a CV to get:
- Overall fit score (0-100)
- Dimension-wise score breakdown
- Strengths, gaps, and risks
- AI-generated interview questions
- Compensation and notice-period guidance

### 3. Multi-Candidate Comparison
Assess multiple candidates against one JD:
- Live leaderboard
- Side-by-side score comparison
- Detailed report per candidate
- Shortlist-ready ranking

### 4. Recruitment Tracker
Track the pipeline with:
- Standard recruiter fields
- Status updates from New to Placed
- Search and filter controls
- Excel export

## Tech Stack

| Layer | Technology |
|---|---|
| Landing Page | Static HTML/CSS |
| Tool Sources | React JSX |
| AI Engine | Anthropic Claude API |
| File Parsing | mammoth.js, FileReader |
| Export | SheetJS |
| Hosting | GitHub Pages |

## Project Structure

```text
Talent-Lens/
|-- index.html
|-- README.md
|-- repo-settings.yml
|-- tools/
|   |-- mandate-intake-tool.jsx
|   |-- talent-lens.jsx
|   |-- candidate-assessment-tool.jsx
|   `-- recruitment-tracker.jsx
`-- .github/workflows/deploy-pages.yml
```

## GitHub Pages

This repo includes a GitHub Actions workflow for Pages deployment. After pushing to `main`, enable GitHub Pages with **Build and deployment -> GitHub Actions**.

## License

MIT License
