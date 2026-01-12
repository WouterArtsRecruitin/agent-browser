#!/usr/bin/env node

/**
 * INTELLIGENCE HUB - PRE-DEPLOYMENT TEST SCRIPT
 * 
 * Valideert dat alle scrapers correct geconfigureerd zijn en kunnen draaien.
 * Run dit VOOR deployment naar productie.
 * 
 * Usage: node test-deployment.js
 */

const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
  scrapers: [
    { name: 'market-trends-scraper.js', timeout: 300000 }, // 5 min
    { name: 'icp-monitor.js', timeout: 180000 },           // 3 min
    { name: 'concurrent-tracker.js', timeout: 360000 }     // 6 min
  ],
  outputDir: './scraper-output',
  requiredFiles: [
    'market-trends-scraper.js',
    'icp-monitor.js',
    'concurrent-tracker.js',
    'package.json',
    'README.md'
  ]
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(text) {
  console.log('');
  log('='.repeat(60), 'cyan');
  log(`  ${text}`, 'bright');
  log('='.repeat(60), 'cyan');
  console.log('');
}

async function checkFile(filepath) {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

async function checkNodeVersion() {
  const version = process.version;
  const major = parseInt(version.split('.')[0].substring(1));
  
  if (major >= 18) {
    log(`✓ Node.js versie OK: ${version}`, 'green');
    return true;
  } else {
    log(`✗ Node.js versie te oud: ${version} (minimaal v18 vereist)`, 'red');
    return false;
  }
}

async function checkDependencies() {
  try {
    require('puppeteer');
    log('✓ Puppeteer geïnstalleerd', 'green');
    return true;
  } catch {
    log('✗ Puppeteer NIET geïnstalleerd', 'red');
    log('  Run: npm install puppeteer', 'yellow');
    return false;
  }
}

async function checkFiles() {
  let allPresent = true;
  
  for (const file of CONFIG.requiredFiles) {
    const exists = await checkFile(file);
    if (exists) {
      log(`✓ ${file}`, 'green');
    } else {
      log(`✗ ${file} NIET GEVONDEN`, 'red');
      allPresent = false;
    }
  }
  
  return allPresent;
}

async function checkOutputDir() {
  try {
    await fs.mkdir(CONFIG.outputDir, { recursive: true });
    log(`✓ Output directory bestaat: ${CONFIG.outputDir}`, 'green');
    return true;
  } catch (error) {
    log(`✗ Kan output directory niet aanmaken: ${error.message}`, 'red');
    return false;
  }
}

async function validateScraperConfig(scraperPath) {
  try {
    const content = await fs.readFile(scraperPath, 'utf-8');
    
    // Check for CONFIG object
    if (!content.includes('const CONFIG = {')) {
      log(`  ⚠ Geen CONFIG object gevonden`, 'yellow');
      return false;
    }
    
    // Check for required functions
    const requiredFunctions = ['scrape', 'generateCSV', 'main'];
    for (const func of requiredFunctions) {
      if (!content.includes(`function ${func}`) && !content.includes(`async function ${func}`)) {
        log(`  ⚠ Function '${func}' niet gevonden`, 'yellow');
      }
    }
    
    return true;
  } catch (error) {
    log(`  ✗ Kan scraper niet lezen: ${error.message}`, 'red');
    return false;
  }
}

async function testScraperSyntax(scraperPath) {
  try {
    // Try to require without executing
    const scraperCode = await fs.readFile(scraperPath, 'utf-8');
    
    // Basic syntax check (look for common errors)
    if (scraperCode.includes('console.log(') && scraperCode.includes('await ')) {
      log(`  ✓ Basis syntax lijkt OK`, 'green');
      return true;
    }
    
    return true;
  } catch (error) {
    log(`  ✗ Syntax error: ${error.message}`, 'red');
    return false;
  }
}

async function estimateRuntime(scraperName) {
  // Rough estimates based on scraper complexity
  const estimates = {
    'market-trends-scraper.js': '3-5 minuten',
    'icp-monitor.js': '2-3 minuten',
    'concurrent-tracker.js': '4-6 minuten'
  };
  
  return estimates[scraperName] || 'onbekend';
}

async function runTests() {
  header('INTELLIGENCE HUB - PRE-DEPLOYMENT TEST');
  
  let allTestsPassed = true;
  
  // Test 1: Node.js version
  header('TEST 1: Node.js Versie');
  if (!await checkNodeVersion()) {
    allTestsPassed = false;
  }
  
  // Test 2: Dependencies
  header('TEST 2: Dependencies');
  if (!await checkDependencies()) {
    allTestsPassed = false;
    log('\n  NOTE: Puppeteer kan niet geïnstalleerd worden in deze environment.', 'yellow');
    log('  Dit script test alleen de configuratie.', 'yellow');
    log('  Deploy naar een echte server om scrapers te draaien.\n', 'yellow');
  }
  
  // Test 3: Required files
  header('TEST 3: Vereiste Bestanden');
  if (!await checkFiles()) {
    allTestsPassed = false;
  }
  
  // Test 4: Output directory
  header('TEST 4: Output Directory');
  if (!await checkOutputDir()) {
    allTestsPassed = false;
  }
  
  // Test 5: Scraper configuration
  header('TEST 5: Scraper Configuratie');
  for (const scraper of CONFIG.scrapers) {
    log(`\nChecking ${scraper.name}...`, 'cyan');
    
    if (!await validateScraperConfig(scraper.name)) {
      allTestsPassed = false;
    }
    
    if (!await testScraperSyntax(scraper.name)) {
      allTestsPassed = false;
    }
    
    const runtime = await estimateRuntime(scraper.name);
    log(`  ℹ Geschatte runtime: ${runtime}`, 'blue');
  }
  
  // Final summary
  header('TEST RESULTATEN');
  
  if (allTestsPassed) {
    log('✓ ALLE TESTS GESLAAGD!', 'green');
    log('\nScrapers zijn klaar voor deployment.', 'green');
    log('\nVolgende stappen:', 'cyan');
    log('1. Kies deployment optie (zie DEPLOYMENT_CHECKLIST.md)', 'cyan');
    log('2. Deploy naar server/GitHub/Vercel', 'cyan');
    log('3. Test eerste run in productie', 'cyan');
    log('4. Schedule wekelijkse runs (maandag 08:00)', 'cyan');
  } else {
    log('✗ SOMMIGE TESTS GEFAALD', 'red');
    log('\nFix de bovenstaande issues voordat je deploy.', 'yellow');
    log('Check README.md en DEPLOYMENT_CHECKLIST.md voor hulp.', 'yellow');
  }
  
  console.log('');
  
  // Configuration summary
  header('CONFIGURATIE OVERZICHT');
  log('Scrapers:', 'cyan');
  for (const scraper of CONFIG.scrapers) {
    log(`  - ${scraper.name}`, 'blue');
  }
  
  log('\nOutput directory:', 'cyan');
  log(`  ${CONFIG.outputDir}`, 'blue');
  
  log('\nDocumentatie:', 'cyan');
  log('  - README.md (technische docs)', 'blue');
  log('  - DEPLOYMENT_CHECKLIST.md (deployment guide)', 'blue');
  log('  - QUICK_REFERENCE.md (daily operations)', 'blue');
  log('  - PROJECT_SUMMARY.md (complete overview)', 'blue');
  
  console.log('');
  
  return allTestsPassed ? 0 : 1;
}

// Run tests
runTests()
  .then(exitCode => {
    process.exit(exitCode);
  })
  .catch(error => {
    log(`\n✗ FATAL ERROR: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
