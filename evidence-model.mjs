export const EVIDENCE_KINDS = Object.freeze(["observation", "assumption"]);
export const REVIEW_STATES = Object.freeze([
  "unreviewed",
  "needs-confirmation",
  "confirmed",
  "rejected",
]);

function normalizeText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizedComparison(value) {
  return normalizeText(value).toLocaleLowerCase();
}

export function nextObservationId(observations) {
  const highest = observations.reduce((maximum, observation) => {
    const match = /^observation-(\d+)$/.exec(observation.id);
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return `observation-${String(highest + 1).padStart(3, "0")}`;
}

export function createObservation(observations, {
  objectId,
  occurrenceId = null,
  topic,
  value,
  evidenceKind = "observation",
  reviewState = "unreviewed",
  createdAt = new Date().toISOString(),
}) {
  const normalizedTopic = normalizeText(topic);
  const normalizedValue = normalizeText(value);
  if (!objectId) {
    throw new Error("Evidence requires an object identity.");
  }
  if (!EVIDENCE_KINDS.includes(evidenceKind)) {
    throw new Error(`Unsupported evidence kind: ${evidenceKind}.`);
  }
  if (!REVIEW_STATES.includes(reviewState)) {
    throw new Error(`Unsupported review state: ${reviewState}.`);
  }
  if (evidenceKind === "observation" && !occurrenceId) {
    throw new Error("An observation requires an exact source occurrence.");
  }
  if (!normalizedTopic) {
    throw new Error("Evidence requires a topic.");
  }
  if (!normalizedValue) {
    throw new Error("Evidence requires a value or note.");
  }
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error("Evidence requires a valid timestamp.");
  }
  return {
    id: nextObservationId(observations),
    objectId,
    occurrenceId,
    topic: normalizedTopic,
    value: normalizedValue,
    evidenceKind,
    reviewState,
    createdAt,
    updatedAt: createdAt,
  };
}

export function updateObservationReviewState(observations, observationId, reviewState, updatedAt = new Date().toISOString()) {
  if (!REVIEW_STATES.includes(reviewState)) {
    throw new Error(`Unsupported review state: ${reviewState}.`);
  }
  if (Number.isNaN(Date.parse(updatedAt))) {
    throw new Error("Evidence review requires a valid timestamp.");
  }
  let found = false;
  const result = observations.map((observation) => {
    if (observation.id !== observationId) {
      return observation;
    }
    found = true;
    return observation.reviewState === reviewState
      ? observation
      : { ...observation, reviewState, updatedAt };
  });
  if (!found) {
    throw new Error(`Unknown evidence entry: ${observationId}.`);
  }
  return result;
}

export function removeObservation(observations, observationId) {
  return observations.filter((observation) => observation.id !== observationId);
}

export function conflictsForObject(observations, objectId) {
  const groups = new Map();
  for (const observation of observations) {
    if (observation.objectId !== objectId || observation.reviewState === "rejected") {
      continue;
    }
    const topicKey = normalizedComparison(observation.topic);
    if (!groups.has(topicKey)) {
      groups.set(topicKey, []);
    }
    groups.get(topicKey).push(observation);
  }

  const conflicts = [];
  for (const entries of groups.values()) {
    const values = new Map();
    for (const entry of entries) {
      const valueKey = normalizedComparison(entry.value);
      if (!values.has(valueKey)) {
        values.set(valueKey, entry.value);
      }
    }
    if (values.size > 1) {
      conflicts.push({
        topic: entries[0].topic,
        values: [...values.values()],
        observationIds: entries.map((entry) => entry.id),
      });
    }
  }
  return conflicts;
}

export function evidenceSummary(observations, objectId) {
  const relevant = observations.filter((observation) => observation.objectId === objectId);
  return {
    total: relevant.length,
    observations: relevant.filter((entry) => entry.evidenceKind === "observation").length,
    assumptions: relevant.filter((entry) => entry.evidenceKind === "assumption").length,
    needsConfirmation: relevant.filter((entry) => entry.reviewState === "needs-confirmation").length,
    confirmed: relevant.filter((entry) => entry.reviewState === "confirmed").length,
    rejected: relevant.filter((entry) => entry.reviewState === "rejected").length,
    conflictCount: conflictsForObject(relevant, objectId).length,
  };
}
