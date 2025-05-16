# gentKit Browser Automation

A browser agent built with Inngest-AgentKit and Firebase-Genkit, featuring an agent system for intelligent web navigation and task execution.

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

4. Start plawright mcp server in a seperate terminal window

```bash
npx @playwright/mcp@latest --port 8931
```

5. To run with genkit sdk

```bash
npx tsx genkit.ts

#dev server(optional but recommended)
#It has fantastic observaibility built-in with opentelemetry
npx genkit start -- npx tsx --watch genkit.ts
```

6. If you want to try agentkit of inngest-cli (NOTE: the names are very close agentkit nad genkit)

```
npx tsx agentkit.ts

#dev-server (optional)
npx inngest-cli@latest dev --no-discovery -u http://localhost:3000/api/inngest -v
```

## Acknowledgments

- [genKit](https://firebase.google.com/products/genkit)
- [AgentKit](https://github.com/inngest/agent-kit)
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [openai-mcp-client](https://github.com/ResoluteError/openai-mcp-client/tree/main/src)
- [Saurav](https://github.com/srvsngh200892)
