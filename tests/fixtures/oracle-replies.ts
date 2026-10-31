export function oracleProposalReply(options: {
  title?: string;
  summary?: string;
  intendedUser?: string;
  problem?: string;
  desiredOutcome?: string;
  mustHaveFeatures?: string[];
  assumptions?: Array<{ id: string; field: string; statement: string; reason: string }>;
  questions?: Array<{ id: string; field: string; prompt: string; whyItMatters: string; suggestedChoices: string[] }>;
} = {}) {
  const intendedUser = options.intendedUser ?? "Campus students";
  const problem = options.problem ?? "Found umbrellas are hard to return safely.";
  const desiredOutcome = options.desiredOutcome ?? "A trustworthy claim and return flow.";
  const mustHaveFeatures = options.mustHaveFeatures ?? ["Track found items"];
  const assumptions = options.assumptions ?? [];
  return {
    mode: "proposal",
    questions: options.questions ?? [],
    assumptions,
    knownConstraints: ["Keep the first release focused."],
    intake: {
      intendedUser: { value: intendedUser, source: "USER" },
      problem: { value: problem, source: "USER" },
      desiredOutcome: { value: desiredOutcome, source: "USER" },
      deadlineEvent: null,
      mustHaveFeatures: { value: mustHaveFeatures, source: "USER" },
      optionalFeatures: null,
      budget: null,
      privacyRequirements: null,
      platforms: null,
      repositoryCondition: { value: "New project; no repository exists yet.", source: "SYSTEM" },
      nonGoals: null,
    },
    proposal: {
      title: options.title ?? "Campus Lost-and-Found",
      summary: options.summary ?? "Track found items and return them to their owners.",
      intendedUser,
      problem,
      desiredOutcome,
      mustHaveFeatures,
      optionalFeatures: [],
      nonGoals: ["A campus-wide identity system"],
      successCriteria: ["A found item can be claimed once."],
      facts: ["The project starts without an existing repository."],
      userDecisions: ["Focus on found-item tracking."],
      assumptions: assumptions.map((assumption) => assumption.statement),
    },
    unresolvedRisks: ["Claim verification needs refinement."],
    recommendedNextAction: "Review and approve the proposal, or correct an answer.",
  };
}

export function oracleQuestionsReply(options: {
  intendedUser?: string | null;
  problem?: string | null;
  questions?: Array<{ id: string; field: string; prompt: string; whyItMatters: string; suggestedChoices: string[] }>;
} = {}) {
  return {
    mode: "questions",
    questions: options.questions ?? [
      {
        id: "intended-user",
        field: "intendedUser",
        prompt: "Who will use this first?",
        whyItMatters: "The first user determines the smallest useful workflow.",
        suggestedChoices: ["Students", "Campus staff"],
      },
      {
        id: "desired-outcome",
        field: "desiredOutcome",
        prompt: "What should change after one successful use?",
        whyItMatters: "A concrete outcome prevents a feature list from replacing the product goal.",
        suggestedChoices: [],
      },
    ],
    assumptions: [],
    knownConstraints: [],
    intake: {
      intendedUser: options.intendedUser ? { value: options.intendedUser, source: "USER" } : null,
      problem: options.problem ? { value: options.problem, source: "USER" } : null,
      desiredOutcome: null,
      deadlineEvent: null,
      mustHaveFeatures: null,
      optionalFeatures: null,
      budget: null,
      privacyRequirements: null,
      platforms: null,
      repositoryCondition: { value: "New project; no repository exists yet.", source: "SYSTEM" },
      nonGoals: null,
    },
    proposal: null,
    unresolvedRisks: [],
    recommendedNextAction: "Answer the two focused questions.",
  };
}

export function confirmNewProjectSource(project: {
  source: Record<string, unknown>;
  oracleIntake: { repositoryCondition: unknown };
}) {
  project.source = {
    kind: "NEW_PROJECT",
    status: "CONFIRMED",
    label: "Test project",
    repositoryUrl: null,
    workspacePath: null,
    managedWorkspace: false,
    importedAt: null,
    confirmedAt: "2026-11-01T00:00:00.000Z",
    repositoryCondition: "No repository exists yet.",
  };
  project.oracleIntake.repositoryCondition = {
    value: "No repository exists yet.",
    source: "SYSTEM",
    updatedAt: "2026-11-01T00:00:00.000Z",
  };
}
