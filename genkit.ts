// import the Genkit and Google AI plugin libraries
import "dotenv/config"; // Ensure dotenv is loaded first
import { gemini20Flash, googleAI } from "@genkit-ai/googleai";
import { genkit, z } from "genkit";
import { mcpClient } from "genkitx-mcp";
import { openAI, gpt4o } from "genkitx-openai";
import { logger } from "genkit/logging";
import {
  initialMessageSystemPrompt,
  performNextStepSystemPrompt,
} from "./prompts";

// Configure logger level from environment variable
const validLogLevels = ["debug", "info", "warn", "error"];
const logLevelFromEnv = process.env.LOG_LEVEL?.toLowerCase();
if (logLevelFromEnv && validLogLevels.includes(logLevelFromEnv)) {
  logger.setLogLevel(logLevelFromEnv as "debug" | "info" | "warn" | "error");
} else {
  logger.setLogLevel("info"); // Default to "info"
}
// // logger.setLogLevel("debug"); // This line is now handled above

// Configuration from environment variables
const playwrightMcpServerUrl =
  process.env.PLAYWRIGHT_MCP_SERVER_URL || "http://localhost:8931/sse";
const serverPort = parseInt(process.env.PORT || "3000", 10);
const modelName = process.env.GENKIT_MODEL;

let agentMaxTurns = 10; // Default value
const agentMaxTurnsEnv = process.env.AGENT_MAX_TURNS;
if (agentMaxTurnsEnv) {
  const parsedMaxTurns = parseInt(agentMaxTurnsEnv, 10);
  if (!isNaN(parsedMaxTurns) && parsedMaxTurns > 0) {
    agentMaxTurns = parsedMaxTurns;
  }
}

let selectedModel;
if (modelName === "gpt4o") {
  selectedModel = gpt4o;
} else {
  selectedModel = gemini20Flash;
}

const playwrightMCP = mcpClient({
  name: "playwright",
  serverUrl: playwrightMcpServerUrl,
});

// configure a Genkit instance
const ai = genkit({
  plugins: [googleAI(), openAI(), playwrightMCP],
  model: selectedModel, // set default model
});

// Dynamically retrieves all registered Playwright browser tools from the Genkit action registry
// to make them available to the agent. This relies on the naming convention
// where Playwright browser tool actions are prefixed with `/tool/playwright/browser_`.
// A future enhancement could be to use a more direct method from Genkit to list tools by plugin, if such a feature becomes available.
const allActions = await ai.registry.listActions();
const playwrightToolList: string[] = [];
for (const k in allActions) {
  if (k.startsWith("/tool/playwright/browser_")) {
    playwrightToolList.push(allActions[k].__action.name);
  }
}
// logger.info("playwrightToolList", playwrightToolList);

export const browserAgent = ai.defineFlow(
  {
    name: "browserAgent",
    inputSchema: z.string(),
  },
  async (task) => {
    try {
      const response = await ai.generate({
        system: initialMessageSystemPrompt,
        prompt: task,
        messages: [
          {
            role: "user",
            content: [{ text: performNextStepSystemPrompt }],
          },
        ],
        tools: [...playwrightToolList],
        maxTurns: agentMaxTurns,
      });
      return response.message;
    } catch (e) {
      logger.error("Error generating response in browserAgent:", e);
      return "An error occurred while processing your request.";
    }
  }
);

import express from "express";
import { expressHandler, startFlowServer } from "@genkit-ai/express";

const app = express();
app.use(express.json());

app.post("/flow", expressHandler(browserAgent));

// curl -X POST http://localhost:3000/flow -H "Content-Type: application/json" -d '{"data": "go to https://dns.google"}'
app.listen(serverPort, () => {
  console.log(`Server is running on port ${serverPort}`);
});
// startFlowServer({
//   flows: [browserAgent],
//   port: serverPort,
// });

const task = "Go to https://www.google.com and take a screenshot of the page.";
const task1 = `
open https://www.berkshirehathaway.com/
navigate to the 'Special letters' page and
open the letter from Buffett
`;
async function main() {
  const result = await browserAgent(task);
  console.log(result);
}

// main();
