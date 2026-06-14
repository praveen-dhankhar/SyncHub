import test from "node:test";
import assert from "node:assert/strict";
import { chunkTranscript, parseTranscriptTurns } from "../chunker.js";

test("chunkTranscript returns empty chunks for empty transcripts", () => {
  assert.deepEqual(chunkTranscript(""), []);
});

test("chunkTranscript preserves short transcript timestamps and speaker", () => {
  const chunks = chunkTranscript("[0:01] Praveen: Ship the auth fix tomorrow.");

  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].chunkStartMs, 1000);
  assert.equal(chunks[0].chunkEndMs, 1000);
  assert.equal(chunks[0].primarySpeaker, "Praveen");
  assert.match(chunks[0].chunkText, /Praveen: Ship the auth fix tomorrow/);
});

test("chunkTranscript preserves speaker-turn boundaries with overlap", () => {
  const transcript = [
    "[0:01] A: one two three four five",
    "[0:02] B: six seven eight nine ten",
    "[0:03] A: eleven twelve thirteen fourteen fifteen",
    "[0:04] B: sixteen seventeen eighteen nineteen twenty",
  ].join("\n");

  const chunks = chunkTranscript(transcript, 10, 5);

  assert.equal(chunks.length, 3);
  assert.match(chunks[0].chunkText, /\[0:01-0:02\] A:/);
  assert.match(chunks[0].chunkText, /\[0:02-0:03\] B:/);
  assert.doesNotMatch(chunks[0].chunkText, /eleven/);
  assert.match(chunks[1].chunkText, /\[0:02-0:03\] B:/);
  assert.match(chunks[1].chunkText, /\[0:03-0:04\] A:/);
  assert.equal(chunks[1].chunkStartMs, 2000);
  assert.equal(chunks[1].chunkEndMs, 4000);
});

test("parseTranscriptTurns handles malformed and timestamp-free transcript safely", () => {
  const turns = parseTranscriptTurns("Loose opening line\nPat: follow up on docs");

  assert.equal(turns.length, 2);
  assert.equal(turns[0].speaker, null);
  assert.equal(turns[0].startMs, null);
  assert.equal(turns[1].speaker, "Pat");
});
