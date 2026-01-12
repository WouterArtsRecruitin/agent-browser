/**
 * CONCURRENT TRACKER - Competitor Blog & PR Activity Monitor
 * 
 * Monitort blog posts, persberichten en LinkedIn activity van concurrenten
 * Output: concurrent_activity_[DATE].csv + concurrent_summary_[DATE].txt
 * 
 * RUN: node concurrent-tracker.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// ============================================================================
// CONFIGURATIE
// ============================================================================

const CONFIG = {
  concurrenten: [
    {
      naam: 'Yacht',
      website: 'https://www.yacht.nl',
      blogUrl: 'https://www.yacht.nl/kennis',
      linkedinUrl: 'https://www.linkedin.com/company/yacht-nl',
      sector: 'Recruitment',
      focusAreas: ['techniek', 'IT', 'engineering']
    },
    {
      naam: 'Brunel',
      website: 'https://www.brunel.nl',
      blogUrl: 'https://www.brunel.nl/nl-nl/insights',
      linkedinUrl: 'https://www.linkedin.com/company/brunel',
      sector: 'Recruitment',
      focusAreas: ['engineering', 'oil & gas', 'renewable energy']
    },
    {
      naam: 'Olympia',
      website: 'https://www.olympia.nl',
      blogUrl: 'https://www.olympia.nl/zakelijk/nieuws',
      linkedinUrl: 'https://www.linkedin.com/company/olympia-uitzendbureau',
      sector: 'Recruitment',
      focusAreas: ['techniek', 'productie', 'logistiek']
    },
    {
      naam: 'Tempo-Team',
      website: 'https://www.tempo-team.nl',
      blogUrl: 'https://www.tempo-team.nl/werkgevers/kennisbank',
      linkedinUrl: 'https://www.linkedin.com/company/tempo-team',
      sector: 'Recruitment',
      focusAreas: ['techniek', 'bouw', 'industrie']
    },
    {
      naam: 'Randstad',
      website: 'https://www.randstad.nl',
      blogUrl: 'https://www.randstad.nl/werkgevers/kennisbank',
      linkedinUrl: 'https://www.linkedin.com/company/randstad-nederland',
      sector: 'Recruitment',
      focusAreas: ['engineering', 'techniek', 'industrie']
    },
    {
      naam: 'Unique',
      website: 'https://www.unique.nl',
      blogUrl: 'https://www.unique.nl/over-unique/nieuws',
      linkedinUrl: 'https://www.linkedin.com/company/unique-nederland',
      sector: 'Recruitment',
      focusAreas: ['techniek', 'productie']
    },
    {
      naam: 'Manpower',
      website: 'https://www.manpower.nl',
      blogUrl: 'https://www.manpower.nl/nl/kennisbank',
      linkedinUrl: 'https://www.linkedin.com/company/manpower-nederland',
      sector: 'Recruitment',
      focusAreas: ['techniek', 'engineering', 'productie']
    },
    {
      naam: 'Cottus',
      website: 'https://www.cottus.nl',
      blogUrl: 'https://www.cottus.nl/kennis',
      linkedinUrl: 'https://www.linkedin.com/company/cottus',
      sector: 'Recruitment',
      focusAreas: ['bouw', 'infra', 'techniek']
    }
  ],

  // Content keywords om te detecteren
  contentKeywords: {
    techniek: ['automation', 'field service', 'maintenance', 'technisch', 'engineer', 'PLC', 'SCADA'],
    trending: ['AI', 'digitalisering', 'sustainability', 'renewable energy', 'net zero', 'energietransitie'],
    recruitment: ['krapte', 'arbeidstekort', 'talent', 'personeelstekort', 'werving', 'selectie'],
    regional: ['gelderland', 'overijssel', 'noord-brabant', 'arnhem', 'nijmegen', 'zwolle', 'eindhoven']
  },

  delays: {
    betweenCompetitors: 3000,  // 3 seconden tussen concurrenten
    betweenRequests: 2000      // 2 seconden tussen individuele requests
  },

  outputDir: './scraper-output'
};

// ============================================================================
// HELPER FUNCTIES
// ============================================================================

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateRelevanceScore(text, concurrent) {
  let score = 0;
  const lowerText = text.toLowerCase();
  
  // Check focus areas (max 30 punten)
  concurrent.focusAreas.forEach(area => {
    if (lowerText.includes(area.toLowerCase())) {
      score += 10;
    }
  });
  
  // Check content keywords (max 40 punten)
  Object.entries(CONFIG.contentKeywords).forEach(([category, keywords]) => {
    keywords.forEach(keyword => {
      if (lowerText.includes(keyword.toLowerCase())) {
        score += 2;
      }
    });
  });
  
  // Cap at 100
  return Math.min(score, 100);
}

function determineActivityLevel(recentPosts, avgRelevance) {
  if (recentPosts >= 5 && avgRelevance >= 50) return 'ZEER ACTIEF';
  if (recentPosts >= 3 && avgRelevance >= 30) return 'ACTIEF';
  if (recentPosts >= 1 || avgRelevance >= 20) return 'MATIG ACTIEF';
  return 'INACTIEF';
}

function determineThreatLevel(activityLevel, avgRelevance) {
  if (activityLevel === 'ZEER ACTIEF' && avgRelevance >= 60) return 'HOOG';
  if (activityLevel === 'ACTIEF' && avgRelevance >= 40) return 'GEMIDDELD';
  if (activityLevel === 'MATIG ACTIEF') return 'LAAG';
  return 'MINIMAAL';
}

// ============================================================================
// SCRAPING FUNCTIES
// ============================================================================

async function checkBlogActivity(page, concurrent) {
  console.log(`  📰 Checking blog: ${concurrent.blogUrl}`);
  
  try {
    await page.goto(concurrent.blogUrl, { 
      waitUntil: 'networkidle2',
      timeout: 15000 
    });
    await delay(CONFIG.delays.betweenRequests);
    
    // Probeer blog posts te vinden (verschillende selectors)
    const content = await page.evaluate(() => {
      const body = document.body.innerText;
      const links = Array.from(document.querySelectorAll('a[href*="/blog"], a[href*="/nieuws"], a[href*="/artikel"], article, .post, .news-item'));
      
      return {
        bodyText: body.substring(0, 5000), // Eerste 5000 chars
        linkCount: links.length,
        titles: links.slice(0, 10).map(el => el.innerText || el.getAttribute('title') || '').filter(t => t.length > 10)
      };
    });
    
    return {
      accessible: true,
      postCount: content.linkCount,
      recentTitles: content.titles,
      relevanceScore: calculateRelevanceScore(content.bodyText + ' ' + content.titles.join(' '), concurrent)
    };
    
  } catch (error) {
    console.log(`  ⚠️  Blog niet toegankelijk: ${error.message}`);
    return {
      accessible: false,
      postCount: 0,
      recentTitles: [],
      relevanceScore: 0
    };
  }
}

async function checkLinkedInActivity(page, concurrent) {
  console.log(`  💼 Checking LinkedIn via Google: ${concurrent.naam}`);
  
  try {
    // Zoek LinkedIn posts via Google (LinkedIn direct scrapen is moeilijk)
    const searchQuery = `site:linkedin.com/posts "${concurrent.naam}"`;
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`, {
      waitUntil: 'networkidle2',
      timeout: 15000
    });
    await delay(CONFIG.delays.betweenRequests);
    
    const results = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div.g, div[data-sokoban-container]'));
      return items.slice(0, 10).map(item => {
        const title = item.querySelector('h3')?.innerText || '';
        const snippet = item.querySelector('.VwiC3b, .yXK7lf')?.innerText || '';
        return { title, snippet };
      }).filter(r => r.title || r.snippet);
    });
    
    const combinedText = results.map(r => r.title + ' ' + r.snippet).join(' ');
    
    return {
      recentPosts: results.length,
      relevanceScore: calculateRelevanceScore(combinedText, concurrent)
    };
    
  } catch (error) {
    console.log(`  ⚠️  LinkedIn check failed: ${error.message}`);
    return {
      recentPosts: 0,
      relevanceScore: 0
    };
  }
}

async function checkGoogleNews(page, concurrent) {
  console.log(`  📡 Checking Google News: ${concurrent.naam}`);
  
  try {
    const searchQuery = `"${concurrent.naam}" techniek OR engineering OR recruitment`;
    await page.goto(`https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=nws`, {
      waitUntil: 'networkidle2',
      timeout: 15000
    });
    await delay(CONFIG.delays.betweenRequests);
    
    const newsItems = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('div.SoaBEf, div[data-sokoban-container]'));
      return items.slice(0, 5).map(item => {
        const title = item.querySelector('div[role="heading"]')?.innerText || '';
        const snippet = item.querySelector('div.GI74Re')?.innerText || '';
        const date = item.querySelector('span.WG9SHc span')?.innerText || '';
        return { title, snippet, date };
      }).filter(r => r.title);
    });
    
    const combinedText = newsItems.map(n => n.title + ' ' + n.snippet).join(' ');
    
    return {
      newsCount: newsItems.length,
      recentNews: newsItems,
      relevanceScore: calculateRelevanceScore(combinedText, concurrent)
    };
    
  } catch (error) {
    console.log(`  ⚠️  Google News check failed: ${error.message}`);
    return {
      newsCount: 0,
      recentNews: [],
      relevanceScore: 0
    };
  }
}

// ============================================================================
// MAIN SCRAPER
// ============================================================================

async function scrapeConcurrentActivity() {
  console.log('🎯 CONCURRENT TRACKER - Starting...\n');
  
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  const results = [];
  const today = getToday();
  
  for (const concurrent of CONFIG.concurrenten) {
    console.log(`\n📊 Processing: ${concurrent.naam}`);
    
    try {
      // Check alle kanalen
      const blogData = await checkBlogActivity(page, concurrent);
      await delay(CONFIG.delays.betweenRequests);
      
      const linkedinData = await checkLinkedInActivity(page, concurrent);
      await delay(CONFIG.delays.betweenRequests);
      
      const newsData = await checkGoogleNews(page, concurrent);
      
      // Bereken overall metrics
      const totalContent = blogData.postCount + linkedinData.recentPosts + newsData.newsCount;
      const avgRelevance = Math.round(
        (blogData.relevanceScore + linkedinData.relevanceScore + newsData.relevanceScore) / 3
      );
      
      const activityLevel = determineActivityLevel(totalContent, avgRelevance);
      const threatLevel = determineThreatLevel(activityLevel, avgRelevance);
      
      // Sla result op
      results.push({
        dataDate: today,
        concurrent: concurrent.naam,
        sector: concurrent.sector,
        blogPosts: blogData.postCount,
        blogRelevance: blogData.relevanceScore,
        linkedinPosts: linkedinData.recentPosts,
        linkedinRelevance: linkedinData.relevanceScore,
        newsItems: newsData.newsCount,
        newsRelevance: newsData.relevanceScore,
        totalContent: totalContent,
        avgRelevance: avgRelevance,
        activityLevel: activityLevel,
        threatLevel: threatLevel,
        topContent: [
          ...blogData.recentTitles.slice(0, 2),
          ...newsData.recentNews.slice(0, 2).map(n => n.title)
        ].join(' | ') || 'Geen recente content',
        lastUpdated: new Date().toISOString()
      });
      
      console.log(`  ✅ ${concurrent.naam}: ${activityLevel} (${totalContent} items, ${avgRelevance}% relevant)`);
      
      await delay(CONFIG.delays.betweenCompetitors);
      
    } catch (error) {
      console.error(`  ❌ Error processing ${concurrent.naam}:`, error.message);
      
      // Voeg foutmelding toe als result
      results.push({
        dataDate: today,
        concurrent: concurrent.naam,
        sector: concurrent.sector,
        blogPosts: 0,
        blogRelevance: 0,
        linkedinPosts: 0,
        linkedinRelevance: 0,
        newsItems: 0,
        newsRelevance: 0,
        totalContent: 0,
        avgRelevance: 0,
        activityLevel: 'ERROR',
        threatLevel: 'ONBEKEND',
        topContent: `Error: ${error.message}`,
        lastUpdated: new Date().toISOString()
      });
    }
  }
  
  await browser.close();
  
  return results;
}

// ============================================================================
// CSV EXPORT
// ============================================================================

async function exportToCSV(results) {
  const csvPath = path.join(CONFIG.outputDir, `concurrent_activity_${getToday()}.csv`);
  
  // CSV Headers
  const headers = [
    'Data Date',
    'Concurrent',
    'Sector',
    'Blog Posts',
    'Blog Relevance %',
    'LinkedIn Posts',
    'LinkedIn Relevance %',
    'News Items',
    'News Relevance %',
    'Total Content',
    'Avg Relevance %',
    'Activity Level',
    'Threat Level',
    'Top Content',
    'Last Updated'
  ];
  
  // CSV Rows
  const rows = results.map(r => [
    r.dataDate,
    r.concurrent,
    r.sector,
    r.blogPosts,
    r.blogRelevance,
    r.linkedinPosts,
    r.linkedinRelevance,
    r.newsItems,
    r.newsRelevance,
    r.totalContent,
    r.avgRelevance,
    r.activityLevel,
    r.threatLevel,
    `"${r.topContent.replace(/"/g, '""')}"`, // Escape quotes
    r.lastUpdated
  ]);
  
  const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  
  await fs.writeFile(csvPath, csv, 'utf-8');
  console.log(`\n✅ CSV exported: ${csvPath}`);
  
  return csvPath;
}

// ============================================================================
// SUMMARY REPORT
// ============================================================================

async function generateSummary(results) {
  const summaryPath = path.join(CONFIG.outputDir, `concurrent_summary_${getToday()}.txt`);
  
  // Groepeer per threat level
  const byThreat = {
    HOOG: results.filter(r => r.threatLevel === 'HOOG'),
    GEMIDDELD: results.filter(r => r.threatLevel === 'GEMIDDELD'),
    LAAG: results.filter(r => r.threatLevel === 'LAAG'),
    MINIMAAL: results.filter(r => r.threatLevel === 'MINIMAAL'),
    ONBEKEND: results.filter(r => r.threatLevel === 'ONBEKEND')
  };
  
  // Top 3 meest actieve concurrenten
  const topActive = [...results]
    .filter(r => r.activityLevel !== 'ERROR')
    .sort((a, b) => b.totalContent - a.totalContent)
    .slice(0, 3);
  
  // Top 3 meest relevante content
  const topRelevant = [...results]
    .filter(r => r.activityLevel !== 'ERROR')
    .sort((a, b) => b.avgRelevance - a.avgRelevance)
    .slice(0, 3);
  
  const summary = `
CONCURRENT ACTIVITY MONITOR - ${getToday()}
================================================================================

📊 OVERVIEW
-----------
Total Concurrenten: ${results.length}
Total Content Items: ${results.reduce((sum, r) => sum + r.totalContent, 0)}
Gemiddelde Relevantie: ${Math.round(results.reduce((sum, r) => sum + r.avgRelevance, 0) / results.length)}%

🚨 THREAT LEVELS
----------------
HOOG:       ${byThreat.HOOG.length} concurrenten
GEMIDDELD:  ${byThreat.GEMIDDELD.length} concurrenten
LAAG:       ${byThreat.LAAG.length} concurrenten
MINIMAAL:   ${byThreat.MINIMAAL.length} concurrenten
ONBEKEND:   ${byThreat.ONBEKEND.length} concurrenten

🔥 TOP 3 MEEST ACTIEF
---------------------
${topActive.map((c, i) => `${i + 1}. ${c.concurrent}: ${c.totalContent} items (${c.activityLevel})`).join('\n')}

⭐ TOP 3 MEEST RELEVANT
-----------------------
${topRelevant.map((c, i) => `${i + 1}. ${c.concurrent}: ${c.avgRelevance}% relevantie`).join('\n')}

🎯 HOGE DREIGING DETAILS
------------------------
${byThreat.HOOG.length > 0 ? byThreat.HOOG.map(c => `
${c.concurrent}:
  - Blog: ${c.blogPosts} posts (${c.blogRelevance}% relevant)
  - LinkedIn: ${c.linkedinPosts} posts (${c.linkedinRelevance}% relevant)
  - News: ${c.newsItems} items (${c.newsRelevance}% relevant)
  - Top Content: ${c.topContent.substring(0, 200)}...
`).join('\n') : 'Geen concurrenten met hoge dreiging.'}

💡 ACTIES
---------
${byThreat.HOOG.length > 0 ? `
⚠️  IMMEDIATE:
   - Review content strategie van: ${byThreat.HOOG.map(c => c.concurrent).join(', ')}
   - Overweeg counter-content op zelfde topics
` : ''}
${byThreat.GEMIDDELD.length > 0 ? `
📌 DEZE WEEK:
   - Monitor activiteit van: ${byThreat.GEMIDDELD.map(c => c.concurrent).join(', ')}
   - Identificeer content gaps
` : ''}
${byThreat.LAAG.length + byThreat.MINIMAAL.length > 0 ? `
📊 MONITOR:
   - Blijf ${byThreat.LAAG.length + byThreat.MINIMAAL.length} minder actieve concurrenten volgen
` : ''}

📅 Next Run: Over 7 dagen
================================================================================
`;
  
  await fs.writeFile(summaryPath, summary, 'utf-8');
  console.log(`✅ Summary generated: ${summaryPath}`);
  
  return summaryPath;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  try {
    // Ensure output directory exists
    await fs.mkdir(CONFIG.outputDir, { recursive: true });
    
    // Run scraper
    const results = await scrapeConcurrentActivity();
    
    // Export data
    await exportToCSV(results);
    await generateSummary(results);
    
    console.log('\n🎉 CONCURRENT TRACKER - Completed!\n');
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { scrapeConcurrentActivity, exportToCSV, generateSummary };
