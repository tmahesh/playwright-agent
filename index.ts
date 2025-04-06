import {
  Agent,
  createAgent,
  createNetwork,
  createTool,
  openai,
} from "@inngest/agent-kit";
import { createServer } from "@inngest/agent-kit/server";
import { z } from "zod";
import {
  navigatorSystemPrompt,
  plannerSystemPrompt,
  validataionSystemPrompt,
} from "./prompts";
import "dotenv/config";

export interface AgentState {
  //the task to be completed
  task: string;
  // plan is the plan created by the planning agent.  It is optional
  // as, to begin with, there is no plan.  This is set by the planning
  // agent's tool.
  plan?: {
    observation: string;
    reasoning: string;
    challenges: string;
    next_steps: string;
    web_task: boolean;
    done: boolean;
  };
  current_state: {
    page_summary: string;
    evaluation_previous_goal: string;
    memory: string;
    next_goal: string;
  };
  page_content: string;
  action: { [key: string]: { desc: string; ref: string; text: string } }[];
  // done indicates whether task is completed as per navigator and planner
  done: boolean;
  // validation_done indicates whether we're done with the validation, and
  // terminates the network when true.
  validation_done: boolean;
  validation_result: {
    is_valid: boolean;
    reason: string;
    answer: string;
  };
}

const planningAgent = createAgent<AgentState>({
  name: "Planning Agent",
  description: "Agent that can plan the actions to reach the desired goal.",
  system: ({ network }) => plannerSystemPrompt,
  tools: [
    createTool({
      name: "structured_output",
      description: "Enforces the structured output schema for responses.",
      parameters: z.object({
        observation: z.string(),
        reasoning: z.string(),
        challenges: z.string(),
        next_steps: z.string(),
        web_task: z.boolean(),
        done: z.boolean(),
      }),
      handler: async (plan, { network }) => {
        // Store this in the function state for introspection in tracing.
        // await step?.run("plan created. " + Math.random(), () => plan);
        network.state.data.plan = plan;
      },
    }),
  ],
});

const navigatorAgent = createAgent<AgentState>({
  name: "Navigator Agent",
  description: "Agent that can use a browser and navigates the web pages.",
  system: ({ network }) => `
  ${navigatorSystemPrompt} 
  
  when using the browser, if you see popups or consents about cookies, privacy or GDPR like things. Accept or give consent.
  
  ${JSON.stringify(network?.state.data.page_content)}  
  `,
  tools: [
    createTool({
      name: "structured_output",
      description: "Enforces the structured output schema for responses.",
      parameters: z.object({
        current_state: z.object({
          page_summary: z.string(),
          evaluation_previous_goal: z.string(),
          memory: z.string(),
          next_goal: z.string(),
        }),
        action: z.array(
          z.object({
            key: z.string(),
            value: z.object({
              desc: z.string(),
              ref: z.string(),
              text: z.string(),
            }),
          })
        ),
      }),
      handler: async (input, { network }) => {
        network.state.data.current_state = input.current_state;
        network.state.data.action = input.action;
      },
    }),
  ],
});

const browserAgent = createAgent<AgentState>({
  name: "Browser Agent",
  description: "Agent that can use a browser and navigates the web pages.",
  system: ({ network }) => `
  Execute these actions specified in the navigator agent using the playwright mcp server tools

  ${JSON.stringify(network?.state.data.action[0])}`,
  mcpServers: [
    {
      name: "playwright",
      transport: {
        type: "sse",
        url: "http://localhost:8931/sse",
      },
    },
  ],
  lifecycle: {
    onFinish: ({ network, result }) => {
      if (network?.state.data.action) {
        console.log("onFinish: updating action", network?.state.data.action);
        network.state.data.action.shift();
      }
      // console.log("onFinish: result", JSON.stringify(result, null, 2));
      if (network && result.toolCalls[0]?.content?.data[0]?.text) {
        network.state.data.page_content =
          result.toolCalls[0].content.data[0].text;
      }
      return result;
    },
  },
});

const validationAgent = createAgent<AgentState>({
  name: "Validation Agent",
  description: "Agent that can validate the result of the navigator agent.",
  system: ({ network }) => `
  ${validataionSystemPrompt}

  TASK TO VALIDATE:
  ${network?.state.data.task}
  `,
  tools: [
    createTool({
      name: "structured_output",
      description: "Enforces the structured output schema for responses.",
      parameters: z.object({
        is_valid: z.boolean(),
        reason: z.string(),
        answer: z.string(),
      }),
      handler: async (validation_result, { network }) => {
        network.state.data.validation_result = validation_result;
      },
    }),
  ],
});

const network = createNetwork<AgentState>({
  name: "Browser automation network",
  agents: [planningAgent, navigatorAgent, browserAgent, validationAgent],
  router: ({ network, input, callCount }): Agent<AgentState> | undefined => {
    console.log("callCount ", callCount);
    // console.log("state ", JSON.stringify(network.state.data, null, 2));
    console.log("\n=========\n");
    const maxCalls = 10;
    if (callCount > maxCalls) {
      return undefined;
    }
    if (network.state.data.validation_result?.is_valid) {
      return undefined;
    }
    //save the task todo in state
    if (network.state.data.task === undefined) {
      network.state.data.task = input;
    }
    // We want to plan every n-th call, otherwise navigate.
    // if (network.state.data.plan === undefined || callCount % 5 === 0) {
    if (callCount % 5 === 0) {
      return planningAgent;
    }
    // if (!network.state.data.plan?.web_task) {
    //   return undefined;
    // }
    if (network.state.data.done) {
      return validationAgent;
    }
    if (network.state.data.action && network.state.data.action.length > 0) {
      return browserAgent;
    }
    return navigatorAgent;
  },
  defaultModel: openai({
    model: "gpt-4o",
    baseUrl: process.env.OPENAI_BASE_URL,
  }),
});

const server = createServer({
  networks: [network],
});

server.listen(3000, () => console.log("Agent kit network running!"));

const task = `
open https://www.berkshirehathaway.com/. 
navigate to the 'Special letters' page and
open the letter from Buffett
`;
network.run(task);
