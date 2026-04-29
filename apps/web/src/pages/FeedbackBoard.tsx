import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronUp,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Bug,
  Lightbulb,
  TrendingUp,
  MessageCircle,
  X,
} from "lucide-react";
import { api } from "../api";
import { useAppContext } from "../context/AppContext";
import type { FeedbackItem, FeedbackCategory, FeedbackStatus } from "../types";

const CATEGORY_ICONS: Record<FeedbackCategory, React.ReactNode> = {
  BUG: <Bug size={14} />,
  FEATURE: <Lightbulb size={14} />,
  IMPROVEMENT: <TrendingUp size={14} />,
  GENERAL: <MessageCircle size={14} />,
};

export function FeedbackBoard() {
  const { t } = useTranslation();
  const { user, isAdmin } = useAppContext();

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<FeedbackCategory | "ALL">("ALL");
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"votes" | "newest">("votes");
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formCategory, setFormCategory] = useState<FeedbackCategory>("FEATURE");
  const [submitting, setSubmitting] = useState(false);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [commentingOn, setCommentingOn] = useState<string | null>(null);

  const loadFeedback = useCallback(async () => {
    try {
      const params: Record<string, string> = { sortBy };
      if (filterCategory !== "ALL") params.category = filterCategory;
      if (filterStatus !== "ALL") params.status = filterStatus;
      const res = await api.get("/feedback", { params });
      setItems(res.data.feedback);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [sortBy, filterCategory, filterStatus]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  async function handleSubmit() {
    if (!formTitle.trim() || !formBody.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post("/feedback", {
        title: formTitle.trim(),
        body: formBody.trim(),
        category: formCategory,
      });
      setItems((prev) => [res.data.feedback, ...prev]);
      setFormTitle("");
      setFormBody("");
      setFormCategory("FEATURE");
      setShowForm(false);
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVote(feedbackId: string) {
    try {
      const res = await api.post(`/feedback/${feedbackId}/vote`);
      setItems((prev) =>
        prev.map((item) =>
          item.id === feedbackId
            ? { ...item, hasVoted: res.data.hasVoted, voteCount: res.data.voteCount }
            : item,
        ),
      );
    } catch {
      // silent
    }
  }

  async function handleAddComment(feedbackId: string) {
    if (!commentText.trim()) return;
    try {
      const res = await api.post(`/feedback/${feedbackId}/comments`, {
        body: commentText.trim(),
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === feedbackId
            ? {
                ...item,
                comments: [...item.comments, res.data.comment],
                commentCount: item.commentCount + 1,
              }
            : item,
        ),
      );
      setCommentText("");
      setCommentingOn(null);
    } catch {
      // silent
    }
  }

  async function handleDeleteComment(feedbackId: string, commentId: string) {
    try {
      await api.delete(`/feedback/${feedbackId}/comments/${commentId}`);
      setItems((prev) =>
        prev.map((item) =>
          item.id === feedbackId
            ? {
                ...item,
                comments: item.comments.filter((c) => c.id !== commentId),
                commentCount: item.commentCount - 1,
              }
            : item,
        ),
      );
    } catch {
      // silent
    }
  }

  async function handleDeleteFeedback(feedbackId: string) {
    if (!confirm(t("feedbackDeleteConfirm"))) return;
    try {
      await api.delete(`/feedback/${feedbackId}`);
      setItems((prev) => prev.filter((item) => item.id !== feedbackId));
    } catch {
      // silent
    }
  }

  async function handleStatusChange(feedbackId: string, status: FeedbackStatus) {
    try {
      await api.patch(`/feedback/${feedbackId}/status`, { status });
      setItems((prev) =>
        prev.map((item) =>
          item.id === feedbackId ? { ...item, status } : item,
        ),
      );
    } catch {
      // silent
    }
  }

  function categoryLabel(cat: FeedbackCategory): string {
    const map: Record<FeedbackCategory, string> = {
      BUG: t("feedbackCategoryBug"),
      FEATURE: t("feedbackCategoryFeature"),
      IMPROVEMENT: t("feedbackCategoryImprovement"),
      GENERAL: t("feedbackCategoryGeneral"),
    };
    return map[cat];
  }

  function statusLabel(s: FeedbackStatus): string {
    const map: Record<FeedbackStatus, string> = {
      OPEN: t("feedbackStatusOpen"),
      UNDER_REVIEW: t("feedbackStatusUnderReview"),
      PLANNED: t("feedbackStatusPlanned"),
      DONE: t("feedbackStatusDone"),
      CLOSED: t("feedbackStatusClosed"),
    };
    return map[s];
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  const categories: FeedbackCategory[] = ["BUG", "FEATURE", "IMPROVEMENT", "GENERAL"];
  const statuses: FeedbackStatus[] = ["OPEN", "UNDER_REVIEW", "PLANNED", "DONE", "CLOSED"];

  return (
    <section className="feedback-board">
      <div className="feedback-header">
        <h2>{t("feedbackBoard")}</h2>
        <button className="btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X size={14} /> : <Plus size={14} />}
          {showForm ? t("cancel") : t("feedbackNew")}
        </button>
      </div>

      {/* ── New Feedback Form ── */}
      {showForm && (
        <div className="feedback-form card">
          <label>
            {t("feedbackTitle")} *
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              maxLength={200}
            />
          </label>
          <label>
            {t("feedbackCategory")}
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as FeedbackCategory)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {categoryLabel(cat)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("feedbackBody")} *
            <textarea
              rows={4}
              value={formBody}
              onChange={(e) => setFormBody(e.target.value)}
              maxLength={2000}
            />
          </label>
          <div className="feedback-form-actions">
            <button
              className="btn-primary"
              disabled={submitting || !formTitle.trim() || !formBody.trim()}
              onClick={() => void handleSubmit()}
            >
              {t("feedbackSubmit")}
            </button>
          </div>
        </div>
      )}

      {/* ── Filters & Sort ── */}
      <div className="feedback-filters">
        <div className="feedback-filter-group">
          <button
            className={`feedback-chip${filterCategory === "ALL" ? " active" : ""}`}
            onClick={() => setFilterCategory("ALL")}
          >
            {t("feedbackFilterAll")}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`feedback-chip${filterCategory === cat ? " active" : ""}`}
              onClick={() => setFilterCategory(cat)}
            >
              {CATEGORY_ICONS[cat]} {categoryLabel(cat)}
            </button>
          ))}
        </div>
        <div className="feedback-filter-group">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FeedbackStatus | "ALL")}
            className="feedback-status-filter"
          >
            <option value="ALL">{t("feedbackFilterAll")} {t("feedbackStatus")}</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "votes" | "newest")}
            className="feedback-sort"
          >
            <option value="votes">{t("feedbackSortVotes")}</option>
            <option value="newest">{t("feedbackSortNewest")}</option>
          </select>
        </div>
      </div>

      {/* ── Feedback List ── */}
      {loading ? (
        <p className="feedback-loading">{t("loading")}</p>
      ) : items.length === 0 ? (
        <p className="feedback-empty">{t("feedbackNoItems")}</p>
      ) : (
        <div className="feedback-list">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const isOwner = user?.id === item.author.id;
            return (
              <article key={item.id} className={`feedback-card card${isExpanded ? " expanded" : ""}`}>
                <div className="feedback-card-main">
                  {/* Vote button */}
                  <button
                    className={`feedback-vote-btn${item.hasVoted ? " voted" : ""}`}
                    onClick={() => void handleVote(item.id)}
                    aria-label={t("feedbackVote")}
                  >
                    <ChevronUp size={18} />
                    <span>{item.voteCount}</span>
                  </button>

                  {/* Content */}
                  <div
                    className="feedback-card-content"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setExpandedId(isExpanded ? null : item.id);
                    }}
                  >
                    <div className="feedback-card-title-row">
                      <h3>{item.title}</h3>
                      <span className={`feedback-category-chip ${item.category.toLowerCase()}`}>
                        {CATEGORY_ICONS[item.category]} {categoryLabel(item.category)}
                      </span>
                      <span className={`feedback-status-chip ${item.status.toLowerCase().replace("_", "-")}`}>
                        {statusLabel(item.status)}
                      </span>
                    </div>
                    <p className="feedback-card-body">{item.body}</p>
                    <div className="feedback-card-meta">
                      <span>{t("feedbackPostedBy")} {item.author.fullName}</span>
                      <span>·</span>
                      <span>{formatDate(item.createdAt)}</span>
                      <span>·</span>
                      <span><MessageSquare size={12} /> {item.commentCount}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="feedback-card-actions">
                    {isAdmin && (
                      <select
                        className="feedback-admin-status"
                        value={item.status}
                        onChange={(e) => void handleStatusChange(item.id, e.target.value as FeedbackStatus)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>{statusLabel(s)}</option>
                        ))}
                      </select>
                    )}
                    {(isOwner || isAdmin) && (
                      <button
                        className="feedback-delete-btn"
                        onClick={(e) => { e.stopPropagation(); void handleDeleteFeedback(item.id); }}
                        aria-label={t("feedbackDelete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded: Comments */}
                {isExpanded && (
                  <div className="feedback-comments-section">
                    {item.comments.length > 0 && (
                      <div className="feedback-comments-list">
                        {item.comments.map((comment) => (
                          <div key={comment.id} className="feedback-comment">
                            <div className="feedback-comment-header">
                              <strong>{comment.author.fullName}</strong>
                              <span>{formatDate(comment.createdAt)}</span>
                              {(comment.author.id === user?.id || isAdmin) && (
                                <button
                                  className="feedback-comment-delete"
                                  onClick={() => void handleDeleteComment(item.id, comment.id)}
                                  aria-label={t("delete")}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                            <p>{comment.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="feedback-comment-form">
                      <input
                        type="text"
                        placeholder={t("feedbackWriteComment")}
                        value={commentingOn === item.id ? commentText : ""}
                        onFocus={() => setCommentingOn(item.id)}
                        onChange={(e) => {
                          setCommentingOn(item.id);
                          setCommentText(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && commentText.trim()) {
                            void handleAddComment(item.id);
                          }
                        }}
                      />
                      <button
                        className="btn-primary"
                        disabled={!commentText.trim() || commentingOn !== item.id}
                        onClick={() => void handleAddComment(item.id)}
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
