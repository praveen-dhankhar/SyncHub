import test from "node:test";
import assert from "node:assert/strict";
import {
  transformActionItemOutput,
  transformRagAnswerOutput,
  validateEmbeddingVector,
  type RetrievedChunk,
} from "../validation.js";

test("transformActionItemOutput normalizes valid items", () => {
  const items = transformActionItemOutput({
    action_items: [
      { text: " Finish launch notes ", owner: " Anita ", due_date: "2026-06-20", confidence: 1.4 },
    ],
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].text, "Finish launch notes");
  assert.equal(items[0].owner, "Anita");
  assert.equal(items[0].confidence, 1);
  assert.equal(items[0].dueDate?.toISOString().startsWith("2026-06-20"), true);
});

test("transformActionItemOutput rejects non-finite confidence and nulls invalid dates", () => {
  const items = transformActionItemOutput({
    action_items: [
      { text: "Bad confidence", owner: null, due_date: "2026-99-99", confidence: Number.NaN },
      { text: "Valid task", owner: "", due_date: "not a date", confidence: 0.7 },
    ],
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].text, "Valid task");
  assert.equal(items[0].owner, null);
  assert.equal(items[0].dueDate, null);
});

test("transformActionItemOutput deduplicates by normalized text", () => {
  const items = transformActionItemOutput({
    action_items: [
      { text: "Send the deck", owner: null, due_date: null, confidence: 0.9 },
      { text: " send   the deck ", owner: "Praveen", due_date: null, confidence: 0.8 },
    ],
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].owner, null);
});

test("transformRagAnswerOutput keeps only citations that match retrieved chunks", () => {
  const chunks: RetrievedChunk[] = [
    {
      id: "chunk-1",
      roomId: "room-1",
      roomName: "Sprint Planning",
      chunkText: "We decided to move the API redesign to next sprint.",
      chunkStartMs: 1000,
      chunkEndMs: 5000,
    },
  ];

  const answer = transformRagAnswerOutput({
    answer: "The API redesign moved to next sprint.",
    citations: [
      { room_id: "room-1", chunk_start_ms: 1000, chunk_end_ms: 5000 },
      { room_id: "room-2", chunk_start_ms: 0, chunk_end_ms: 1000 },
    ],
  }, chunks);

  assert.equal(answer.citations.length, 1);
  assert.equal(answer.citations[0].roomId, "room-1");
  assert.match(answer.citations[0].snippet, /API redesign/);
});

test("validateEmbeddingVector rejects invalid dimensions and non-finite values", () => {
  assert.throws(() => validateEmbeddingVector([0, 1], 3), /Expected 3-dimension/);
  assert.throws(() => validateEmbeddingVector([0, Number.POSITIVE_INFINITY, 1], 3), /non-finite/);
  assert.deepEqual(validateEmbeddingVector([0, 0.5, 1], 3), [0, 0.5, 1]);
});
