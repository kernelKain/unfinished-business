import { SECTION_CONTRACTS, sectionContract } from "../../src/shared/section-contracts.ts";

/**
 * Generates a contract-compliant Markdown draft for tests. It deliberately
 * includes every required topic, dependency, risk, decision, and acceptance
 * item so candidate creation exercises the real validator.
 */
export function compliantSectionDraft(sectionId: string, change = ""): string {
  const contract = sectionContract(sectionId);
  if (!contract) throw new Error(`Unknown section: ${sectionId}`);
  const lines: string[] = [
    `# ${contract.title}`,
    "",
    contract.purpose,
    "",
    contract.detailGuidance,
    "",
    "## Required topics",
    "",
  ];
  for (const topic of contract.requiredTopics) {
    lines.push(`### ${topic.label}`, "", `This section covers ${topic.label.toLowerCase()}: ${topic.terms.join(", ")}.`, "");
    lines.push(`- ${topic.label} is explicit.`, `- ${topic.label} has an owner and a reviewable result.`, "");
  }
  if (contract.dependencies.length) {
    lines.push("## Dependencies", "");
    for (const dependency of contract.dependencies) {
      const dependencyContract = SECTION_CONTRACTS[dependency];
      lines.push(`- ${dependencyContract?.title ?? dependency} is an upstream input.`);
    }
    lines.push("");
  }
  lines.push("## Risks and mitigations", "");
  for (const risk of contract.riskRequirements) lines.push(`- ${risk}`);
  lines.push("- The remaining uncertainty is named and reviewed before approval.", "");
  lines.push("## Decisions", "");
  for (const decision of contract.decisionRequirements) lines.push(`- ${decision}`);
  lines.push("- The chosen path is recorded here; rejected alternatives stay visible.", "");
  lines.push("## Acceptance criteria", "");
  for (const criterion of contract.acceptanceCriteria) lines.push(`- ${criterion}`);
  lines.push("- The section is reviewed against this list before approval.", "");
  if (change.trim()) lines.push("## Requested change", "", change.trim(), "");
  return lines.join("\n");
}
