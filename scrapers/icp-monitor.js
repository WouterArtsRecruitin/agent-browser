/**
 * ICP ACTIVITY MONITOR
 * 
 * Monitoreert target bedrijven (ICP) voor hiring signals en nieuws
 * Focus: Mid-market (50-800 FTE) technisch bedrijven Gelderland/Overijssel/Brabant
 * Output: CSV format voor Google Sheets Intelligence Hub
 * 
 * USAGE:
 * node icp-monitor.js
 * 
 * OUTPUT:
 * icp_activity_[YYYY-MM-DD].csv
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // ICP target companies (Wouter's mid-market focus)
  targetCompanies: [
    // Automation & Manufacturing
    { name: 'Stork', domain: 'stork.com', sector: 'Oil & Gas / Maintenance' },
    { name: 'Siemens Nederland', domain: 'siemens.nl', sector: 'Automation' },
    { name: 'Bosch Rexroth', domain: 'boschrexroth.nl', sector: 'Automation' },
    { name: 'Mitsubishi Electric', domain: 'mitsubishielectric.nl', sector: 'Automation' },
    { name: 'Omron', domain: 'industrial.omron.nl', sector: 'Automation' },
    
    // Manufacturing & Engineering
    { name: 'VDL Groep', domain: 'vdlgroep.com', sector: 'Manufacturing' },
    { name: 'Demka', domain: 'demka.nl', sector: 'Manufacturing' },
    { name: 'Stiho', domain: 'stiho.nl', sector: 'Building Services' },
    { name: 'Imtech', domain: 'imtech.eu', sector: 'Technical Services' },
    { name: 'Strukton', domain: 'strukton.com', sector: 'Infrastructure' },
    
    // Construction & Infrastructure
    { name: 'BAM', domain: 'bam.com', sector: 'Construction' },
    { name: 'VolkerWessels', domain: 'volkerwessels.com', sector: 'Construction' },
    { name: 'Heijmans', domain: 'heijmans.nl', sector: 'Construction' },
    { name: 'Dura Vermeer', domain: 'duravermeer.nl', sector: 'Construction' },
    
    // Renewable Energy
    { name: 'Alfen', domain: 'alfen.com', sector: 'Energy Storage' },
    { name: 'Solarfields', domain: 'solarfields.nl', sector: 'Solar Energy' },
    { name: 'Vattenfall', domain: 'vattenfall.nl', sector: 'Renewable Energy' },
    
    // Add more as needed
  ],
  
  // Hiring signal keywords
  hiringSignals: [
    'vacature',
    'vacatures',
    'werken bij',
    'join our team',
    'we are hiring',
    'open sollicitatie',
    'career',
    'carrière'
  ],
  
  // News signal keywords
  newsSignals: [
    'order',
    'contract',
    'project',
    'uitbreiding',
    'expansion',
    'nieuwe vestiging',
    'investering',
    'groei',
    'growth',
    'opdracht',
    'samenwerking'
  ],
  
  // Output settings
  outputDir: './scraper-output',
  csvFilename: `icp_activity_${new Date().toISOString().split('T')[0]}.csv`,
  
  // Browser settings
  headless: true,
  timeout: 30000
};

// ============================================================================
// SCRAPER FUNCTIONS
// ============================================================================

/**
 * Initialize browser
 */
async function initBrowser() {
  return await puppeteer.launch({
    headless: CONFIG.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
}

/**
 * Check company career page for hiring signals
 */
async function checkCareerPage(page, company) {
  const careerUrls = [
    `https://${company.domain}/careers`,
    `https://${company.domain}/carriere`,
    `https://${company.domain}/vacatures`,
    `https://${company.domain}/jobs`,
    `https://www.${company.domain}/careers`,
    `https://www.${company.domain}/carriere`
  ];
  
  for (const url of careerUrls) {
    try {
      const response = await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: CONFIG.timeout 
      });
      
      if (response && response.status() === 200) {
        // Found career page
        const vacancyCount = await page.evaluate((signals) => {
          const bodyText = document.body.textContent.toLowerCase();
          
          // Try to find vacancy count
          const countMatch = bodyText.match(/(\d+)\s*(vacature|openings|positions)/i);
          if (countMatch) return parseInt(countMatch[1]);
          
          // Count vacancy-related links
          const links = Array.from(document.querySelectorAll('a'));
          const vacancyLinks = links.filter(link => {
            const text = link.textContent.toLowerCase();
            return signals.some(signal => text.includes(signal));
          });
          
          return vacancyLinks.length > 0 ? vacancyLinks.length : null;
        }, CONFIG.hiringSignals);
        
        return {
          careerPageFound: true,
          careerPageUrl: url,
          vacancyCount: vacancyCount || 'Unknown',
          lastChecked: new Date().toISOString()
        };
      }
    } catch (error) {
      // Continue to next URL
      continue;
    }
  }
  
  return {
    careerPageFound: false,
    careerPageUrl: 'N/A',
    vacancyCount: 0,
    lastChecked: new Date().toISOString()
  };
}

