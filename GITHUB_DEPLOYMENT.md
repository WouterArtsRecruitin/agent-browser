# Intelligence Hub - GitHub Actions Deployment

## 🚀 Quick Start

### 1. Repository Setup
Deze files moeten in je `agent-browser` repo:
```
agent-browser/
├── .github/
│   └── workflows/
│       ├── intelligence-hub-daily.yml    # Auto dagelijks 08:00
│       └── intelligence-hub-manual.yml   # Manual trigger
└── intelligence-hub/
    ├── scrapers/
    │   ├── market-trends-scraper.js
    │   ├── icp-monitor.js
    │   └── concurrent-tracker.js
    ├── config/
    │   └── intelligence_hub_config.json
    ├── package.json
    └── README.md
```

### 2. GitHub Secrets Instellen

Ga naar: `https://github.com/WouterArtsRecruitin/agent-browser/settings/secrets/actions`

Maak deze secrets aan:

#### `GOOGLE_SHEETS_CREDENTIALS`
Volledige JSON van je Google Service Account:
```json
{
  "type": "service_account",
  "project_id": "your-project",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

#### `GOOGLE_SHEETS_ID`
```
14pX6dV6-5KLHYPuU1YsZSzu5SLHVbUxU78YQvIIRV_c
```

### 3. Google Sheets Permissions

Share de Google Sheet met de service account email:
```
your-service-account@your-project.iam.gserviceaccount.com
```
Met **Editor** permissions.

### 4. Test Run

**Manual trigger:**
1. Ga naar `Actions` tab in GitHub
2. Selecteer `Intelligence Hub - Manual Run`
3. Click `Run workflow`
4. Kies `test-only`
5. Check de logs

**Als test slaagt:**
- Daily workflow draait automatisch elke dag 08:00 UTC
- Of run manual met `all` scrapers

## 📊 Google Sheets Dashboard

https://docs.google.com/spreadsheets/d/14pX6dV6-5KLHYPuU1YsZSzu5SLHVbUxU78YQvIIRV_c/edit

## 🔧 Workflow Features

### Daily Run (`intelligence-hub-daily.yml`)
- Scheduled: Dagelijks 08:00 UTC
- Runs: Alle 3 scrapers sequentieel
- Logs: 30 dagen bewaard
- Fallback: Auto-cleanup credentials

### Manual Run (`intelligence-hub-manual.yml`)
- On-demand via GitHub UI
- Keuze: all, market-trends, icp-monitor, concurrent-tracker, test-only
- Ideal voor: Testing, debugging, ad-hoc updates

## 📈 Expected Results

**First Run:**
- Duration: ~5-8 minuten
- Updates: 8 sheets in Google Sheets
- Data: 500+ bedrijven, 200+ vacatures
- Status: Check logs in Actions tab

**Daily Updates:**
- Market Trends: ~150-200 nieuwe signalen
- ICP Activity: ~80-120 bedrijf updates
- Concurrent Tracking: ~50-80 nieuwe vacatures

## 🚨 Troubleshooting

### Error: "Cannot find module 'googleapis'"
```bash
cd intelligence-hub && npm install
```

### Error: "Invalid credentials"
- Check `GOOGLE_SHEETS_CREDENTIALS` secret
- Verify JSON format (geen syntax errors)
- Check service account permissions

### Error: "Permission denied on sheet"
- Share sheet met service account email
- Geef Editor permissions
- Wait 1-2 min voor propagatie

### Logs bekijken:
1. GitHub → Actions tab
2. Click laatste run
3. Download artifacts voor detailed logs

## 🎯 ROI Metrics

- **Time saved:** 10 uur/week → 15 min/week
- **Coverage:** 20 bedrijven → 500+ bedrijven
- **Speed:** 7 dagen → 8 uur updates
- **Expected revenue:** €50k+ Q1 2026

## 📅 Go-Live

**Target: Maandag 20 januari 2026, 08:00**

Pre-launch checklist:
- [ ] Secrets configured
- [ ] Test run successful
- [ ] Daily workflow enabled
- [ ] Google Sheets permissions verified
- [ ] Logs reviewed

---

**Support:** Check COMPLETE_DELIVERY_OVERVIEW.md voor volledige documentatie
