import { GlucoseUnits } from './units.js';

export interface GlucoseReading {
  value: number;           // mg/dL glucose value (converted only at output)
  timestamp: Date;         // Reading timestamp
  trend: TrendType;        // Arrow direction (up/down/stable)
  isHigh: boolean;         // Above target range
  isLow: boolean;          // Below target range
  color: string;           // UI color indicator
}

export enum TrendType {
  FLAT = "Flat",
  FORTY_FIVE_UP = "FortyFiveUp", 
  SINGLE_UP = "SingleUp",
  DOUBLE_UP = "DoubleUp",
  FORTY_FIVE_DOWN = "FortyFiveDown",
  SINGLE_DOWN = "SingleDown", 
  DOUBLE_DOWN = "DoubleDown"
}

export interface HistoricalData {
  graphData: GlucoseReading[];    // Array of historical readings
  glucoseMeasurement: GlucoseReading; // Latest reading
  activeSensors: SensorInfo[];     // Sensor status/info
}

export interface SensorInfo {
  deviceId: string;
  serialNumber: string;
  activationTime: Date;    // Sensor applied; from the API's epoch-seconds field
  warmupMinutes: number;   // Warmup period reported by the API
  readyTime: Date;         // activation + warmup -- what the LibreLink app calls the start
  state: string;           // "Warming up", "Active", "Unknown"
  deviceType: string;      // "FreeStyle Libre 3", etc.
}

export interface LibreLinkConfig {
  credentials: {
    email: string;
    password: string;
  };
  client: {
    version: string;         // LibreLink client version
    region: 'US' | 'EU';     // API region
  };
  cache: {
    enabled: boolean;
    ttl_minutes: number;     // Cache time-to-live
  };
  ranges: {
    target_low: number;      // Target range low, always mg/dL (default: 70)
    target_high: number;     // Target range high, always mg/dL (default: 180)
  };
  display: {
    units: GlucoseUnits;     // Output unit only; internals stay mg/dL
  };
}

export interface GlucoseStats {
  average: number;
  gmi: number;                    // Glucose Management Indicator
  timeInRange: number;           // Percentage in target range
  timeBelowRange: number;        // Percentage below target
  timeAboveRange: number;        // Percentage above target
  standardDeviation: number;
  coefficientOfVariation: number;
}

export interface TrendAnalysis {
  patterns: string[];
  dawnPhenomenon: boolean;
  mealResponse: number;
  overnightStability: number;
}

export interface MCPError {
  code: string;
  message: string;
  details?: any;
}