/**
 * Search Google News for company mentions
 */
async function searchCompanyNews(page, company) {
  const query = `${company.name} ${CONFIG.newsSignals.slice(0, 3).join(' OR ')}`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=nws&num=10`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });
    
    const newsItems = await page.evaluate(() => {
      const results = [];
      const newsCards = document.querySelectorAll('div[data-hveid]');
      
      newsCards.forEach((card, index) => {
        if (index >= 5) return; // Top 5 only
        
        const titleElement = card.querySelector('div[role="heading"]');
        const linkElement = card.querySelector('a');
        const dateElement = card.querySelector('span:not([role])');
        
        if (titleElement && linkElement) {
          results.push({
            title: titleElement.textContent.trim(),
            url: linkElement.href,
            date: dateElement ? dateElement.textContent.trim() : 'Unknown'
          });
        }
      });
      
      return results;
    });
    
    return {
      newsFound: newsItems.length > 0,
      newsCount: newsItems.length,
      latestNews: newsItems[0] || null,
      allNews: newsItems
    };
    
  } catch (error) {
    console.error(`Error searching news for ${company.name}:`, error.message);
    return {
      newsFound: false,
      newsCount: 0,
      latestNews: null,
      allNews: []
    };
  }
}

/**
 * Check LinkedIn company page for updates
 */
async function checkLinkedInActivity(page, company) {
  // LinkedIn requires login, so we'll use a simplified approach
  // Check if company has LinkedIn page via Google search
  
  const query = `${company.name} LinkedIn site:linkedin.com/company`;
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });
    
    const linkedInUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const linkedInLink = links.find(link => 
        link.href.includes('linkedin.com/company/')
      );
      return linkedInLink ? linkedInLink.href : null;
    });
    
    return {
      hasLinkedIn: !!linkedInUrl,
      linkedInUrl: linkedInUrl || 'N/A'
    };
    
  } catch (error) {
    return {
      hasLinkedIn: false,
      linkedInUrl: 'N/A'
    };
  }
}

/**
 * Calculate activity score
 */
function calculateActivityScore(careerData, newsData, linkedInData) {
  let score = 0;
  
  // Career page signals (0-40 points)
  if (careerData.careerPageFound) {
    score += 20;
    if (typeof careerData.vacancyCount === 'number' && careerData.vacancyCount > 0) {
      score += Math.min(20, careerData.vacancyCount * 2);
    }
  }
  
  // News signals (0-40 points)
  if (newsData.newsFound) {
    score += Math.min(40, newsData.newsCount * 8);
  }
  
  // LinkedIn presence (0-20 points)
  if (linkedInData.hasLinkedIn) {
    score += 20;
  }
  
  return Math.min(100, score);
}

// ============================================================================
// MAIN MONITORING LOGIC
// ============================================================================

async function monitorAllCompanies() {
  console.log('🚀 Starting ICP Activity Monitor...\n');
  console.log(`Target Companies: ${CONFIG.targetCompanies.length}\n`);
  
  const browser = await initBrowser();
  const page = await browser.newPage();
  
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const results = [];
  
  for (let i = 0; i < CONFIG.targetCompanies.length; i++) {
    const company = CONFIG.targetCompanies[i];
    console.log(`[${i + 1}/${CONFIG.targetCompanies.length}] Monitoring: ${company.name}...`);
    
    // Check career page
    console.log(`  → Checking career page...`);
    const careerData = await checkCareerPage(page, company);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Search news
    console.log(`  → Searching news...`);
    const newsData = await searchCompanyNews(page, company);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check LinkedIn
    console.log(`  → Checking LinkedIn...`);
    const linkedInData = await checkLinkedInActivity(page, company);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Calculate activity score
    const activityScore = calculateActivityScore(careerData, newsData, linkedInData);
    
    // Determine status
    let status = 'COLD';
    if (activityScore >= 70) status = 'HOT';
    else if (activityScore >= 40) status = 'WARM';
    
    console.log(`  ✓ Score: ${activityScore}/100 | Status: ${status}\n`);
    
    results.push({
      company: company.name,
      domain: company.domain,
      sector: company.sector,
      activityScore,
      status,
      careerPageFound: careerData.careerPageFound,
      careerPageUrl: careerData.careerPageUrl,
      vacancyCount: careerData.vacancyCount,
      newsCount: newsData.newsCount,
      latestNews: newsData.latestNews ? newsData.latestNews.title : 'N/A',
      latestNewsUrl: newsData.latestNews ? newsData.latestNews.url : 'N/A',
      linkedInUrl: linkedInData.linkedInUrl,
      lastChecked: new Date().toISOString()
    });
  }
  
  await browser.close();
  
  console.log('\n✅ Monitoring completed!\n');
  
  return results;
}

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * Convert results to CSV
 */
function convertToCSV(results) {
  let csv = 'Data Date,Company,Sector,Activity Score,Status,Hiring Signal,News Signal,Action Priority,Last Updated\n';
  
  results.forEach(r => {
    const date = new Date().toISOString().split('T')[0];
    const hiringSignal = r.careerPageFound ? `${r.vacancyCount} vacatures` : 'No career page';
    const newsSignal = r.newsCount > 0 ? `${r.newsCount} news items` : 'No recent news';
    const actionPriority = r.status === 'HOT' ? 'IMMEDIATE' : r.status === 'WARM' ? 'THIS WEEK' : 'MONITOR';
    
    csv += `${date},"${r.company}","${r.sector}",${r.activityScore},"${r.status}","${hiringSignal}","${newsSignal}","${actionPriority}","${r.lastChecked}"\n`;
  });
  
  return csv;
}

/**
 * Save results and generate report
 */
async function saveResults(results) {
  await fs.mkdir(CONFIG.outputDir, { recursive: true });
  
  // Save CSV
  const csv = convertToCSV(results);
  const csvPath = path.join(CONFIG.outputDir, CONFIG.csvFilename);
  await fs.writeFile(csvPath, csv, 'utf8');
  console.log(`📊 ICP activity saved: ${csvPath}`);
  
  // Generate detailed report
  const report = generateReport(results);
  const reportPath = path.join(CONFIG.outputDir, `icp_report_${new Date().toISOString().split('T')[0]}.txt`);
  await fs.writeFile(reportPath, report, 'utf8');
  console.log(`📋 Detailed report saved: ${reportPath}`);
}

/**
 * Generate detailed report
 */
function generateReport(results) {
  const hotCompanies = results.filter(r => r.status === 'HOT');
  const warmCompanies = results.filter(r => r.status === 'WARM');
  const coldCompanies = results.filter(r => r.status === 'COLD');
  
  const avgScore = results.reduce((sum, r) => sum + r.activityScore, 0) / results.length;
  const companiesWithVacancies = results.filter(r => r.careerPageFound && r.vacancyCount > 0).length;
  
  return `
=============================================================================
ICP ACTIVITY MONITOR REPORT
=============================================================================
Date: ${new Date().toISOString()}
Companies Monitored: ${results.length}

ACTIVITY BREAKDOWN:
- HOT (70-100): ${hotCompanies.length} companies → IMMEDIATE OUTREACH
- WARM (40-69): ${warmCompanies.length} companies → OUTREACH THIS WEEK
- COLD (0-39): ${coldCompanies.length} companies → KEEP MONITORING

AVERAGE ACTIVITY SCORE: ${Math.round(avgScore)}/100
COMPANIES WITH VACANCIES: ${companiesWithVacancies}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOT COMPANIES (Immediate Action Required):
${hotCompanies.length > 0 ? hotCompanies.map((c, i) => `
${i + 1}. ${c.company} (${c.activityScore}/100)
   Sector: ${c.sector}
   Vacancies: ${c.vacancyCount}
   Career Page: ${c.careerPageUrl}
   Latest News: ${c.latestNews}
   LinkedIn: ${c.linkedInUrl}
`).join('\n') : '   None'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WARM COMPANIES (Schedule Outreach):
${warmCompanies.length > 0 ? warmCompanies.map((c, i) => `
${i + 1}. ${c.company} (${c.activityScore}/100)
   Sector: ${c.sector}
   Hiring Signal: ${c.careerPageFound ? 'Yes' : 'No'}
   News Activity: ${c.newsCount} items
`).join('\n') : '   None'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NEXT STEPS:
1. Import CSV to Google Sheets Intelligence Hub
2. Prioritize outreach to HOT companies
3. Schedule warm outreach for WARM companies
4. Continue monitoring COLD companies

=============================================================================
  `.trim();
}

// ============================================================================
// EXECUTION
// ============================================================================

(async () => {
  try {
    const results = await monitorAllCompanies();
    await saveResults(results);
    
    console.log('\n✅ ALL DONE! Files ready for Google Sheets import.\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Monitor failed:', error);
    process.exit(1);
  }
})();
