import type { PluginMetadata } from "./types";
import { normalizeTimelineLocale } from "../utils/i18n";

export function getPluginMetadataDescription(
  metadata: PluginMetadata,
  locale?: string
): string {
  if (!metadata.descriptionI18n) {
    return metadata.description;
  }

  const normalizedLocale = normalizeTimelineLocale(locale);

  return (
    metadata.descriptionI18n[normalizedLocale] ||
    metadata.descriptionI18n.zh ||
    metadata.description
  );
}