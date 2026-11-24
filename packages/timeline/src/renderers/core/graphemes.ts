/// <reference lib="es2022.intl" />

const segmenter =
  typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : undefined;

/** ASCII titles need no segmentation. Older engines keep unsegmentable text whole. */
export function graphemes(text: string): string[] {
  if (/^[\x20-\x7e]*$/.test(text)) return text.split("");
  if (!segmenter) return [text];
  return Array.from(segmenter.segment(text), (part) => part.segment);
}
