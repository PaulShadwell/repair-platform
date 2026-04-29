import { Router } from "express";
import { prisma } from "../prisma.js";
import { requireAuth } from "../middleware/auth.js";
import type { AuthenticatedRequest } from "../types.js";
import { isAdmin } from "../services/rbac.js";

export const feedbackRouter = Router();

// ---------------------------------------------------------------------------
// GET /feedback — List all feedback (filterable, sortable)
// ---------------------------------------------------------------------------
feedbackRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) { res.status(401).json({ message: "Unauthorized" }); return; }

  const categoryRaw = req.query.category;
  const category = typeof categoryRaw === "string" ? categoryRaw : undefined;
  const statusRaw = req.query.status;
  const status = typeof statusRaw === "string" ? statusRaw : undefined;
  const sortBy = String(req.query.sortBy ?? "votes");
  const sortDir = String(req.query.sortDir ?? "desc") === "asc" ? "asc" as const : "desc" as const;

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (status) where.status = status;

  const feedbacks = await prisma.feedback.findMany({
    where,
    include: {
      author: { select: { id: true, fullName: true, username: true } },
      votes: { select: { userId: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, fullName: true, username: true } },
        },
      },
      _count: { select: { votes: true, comments: true } },
    },
    orderBy: sortBy === "votes"
      ? { votes: { _count: sortDir } }
      : sortBy === "newest"
        ? { createdAt: sortDir }
        : { updatedAt: sortDir },
  });

  const userId = req.user.id;
  const items = feedbacks.map((fb) => ({
    id: fb.id,
    title: fb.title,
    body: fb.body,
    category: fb.category,
    status: fb.status,
    author: fb.author,
    voteCount: fb._count.votes,
    commentCount: fb._count.comments,
    hasVoted: fb.votes.some((v) => v.userId === userId),
    comments: fb.comments.map((c) => ({
      id: c.id,
      body: c.body,
      author: c.author,
      createdAt: c.createdAt.toISOString(),
    })),
    createdAt: fb.createdAt.toISOString(),
    updatedAt: fb.updatedAt.toISOString(),
  }));

  res.json({ feedback: items });
});

// ---------------------------------------------------------------------------
// POST /feedback — Create new feedback
// ---------------------------------------------------------------------------
feedbackRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) { res.status(401).json({ message: "Unauthorized" }); return; }

  const { title, body, category } = req.body as {
    title?: string;
    body?: string;
    category?: string;
  };

  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ message: "Title and body are required" });
    return;
  }

  const validCategories = ["BUG", "FEATURE", "IMPROVEMENT", "GENERAL"];
  if (!category || !validCategories.includes(category)) {
    res.status(400).json({ message: "Invalid category" });
    return;
  }

  const fb = await prisma.feedback.create({
    data: {
      title: title.trim(),
      body: body.trim(),
      category: category as "BUG" | "FEATURE" | "IMPROVEMENT" | "GENERAL",
      authorId: req.user.id,
    },
    include: {
      author: { select: { id: true, fullName: true, username: true } },
      _count: { select: { votes: true, comments: true } },
    },
  });

  res.status(201).json({
    feedback: {
      id: fb.id,
      title: fb.title,
      body: fb.body,
      category: fb.category,
      status: fb.status,
      author: fb.author,
      voteCount: fb._count.votes,
      commentCount: fb._count.comments,
      hasVoted: false,
      comments: [],
      createdAt: fb.createdAt.toISOString(),
      updatedAt: fb.updatedAt.toISOString(),
    },
  });
});

// ---------------------------------------------------------------------------
// PATCH /feedback/:id/status — Admin-only status update
// ---------------------------------------------------------------------------
feedbackRouter.patch("/:id/status", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user || !isAdmin(req.user.roles)) {
    res.status(403).json({ message: "Only admins can update feedback status" });
    return;
  }

  const { status } = req.body as { status?: string };
  const validStatuses = ["OPEN", "UNDER_REVIEW", "PLANNED", "DONE", "CLOSED"];
  if (!status || !validStatuses.includes(status)) {
    res.status(400).json({ message: "Invalid status" });
    return;
  }

  const fb = await prisma.feedback.update({
    where: { id: req.params.id },
    data: { status: status as "OPEN" | "UNDER_REVIEW" | "PLANNED" | "DONE" | "CLOSED" },
  });

  res.json({ feedback: { id: fb.id, status: fb.status } });
});

// ---------------------------------------------------------------------------
// POST /feedback/:id/vote — Toggle upvote
// ---------------------------------------------------------------------------
feedbackRouter.post("/:id/vote", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) { res.status(401).json({ message: "Unauthorized" }); return; }

  const feedbackId = req.params.id;
  const userId = req.user.id;

  const existing = await prisma.feedbackVote.findUnique({
    where: { feedbackId_userId: { feedbackId, userId } },
  });

  if (existing) {
    await prisma.feedbackVote.delete({ where: { id: existing.id } });
    const count = await prisma.feedbackVote.count({ where: { feedbackId } });
    res.json({ hasVoted: false, voteCount: count });
  } else {
    await prisma.feedbackVote.create({ data: { feedbackId, userId } });
    const count = await prisma.feedbackVote.count({ where: { feedbackId } });
    res.json({ hasVoted: true, voteCount: count });
  }
});

// ---------------------------------------------------------------------------
// POST /feedback/:id/comments — Add comment
// ---------------------------------------------------------------------------
feedbackRouter.post("/:id/comments", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) { res.status(401).json({ message: "Unauthorized" }); return; }

  const { body } = req.body as { body?: string };
  if (!body?.trim()) {
    res.status(400).json({ message: "Comment body is required" });
    return;
  }

  const comment = await prisma.feedbackComment.create({
    data: {
      feedbackId: req.params.id,
      authorId: req.user.id,
      body: body.trim(),
    },
    include: {
      author: { select: { id: true, fullName: true, username: true } },
    },
  });

  res.status(201).json({
    comment: {
      id: comment.id,
      body: comment.body,
      author: comment.author,
      createdAt: comment.createdAt.toISOString(),
    },
  });
});

// ---------------------------------------------------------------------------
// DELETE /feedback/:id/comments/:commentId — Delete own comment (or admin)
// ---------------------------------------------------------------------------
feedbackRouter.delete("/:id/comments/:commentId", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) { res.status(401).json({ message: "Unauthorized" }); return; }

  const comment = await prisma.feedbackComment.findUnique({
    where: { id: req.params.commentId },
  });

  if (!comment) {
    res.status(404).json({ message: "Comment not found" });
    return;
  }

  if (comment.authorId !== req.user.id && !isAdmin(req.user.roles)) {
    res.status(403).json({ message: "You can only delete your own comments" });
    return;
  }

  await prisma.feedbackComment.delete({ where: { id: req.params.commentId } });
  res.json({ deleted: true });
});

// ---------------------------------------------------------------------------
// DELETE /feedback/:id — Delete feedback (admin or author)
// ---------------------------------------------------------------------------
feedbackRouter.delete("/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user) { res.status(401).json({ message: "Unauthorized" }); return; }

  const fb = await prisma.feedback.findUnique({ where: { id: req.params.id } });
  if (!fb) {
    res.status(404).json({ message: "Feedback not found" });
    return;
  }

  if (fb.authorId !== req.user.id && !isAdmin(req.user.roles)) {
    res.status(403).json({ message: "You can only delete your own feedback" });
    return;
  }

  await prisma.feedback.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
});
