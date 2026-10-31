import { markdownPlainText, parseMarkdown, type MarkdownBlock } from "./markdown.ts";

/**
 * Content contracts for the eight Architect sections.
 *
 * Quality is judged by structure and coverage, not by a word count. Each
 * contract names the topics a reader must find, the blocks that make the
 * detail useful, the dependencies that must be acknowledged, and the
 * risk/decision/acceptance sections that make a plan reviewable.
 */

export interface SectionTopic {
  id: string;
  label: string;
  /** Any one of these case-insensitive terms demonstrates coverage. */
  terms: string[];
}

export interface SectionHeadingRequirement {
  id: string;
  label: string;
  aliases: string[];
}

export interface SectionContract {
  id: string;
  title: string;
  purpose: string;
  dependencies: string[];
  requiredTopics: SectionTopic[];
  detailGuidance: string;
  requiredBlocks: {
    headings: number;
    paragraphs: number;
    listItems: number;
  };
  requiresDependencySection: boolean;
  requiredHeadings: SectionHeadingRequirement[];
  riskRequirements: string[];
  decisionRequirements: string[];
  acceptanceCriteria: string[];
}

const riskHeading: SectionHeadingRequirement = {
  id: "risks",
  label: "Risks and mitigations",
  aliases: ["risk", "mitigation", "assumption"],
};
const decisionHeading: SectionHeadingRequirement = {
  id: "decisions",
  label: "Decisions",
  aliases: ["decision", "choice", "tradeoff", "trade-off"],
};
const acceptanceHeading: SectionHeadingRequirement = {
  id: "acceptance",
  label: "Acceptance criteria",
  aliases: ["acceptance", "success criteria", "done when", "definition of done"],
};
const dependencyHeading: SectionHeadingRequirement = {
  id: "dependencies",
  label: "Dependencies",
  aliases: ["dependenc", "prerequisite", "upstream"],
};

