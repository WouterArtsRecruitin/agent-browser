/**
 * MARKET TRENDS SCRAPER
 * 
 * Scrapes Indeed.nl + Monsterboard.nl voor vacature trends
 * Target: Technisch recruitment (Automation, Oil & Gas, Manufacturing)
 * Output: CSV format voor Google Sheets Intelligence Hub
 * 
 * USAGE:
 * node market-trends-scraper.js
 * 
 * OUTPUT:
 * market_trends_[YYYY-MM-DD].csv
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Target keywords (technical recruitment focus)
  keywords: [
    'automation engineer',
    'field service engineer',
    'maintenance engineer',
    'process engineer',
    'electrical engineer',
    'mechanical engineer',
    'project engineer',
    'commissioning engineer',
    'PLC programmeur',
    'technisch commercieel'
  ],
  
  // Target locations (Wouter's regions)
  locations: [
    'Gelderland',
    'Overijssel',
    'Noord-Brabant'
  ],
  
  // Concurrent keywords for ghosting detection
  concurrentKeywords: [
    'Yacht',
    'Brunel',
    'Olympia',
    'Tempo-Team'
  ],
  
  // Output settings
  outputDir: './scraper-output',
  csvFilename: `market_trends_${new Date().toISOString().split('T')[0]}.csv`,
  
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
 * Scrape Indeed.nl voor vacature counts
 */
async function scrapeIndeed(page, keyword, location) {
  const url = `https://nl.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=${encodeURIComponent(location)}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });
    
    // Extract job count
    const jobCount = await page.evaluate(() => {
      // Indeed shows count in multiple possible locations
      const countElement = document.querySelector('[class*="jobsearch-JobCountAndSortPane-jobCount"]') ||
                          document.querySelector('div[id="searchCountPages"]');
      
      if (!countElement) return 0;
      
      const text = countElement.textContent;
      const match = text.match(/[\d.,]+/);
      return match ? parseInt(match[0].replace(/[.,]/g, '')) : 0;
    });
    
    // Extract sample salary data
    const salaryData = await page.evaluate(() => {
      const salaryElements = document.querySelectorAll('[class*="salary-snippet"]');
      const salaries = [];
      
      salaryElements.forEach(el => {
        const text = el.textContent;
        const match = text.match(/€\s*[\d.,]+/g);
        if (match) {
          salaries.push(text.trim());
        }
      });
      
      return salaries.slice(0, 3); // Top 3 samples
    });
    
    return {
      source: 'Indeed',
      keyword,
      location,
      jobCount,
      salaryData: salaryData.join(' | '),
      url
    };
    
  } catch (error) {
    console.error(`Error scraping Indeed for ${keyword} in ${location}:`, error.message);
    return {
      source: 'Indeed',
      keyword,
      location,
      jobCount: 0,
      salaryData: 'ERROR',
      url
    };
  }
}

/**
 * Scrape Monsterboard.nl voor vacature counts
 */
async function scrapeMonsterboard(page, keyword, location) {
  const url = `https://www.monsterboard.nl/vacatures/zoeken/?q=${encodeURIComponent(keyword)}&where=${encodeURIComponent(location)}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });
    
    // Extract job count
    const jobCount = await page.evaluate(() => {
      const countElement = document.querySelector('[data-test-id="svx-job-count"]') ||
                          document.querySelector('.job-count') ||
                          document.querySelector('h2[class*="results"]');
      
      if (!countElement) return 0;
      
      const text = countElement.textContent;
      const match = text.match(/[\d.,]+/);
      return match ? parseInt(match[0].replace(/[.,]/g, '')) : 0;
    });
    
    return {
      source: 'Monsterboard',
      keyword,
      location,
      jobCount,
      salaryData: 'N/A',
      url
    };
    
  } catch (error) {
    console.error(`Error scraping Monsterboard for ${keyword} in ${location}:`, error.message);
    return {
      source: 'Monsterboard',
      keyword,
      location,
      jobCount: 0,
      salaryData: 'ERROR',
      url
    };
  }
}

/**
 * Check concurrent ghosting signals (competitor activity)
 */
