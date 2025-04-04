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
  name: "Browser Agent",
  description: "Agent that can use a browser and navigates the web pages.",
  system: `
  ${navigatorSystemPrompt} 
  
  when using the browser, if you see popups or consents about cookies, privacy or GDPR like things. Accept or give consent.
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
            one_action_name: z.string(),
          })
        ),
      }),
      handler: async (input, { network }) => {
        network.state.data.current_state = input.current_state;
        network.state.data.action = input.action;
      },
    }),
  ],
  mcpServers: [
    {
      name: "playwright",
      transport: {
        type: "sse",
        url: "http://localhost:8931/sse",
      },
    },
  ],
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
  agents: [planningAgent, navigatorAgent, validationAgent],
  router: ({ network, input, callCount }): Agent<AgentState> | undefined => {
    console.log("state", JSON.stringify(network.state.data, null, 2));
    const maxCalls = 5;
    if (callCount > maxCalls) {
      return undefined;
    }
    //save the task todo in state
    if (network.state.data.task === undefined) {
      network.state.data.task = input;
    }
    // We want to plan every n-th call, otherwise navigate.
    if (network.state.data.plan === undefined || callCount % 5 === 0) {
      return planningAgent;
    }
    // if (!network.state.data.plan?.web_task) {
    //   return undefined;
    // }
    if (network.state.data.done) {
      return validationAgent;
    }
    if (network.state.data.validation_result?.is_valid) {
      return undefined;
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
