/**
 * Dev check: parse a minimal text PDF through pdf-parse (same stack as the API route).
 * Run: node scripts/test-resume-parse.mjs
 */
import { PDFParse } from "pdf-parse";

const minimalResumePdf = Buffer.from(
  "%PDF-1.4\n" +
    "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n" +
    "4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
    "5 0 obj<</Length 120>>stream\n" +
    "BT /F1 11 Tf 72 720 Td (Alex Chen) Tj 0 -16 Td (Product Manager with 8 years experience) Tj 0 -16 Td (SKILLS: SQL, Roadmaps, Stakeholders) Tj ET\n" +
    "endstream\nendobj\n" +
    "xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \n0000000229 00000 n \n0000000306 00000 n \n" +
    "trailer<</Size 6/Root 1 0 R>>\nstartxref\n480\n%%EOF",
);

async function main() {
  const uint8 = new Uint8Array(minimalResumePdf);
  console.log("buffer bytes:", minimalResumePdf.length, "uint8 bytes:", uint8.byteLength);

  const parser = new PDFParse({ data: uint8 });
  try {
    const result = await parser.getText();
    const pageTexts = (result.pages ?? []).map((p) => p.text ?? "");
    const aggregated =
      typeof result.text === "string" && result.text.trim().length > 0
        ? result.text
        : pageTexts.join("\n\n");

    console.log("pages:", result.total ?? result.pages?.length);
    console.log("result.text length:", result.text?.length ?? 0);
    console.log("aggregated length:", aggregated.length);
    console.log("sample:", aggregated.slice(0, 200));

    if (aggregated.trim().length < 10) {
      console.error("FAIL: extraction too short");
      process.exit(1);
    }
    console.log("OK: text-based PDF extraction works");
  } finally {
    await parser.destroy();
  }
}

main().catch((error) => {
  console.error("FAIL:", error);
  process.exit(1);
});
