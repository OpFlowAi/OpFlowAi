"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Plus, Check, X, Loader2 } from "lucide-react";
import { useLocationStore } from "@/store/location-store";
import { cn } from "@/lib/cn";

type AgentActionDTO = {
  id: string;
  actionType: string;
  payload: Record<string, unknown>;
  status: "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED" | "EXECUTED" | "FAILED";
  resultSummary?: string | null;
};

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  pendingActions?: AgentActionDTO[];
};

type ConversationSummary = { id: string; title: string; updatedAt: string };

const ACTION_LABEL: Record<string, string> = {
  ADD_TASK: "Add task",
  LOG_TIME_OFF: "Log time off",
  MARK_ITEM_REORDERED: "Mark item reordered",
};

function tempId() {
  return `tmp_${Math.random().toString(36).slice(2)}`;
}

export function AgentChat({ locationId, userName }: { locationId: string; userName: string }) {
  const storeLocationId = useLocationStore((s) => s.activeLocationId);
  const effectiveLocationId = storeLocationId ?? locationId;

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLoadedLocation = useRef<string | null>(null);

  async function loadConversations(locId: string) {
    const res = await fetch(`/api/agent/conversations?locationId=${locId}`);
    if (res.ok) setConversations(await res.json());
  }

  useEffect(() => {
    if (lastLoadedLocation.current === effectiveLocationId) return;
    lastLoadedLocation.current = effectiveLocationId;
    setConversationId(null);
    setMessages([]);
    loadConversations(effectiveLocationId);
  }, [effectiveLocationId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function selectConversation(id: string) {
    setError(null);
    const res = await fetch(`/api/agent/conversations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setConversationId(data.id);
    setMessages(
      data.messages.map((m: ChatMessage & { pendingActions: AgentActionDTO[] }) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        pendingActions: m.pendingActions?.filter((a) => a.status !== undefined),
      }))
    );
  }

  function newChat() {
    setConversationId(null);
    setMessages([]);
    setError(null);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    const userMsg: ChatMessage = { id: tempId(), role: "USER", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: effectiveLocationId, conversationId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { id: tempId(), role: "ASSISTANT", content: data.assistantText, pendingActions: data.pendingActions },
      ]);
      loadConversations(effectiveLocationId);
    } catch {
      setError("Couldn't reach the AI Agent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function decideAction(action: AgentActionDTO, decision: "confirm" | "reject") {
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        pendingActions: m.pendingActions?.map((a) =>
          a.id === action.id ? { ...a, status: decision === "confirm" ? "EXECUTED" : "REJECTED" } : a
        ),
      }))
    );
    const res = await fetch(`/api/agent/actions/${action.id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessages((prev) => [
        ...prev,
        { id: tempId(), role: "ASSISTANT", content: data.message.content },
      ]);
    }
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden">
      <div className="hidden w-56 shrink-0 flex-col gap-2 lg:flex">
        <button
          onClick={newChat}
          className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm font-medium hover:bg-surface-hover transition"
        >
          <Plus size={15} /> New chat
        </button>
        <div className="flex flex-col gap-1 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => selectConversation(c.id)}
              className={cn(
                "truncate rounded-lg px-3 py-2 text-left text-xs transition",
                c.id === conversationId
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              )}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      <div className="card-surface flex flex-1 flex-col overflow-hidden rounded-2xl">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center gap-3 text-muted">
              <span className="grid h-12 w-12 place-items-center rounded-2xl gradient-brand text-white">
                <Sparkles size={20} />
              </span>
              <p className="text-sm max-w-sm">
                Hi {userName.split(" ")[0]}, ask me about revenue, inventory, staffing, compliance, or anything
                else at this location - or ask me to add a task, log time off, or reorder an item.
              </p>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "USER" ? "justify-end" : "justify-start")}>
                <div className={cn("flex flex-col gap-2", m.role === "USER" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-lg rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
                      m.role === "USER"
                        ? "gradient-brand text-white"
                        : "bg-surface-2 text-foreground border border-border"
                    )}
                  >
                    {m.content}
                  </div>
                  {m.pendingActions?.map((action) => (
                    <ActionCard key={action.id} action={action} onDecide={decideAction} />
                  ))}
                </div>
              </div>
            ))
          )}
          {sending ? (
            <div className="flex items-center gap-2 text-xs text-muted-2">
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </div>
          ) : null}
          {error ? <p className="text-xs text-danger">{error}</p> : null}
        </div>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about this location, or ask me to take an action..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-2"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !input.trim()}
              className="grid h-8 w-8 place-items-center rounded-lg gradient-brand text-white disabled:opacity-40"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionCard({
  action,
  onDecide,
}: {
  action: AgentActionDTO;
  onDecide: (action: AgentActionDTO, decision: "confirm" | "reject") => void;
}) {
  const label = ACTION_LABEL[action.actionType] ?? action.actionType;

  return (
    <div className="w-full max-w-lg rounded-xl border border-brand-purple/30 bg-brand-purple/5 p-3.5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-brand-purple uppercase tracking-wide">
        <Sparkles size={13} /> {label}
      </div>
      <ul className="text-xs text-muted flex flex-col gap-0.5">
        {Object.entries(action.payload)
          .filter(([k]) => !k.toLowerCase().endsWith("id"))
          .map(([k, v]) => (
            <li key={k}>
              <span className="text-muted-2">{k}:</span> {String(v)}
            </li>
          ))}
      </ul>

      {action.status === "PENDING_CONFIRMATION" ? (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onDecide(action, "confirm")}
            className="flex items-center gap-1 rounded-lg gradient-brand px-3 py-1.5 text-xs font-medium text-white"
          >
            <Check size={13} /> Confirm
          </button>
          <button
            onClick={() => onDecide(action, "reject")}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-danger hover:border-danger/40"
          >
            <X size={13} /> Cancel
          </button>
        </div>
      ) : (
        <span
          className={cn(
            "text-xs font-medium",
            action.status === "EXECUTED" && "text-success",
            action.status === "REJECTED" && "text-muted-2",
            action.status === "FAILED" && "text-danger"
          )}
        >
          {action.status === "EXECUTED" && "Confirmed"}
          {action.status === "REJECTED" && "Cancelled"}
          {action.status === "FAILED" && "Failed"}
        </span>
      )}
    </div>
  );
}
