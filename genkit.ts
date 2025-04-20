// import the Genkit and Google AI plugin libraries
import { gemini20Flash, googleAI } from "@genkit-ai/googleai";
import { genkit, z } from "genkit";
import { mcpClient } from "genkitx-mcp";
import { openAI, gpt4o } from "genkitx-openai";
import { logger } from "genkit/logging";
import "dotenv/config";
import {
  initialMessageSystemPrompt,
  performNextStepSystemPrompt,
} from "./prompts";

// logger.setLogLevel("debug");

const playwrightMCP = mcpClient({
  name: "playwright",
  serverUrl: "http://localhost:8931/sse",
});

// configure a Genkit instance
const ai = genkit({
  plugins: [googleAI(), openAI(), playwrightMCP],
  model: gemini20Flash, // set default model
  // model: gpt4o,
});

const allActions = await ai.registry.listActions();
const playwrightToolList: string[] = [];
for (const k in allActions) {
  if (k.startsWith("/tool/playwright/browser_")) {
    playwrightToolList.push(allActions[k].__action.name);
  }
}
logger.info("playwrightToolList", playwrightToolList);

export const browserAgent = ai.defineFlow(
  {
    name: "browserAgent",
    inputSchema: z.string(),
  },
  async (task) => {
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
      maxTurns: 10,
    });
    return response.messages;
  }
);

import express from "express";
import { expressHandler, startFlowServer } from "@genkit-ai/express";

const app = express();
app.use(express.json());

app.post("/flow", expressHandler(browserAgent));

// curl -X POST http://localhost:3000/flow -H "Content-Type: application/json" -d '{"data": "go to https://dns.google"}'
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
// startFlowServer({
//   flows: [browserAgent],
//   port: 3000,
// });

const task = "Go to https://www.google.com and take a screenshot of the page.";
const task1 = `
open https://www.berkshirehathaway.com/.navigate to the 'Special letters' page and
open the letter from Buffett
`;
async function main() {
  const result = await browserAgent(task);
  console.log(result);
}

// main();