export const SECTION_CONTRACTS: Record<string, SectionContract> = {
  control: {
    id: "control",
    title: "Control, product, scope, and acceptance",
    purpose: "Make the product goal, audience, scope, constraints, and done condition unambiguous before design begins.",
    dependencies: [],
    requiredTopics: [
      { id: "goal", label: "Product goal and problem", terms: ["problem", "goal", "outcome", "purpose"] },
      { id: "user", label: "Intended user", terms: ["intended user", "audience", "customer", "student", "user"] },
      { id: "scope", label: "Scope and must-haves", terms: ["scope", "must-have", "must have", "in scope", "feature"] },
      { id: "non-goals", label: "Non-goals", terms: ["non-goal", "non goal", "non-goals", "out of scope", "not doing"] },
      { id: "constraints", label: "Constraints and assumptions", terms: ["constraint", "assumption", "limit"] },
      { id: "acceptance", label: "Acceptance condition", terms: ["acceptance", "success criteria", "done when"] },
    ],
    detailGuidance: "State the product in concrete terms, separate committed scope from non-goals, and make the acceptance condition testable.",
    requiredBlocks: { headings: 5, paragraphs: 3, listItems: 8 },
    requiresDependencySection: false,
    requiredHeadings: [riskHeading, decisionHeading, acceptanceHeading],
    riskRequirements: ["Name at least one product or scope risk and how it is reduced."],
    decisionRequirements: ["Record the decisions already made and any decision still open."],
    acceptanceCriteria: ["The user, problem, scope, non-goals, and done condition are all explicit."],
  },
  architecture: {
    id: "architecture",
    title: "Architecture and contracts",
    purpose: "Describe the system boundaries, data and state model, interfaces, security posture, and recovery behavior.",
    dependencies: ["control"],
    requiredTopics: [
      { id: "boundaries", label: "System boundaries and components", terms: ["boundary", "boundaries", "component", "module", "service"] },
      { id: "data", label: "Data and state model", terms: ["data model", "state", "schema", "persistence", "store"] },
      { id: "contracts", label: "Interfaces and contracts", terms: ["contract", "api", "route", "interface", "schema"] },
      { id: "security", label: "Security and trust boundaries", terms: ["security", "trust boundary", "permission", "authorization", "sanitiz"] },
      { id: "recovery", label: "Failure and recovery behavior", terms: ["failure", "recovery", "retry", "timeout", "fallback"] },
      { id: "dependencies", label: "Dependencies and integration points", terms: ["dependenc", "integration", "upstream"] },
    ],
    detailGuidance: "Show how the pieces fit together, which contracts are authoritative, and what happens when a dependency or native run fails.",
    requiredBlocks: { headings: 6, paragraphs: 4, listItems: 10 },
    requiresDependencySection: true,
    requiredHeadings: [riskHeading, decisionHeading, acceptanceHeading, dependencyHeading],
    riskRequirements: ["Name a failure mode in the architecture and the recovery or containment path."],
    decisionRequirements: ["Record the structural decisions and rejected alternatives."],
    acceptanceCriteria: ["Boundaries, state, contracts, security, recovery, and dependencies are reviewable without reading the code."],
  },
  experience: {
    id: "experience",
    title: "Experience",
    purpose: "Describe the user journey, interface states, accessibility, reading experience, and revision review behavior.",
    dependencies: ["control", "architecture"],
    requiredTopics: [
      { id: "journey", label: "User journey", terms: ["journey", "flow", "step", "user"] },
      { id: "states", label: "Empty, loading, and error states", terms: ["empty", "loading", "error", "state"] },
      { id: "accessibility", label: "Accessibility", terms: ["accessib", "keyboard", "screen reader", "contrast", "focus"] },
      { id: "visual", label: "Typography and reading width", terms: ["typography", "spacing", "reading width", "layout", "visual"] },
      { id: "responsive", label: "Responsive behavior", terms: ["responsive", "mobile", "screen size", "breakpoint"] },
      { id: "review", label: "Revision and approval review", terms: ["review", "diff", "revision", "approval"] },
    ],
    detailGuidance: "Walk through the screen states a user actually sees, including the moment a proposed revision is inspected before it is accepted.",
    requiredBlocks: { headings: 6, paragraphs: 4, listItems: 10 },
    requiresDependencySection: true,
    requiredHeadings: [riskHeading, decisionHeading, acceptanceHeading, dependencyHeading],
    riskRequirements: ["Name an interaction or accessibility risk and how the interface avoids it."],
    decisionRequirements: ["Record the interface decisions that affect review, approval, or reading."],
    acceptanceCriteria: ["The journey, states, accessibility, responsive behavior, and revision review are all described."],
  },
  tools: {
    id: "tools",
    title: "Tools, access, and cost",
    purpose: "Describe the tool catalog, permission model, model/provider selection, spending limits, and privacy behavior.",
    dependencies: ["architecture"],
    requiredTopics: [
      { id: "catalog", label: "Tool catalog and capabilities", terms: ["tool", "catalog", "capabilit"] },
      { id: "access", label: "Access and permissions", terms: ["permission", "access", "scope", "authorization"] },
      { id: "model", label: "Model and provider selection", terms: ["model", "provider", "selection"] },
      { id: "cost", label: "Cost and budget controls", terms: ["cost", "budget", "spend", "price", "token"] },
      { id: "privacy", label: "Privacy and data policy", terms: ["privacy", "data policy", "secret", "redact", "training"] },
      { id: "failure", label: "Provider failure handling", terms: ["failure", "error", "unavailable", "recovery"] },
    ],
    detailGuidance: "Separate what the user chooses from what the runtime enforces, and state the fallback when a tool or provider is unavailable.",
    requiredBlocks: { headings: 6, paragraphs: 4, listItems: 10 },
    requiresDependencySection: true,
    requiredHeadings: [riskHeading, decisionHeading, acceptanceHeading, dependencyHeading],
    riskRequirements: ["Name a cost, privacy, or permission risk and the guard that limits it."],
    decisionRequirements: ["Record tool, access, model, and budget decisions with their consequences."],
    acceptanceCriteria: ["Tool access, model choice, cost limits, privacy, and failure handling are explicit."],
  },
  verification: {
    id: "verification",
    title: "Verification and risks",
    purpose: "Describe how the product is proven, which checks are automated, and which risks remain.",
    dependencies: ["control", "architecture", "tools"],
    requiredTopics: [
      { id: "strategy", label: "Verification strategy", terms: ["test", "verification", "strategy"] },
      { id: "automated", label: "Automated checks", terms: ["automated", "unit", "integration", "typecheck", "test"] },
      { id: "manual", label: "Manual and visual checks", terms: ["visual", "manual", "screenshot", "accessibility"] },
      { id: "security", label: "Security checks", terms: ["security", "redaction", "traversal", "csrf", "sanitiz"] },
      { id: "migration", label: "Migration and compatibility checks", terms: ["migration", "backward", "schema", "compatib"] },
      { id: "evidence", label: "Evidence and limitations", terms: ["evidence", "result", "pass", "fail", "limitation"] },
    ],
    detailGuidance: "Name the commands or checks, the behavior each protects, and the limitation that prevents a stronger claim.",
    requiredBlocks: { headings: 6, paragraphs: 4, listItems: 12 },
    requiresDependencySection: true,
    requiredHeadings: [riskHeading, decisionHeading, acceptanceHeading, dependencyHeading],
    riskRequirements: ["Name a remaining risk and the evidence that would change the conclusion."],
    decisionRequirements: ["Record what is tested automatically, what is reviewed manually, and what is not claimed."],
    acceptanceCriteria: ["Every acceptance claim has a check or an explicit limitation."],
  },
  phases: {
    id: "phases",
    title: "Phases and queue",
    purpose: "Sequence the work, define gates, and keep deferred work and recovery visible.",
    dependencies: ["verification"],
    requiredTopics: [
      { id: "sequence", label: "Phase sequence", terms: ["phase", "sequence", "order", "step"] },
      { id: "gates", label: "Acceptance gates", terms: ["gate", "acceptance", "criteria", "ready"] },
      { id: "dependencies", label: "Ordering and prerequisites", terms: ["dependenc", "blocked", "prerequisite"] },
      { id: "deferred", label: "Deferred work", terms: ["defer", "later", "out of scope", "future"] },
      { id: "recovery", label: "Rollback and recovery", terms: ["rollback", "recovery", "revert", "retry"] },
    ],
    detailGuidance: "Make each phase independently reviewable, state what must be true before the next one starts, and say what is deliberately deferred.",
    requiredBlocks: { headings: 6, paragraphs: 3, listItems: 10 },
    requiresDependencySection: true,
    requiredHeadings: [riskHeading, decisionHeading, acceptanceHeading, dependencyHeading],
    riskRequirements: ["Name a sequencing or rollback risk and the checkpoint that contains it."],
    decisionRequirements: ["Record why the phases are ordered this way and what is deferred."],
    acceptanceCriteria: ["Each phase has a gate, a dependency, and a recovery path."],
  },
  delivery: {
    id: "delivery",
    title: "Delivery",
    purpose: "Describe environments, configuration, operations, release notes, rollback, and support.",
    dependencies: ["experience", "verification", "phases"],
    requiredTopics: [
      { id: "environments", label: "Environments and deployment", terms: ["environment", "deploy", "hosting", "runtime"] },
      { id: "config", label: "Configuration and secrets", terms: ["config", "environment variable", "secret", "credential"] },
      { id: "operations", label: "Operations and monitoring", terms: ["operation", "monitor", "log", "health", "recovery"] },
      { id: "release", label: "Release notes and versioning", terms: ["release", "changelog", "note", "version"] },
      { id: "rollback", label: "Rollback and restore", terms: ["rollback", "revert", "restore"] },
      { id: "support", label: "Support and ownership", terms: ["support", "runbook", "owner", "maintenance"] },
    ],
    detailGuidance: "Describe what an operator does before, during, and after a release, and keep secrets out of every artifact.",
    requiredBlocks: { headings: 6, paragraphs: 4, listItems: 10 },
    requiresDependencySection: true,
    requiredHeadings: [riskHeading, decisionHeading, acceptanceHeading, dependencyHeading],
    riskRequirements: ["Name a deployment or configuration risk and the rollback that contains it."],
    decisionRequirements: ["Record hosting, configuration, and release decisions."],
    acceptanceCriteria: ["Deployment, configuration, operations, release notes, rollback, and support are all covered."],
  },
  readiness: {
    id: "readiness",
    title: "Execution directive and readiness",
    purpose: "State the execution directive, readiness checklist, known limitations, open decisions, and approval state.",
    dependencies: ["control", "architecture", "experience", "tools", "verification", "phases", "delivery"],
    requiredTopics: [
      { id: "directive", label: "Execution directive", terms: ["execution directive", "directive", "implement", "build"] },
      { id: "checklist", label: "Readiness checklist", terms: ["readiness", "checklist", "ready"] },
      { id: "limitations", label: "Known limitations", terms: ["limitation", "known issue", "not run", "unavailable"] },
      { id: "decisions", label: "Open decisions", terms: ["decision", "open question", "unresolved"] },
      { id: "approval", label: "Approval state", terms: ["approval", "approved", "stale", "version"] },
      { id: "next", label: "Next action", terms: ["next action", "next step", "proceed"] },
    ],
    detailGuidance: "Give the Maker a direct instruction, list the checks that must be true, and state what is still unresolved.",
    requiredBlocks: { headings: 6, paragraphs: 4, listItems: 10 },
    requiresDependencySection: true,
    requiredHeadings: [riskHeading, decisionHeading, acceptanceHeading, dependencyHeading],
    riskRequirements: ["Name a readiness risk and what blocks execution if it is unresolved."],
    decisionRequirements: ["Record the decisions that authorize execution and any open decision."],
    acceptanceCriteria: ["The directive, checklist, limitations, decisions, approval state, and next action are explicit."],
  },
};

