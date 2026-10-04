// AI-помощник сообщества. Ищет и пересказывает ТОЛЬКО сообщения, доступные пользователю:
// каналы и локальные чаты сообщества, в котором он состоит.
// Авторы в контекст не передаются — у модели нет данных, по которым можно раскрыть человека.
// Без ANTHROPIC_API_KEY работает простой поиск по словам.

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env";
import { supabaseAdmin } from "../config/supabase";
import { apiErrors } from "../utils/apiErrors";
import { must } from "../utils/db";
import { requireMember } from "./access.service";

const anthropic = env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }) : null;

const CONTEXT_MESSAGES = 300;

export interface AiAnswer {
  answer: string;
  mode: "ai" | "search"; // search — ключа нет, ответ собран поиском по словам
}

interface ContextMessage {
  place: string;
  content: string;
  createdAt: string;
}

async function loadCommunityContext(communityId: string): Promise<{ messages: ContextMessage[]; events: string[] }> {
  const [channels, localChats, events] = await Promise.all([
    supabaseAdmin.from("channels").select("id, name").eq("community_id", communityId),
    supabaseAdmin.from("chats").select("id, name").eq("type", "local").eq("community_id", communityId),
    supabaseAdmin
      .from("events")
      .select("title, starts_at, location, max_attendees")
      .eq("community_id", communityId)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(20),
  ]);
  const channelName = new Map(must(channels).map((row) => [row.id, `#${row.name}`]));
  const chatName = new Map(must(localChats).map((row) => [row.id, `«${row.name}» (Рядом)`]));

  const filters = [
    channelName.size > 0 ? `channel_id.in.(${[...channelName.keys()].join(",")})` : null,
    chatName.size > 0 ? `chat_id.in.(${[...chatName.keys()].join(",")})` : null,
  ].filter((filter): filter is string => filter !== null);

  const rows =
    filters.length === 0
      ? []
      : must(
          await supabaseAdmin
            .from("messages")
            .select("channel_id, chat_id, content, created_at")
            .or(filters.join(","))
            .eq("type", "text")
            .order("created_at", { ascending: false })
            .limit(CONTEXT_MESSAGES),
        );

  return {
    messages: rows.reverse().map((row) => ({
      place: (row.channel_id ? channelName.get(row.channel_id) : row.chat_id ? chatName.get(row.chat_id) : null) ?? "чат",
      content: row.content,
      createdAt: row.created_at,
    })),
    events: must(events).map(
      (event) =>
        `${event.title} — ${new Date(event.starts_at).toLocaleString("ru-RU", { timeZone: "Asia/Bishkek" })}, ${event.location}`,
    ),
  };
}

function keywordSearch(question: string, messages: ContextMessage[]): string {
  const words = question
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 4);
  const found = messages
    .filter((message) => words.some((word) => message.content.toLowerCase().includes(word.slice(0, -1))))
    .slice(-5);
  if (found.length === 0) {
    return "Я поискал в сообщениях сообщества, но не нашёл совпадений. Попробуйте другие слова.";
  }
  return `🔍 Нашёл сообщения:\n\n${found.map((message) => `${message.place}: «${message.content}»`).join("\n\n")}`;
}

export async function ask(userId: string, communityId: string, question: string): Promise<AiAnswer> {
  const { community } = await requireMember(userId, communityId);
  const context = await loadCommunityContext(communityId);

  if (!anthropic) return { answer: keywordSearch(question, context.messages), mode: "search" };

  const transcript = context.messages
    .map((message) => `[${message.createdAt.slice(0, 16).replace("T", " ")}] ${message.place}: ${message.content}`)
    .join("\n");

  try {
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "low" },
      // При отказе модели запрос автоматически повторяется на подходящей запасной модели
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        `Ты — помощник анонимного чата сообщества «${community.name}». Отвечай по-русски, кратко, ` +
        "опираясь только на сообщения и события ниже. Все участники анонимны: никогда не пытайся " +
        "угадать, кто написал сообщение. Если ответа в данных нет — так и скажи.",
      messages: [
        {
          role: "user",
          content:
            `<messages>\n${transcript || "(сообщений пока нет)"}\n</messages>\n` +
            `<events>\n${context.events.join("\n") || "(ближайших событий нет)"}\n</events>\n\n` +
            `Вопрос: ${question}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return { answer: "Не могу ответить на этот вопрос. Попробуйте переформулировать.", mode: "ai" };
    }
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim();
    return { answer: text || "Не удалось составить ответ.", mode: "ai" };
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      throw apiErrors.tooManyRequests("AI-помощник перегружен — попробуйте через минуту");
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Ошибка Claude API ${error.status}:`, error.message);
      // Ключ неверный или сервис недоступен — не оставляем пользователя без ответа
      return { answer: keywordSearch(question, context.messages), mode: "search" };
    }
    throw error;
  }
}
