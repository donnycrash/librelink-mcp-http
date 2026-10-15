# LibreLink MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

A local [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that provides Claude Desktop with secure access to your FreeStyle LibreLink continuous glucose monitoring (CGM) data.

![LibreLink MCP Demo](https://img.shields.io/badge/Demo-Working%20with%20Real%20Data-green)

## 🌟 Features

- **Real-time glucose monitoring** - Get current readings with trend arrows
- **Historical data analysis** - Retrieve glucose history over customizable periods
- **Comprehensive analytics** - Time-in-range, GMI, variability metrics
- **mg/dL or mmol/L** - Choose your unit; analytics stay accurate either way
- **Pattern recognition** - Dawn phenomenon, meal responses, stability analysis
- **Privacy-first design** - All data stays local on your machine
- **Secure credential management** - Local encrypted storage
- **Cross-platform health integration** - Works alongside other health MCP servers

## 📋 Prerequisites

- **LibreLink Account**: Active FreeStyle LibreLink account with glucose data
- **Compatible Sensor**: FreeStyle Libre 2 or 3 with data sharing enabled
- **Node.js**: Version 18.0.0 or higher
- **Claude Desktop**: For MCP integration

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/librelink-mcp-server.git
cd librelink-mcp-server

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Configuration

```bash
# Configure your LibreLink credentials
npm run configure
```

You'll be prompted for:
- **Email**: Your LibreLink account email
- **Password**: Your LibreLink account password
- **Region**: US or EU (based on your location)
- **Units**: mg/dL (United States) or mmol/L (UK, Europe, South Africa, Australia)
- **Target ranges**: Glucose target ranges, entered in your chosen unit
  (default: 70-180 mg/dL, shown as 3.9-10.0 mmol/L)

### 3. Test Connection

```bash
# Test your LibreLink connection
node test-real-connection.js
```

### 4. Claude Desktop Integration

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "librelink": {
      "command": "node",
      "args": ["/path/to/librelink-mcp-server/dist/index.js"],
      "env": {
        "LIBRE_LINK_UP_VERSION": "4.16.0"
      }
    }
  }
}
```

> **The `env` block is required.** Abbott rejects the client version pinned by
> the upstream API library with `403` / status `920` and a `minimumVersion` in
> the response body. Set `LIBRE_LINK_UP_VERSION` to at least that version. See
> [Troubleshooting](#-troubleshooting).

If you already have other MCP servers configured, merge the `librelink` key
into the existing `mcpServers` object rather than replacing the file.

### 5. Restart Claude Desktop

Restart Claude Desktop to load the new MCP server.

## 🩸 Usage Examples

Once integrated with Claude Desktop, you can ask:

### Basic Glucose Queries
- *"What's my current glucose level?"*
- *"Show me my glucose readings from the past 6 hours"*
- *"What's my average glucose today?"*

### Analytics & Insights
- *"Calculate my time in range for this week"*
- *"Analyze my glucose patterns and trends"*
- *"Do I have dawn phenomenon?"*
- *"How stable are my overnight glucose levels?"*

### Health Correlations
When combined with other health MCP servers:
- *"How does my sleep quality affect my glucose control?"*
- *"Compare my glucose variability with my stress levels"*
- *"Show the impact of my supplements on glucose stability"*

## 🛠 Available MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `get_current_glucose` | Real-time glucose reading with trend | None |
| `get_glucose_history` | Historical glucose data | `hours` (default: 24) |
| `get_glucose_stats` | Statistics and time-in-range | `days` (default: 7) |
| `get_glucose_trends` | Pattern analysis | `period` (daily/weekly/monthly) |
| `get_sensor_info` | Sensor status and info | None |
| `configure_credentials` | Update LibreLink credentials | `email`, `password`, `region` |
| `configure_ranges` | Set target glucose ranges, in the configured unit | `target_low`, `target_high` |
| `configure_units` | Switch between mg/dL and mmol/L | `units` |
| `validate_connection` | Test LibreLink connection | None |

## 📊 Sample Output

Samples below use the default `mg/dL`. With `mmol/L` configured, every glucose
value converts and `units` reports `mmol/L`.

### Current Glucose Reading
```json
{
  "current_glucose": 105,
  "units": "mg/dL",
  "timestamp_local": "Jul 14, 2025, 11:19:24 PM",
  "timestamp_utc": "2025-07-14T21:19:24.000Z",
  "timezone": "Europe/London",
  "trend": "Flat",
  "status": "Normal",
  "color": "green"
}
```

### Glucose Statistics
```json
{
  "analysis_period_days": 7,
  "units": "mg/dL",
  "average_glucose": 93.46,
  "glucose_management_indicator_percent": 5.55,
  "time_in_range": {
    "target_range": "70-180 mg/dL",
    "in_range_percent": 100.0,
    "below_range_percent": 0.0,
    "above_range_percent": 0.0
  },
  "variability": {
    "standard_deviation": 7.52,
    "coefficient_of_variation_percent": 8.04
  }
}
```

GMI is an estimated A1C percentage and the variability figures are ratios, so
they read the same in either unit. `average_glucose` and `standard_deviation`
are concentrations and convert with the configured unit.

### Trend Analysis
```json
{
  "period": "daily",
  "units": "mg/dL",
  "patterns": [
    "Good postprandial glucose control",
    "Excellent overnight glucose stability"
  ],
  "dawn_phenomenon": false,
  "meal_response_average": 0,
  "overnight_stability": 2.08
}
```

### Sensor Information
```json
{
  "timezone": "Europe/London",
  "active_sensors": [
    {
      "device_id": "8389721a-5e5d-11ef-82f7-923037a589ee",
      "serial_number": "MH00XXXXXX",
      "device_type": "FreeStyle Libre 3",
      "state": "Active",
      "applied_local": "Sep 3, 2026, 11:05:28 AM",
      "applied_utc": "2026-09-03T09:05:28.000Z",
      "warmup_minutes": 60,
      "started_local": "Sep 3, 2026, 12:05:28 PM",
      "started_utc": "2026-09-03T10:05:28.000Z"
    }
  ],
  "sensor_count": 1
}
```

`applied_*` is when the sensor was attached; `started_*` adds the reported
warmup period and is the figure the LibreLink app shows as the sensor start.
Timestamps are given in both the host timezone and UTC.

## 🌐 Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `LIBRE_LINK_UP_VERSION` | `4.7.0` (set by the API library) | Client version sent to Abbott. Must meet the API's current `minimumVersion` or requests fail with `403` / status `920`. |
| `LIBRELINK_MCP_CONFIG_DIR` | `~/.librelink-mcp` | Directory holding `config.json`. Override to keep separate profiles, or to avoid touching a real configuration. |
| `LIBRELINK_EMAIL` | unset | LibreLink account email. Overrides the value in `config.json`. |
| `LIBRELINK_PASSWORD` | unset | LibreLink account password. Overrides the value in `config.json`. |
| `LIBRELINK_REGION` | from config (`US`) | `US` or `EU`. Overrides the value in `config.json`. |
| `LIBRELINK_UNITS` | from config (`mg/dL`) | `mg/dL` or `mmol/L`. Overrides the value in `config.json`. |
| `MCP_AUTH_TOKEN` | unset | **HTTP mode only.** Bearer token every request to `/mcp` must present. The HTTP server refuses to start without it. |
| `PORT` | `3000` | **HTTP mode only.** Port the HTTP server listens on. |

Environment values take precedence over `config.json`, so an injected secret is
never shadowed by a stale file. Invalid `LIBRELINK_REGION` or `LIBRELINK_UNITS`
values are ignored with a warning.

## ☁️ Remote Deployment (Northflank)

The default `dist/index.js` speaks MCP over stdio, which only works when a
client launches it as a child process. For a hosted deployment the server also
ships a Streamable HTTP entrypoint, `dist/http.js`, that listens on `PORT`,
exposes `POST /mcp` behind bearer-token auth, and answers `GET /health` for
platform health checks. The included `Dockerfile` builds that entrypoint.

> Hosting this server moves your LibreLink password and glucose history onto a
> third-party platform. The local-only privacy posture described below does not
> apply to a remote deployment. Keep `MCP_AUTH_TOKEN` long and random and treat
> the URL as sensitive.

### Northflank setup

1. Create a project, then add a **Combined service** linked to this repository
   and branch.
2. Build type **Dockerfile**, path `/Dockerfile`.
3. Under **Networking**, add port `3000`, protocol HTTP, publicly exposed.
   Northflank issues a `*.code.run` URL with TLS.
4. Create a **Secret group** with `LIBRELINK_EMAIL`, `LIBRELINK_PASSWORD`,
   `LIBRELINK_REGION`, and `MCP_AUTH_TOKEN` (for example
   `openssl rand -hex 32`), and link it to the service.
5. Set the health check to HTTP `GET /health` on port `3000`.
6. Run a single replica. The glucose cache and the LibreLink login session live
   in process memory, and multiple replicas would each log in to Abbott
   separately.

### Connecting a client

```bash
# Claude Code
claude mcp add --transport http librelink https://<your-service>.code.run/mcp \
  --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
