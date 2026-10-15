import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { LibreLinkConfig } from './types.js';
import { GlucoseUnits, toDisplay } from './units.js';

// Overridable so tests never write over a real configuration.
const CONFIG_DIR = process.env.LIBRELINK_MCP_CONFIG_DIR || join(homedir(), '.librelink-mcp');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export const DEFAULT_CONFIG: LibreLinkConfig = {
  credentials: {
    email: '',
    password: ''
  },
  client: {
    version: '4.12.0',
    region: 'US'
  },
  cache: {
    enabled: true,
    ttl_minutes: 5
  },
  ranges: {
    target_low: 70,
    target_high: 180
  },
  display: {
    units: 'mg/dL'
  }
};

const REGIONS = ['US', 'EU'] as const;
const UNITS: GlucoseUnits[] = ['mg/dL', 'mmol/L'];

// Hosted deployments have no interactive configure step and no durable home
// directory, so credentials may arrive through the environment. Env wins over
// the file so a stale config.json cannot shadow an injected secret.
function applyEnvOverrides(config: LibreLinkConfig): LibreLinkConfig {
  const { LIBRELINK_EMAIL, LIBRELINK_PASSWORD, LIBRELINK_REGION, LIBRELINK_UNITS } = process.env;

  const region = REGIONS.find(r => r === LIBRELINK_REGION?.toUpperCase());
  if (LIBRELINK_REGION && !region) {
    console.warn(`Ignoring LIBRELINK_REGION="${LIBRELINK_REGION}"; expected one of ${REGIONS.join(', ')}`);
  }

  const units = UNITS.find(u => u.toLowerCase() === LIBRELINK_UNITS?.toLowerCase());
  if (LIBRELINK_UNITS && !units) {
    console.warn(`Ignoring LIBRELINK_UNITS="${LIBRELINK_UNITS}"; expected one of ${UNITS.join(', ')}`);
  }

  return {
    ...config,
    credentials: {
      email: LIBRELINK_EMAIL ?? config.credentials.email,
      password: LIBRELINK_PASSWORD ?? config.credentials.password
    },
    client: { ...config.client, region: region ?? config.client.region },
    display: { ...config.display, units: units ?? config.display.units }
  };
}

export class ConfigManager {
  private config: LibreLinkConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): LibreLinkConfig {
    return applyEnvOverrides(this.loadConfigFile());
  }

  private loadConfigFile(): LibreLinkConfig {
    if (!existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG };
    }

    try {
      const configData = readFileSync(CONFIG_FILE, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      // Merge with defaults to ensure all properties exist
      return {
        ...DEFAULT_CONFIG,
        ...parsedConfig,
        credentials: {
          ...DEFAULT_CONFIG.credentials,
          ...parsedConfig.credentials
        },
        client: {
          ...DEFAULT_CONFIG.client,
          ...parsedConfig.client
        },
        cache: {
          ...DEFAULT_CONFIG.cache,
          ...parsedConfig.cache
        },
        ranges: {
          ...DEFAULT_CONFIG.ranges,
          ...parsedConfig.ranges
        },
        display: {
          ...DEFAULT_CONFIG.display,
          ...parsedConfig.display
        }
      };
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
      return { ...DEFAULT_CONFIG };
    }
  }

  saveConfig(config: LibreLinkConfig): void {
    try {
      // Ensure config directory exists
      mkdirSync(CONFIG_DIR, { recursive: true });

      writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      this.config = config;
    } catch (error) {
      throw new Error(`Failed to save config: ${error}`);
    }
  }

  getConfig(): LibreLinkConfig {
    return { ...this.config };
  }

  updateCredentials(email: string, password: string): void {
    const updatedConfig = {
      ...this.config,
      credentials: { email, password }
    };
    this.saveConfig(updatedConfig);
  }

  updateRanges(targetLow: number, targetHigh: number): void {
    const updatedConfig = {
      ...this.config,
      ranges: {
        target_low: targetLow,
        target_high: targetHigh
      }
    };
    this.saveConfig(updatedConfig);
  }

  updateUnits(units: GlucoseUnits): void {
    const updatedConfig = {
      ...this.config,
      display: {
        ...this.config.display,
        units
      }
    };
    this.saveConfig(updatedConfig);
  }

  updateRegion(region: 'US' | 'EU'): void {
    const updatedConfig = {
      ...this.config,
      client: {
        ...this.config.client,
        region
      }
    };
    this.saveConfig(updatedConfig);
  }

  isConfigured(): boolean {
    return !!(this.config.credentials.email && this.config.credentials.password);
  }

  validateConfig(): string[] {
    const errors: string[] = [];

    if (!this.config.credentials.email) {
      errors.push('Email is required');
    }

    if (!this.config.credentials.password) {
      errors.push('Password is required');
    }

    if (this.config.ranges.target_low >= this.config.ranges.target_high) {
      errors.push('Target low must be less than target high');
    }

    const units = this.config.display.units;

    if (this.config.ranges.target_low < 50 || this.config.ranges.target_low > 150) {
      errors.push(`Target low should be between ${toDisplay(50, units)}-${toDisplay(150, units)} ${units}`);
    }

    if (this.config.ranges.target_high < 100 || this.config.ranges.target_high > 300) {
      errors.push(`Target high should be between ${toDisplay(100, units)}-${toDisplay(300, units)} ${units}`);
    }

    return errors;
  }
}