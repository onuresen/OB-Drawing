import test from "node:test";
import assert from "node:assert/strict";
import { crc32, createStoredZip } from "../zip-store.mjs";

const encoder = new TextEncoder();

test("CRC-32 matches the standard check value", () => {
  assert.equal(crc32(encoder.encode("123456789")), 0xcbf43926);
});

test("stored ZIP writes local entries, a central directory, and an end record", () => {
  const zip = createStoredZip([
    { name: "manifest.json", data: "{}\n" },
    { name: "previews/occurrence-001.png", data: new Uint8Array([1, 2, 3]) },
  ], new Date("2026-09-30T00:00:00Z"));
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  assert.equal(view.getUint32(0, true), 0x04034b50);
  assert.equal(view.getUint32(zip.length - 22, true), 0x06054b50);
  assert.equal(view.getUint16(zip.length - 12, true), 2);
  const text = new TextDecoder().decode(zip);
  assert.match(text, /manifest\.json/);
  assert.match(text, /previews\/occurrence-001\.png/);
});

test("stored ZIP rejects unsafe and duplicate paths", () => {
  assert.throws(() => createStoredZip([{ name: "../outside.json", data: "{}" }]), /Unsafe ZIP path/);
  assert.throws(() => createStoredZip([
    { name: "same.json", data: "one" },
    { name: "same.json", data: "two" },
  ]), /Duplicate ZIP path/);
});
