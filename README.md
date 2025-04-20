# AgentKit Browser Automation

A sophisticated browser automation framework built with Inngest-AgentKit and Firebase-Genkit, featuring a multi-agent system for intelligent web navigation and task execution.

## Overview

This project implements a multi-agent system for browser automation, where different agents work together to:

- Plan and break down tasks
- Navigate web pages
- Execute browser actions
- Validate results

## Architecture (TODO)

The system consists of four specialized agents:

1. **Planning Agent**

   - Breaks down tasks into actionable steps
   - Creates detailed execution plans
   - Determines task completion criteria

2. **Navigator Agent**

   - Determines the next actions to take
   - Manages state transitions
   - Handles action execution
   - Provides detailed logging and feedback

3. **Browser Agent**

   - Executes browser automation actions
   - Interacts with web elements
   - Handles page navigation
   - Manages browser state

4. **Validation Agent**
   - Validates task completion
   - Verifies results
   - Handles error cases
   - Provides feedback on success/failure

## Features

- **Intelligent Task Planning**: Breaks down complex tasks into manageable steps
- **State Management**: Tracks browser state and action results
- **Error Handling**: Robust error handling and recovery mechanisms
- **Event System**: Comprehensive event logging and monitoring
- **Flexible Action System**: Extensible action registry for custom behaviors
- **Validation Framework**: Built-in validation for task completion
- **Memory Management**: Maintains context and history of actions

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- OpenAI API key (for GPT models)
- Goolge AI key (for gemini models)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/tmahesh/playwright-agent.git
cd playwright-agent
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.sample .env
# Edit .env with your API keys
```

4. run these commands on diff terminals: index.ts, playwright-mcp, inngest-cli

```
npx @playwright/mcp@latest --port 8931

npx tsx index.ts

#dev-server (optional)
npx inngest-cli@latest dev --no-discovery -u http://localhost:3000/api/inngest -v
```

5. To run with genkit sdk and

```bash
npx tsx genkit.ts

#dev server(optional but recommended)
#It has fantastic observaibility built-in with opentelemetry
npx genkit start -- npx tsx --watch genkit.ts
```

## Acknowledgments

- [genKit](https://firebase.google.com/products/genkit)
- [AgentKit](https://github.com/inngest/agent-kit)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [openai-mcp-client](https://github.com/ResoluteError/openai-mcp-client/tree/main/src)
- [Saurav](https://github.com/srvsngh200892)
