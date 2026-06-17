"use client";

import { Star, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { TagItem, TagRating } from "@/types/feedback";
import { generateDescriptionByRating } from "@/lib/feedback-utils";

interface TagRatingItemProps {
  tag: TagItem;
  isSelected: boolean;
  rating: number;
  tagRating: TagRating | undefined;
  onToggle: (tagId: string) => void;
  onUpdateRating: (tagId: string, rating: number) => void;
  onUpdateNote: (tagId: string, note: string) => void;
  badgeVariant?: "default" | "outline" | "destructive";
  selectedBorderColor?: string;
  selectedBgColor?: string;
}

export function TagRatingItem({
  tag,
  isSelected,
  rating,
  tagRating,
  onToggle,
  onUpdateRating,
  onUpdateNote,
  badgeVariant = "default",
  selectedBorderColor = "border-green-400",
  selectedBgColor = "bg-green-50",
}: TagRatingItemProps) {
  return (
    <div
      className={cn(
        "p-3 border rounded-lg transition-all bg-white",
        isSelected ? `${selectedBorderColor} ${selectedBgColor}` : "hover:border-gray-300"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={isSelected ? badgeVariant : "outline"} className="text-xs">
              {tag.name}
            </Badge>
            {isSelected && (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1"
                onClick={() => onToggle(tag.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          {tag.description && <p className="text-xs text-gray-500">{tag.description}</p>}
        </div>
        {!isSelected && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => onToggle(tag.id)}
          >
            <Plus className="h-3 w-3 mr-1" />
            选择
          </Button>
        )}
      </div>

      {isSelected && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs text-gray-600 mr-1">评分：</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onUpdateRating(tag.id, star)}
                className="focus:outline-none"
              >
                <Star
                  className={cn(
                    "h-5 w-5 transition-colors",
                    star <= rating
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300 hover:text-yellow-300"
                  )}
                />
              </button>
            ))}
            <span className="ml-1 text-xs font-medium">{rating}星</span>
          </div>
          <div>
            <Label className="text-xs text-gray-500">备注</Label>
            <Input
              className="mt-1 h-7 text-xs"
              placeholder={generateDescriptionByRating(tag.name, rating, tag.category)}
              value={tagRating?.note || ""}
              onChange={(e) => onUpdateNote(tag.id, e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
