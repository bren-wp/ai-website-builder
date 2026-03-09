import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { fileValidator, messageValidator } from "./schema";

const workspaceDocumentValidator = v.object({
  _id: v.id("workspace"),
  _creationTime: v.number(),
  ownerId: v.id("users"),
  messages: v.array(messageValidator),
  fileData: v.optional(v.record(v.string(), fileValidator)),
});

async function getCurrentUser(ctx: Parameters<typeof query>[0]["handler"] extends (
  ctx: infer Ctx,
  ...args: any[]
) => any
  ? Ctx
  : never) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_uid", (q) => q.eq("uid", identity.subject))
    .unique();

  return user ?? null;
}

async function requireCurrentUser(ctx: Parameters<typeof mutation>[0]["handler"] extends (
  ctx: infer Ctx,
  ...args: any[]
) => any
  ? Ctx
  : never) {
  const user = await getCurrentUser(ctx);

  if (!user) {
    throw new ConvexError("Unauthorized");
  }

  return user;
}

async function requireOwnedWorkspace(ctx: any, workspaceId: any, ownerId: any) {
  const workspace = await ctx.db.get(workspaceId);

  if (!workspace) {
    throw new ConvexError("Workspace not found");
  }

  if (workspace.ownerId !== ownerId) {
    throw new ConvexError("Forbidden");
  }

  return workspace;
}

function validateMessages(messages: Array<{ content: string }>) {
  if (messages.length > 200) {
    throw new ConvexError("Too many messages");
  }

  for (const message of messages) {
    if (message.content.length > 10000) {
      throw new ConvexError("Message is too long");
    }
  }
}

function validateFiles(files: Record<string, { code: string }>) {
  const entries = Object.entries(files);

  if (entries.length > 200) {
    throw new ConvexError("Too many files");
  }

  for (const [path, file] of entries) {
    if (!path.startsWith("/") || path.includes("..") || path.includes("\\")) {
      throw new ConvexError(`Invalid file path: ${path}`);
    }

    if (file.code.length > 200000) {
      throw new ConvexError(`File is too large: ${path}`);
    }
  }
}

export const CreateWorkspace = mutation({
  args: {
    messages: v.array(messageValidator),
    fileData: v.optional(v.record(v.string(), fileValidator)),
  },
  returns: v.id("workspace"),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    validateMessages(args.messages);

    if (args.fileData) {
      validateFiles(args.fileData);
    }

    const workspaceId = await ctx.db.insert("workspace", {
      ownerId: user._id,
      messages: args.messages,
      ...(args.fileData ? { fileData: args.fileData } : {}),
    });

    return workspaceId;
  },
});

export const GetWorkspace = query({
  args: {
    workspaceId: v.id("workspace"),
  },
  returns: v.union(v.null(), workspaceDocumentValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);

    if (!user) {
      return null;
    }

    const workspace = await ctx.db.get(args.workspaceId);

    if (!workspace) {
      return null;
    }

    if (workspace.ownerId !== user._id) {
      return null;
    }

    return workspace;
  },
});

export const UpdateWorkspace = mutation({
  args: {
    workspaceId: v.id("workspace"),
    messages: v.array(messageValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    validateMessages(args.messages);
    await requireOwnedWorkspace(ctx, args.workspaceId, user._id);

    await ctx.db.patch(args.workspaceId, {
      messages: args.messages,
    });

    return null;
  },
});

export const UpdateFiles = mutation({
  args: {
    workspaceId: v.id("workspace"),
    files: v.record(v.string(), fileValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx);

    validateFiles(args.files);
    await requireOwnedWorkspace(ctx, args.workspaceId, user._id);

    await ctx.db.patch(args.workspaceId, {
      fileData: args.files,
    });

    return null;
  },
});
