// AI-помощник: вопрос по сообщениям сообщества

import { useMutation } from "@tanstack/react-query";
import { sendData } from "@/lib/api";
import type { Id } from "@/types";

export interface AiAnswer {
  answer: string;
  mode: "ai" | "search"; // search — на сервере нет ключа AI, ответ собран поиском по словам
}

export function useAskAi(communityId: Id) {
  return useMutation({
    mutationFn: (question: string) => sendData<AiAnswer>("post", "/ai/ask", { communityId, question }),
  });
}
