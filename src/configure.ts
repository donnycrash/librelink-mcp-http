#!/usr/bin/env node

import * as readline from 'readline';
import { ConfigManager } from './config.js';
import { GlucoseUnits, toDisplay, fromDisplay } from './units.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('LibreLink MCP Server Configuration');
  console.log('==================================\n');

  const configManager = new ConfigManager();
  const currentConfig = configManager.getConfig();

  // Configure credentials
  const email = await question(`LibreLink email (current: ${currentConfig.credentials.email || 'not set'}): `);
  const password = await question('LibreLink password (current: hidden): ');
  
  // Configure region
  console.log('\nAvailable regions:');
  console.log('1. US (United States)');
  console.log('2. EU (Europe)');
  const regionChoice = await question(`Choose region (1 or 2, current: ${currentConfig.client.region}): `);
  const region = regionChoice === '2' ? 'EU' : 'US';

  // Configure display units
  console.log('\nGlucose units:');
  console.log('1. mg/dL (United States)');
  console.log('2. mmol/L (UK, Europe, South Africa, Australia)');
  const unitsChoice = await question(`Choose units (1 or 2, current: ${currentConfig.display.units}): `);
  const units: GlucoseUnits = unitsChoice === '2'
    ? 'mmol/L'
    : unitsChoice === '1' ? 'mg/dL' : currentConfig.display.units;

  // Configure target ranges, entered in the unit chosen above
  const targetLow = await question(`Target glucose low (${units}, current: ${toDisplay(currentConfig.ranges.target_low, units)}): `);
  const targetHigh = await question(`Target glucose high (${units}, current: ${toDisplay(currentConfig.ranges.target_high, units)}): `);

  // Update configuration
  if (email.trim()) {
    configManager.updateCredentials(email.trim(), password);
  }
  
  configManager.updateRegion(region as 'US' | 'EU');
  configManager.updateUnits(units);

  if (targetLow.trim() && targetHigh.trim()) {
    const low = parseFloat(targetLow);
    const high = parseFloat(targetHigh);
    if (!isNaN(low) && !isNaN(high)) {
      configManager.updateRanges(fromDisplay(low, units), fromDisplay(high, units));
    }
  }

  // Validate configuration
  const errors = configManager.validateConfig();
  if (errors.length > 0) {
    console.log('\n❌ Configuration errors:');
    errors.forEach(error => console.log(`  - ${error}`));
    rl.close();
    process.exit(1);
  }

  console.log('\n✅ Configuration saved successfully!');
  console.log('\nNext steps:');
  console.log('1. Add this server to your Claude Desktop configuration');
  console.log('2. Restart Claude Desktop');
  console.log('3. Test the connection using the validate_connection tool');

  rl.close();
}

main().catch(console.error);