```

In Claude Desktop, add the same URL as a remote connector with the
`Authorization: Bearer <MCP_AUTH_TOKEN>` header.

### Running the HTTP server locally

```bash
npm run build
MCP_AUTH_TOKEN=dev-token npm run start:http
curl http://localhost:3000/health
```

Or with Docker:

```bash
docker build -t librelink-mcp .
docker run --rm -p 3000:3000 \
  -e MCP_AUTH_TOKEN=dev-token \
  -e LIBRELINK_EMAIL=you@example.com \
  -e LIBRELINK_PASSWORD=secret \
  librelink-mcp
```

## 🔧 Development

### Running Tests

```bash
# Run all tests
npm test

# Test MCP protocol
npm run test:mcp

# Test analytics with mock data
npm run test:analytics

# Test environment-variable config overrides
npm run test:config

# Test the HTTP entrypoint (health, auth, tools/list)
npm run test:http

# Test with real LibreLink data (requires configuration)
node test-real-data.js
```

`npm run test:mcp` calls the `configure_credentials` tool with dummy values. It
points `LIBRELINK_MCP_CONFIG_DIR` at a temporary directory it removes on
teardown, so your real credentials in `~/.librelink-mcp/config.json` are left
untouched. Tests that exercise live data (`test-real-connection.js`,
`test-real-data.js`) deliberately read the real configuration, and need
`LIBRE_LINK_UP_VERSION` set in the environment.

### Building

```bash
# Build TypeScript
npm run build

