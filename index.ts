import {
  Agent,
  createAgent,
  createNetwork,
  createState,
  createTool,
  openai,
} from "@inngest/agent-kit";
import { createServer } from "@inngest/agent-kit/server";
import { z } from "zod";
import {
  initialMessageSystemPrompt,
  performNextStepSystemPrompt,
} from "./prompts";
import "dotenv/config";

if (process.env.OPENAI_API_KEY === undefined) {
  throw new Error("OPENAI_API_KEY is not set");
}

export interface AgentState {
  //the task to be completed
  task: string;
  callCount: number;
  // done indicates whether task is completed
  done: boolean;
}

// const state = createState<AgentState>({
//   task: "",
//   done: false,
// });

const mcpServers = [
  {
    name: "playwright",
    transport: {
      type: "sse",
      url: "http://localhost:8931/sse",
    },
  },
];

const browserAgent = createAgent<AgentState>({
  name: "Browser Agent",
  description: "Agent that can use a browser and navigates the web pages.",
  system: `
  ${initialMessageSystemPrompt}
  `,
  lifecycle: {
    onStart: async ({ prompt, history }) => {
      if (history!.length > 1) {
        history!.push({
          role: "system",
          type: "text",
          content: performNextStepSystemPrompt,
        });
      }
      return {
        prompt,
        history,
      };
    },
    onResponse({ network, result }) {
      console.log(
        "onResponse",
        JSON.stringify(result.output[0]?.content, null, 2)
      );
      if (
        // network!.state.data.callCount > 1 &&
        result.output[0].stop_reason === "stop"
      ) {
        network!.state.data.done = true;
      }
      return result;
    },
  },
});
await browserAgent.listMCPTools(mcpServers[0]);
console.log("browserAgent.tools count:", browserAgent.tools.size);

const network = createNetwork<AgentState>({
  name: "Browser automation network",
  agents: [browserAgent],
  router: ({ network, input, callCount }): Agent<AgentState> | undefined => {
    console.log(`\n====callCount: ${callCount}=====\n`);
    network.state.data.callCount = callCount;
    const maxCalls = 10;
    if (callCount > maxCalls) {
      return undefined;
    }
    //save the task todo in state
    if (network.state.data.task === undefined) {
      network.state.data.task = input;
    }
    if (network.state.data.done) {
      console.log("stopping the network because task is done");
      return undefined;
    }
    return browserAgent;
  },
  defaultModel: openai({
    model: "gpt-4o",
    baseUrl: process.env.OPENAI_BASE_URL,
  }),
});

const server = createServer({
  networks: [network],
});

// const task = `
// open https://www.berkshirehathaway.com/.
// navigate to the 'Special letters' page and
// open the letter from Buffett
// `;
// network.run(task);

server.listen(3000, () => console.log("Agent kit network running!"));
