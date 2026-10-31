import { z } from "zod";

export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced?.[1] ?? text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The spirit did not return a JSON object.");
  return JSON.parse(source.slice(start, end + 1));
}

const oracleFieldSchema = z.enum([
  "intendedUser", "problem", "desiredOutcome", "deadlineEvent", "mustHaveFeatures",
  "optionalFeatures", "budget", "privacyRequirements", "platforms",
  "repositoryCondition", "nonGoals", "unresolvedQuestions",
]);
const oracleAnswerSourceSchema = z.enum(["USER", "ASSUMPTION", "SYSTEM"]);
const oracleScalarAnswerSchema = z.object({
  value: z.string().min(1).max(4_000),
  source: oracleAnswerSourceSchema,
}).nullable();
const oracleListAnswerSchema = z.object({
  value: z.array(z.string().min(1).max(1_000)).max(30),
  source: oracleAnswerSourceSchema,
}).nullable();

export const oracleReplySchema = z.object({
  mode: z.enum(["questions", "proposal"]),
  questions: z.array(z.object({
    id: z.string().min(1).max(128),
    field: oracleFieldSchema,
    prompt: z.string().min(1).max(1_000),
    whyItMatters: z.string().min(1).max(1_000),
    suggestedChoices: z.array(z.string().min(1).max(300)).max(6),
  })).max(3),
  assumptions: z.array(z.object({
    id: z.string().min(1).max(128),
    field: oracleFieldSchema,
    statement: z.string().min(1).max(1_000),
    reason: z.string().min(1).max(1_000),
  })).max(30),
  knownConstraints: z.array(z.string().min(1).max(1_000)).max(30),
  intake: z.object({
    intendedUser: oracleScalarAnswerSchema,
    problem: oracleScalarAnswerSchema,
    desiredOutcome: oracleScalarAnswerSchema,
    deadlineEvent: oracleScalarAnswerSchema,
    mustHaveFeatures: oracleListAnswerSchema,
    optionalFeatures: oracleListAnswerSchema,
    budget: oracleScalarAnswerSchema,
    privacyRequirements: oracleListAnswerSchema,
    platforms: oracleListAnswerSchema,
    repositoryCondition: oracleScalarAnswerSchema,
    nonGoals: oracleListAnswerSchema,
  }),
  proposal: z.object({
    title: z.string().min(1).max(200),
    summary: z.string().min(1).max(4_000),
    intendedUser: z.string().min(1).max(2_000),
    problem: z.string().min(1).max(4_000),
    desiredOutcome: z.string().min(1).max(4_000),
    mustHaveFeatures: z.array(z.string().min(1).max(500)).max(20),
    optionalFeatures: z.array(z.string().min(1).max(500)).max(20),
    nonGoals: z.array(z.string().min(1).max(500)).max(20),
    successCriteria: z.array(z.string().min(1).max(500)).max(20),
    facts: z.array(z.string().min(1).max(1_000)).max(30),
    userDecisions: z.array(z.string().min(1).max(1_000)).max(30),
    assumptions: z.array(z.string().min(1).max(1_000)).max(30),
  }).nullable(),
  unresolvedRisks: z.array(z.string().min(1).max(1_000)).max(30),
  recommendedNextAction: z.string().min(1).max(2_000),
}).superRefine((reply, context) => {
  if (reply.mode === "questions" && (reply.questions.length < 1 || reply.proposal !== null)) {
    context.addIssue({ code: "custom", message: "Question mode requires one to three questions and no proposal." });
  }
  if (reply.mode === "proposal" && reply.proposal === null) {
    context.addIssue({ code: "custom", message: "Proposal mode requires a structured proposal." });
  }
  const statedAssumptionFields = new Set(reply.assumptions.map((assumption) => assumption.field));
  for (const [field, answer] of Object.entries(reply.intake)) {
    if (answer?.source === "ASSUMPTION" && !statedAssumptionFields.has(field as z.infer<typeof oracleFieldSchema>)) {
      context.addIssue({ code: "custom", message: `Assumed intake field ${field} requires a stated assumption.` });
    }
  }
});

export const sectionReplySchema = z.object({
  content: z.string().min(1).max(24_000),
  summary: z.string().min(1).max(2_000),
  recommendation: z.string().max(2_000).optional().default(""),
  tradeoff: z.string().max(2_000).optional().default(""),
});

export const witnessReplySchema = z.object({
  findings: z.string().min(1).max(8_000),
  limitations: z.string().min(1).max(4_000),
  draftNotes: z.string().min(1).max(8_000),
});