async function checkGhostingSignals(page, keyword, location) {
  const url = `https://nl.indeed.com/jobs?q=${encodeURIComponent(keyword + ' ' + CONFIG.concurrentKeywords.join(' OR '))}&l=${encodeURIComponent(location)}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });
    
    const concurrentCount = await page.evaluate(() => {
      const countElement = document.querySelector('[class*="jobsearch-JobCountAndSortPane-jobCount"]');
      if (!countElement) return 0;
      
      const text = countElement.textContent;
      const match = text.match(/[\d.,]+/);
      return match ? parseInt(match[0].replace(/[.,]/g, '')) : 0;
    });
    
    return {
      keyword,
      location,
      concurrentCount,
      ghostingRisk: concurrentCount > 20 ? 'HIGH' : concurrentCount > 10 ? 'MEDIUM' : 'LOW'
    };
    
  } catch (error) {
    console.error(`Error checking ghosting signals for ${keyword}:`, error.message);
    return {
      keyword,
      location,
      concurrentCount: 0,
      ghostingRisk: 'UNKNOWN'
    };
  }
}

// ============================================================================
// MAIN SCRAPING LOGIC
// ============================================================================

async function scrapeAllData() {
  console.log('🚀 Starting Market Trends Scraper...\n');
  console.log(`Target Keywords: ${CONFIG.keywords.length}`);
  console.log(`Target Locations: ${CONFIG.locations.length}`);
  console.log(`Total Combinations: ${CONFIG.keywords.length * CONFIG.locations.length}\n`);
  
  const browser = await initBrowser();
  const page = await browser.newPage();
  
  // Set user agent to avoid detection
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const results = [];
  const ghostingData = [];
  
  let processed = 0;
  const total = CONFIG.keywords.length * CONFIG.locations.length * 2; // 2 sources
  
  // Scrape each keyword-location combination
  for (const keyword of CONFIG.keywords) {
    for (const location of CONFIG.locations) {
      
      // Indeed
      console.log(`[${++processed}/${total}] Scraping Indeed: ${keyword} in ${location}...`);
      const indeedResult = await scrapeIndeed(page, keyword, location);
      results.push(indeedResult);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Monsterboard
      console.log(`[${++processed}/${total}] Scraping Monsterboard: ${keyword} in ${location}...`);
      const monsterResult = await scrapeMonsterboard(page, keyword, location);
      results.push(monsterResult);
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check ghosting signals (once per keyword-location)
      console.log(`[INFO] Checking ghosting signals: ${keyword} in ${location}...`);
      const ghosting = await checkGhostingSignals(page, keyword, location);
      ghostingData.push(ghosting);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  await browser.close();
  
  console.log('\n✅ Scraping completed!\n');
  
  return { results, ghostingData };
}

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * Convert results to CSV format for Google Sheets
 */
function convertToCSV(results, ghostingData) {
  const timestamp = new Date().toISOString();
  
  // Market Trends CSV
  let csv = 'Data Date,Source,Keyword,Location,Count,Trend %,Salary Range,URL,Last Updated\n';
  
  results.forEach(r => {
    const date = new Date().toISOString().split('T')[0];
    csv += `${date},"${r.source}","${r.keyword}","${r.location}",${r.jobCount},,"${r.salaryData}","${r.url}","${timestamp}"\n`;
  });
  
  // Ghosting Patterns CSV
  let ghostingCSV = 'Data Date,Keyword,Location,Concurrent Count,Ghosting Risk,Detection Method,Last Updated\n';
  
  ghostingData.forEach(g => {
    const date = new Date().toISOString().split('T')[0];
    ghostingCSV += `${date},"${g.keyword}","${g.location}",${g.concurrentCount},"${g.ghostingRisk}","Concurrent Analysis","${timestamp}"\n`;
  });
  
  return { csv, ghostingCSV };
}

/**
 * Save CSV files
 */
async function saveResults(results, ghostingData) {
  // Create output directory
  await fs.mkdir(CONFIG.outputDir, { recursive: true });
  
  const { csv, ghostingCSV } = convertToCSV(results, ghostingData);
  
  // Save market trends
  const trendsPath = path.join(CONFIG.outputDir, CONFIG.csvFilename);
  await fs.writeFile(trendsPath, csv, 'utf8');
  console.log(`📊 Market trends saved: ${trendsPath}`);
  
  // Save ghosting patterns
  const ghostingPath = path.join(CONFIG.outputDir, `ghosting_patterns_${new Date().toISOString().split('T')[0]}.csv`);
  await fs.writeFile(ghostingPath, ghostingCSV, 'utf8');
  console.log(`👻 Ghosting patterns saved: ${ghostingPath}`);
  
  // Generate summary
  const summary = generateSummary(results, ghostingData);
  const summaryPath = path.join(CONFIG.outputDir, `scrape_summary_${new Date().toISOString().split('T')[0]}.txt`);
  await fs.writeFile(summaryPath, summary, 'utf8');
  console.log(`📋 Summary saved: ${summaryPath}`);
}

/**
 * Generate summary report
 */
function generateSummary(results, ghostingData) {
  const totalJobs = results.reduce((sum, r) => sum + r.jobCount, 0);
  const avgJobsPerKeyword = totalJobs / CONFIG.keywords.length;
  
  const highGhosting = ghostingData.filter(g => g.ghostingRisk === 'HIGH').length;
  const mediumGhosting = ghostingData.filter(g => g.ghostingRisk === 'MEDIUM').length;
  
  const topKeywords = CONFIG.keywords
    .map(keyword => {
      const keywordResults = results.filter(r => r.keyword === keyword);
      const totalCount = keywordResults.reduce((sum, r) => sum + r.jobCount, 0);
      return { keyword, count: totalCount };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return `
=============================================================================
MARKET TRENDS SCRAPE SUMMARY
=============================================================================
Date: ${new Date().toISOString()}
Keywords Scraped: ${CONFIG.keywords.length}
Locations: ${CONFIG.locations.join(', ')}

VACANCY TRENDS:
- Total Jobs Found: ${totalJobs}
- Average per Keyword: ${Math.round(avgJobsPerKeyword)}
- Sources: Indeed.nl, Monsterboard.nl

TOP 5 KEYWORDS:
${topKeywords.map((k, i) => `${i + 1}. ${k.keyword}: ${k.count} jobs`).join('\n')}

GHOSTING RISK:
- HIGH Risk: ${highGhosting} keyword-location combinations
- MEDIUM Risk: ${mediumGhosting} keyword-location combinations
- LOW Risk: ${ghostingData.length - highGhosting - mediumGhosting} combinations

NEXT STEPS:
1. Import CSVs to Google Sheets Intelligence Hub
2. Review high ghosting risk keywords
3. Adjust targeting based on trends

=============================================================================
  `.trim();
}

// ============================================================================
// EXECUTION
// ============================================================================

(async () => {
  try {
    const { results, ghostingData } = await scrapeAllData();
    await saveResults(results, ghostingData);
    
    console.log('\n✅ ALL DONE! Files ready for Google Sheets import.\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Scraper failed:', error);
    process.exit(1);
  }
})();
