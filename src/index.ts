#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { LibreLinkClient } from './librelink-client.js';
import { GlucoseAnalytics } from './glucose-analytics.js';
import { ConfigManager } from './config.js';
import { MCPError } from './types.js';
import { GlucoseUnits, toDisplay, fromDisplay, formatValue, formatRange } from './units.js';

const configManager = new ConfigManager();
let client: LibreLinkClient | null = null;
let analytics: GlucoseAnalytics | null = null;

// Initialize client if configured
export function initializeClient(): void {
  const config = configManager.getConfig();
  if (configManager.isConfigured()) {
    client = new LibreLinkClient(config);
    analytics = new GlucoseAnalytics(config);
  }
}

// Times come back as UTC instants; render local as well so they can be read
// against a clock without mental conversion.
const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatLocal(date: Date): string {
  // Undefined locale so the host's own formatting conventions apply.
  return date.toLocaleString(undefined, {
    timeZone: LOCAL_TZ,
    dateStyle: 'medium',
    timeStyle: 'medium'
  });
}

function displayUnits(): GlucoseUnits {
  return configManager.getConfig().display.units;
}

// Error handler
function handleError(error: any): any {
  console.error('LibreLink MCP Error:', error);
  
  if (error instanceof Error && 'code' in error) {
    const mcpError = error as MCPError;
    return {
      content: [{
        type: 'text',
        text: `Error [${mcpError.code}]: ${mcpError.message}`
      }]
    };
  }

  return {
    content: [{
      type: 'text',
      text: `Error: ${error.message || 'Unknown error occurred'}`
    }]
  };
}

// Tool definitions
function buildTools(): Tool[] {
  const units = displayUnits();
  const ranges = configManager.getConfig().ranges;
  return [
  {
    name: 'get_current_glucose',
    description: `Get the most recent glucose reading from your FreeStyle Libre sensor. Returns current glucose value in ${units}, trend direction (rising/falling/stable), and whether the value is in target range. Use this for real-time glucose monitoring.`,
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_glucose_history',
    description: 'Retrieve historical glucose readings for analysis. Returns an array of timestamped glucose values. Useful for reviewing past glucose levels, identifying patterns, or checking overnight values. Default retrieves 24 hours of data.',
    inputSchema: {
      type: 'object',
      properties: {
        hours: {
          type: 'number',
          description: 'Number of hours of history to retrieve (1-720). Default: 24. Examples: 1 for last hour, 8 for overnight, 168 for one week'
        }
      },
      required: []
    }
  },
  {
    name: 'get_glucose_stats',
    description: 'Calculate comprehensive glucose statistics including average glucose, GMI (estimated A1C), time-in-range percentages, and variability metrics. Essential for diabetes management insights and identifying areas for improvement.',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze (1-90). Default: 7. Common periods: 7 (weekly report), 14 (two weeks), 30 (monthly), 90 (quarterly)'
        }
      },
      required: []
    }
  },
  {
    name: 'get_glucose_trends',
    description: 'Analyze glucose patterns including dawn phenomenon (early morning rise), meal responses, and overnight stability. Helps identify recurring patterns that may need attention or treatment adjustments.',
    inputSchema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly'],
          description: 'Analysis period for pattern detection. Default: weekly. Use daily for detailed patterns, weekly for typical patterns, monthly for long-term trends'
        }
      },
      required: []
    }
  },
  {
    name: 'get_sensor_info',
    description: 'Get information about your active FreeStyle Libre sensor including activation date, remaining lifetime, and connection status. Use this to check if sensor is working properly or needs replacement.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'configure_credentials',
    description: 'Set up or update your LibreLink account credentials for data access. Required before using any glucose reading tools. Credentials are stored securely on your local machine only.',
    inputSchema: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Your LibreLink account email address (same as used in the LibreLink app)'
        },
        password: {
          type: 'string',
          description: 'Your LibreLink account password'
        },
        region: {
          type: 'string',
          enum: ['US', 'EU'],
          description: 'Your LibreLink account region. US for United States, EU for Europe. Default: US'
        }
      },
      required: ['email', 'password']
    }
  },
  {
    name: 'configure_ranges',
    description: `Customize your target glucose range for personalized time-in-range calculations. Values are given in ${units}. Standard range is ${formatRange(70, 180, units)}, but your healthcare provider may recommend different targets based on your individual needs.`,
    inputSchema: {
      type: 'object',
      properties: {
        target_low: {
          type: 'number',
          description: `Lower bound of target range in ${units}. Common values: ${toDisplay(70, units)} (standard), ${toDisplay(80, units)} (tighter control), ${toDisplay(60, units)} (athletic)`
        },
        target_high: {
          type: 'number',
          description: `Upper bound of target range in ${units}. Common values: ${toDisplay(180, units)} (standard), ${toDisplay(140, units)} (tighter control), ${toDisplay(200, units)} (relaxed)`
        }
      },
      required: ['target_low', 'target_high']
    }
  },
  {
    name: 'configure_units',
    description: `Set the glucose unit used in all output. Currently ${units}. Use mmol/L for the UK, Europe, South Africa, Australia and most of the world; mg/dL for the US. Target ranges are preserved across the change (currently ${formatRange(ranges.target_low, ranges.target_high, units)}).`,
    inputSchema: {
      type: 'object',
      properties: {
        units: {
          type: 'string',
          enum: ['mg/dL', 'mmol/L'],
          description: 'Glucose unit for all reported values'
        }
      },
      required: ['units']
    }
  },
  {
    name: 'validate_connection',
    description: 'Test the connection to LibreLink servers and verify your credentials are working. Use this if you encounter errors or after updating credentials. Returns success/failure status.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
  ];
}

