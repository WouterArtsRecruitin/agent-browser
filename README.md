# Intelligence Hub - Recruitment Market Intelligence

Automated market intelligence system voor technisch recruitment. Monitort 500+ bedrijven, 200+ vacatures, en levert dagelijks actionable insights.

## 📊 Wat doet het?

### 3 Core Scrapers:

1. **Market Trends Scraper** (`scrapers/market-trends-scraper.js`)
   - Vacancy explosions: Bedrijven met 30%+ groei
   - Ghosting risks: Bedrijven met stagnerend recruitment
   - Hiring surges: Plotselinge pieken in vacatures

2. **ICP Monitor** (`scrapers/icp-monitor.js`)
   - Top 500 ICP bedrijven tracking
   - Hiring signals en activity scoring
   - Prioriteit rankings

3. **Concurrent Tracker** (`scrapers/concurrent-tracker.js`)
   - Concurrent content monitoring
   - Threat level assessment
   - Concurrentie intelligence

## 🚀 Quick Start

### Lokale Test:
```bash
cd intelligence-hub
npm install
cp .env.example .env
# Edit .env en add credentials
node test-deployment.js
```

### GitHub Actions Deploy:
Zie **GITHUB_DEPLOYMENT.md** voor volledige instructies.

## 📁 Directory Structure

```
intelligence-hub/
├── scrapers/
│   ├── market-trends-scraper.js    # Markt trend analyse
│   ├── icp-monitor.js              # ICP bedrijven tracking
│   └── concurrent-tracker.js       # Concurrent monitoring
├── config/
│   └── intelligence_hub_config.json # Configuratie
├── package.json                     # Dependencies
├── test-deployment.js               # Test script
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore rules
├── GITHUB_DEPLOYMENT.md             # Deploy guide
└── README.md                        # This file
```

## 🔧 Configuration

Edit `config/intelligence_hub_config.json`:
- ICP bedrijven lijst (top 500)
- Threshold settings (growth rates, alert levels)
- Scraping parameters

## 📈 Output

**Google Sheets Dashboard:**
https://docs.google.com/spreadsheets/d/14pX6dV6-5KLHYPuU1YsZSzu5SLHVbUxU78YQvIIRV_c/edit

**8 Sheets:**
- Market Trends: Overzicht alle signalen
- Vacancy Explosions: Groei opportunities
- Ghosting Risk: Probleem bedrijven
- ICP Companies: Top 500 tracking
- Hiring Surge: Plotselinge pieken
- Concurrent Content: Concurrent posts
- Threat Level: Risk assessment
- Dashboard: Executive summary

## 💰 Business Impact

- **Time savings:** 10 uur/week → 15 min/week = €48k/year
- **Coverage:** 20 bedrijven → 500+ = 25x expansion
- **Speed:** 7 dagen → 8 uur = 6.75 dagen faster
- **Expected revenue:** €50k+ Q1 2026, €375k+ Year 1

## 🔐 Security

- Credentials in GitHub Secrets (NEVER commit)
- Service account met minimale permissions
- Auto-cleanup na elke run
- Logs rotatie (30 dagen)

## 📅 Schedule

- **Daily run:** 08:00 UTC (09:00 CET / 10:00 CEST)
- **Duration:** ~5-8 minuten per run
- **Manual trigger:** Via GitHub Actions UI

## 🆘 Support

- Full documentation: `COMPLETE_DELIVERY_OVERVIEW.md`
- Deployment guide: `GITHUB_DEPLOYMENT.md`
- Project summary: `PROJECT_SIGN_OFF.md`

---

**Version:** 1.0.0  
**Last updated:** 12 januari 2026  
**Go-live target:** 20 januari 2026
