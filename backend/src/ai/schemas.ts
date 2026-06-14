import { SchemaType, type ResponseSchema } from "@google/generative-ai";

export const ActionItemListSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    action_items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          text: { type: SchemaType.STRING },
          owner: { type: SchemaType.STRING, nullable: true },
          due_date: { type: SchemaType.STRING, nullable: true },
          confidence: { type: SchemaType.NUMBER },
        },
        required: ["text", "owner", "due_date", "confidence"],
      },
    },
  },
  required: ["action_items"],
};

export const RagAnswerSchema: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    answer: { type: SchemaType.STRING },
    citations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          room_id: { type: SchemaType.STRING },
          chunk_start_ms: { type: SchemaType.INTEGER, nullable: true },
          chunk_end_ms: { type: SchemaType.INTEGER, nullable: true },
        },
        required: ["room_id", "chunk_start_ms", "chunk_end_ms"],
      },
    },
  },
  required: ["answer", "citations"],
};
