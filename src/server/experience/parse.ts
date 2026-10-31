import { z } from "zod";

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced?.[1] ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The spirit did not return a JSON object.");
  return JSON.parse(source.slice(start, end + 1));
}

export const oracleReplySchema = z.object({
  clarification: z.string().min(1).max(4_000),
  proposal: z.string().min(1).max(8_000),
  openQuestions: z.array(z.string().min(1).max(500)).max(6),
});

export const sectionReplySchema = z.object({
  content: z.string().min(1).max(12_000),
  recommendation: z.string().min(1).max(2_000),
  tradeoff: z.string().min(1).max(2_000),
});

export const witnessReplySchema = z.object({
  findings: z.string().min(1).max(8_000),
  limitations: z.string().min(1).max(4_000),
  draftNotes: z.string().min(1).max(8_000),
});

export function formatSectionDraft(reply: z.infer<typeof sectionReplySchema>): string {
  return `${reply.content}\n\nRecommendation: ${reply.recommendation}\n\nTradeoff: ${reply.tradeoff}`;
}
