import type Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient, AGENT_MODEL } from "@/lib/anthropic";
import { AGENT_TOOLS, TOOL_META } from "@/lib/agent/tools";
import { executeReadTool } from "@/lib/agent/read-executors";
import { proposeWriteTool } from "@/lib/agent/write-tools";
import type { Message as DbMessage, Location } from "@prisma/client";

const MAX_TOOL_ROUNDS = 6;
const HISTORY_LIMIT = 40;

function buildSystemPrompt(location: Location, userName: string) {
  return `You are the OpsFlow AI agent, embedded in the operational hub for gas stations, truck stops, and grocery store chains.

You are currently helping ${userName} at "${location.name}" (${location.type.replace("_", " ").toLowerCase()}${
    location.city ? `, ${location.city}, ${location.state}` : ""
  }). Today's date is ${new Date().toDateString()}.

You have read-only tools to look up live data (revenue, inventory, staffing, compliance, alerts, tasks, banking, suppliers) across every screen of the app - use them whenever a question depends on current data rather than guessing.

You also have action tools (add_task, log_time_off, mark_item_reordered) that PROPOSE a change. Calling one of these does not execute it - it surfaces a confirmation card to the user in the UI, and the change only happens once they explicitly confirm. After calling an action tool, briefly tell the user what you've drafted and that it's awaiting their confirmation. Never claim an action is already done until you see it reflected as executed in the conversation.

Be concise and concrete: cite real numbers from your tool calls rather than vague language. If a lookup returns no data or an item/staff member can't be found, say so plainly and ask a clarifying question rather than guessing.`;
}

type AnthropicMessage = Anthropic.MessageParam;

function dbMessagesToAnthropic(messages: DbMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === "USER") {
      out.push({ role: "user", content: m.content });
    } else if (m.role === "ASSISTANT") {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      const toolCalls = (m.toolCalls as { id: string; name: string; input: unknown }[] | null) ?? [];
      for (const tc of toolCalls) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input as Record<string, unknown> });
      }
      if (blocks.length > 0) out.push({ role: "assistant", content: blocks });
    } else if (m.role === "TOOL") {
      const toolResults = (m.toolResults as { tool_use_id: string; content: string }[] | null) ?? [];
      if (toolResults.length > 0) {
        out.push({
          role: "user",
          content: toolResults.map((tr) => ({
            type: "tool_result" as const,
            tool_use_id: tr.tool_use_id,
            content: tr.content,
          })),
        });
      }
    }
  }
  return out;
}

export interface AgentTurnResult {
  assistantMessageId: string;
  assistantText: string;
  pendingActionIds: string[];
}

export async function runAgentTurn(params: {
  conversationId: string;
  userId: string;
  userName: string;
  locationId: string;
  accountId: string;
  userMessageText: string;
}): Promise<AgentTurnResult> {
  const { conversationId, locationId, accountId, userMessageText } = params;

  const location = await prisma.location.findUniqueOrThrow({ where: { id: locationId } });

  await prisma.message.create({
    data: { conversationId, role: "USER", content: userMessageText },
  });

  const history = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });

  const anthropic = getAnthropicClient();
  const apiMessages = dbMessagesToAnthropic(history);
  const system = buildSystemPrompt(location, params.userName);

  const pendingActionIds: string[] = [];
  let finalText = "";
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: 1024,
      system,
      tools: AGENT_TOOLS,
      messages: apiMessages,
    });

    const textParts = response.content.filter((b) => b.type === "text").map((b) => b.text);
    const toolUses = response.content.filter((b) => b.type === "tool_use");
    const assistantText = textParts.join("\n").trim();

    if (toolUses.length === 0) {
      finalText = assistantText;
      await prisma.message.create({
        data: { conversationId, role: "ASSISTANT", content: assistantText },
      });
      break;
    }

    // Persist the assistant's tool-use turn.
    const assistantMsg = await prisma.message.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content: assistantText,
        toolCalls: toolUses.map((t) => ({ id: t.id, name: t.name, input: t.input })) as Prisma.InputJsonValue,
      },
    });
    apiMessages.push({ role: "assistant", content: response.content });

    const toolResults: { tool_use_id: string; content: string }[] = [];
    for (const toolUse of toolUses) {
      const meta = TOOL_META[toolUse.name];
      if (!meta) {
        toolResults.push({ tool_use_id: toolUse.id, content: JSON.stringify({ error: "Unknown tool" }) });
        continue;
      }
      if (meta.kind === "read") {
        const result = await executeReadTool(toolUse.name, toolUse.input as Record<string, unknown>, {
          locationId,
          accountId,
        });
        toolResults.push({ tool_use_id: toolUse.id, content: JSON.stringify(result) });
      } else {
        const proposal = await proposeWriteTool(toolUse.name, toolUse.input as Record<string, unknown>, {
          locationId,
          accountId,
        });
        if (!proposal.ok) {
          toolResults.push({
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: proposal.error }),
          });
        } else {
          const action = await prisma.agentAction.create({
            data: {
              conversationId,
              messageId: assistantMsg.id,
              locationId,
              actionType: meta.actionType!,
              payload: proposal.payload as Prisma.InputJsonValue,
              status: "PENDING_CONFIRMATION",
            },
          });
          pendingActionIds.push(action.id);
          toolResults.push({
            tool_use_id: toolUse.id,
            content: JSON.stringify({
              status: "awaiting_user_confirmation",
              summary: proposal.summary,
            }),
          });
        }
      }
    }

    await prisma.message.create({
      data: {
        conversationId,
        role: "TOOL",
        content: toolResults.map((r) => r.content).join("\n"),
        toolResults: toolResults as unknown as Prisma.InputJsonValue,
      },
    });
    apiMessages.push({
      role: "user",
      content: toolResults.map((tr) => ({
        type: "tool_result" as const,
        tool_use_id: tr.tool_use_id,
        content: tr.content,
      })),
    });
  }

  const lastAssistant = await prisma.message.findFirst({
    where: { conversationId, role: "ASSISTANT" },
    orderBy: { createdAt: "desc" },
  });

  await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

  return {
    assistantMessageId: lastAssistant?.id ?? "",
    assistantText: finalText || lastAssistant?.content || "",
    pendingActionIds,
  };
}

export async function getOrCreateConversation(userId: string, locationId: string, conversationId?: string) {
  if (conversationId) {
    const existing = await prisma.conversation.findFirst({ where: { id: conversationId, userId } });
    if (existing) return existing;
  }
  return prisma.conversation.create({ data: { userId, locationId } });
}
