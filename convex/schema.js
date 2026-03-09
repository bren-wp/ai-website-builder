import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const messageValidator = v.object({
  role: v.union(
    v.literal("system"),
    v.literal("user"),
    v.literal("assistant")
  ),
  content: v.string(),
  createdAt: v.number(),
});

export const fileValidator = v.object({
  code: v.string(),
  language: v.optional(v.string()),
});

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    picture: v.optional(v.string()),
    uid: v.string(),
  })
    .index("by_uid", ["uid"])
    .index("by_email", ["email"]),

  workspace: defineTable({
    ownerId: v.id("users"),
    messages: v.array(messageValidator),
    fileData: v.optional(v.record(v.string(), fileValidator)),
  }).index("by_ownerId", ["ownerId"]),
});