# Type checking
npm run typecheck

# Development mode
npm run dev
```

### Project Structure

```
librelink-mcp-server/
├── src/
│   ├── index.ts              # Main MCP server
│   ├── librelink-client.ts   # LibreLink API wrapper
│   ├── glucose-analytics.ts  # Analytics and statistics
│   ├── config.ts             # Configuration management
│   ├── configure.ts          # CLI configuration tool
│   ├── units.ts              # mg/dL <-> mmol/L conversion
│   └── types.ts              # TypeScript definitions
├── config/
│   └── default.json          # Default configuration
├── test-*.js                 # Test suites
├── package.json
└── README.md
```

## 🔒 Security & Privacy

### Data Privacy
- **Local processing only** - No data sent to external servers
- **Your data stays on your machine** - Complete privacy control
- **No analytics or tracking** - Zero telemetry

### Credential Security
- **Local storage** - Credentials stored in `~/.librelink-mcp/config.json`
- **File permissions** - Automatically set to user-only access (600)
- **No cloud storage** - Never uploaded or shared

### Security Best Practices
```bash
# Verify file permissions
ls -la ~/.librelink-mcp/config.json
# Should show: -rw------- (user read/write only)

# Optional: Encrypt config directory
# (Implementation details in documentation)
```

## ⚠️ Important Notes

### LibreLink API Usage
- This project uses an **unofficial API** through reverse engineering
- **Not affiliated with Abbott** or FreeStyle Libre
- **Use at your own discretion** and ensure compliance with LibreLink terms
- **API may change** - community maintained compatibility

### Data Sharing Requirements
- Ensure your **LibreLink app has data sharing enabled**
- Your **sensor must be active** and transmitting data
- **LibreLink account** (not LibreLinkUp) credentials required

### Sensor Compatibility
- ✅ **FreeStyle Libre 2**
- ✅ **FreeStyle Libre 3**
- ❓ **FreeStyle Libre 1** (may work, not tested)

## 🐛 Troubleshooting

### Common Issues

**`403` with `{"status": 920, "data": {"minimumVersion": "..."}}`**
- Abbott is rejecting the client version, not your credentials — login
  succeeds and the failure appears on the next request
- Set `LIBRE_LINK_UP_VERSION` to at least the `minimumVersion` in the response
- If Abbott raises the minimum again, the symptom is identical; raise the value

**"No connections found"**
- The API authenticates against LibreLinkUp; verify your email and password
  sign in to the LibreLinkUp app itself
- Check that data sharing is enabled in your LibreLink app
- Ensure your sensor is active and connected

**"Authentication failed"**
- Double-check email and password
- Verify correct region (US/EU)
- Try logging into LibreLink app to confirm credentials

**"Connection timeout"**
- Check internet connection
- Verify LibreLink service status
- Try again after a few minutes

### Getting Help

1. **Run diagnostics**:
   ```bash
   node diagnose-account.js
   ```

2. **Check logs**: Look for error messages in the console output

3. **Test connection**:
   ```bash
   node test-real-connection.js
   ```

4. **Open an issue**: Include diagnostic output and error messages

## 🤝 Contributing

We welcome contributions! Please:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** with tests
4. **Follow the existing code style**
5. **Submit a pull request**

### Development Guidelines
- **TypeScript required** - Maintain type safety
- **Test coverage** - Add tests for new features
- **Documentation** - Update README for new functionality
- **Security first** - Never commit credentials or sensitive data

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **libre-link-unofficial-api** - Community-maintained LibreLink API client
- **MCP Protocol** - Anthropic's Model Context Protocol
- **FreeStyle Libre Community** - Inspiration and reverse engineering efforts
- **Open Source Diabetes Projects** - Nightscout, OpenAPS, and others

## ⭐ Support

If this project helps you manage your diabetes with AI assistance, please:
- ⭐ **Star the repository**
- 🐛 **Report issues** you encounter
- 💡 **Suggest improvements**
- 🤝 **Contribute** to the project

---

**Disclaimer**: This is an unofficial project not affiliated with Abbott or FreeStyle Libre. Use responsibly and in compliance with applicable terms of service. Always consult healthcare professionals for medical decisions.