type CallToolRequest = z.infer<typeof CallToolRequestSchema>;

async function callTool(request: CallToolRequest) {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_current_glucose': {
        if (!client) {
          throw new Error('LibreLink not configured. Use configure_credentials first.');
        }

        const reading = await client.getCurrentGlucose();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              current_glucose: toDisplay(reading.value, displayUnits()),
              units: displayUnits(),
              timestamp_local: formatLocal(reading.timestamp),
              timestamp_utc: reading.timestamp.toISOString(),
              timezone: LOCAL_TZ,
              trend: reading.trend,
              status: reading.isHigh ? 'High' : reading.isLow ? 'Low' : 'Normal',
              color: reading.color
            }, null, 2)
          }]
        };
      }

      case 'get_glucose_history': {
        if (!client) {
          throw new Error('LibreLink not configured. Use configure_credentials first.');
        }

        const hours = (args?.hours as number) || 24;
        const history = await client.getGlucoseHistory(hours);
        const units = displayUnits();

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              period_hours: hours,
              total_readings: history.length,
              units,
              readings: history.map(r => ({ ...r, value: toDisplay(r.value, units) }))
            }, null, 2)
          }]
        };
      }

      case 'get_glucose_stats': {
        if (!client || !analytics) {
          throw new Error('LibreLink not configured. Use configure_credentials first.');
        }

        const days = (args?.days as number) || 7;
        const readings = await client.getGlucoseHistory(days * 24);
        const stats = analytics.calculateGlucoseStats(readings);
        const units = displayUnits();
        const ranges = configManager.getConfig().ranges;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              analysis_period_days: days,
              units,
              average_glucose: toDisplay(stats.average, units),
              // GMI is an estimated A1C percentage, not a glucose concentration
              glucose_management_indicator_percent: stats.gmi,
              time_in_range: {
                target_range: formatRange(ranges.target_low, ranges.target_high, units),
                in_range_percent: stats.timeInRange,
                below_range_percent: stats.timeBelowRange,
                above_range_percent: stats.timeAboveRange
              },
              variability: {
                standard_deviation: toDisplay(stats.standardDeviation, units),
                coefficient_of_variation_percent: stats.coefficientOfVariation
              }
            }, null, 2)
          }]
        };
      }

      case 'get_glucose_trends': {
        if (!client || !analytics) {
          throw new Error('LibreLink not configured. Use configure_credentials first.');
        }

        const period = (args?.period as 'daily' | 'weekly' | 'monthly') || 'weekly';
        const daysToAnalyze = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
        const readings = await client.getGlucoseHistory(daysToAnalyze * 24);
        const trends = analytics.analyzeTrends(readings, period);
        const units = displayUnits();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              period: period,
              units,
              patterns: trends.patterns,
              dawn_phenomenon: trends.dawnPhenomenon,
              meal_response_average: toDisplay(trends.mealResponse, units),
              overnight_stability: toDisplay(trends.overnightStability, units)
            }, null, 2)
          }]
        };
      }

      case 'get_sensor_info': {
        if (!client) {
          throw new Error('LibreLink not configured. Use configure_credentials first.');
        }

        const sensors = await client.getSensorInfo();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              timezone: LOCAL_TZ,
              active_sensors: sensors.map(s => ({
                device_id: s.deviceId,
                serial_number: s.serialNumber,
                device_type: s.deviceType,
                state: s.state,
                applied_local: formatLocal(s.activationTime),
                applied_utc: s.activationTime.toISOString(),
                warmup_minutes: s.warmupMinutes,
                // What the LibreLink app shows as the sensor start
                started_local: formatLocal(s.readyTime),
                started_utc: s.readyTime.toISOString()
              })),
              sensor_count: sensors.length
            }, null, 2)
          }]
        };
      }

      case 'configure_credentials': {
        const { email, password, region } = args as { 
          email: string; 
          password: string; 
          region?: 'US' | 'EU' 
        };

        configManager.updateCredentials(email, password);
        if (region) {
          configManager.updateRegion(region);
        }

        // Reinitialize client with new credentials
        initializeClient();

        return {
          content: [{
            type: 'text',
            text: 'LibreLink credentials configured successfully. Use validate_connection to test.'
          }]
        };
      }

      case 'configure_ranges': {
        const { target_low, target_high } = args as { 
          target_low: number; 
          target_high: number 
        };

        const units = displayUnits();
        configManager.updateRanges(
          fromDisplay(target_low, units),
          fromDisplay(target_high, units)
        );

        // Reinitialize client with new ranges
        initializeClient();

        return {
          content: [{
            type: 'text',
            text: `Target glucose ranges updated: ${formatValue(fromDisplay(target_low, units), units)}-${formatValue(fromDisplay(target_high, units), units)} ${units}`
          }]
        };
      }

      case 'configure_units': {
        const { units } = args as { units: GlucoseUnits };

        configManager.updateUnits(units);
        initializeClient();

        const ranges = configManager.getConfig().ranges;
        return {
          content: [{
            type: 'text',
            text: `Glucose units set to ${units}. Target range is now shown as ${formatRange(ranges.target_low, ranges.target_high, units)}.`
          }]
        };
      }

      case 'validate_connection': {
        if (!client) {
          throw new Error('LibreLink not configured. Use configure_credentials first.');
        }

        const isValid = await client.validateConnection();
        return {
          content: [{
            type: 'text',
            text: isValid 
              ? 'LibreLink connection validated successfully!'
              : 'LibreLink connection failed. Check credentials and sensor status.'
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return handleError(error);
  }
}

// One Server instance can only be bound to a single transport, so the HTTP
// entrypoint needs a fresh one per connection. Client and config stay shared.
export function createServer(): Server {
  const server = new Server(
    { name: 'librelink-mcp-server', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: buildTools() }));
  server.setRequestHandler(CallToolRequestSchema, callTool);
  return server;
}

// Initialize and start server
async function main() {
  initializeClient();

  const transport = new StdioServerTransport();
  await createServer().connect(transport);
  
  console.error('LibreLink MCP Server running on stdio');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}