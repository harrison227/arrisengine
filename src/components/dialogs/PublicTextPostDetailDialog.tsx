import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { CheckCircle, XCircle, MessageSquare, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface TextPost {
  id: string;
  content: string;
  platform: string;
  scheduled_for: string | null;
  status: string;
  hook?: string | null;
  cta?: string | null;
  hashtags?: string[] | null;
}

interface PublicTextPostDetailDialogProps {
  post: TextPost | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareId: string;
  onActionComplete?: () => void;
}

type ActionType = "approve" | "request_changes" | "reject";

export function PublicTextPostDetailDialog({
  post,
  open,
  onOpenChange,
  shareId,
  onActionComplete,
}: PublicTextPostDetailDialogProps) {
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");

  // Reset edited content when post changes
  useEffect(() => {
    if (post) {
      setEditedContent(post.content);
      setIsEditing(false);
    }
  }, [post?.id, post?.content]);

  const handleAction = async (action: ActionType) => {
    if (!post) return;

    // Require feedback for request_changes and reject
    if ((action === "request_changes" || action === "reject") && !feedback.trim()) {
      toast.error("Please provide feedback for this action");
      return;
    }

    setIsSubmitting(true);
    setActiveAction(action);

    try {
      // Build request body, include content if it was edited
      const requestBody: Record<string, any> = {
        shareId,
        postId: post.id,
        action,
        feedback: feedback.trim() || null,
      };

      // Include edited content if it changed
      if (editedContent !== post.content) {
        requestBody.content = editedContent;
      }

      const { data, error } = await supabase.functions.invoke("public-text-post-action", {
        body: requestBody,
      });

      if (error) throw error;

      const actionLabels: Record<ActionType, string> = {
        approve: "approved",
        request_changes: "sent back for changes",
        reject: "rejected",
      };

      toast.success(`Post ${actionLabels[action]} successfully`);
      setFeedback("");
      setIsEditing(false);
      onOpenChange(false);
      onActionComplete?.();
    } catch (error: any) {
      console.error("Error submitting action:", error);
      toast.error(error.message || "Failed to submit action");
    } finally {
      setIsSubmitting(false);
      setActiveAction(null);
    }
  };

  const handleCancelEdit = () => {
    setEditedContent(post?.content || "");
    setIsEditing(false);
  };

  if (!post) return null;

  const platformColors: Record<string, string> = {
    instagram: "bg-pink-500/10 text-pink-600 border-pink-200",
    facebook: "bg-blue-500/10 text-blue-600 border-blue-200",
    twitter: "bg-sky-500/10 text-sky-600 border-sky-200",
    linkedin: "bg-blue-700/10 text-blue-700 border-blue-300",
    tiktok: "bg-black/10 text-black border-gray-300",
    threads: "bg-gray-500/10 text-gray-700 border-gray-300",
  };

  const isApproved = post.status === "approved";
  const isRejected = post.status === "rejected";
  const needsChanges = post.status === "changes_requested";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-white text-slate-900 p-4 sm:p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg pr-6">
            Review Post
            <Badge
              variant="outline"
              className={cn("text-xs sm:text-sm", platformColors[post.platform.toLowerCase()] || "")}
            >
              {post.platform}
            </Badge>
            {post.scheduled_for && (
              <Badge variant="secondary" className="text-xs sm:text-sm">
                {format(new Date(post.scheduled_for), "MMM d, h:mm a")}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
          {/* Post Content */}
          <div className="space-y-3">
            {post.hook && (
              <div className="space-y-1">
                <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Hook
                </span>
                <p className="text-xs sm:text-sm font-medium text-slate-800">{post.hook}</p>
              </div>
            )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Content
                </span>
                {!isApproved && !isRejected && !isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="h-6 sm:h-7 text-xs"
                  >
                    <Pencil className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                )}
                {isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="h-6 sm:h-7 text-xs text-slate-500"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </Button>
                )}
              </div>
              
              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    rows={6}
                    className="resize-none text-xs sm:text-sm bg-white text-slate-900 border-slate-300 placeholder:text-slate-400"
                    placeholder="Enter post content..."
                  />
                  <p className="text-[10px] sm:text-xs text-slate-500">
                    {editedContent.length} characters
                    {editedContent !== post.content && (
                      <span className="text-amber-600 ml-2">• Edited</span>
                    )}
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-lg p-3 sm:p-4 whitespace-pre-wrap text-xs sm:text-sm text-slate-800 max-h-[30vh] overflow-y-auto border border-slate-200">
                  {post.content}
                </div>
              )}
            </div>

            {post.cta && (
              <div className="space-y-1">
                <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Call to Action
                </span>
                <p className="text-xs sm:text-sm text-slate-800">{post.cta}</p>
              </div>
            )}

            {post.hashtags && post.hashtags.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Hashtags
                </span>
                <div className="flex flex-wrap gap-1">
                  {post.hashtags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] sm:text-xs">
                      #{tag.replace(/^#/, "")}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Status indicator */}
          {(isApproved || isRejected || needsChanges) && (
            <div
              className={cn(
                "p-2.5 sm:p-3 rounded-lg text-xs sm:text-sm",
                isApproved && "bg-green-50 text-green-700 border border-green-200",
                isRejected && "bg-red-50 text-red-700 border border-red-200",
                needsChanges && "bg-yellow-50 text-yellow-700 border border-yellow-200"
              )}
            >
              {isApproved && "✓ This post has been approved"}
              {isRejected && "✕ This post has been rejected"}
              {needsChanges && "↻ Changes have been requested for this post"}
            </div>
          )}

          {/* Feedback input (only show if not already actioned) */}
          {!isApproved && !isRejected && (
            <>
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-slate-700">
                  Feedback / Notes{" "}
                  <span className="text-slate-500 font-normal text-[10px] sm:text-xs">
                    (required for changes or rejection)
                  </span>
                </label>
                <Textarea
                  placeholder="Add your feedback or requested changes here..."
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                  className="resize-none text-xs sm:text-sm bg-white text-slate-900 border-slate-300 placeholder:text-slate-400"
                />
              </div>

              {/* Action buttons - Stack on mobile */}
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => handleAction("approve")}
                  disabled={isSubmitting}
                  className="w-full bg-green-600 hover:bg-green-700 h-10 sm:h-11 text-sm"
                >
                  {isSubmitting && activeAction === "approve" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Approve
                </Button>

                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAction("request_changes")}
                    disabled={isSubmitting}
                    variant="outline"
                    className="flex-1 border-yellow-500 text-yellow-700 hover:bg-yellow-50 h-10 sm:h-11 text-xs sm:text-sm"
                  >
                    {isSubmitting && activeAction === "request_changes" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <MessageSquare className="h-4 w-4 mr-2" />
                    )}
                    Changes
                  </Button>

                  <Button
                    onClick={() => handleAction("reject")}
                    disabled={isSubmitting}
                    variant="outline"
                    className="flex-1 border-red-500 text-red-700 hover:bg-red-50 h-10 sm:h-11 text-xs sm:text-sm"
                  >
                    {isSubmitting && activeAction === "reject" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Reject
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
