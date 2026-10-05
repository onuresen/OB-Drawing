export const EVIDENCE_ASSET_INDEX_FORMAT = "objdraw-object-evidence-assets-v1";

function safePart(value, fallback) {
  const result = String(value ?? "")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return result || fallback;
}

export function evidenceExportStem(subject) {
  return `${safePart(subject.label, "object")}-${safePart(subject.id, "subject")}`;
}

export function createEvidenceAssetIndex(occurrences, includedAssets, unavailableReasons = new Map()) {
  const occurrenceIds = new Set(occurrences.map((occurrence) => occurrence.id));
  const includedIds = new Set();
  const items = includedAssets.map((asset) => {
    if (!occurrenceIds.has(asset.occurrenceId)) {
      throw new Error(`Asset references unknown occurrence: ${asset.occurrenceId}.`);
    }
    if (includedIds.has(asset.occurrenceId)) {
      throw new Error(`Duplicate asset for occurrence: ${asset.occurrenceId}.`);
    }
    includedIds.add(asset.occurrenceId);
    return {
      occurrenceId: asset.occurrenceId,
      path: asset.path,
      mediaType: "image/png",
      width: asset.width,
      height: asset.height,
    };
  });

  return {
    format: EVIDENCE_ASSET_INDEX_FORMAT,
    items,
    unavailable: occurrences
      .filter((occurrence) => !includedIds.has(occurrence.id))
      .map((occurrence) => ({
        occurrenceId: occurrence.id,
        reason: unavailableReasons.get(occurrence.id) ?? "preview-unavailable",
      })),
  };
}