export function sectionContract(id: string): SectionContract | null {
  return SECTION_CONTRACTS[id] ?? null;
}

export interface ContractValidation {
  ok: boolean;
  errors: string[];
  satisfiedTopics: string[];
  missingTopics: string[];
  metrics: {
    headings: number;
    paragraphs: number;
    listItems: number;
    tableRows: number;
  };
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[’']/g, "").replace(/\s+/g, " ");
}

function sectionItems(blocks: MarkdownBlock[], aliases: string[]): string[] {
  const items: string[] = [];
  let activeLevel: number | null = null;
  for (const block of blocks) {
    if (block.type === "heading") {
      const heading = normalized(block.text);
      if (activeLevel !== null && block.level <= activeLevel) activeLevel = null;
      if (activeLevel === null && aliases.some((alias) => heading.includes(normalized(alias)))) {
        activeLevel = block.level;
      }
      continue;
    }
    if (activeLevel === null) continue;
    if (block.type === "list") items.push(...block.items.map((item) => item.text));
    else if (block.type === "table") items.push(...block.rows.flat());
    else if (block.type === "paragraph" || block.type === "blockquote") items.push(block.text);
  }
  return items.filter((item) => item.trim().length > 0);
}

/**
 * Validates a generated section against its contract. Word count alone can
 * never pass: topics, block structure, dependency acknowledgement, and the
 * risk/decision/acceptance sections are checked independently.
 */
export function validateSectionContent(sectionId: string, content: string): ContractValidation {
  const contract = sectionContract(sectionId);
  if (!contract) {
    return {
      ok: false,
      errors: [`Unknown Architect section: ${sectionId}.`],
      satisfiedTopics: [],
      missingTopics: [],
      metrics: { headings: 0, paragraphs: 0, listItems: 0, tableRows: 0 },
    };
  }
  const blocks = parseMarkdown(content);
  const text = normalized(markdownPlainText(blocks));
  const metrics = {
    headings: blocks.filter((block) => block.type === "heading").length,
    paragraphs: blocks.filter((block) => block.type === "paragraph" && block.text.trim().length > 0).length,
    listItems: blocks.reduce((total, block) => total + (block.type === "list" ? block.items.length : 0), 0),
    tableRows: blocks.reduce((total, block) => total + (block.type === "table" ? block.rows.length : 0), 0),
  };
  const errors: string[] = [];
  const satisfiedTopics: string[] = [];
  const missingTopics: string[] = [];

  for (const topic of contract.requiredTopics) {
    const covered = topic.terms.some((term) => text.includes(normalized(term)));
    if (covered) satisfiedTopics.push(topic.id);
    else {
      missingTopics.push(topic.id);
      errors.push(`Missing required topic: ${topic.label}.`);
    }
  }

  if (metrics.headings < contract.requiredBlocks.headings) {
    errors.push(`Use at least ${contract.requiredBlocks.headings} headings so the section is scannable.`);
  }
  if (metrics.paragraphs < contract.requiredBlocks.paragraphs) {
    errors.push(`Use at least ${contract.requiredBlocks.paragraphs} substantive paragraphs.`);
  }
  if (metrics.listItems < contract.requiredBlocks.listItems) {
    errors.push(`Use at least ${contract.requiredBlocks.listItems} list or table items.`);
  }

  for (const requirement of contract.requiredHeadings) {
    const items = sectionItems(blocks, requirement.aliases);
    if (!items.length) errors.push(`Add a ${requirement.label} section with at least one item.`);
  }

  if (contract.requiresDependencySection && contract.dependencies.length) {
    const dependencyItems = sectionItems(blocks, dependencyHeading.aliases);
    if (!dependencyItems.length) {
      errors.push("Add a Dependencies section that names each upstream section.");
    } else {
      const dependencyText = normalized(dependencyItems.join(" "));
      for (const dependency of contract.dependencies) {
        const dependencyContract = sectionContract(dependency);
        const label = dependencyContract?.title.split(" ")[0] ?? dependency;
        if (!dependencyText.includes(normalized(label)) && !text.includes(normalized(label))) {
          errors.push(`Acknowledge the upstream ${label} section in Dependencies.`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    satisfiedTopics,
    missingTopics,
    metrics,
  };
}

/** Prompt-ready contract text. It is not a runtime system prompt. */
export function describeSectionContract(contract: SectionContract): string {
  return [
    `Section ${contract.title}`,
    `Purpose: ${contract.purpose}`,
    `Required topics: ${contract.requiredTopics.map((topic) => `${topic.label} (${topic.terms.join(", ")})`).join("; ")}.`,
    `Detail: ${contract.detailGuidance} Use at least ${contract.requiredBlocks.headings} headings, ${contract.requiredBlocks.paragraphs} paragraphs, and ${contract.requiredBlocks.listItems} list or table items.`,
    `Dependencies: ${contract.dependencies.length ? contract.dependencies.map((id) => sectionContract(id)?.title ?? id).join("; ") : "none"}.`,
    `Risks: ${contract.riskRequirements.join(" ")}`,
    `Decisions: ${contract.decisionRequirements.join(" ")}`,
    `Acceptance criteria: ${contract.acceptanceCriteria.join(" ")}`,
    `Required sections: ${contract.requiredHeadings.map((heading) => heading.label).join("; ")}.`,
  ].join("\n");
}
