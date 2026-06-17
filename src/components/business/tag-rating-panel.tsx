"use client";

import { Tag, Plus, CheckCircle2, ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TagItem, TagRating, CategorizedTags } from "@/types/feedback";
import { TagRatingItem } from "./tag-rating-item";

interface TagRatingPanelProps {
  categorizedTags: CategorizedTags;
  tagRatings: Record<string, TagRating>;
  selectedTagsCount: number;
  customTagName: string;
  customTagNote: string;
  customTagRating: number;
  customTagCategory: string;
  addingCustomTag: boolean;
  onToggleTag: (tagId: string) => void;
  onUpdateTagRating: (tagId: string, rating: number) => void;
  onUpdateTagNote: (tagId: string, note: string) => void;
  onSetCustomTagName: (name: string) => void;
  onSetCustomTagNote: (note: string) => void;
  onSetCustomTagRating: (rating: number) => void;
  onSetCustomTagCategory: (category: string) => void;
  onAddCustomTag: () => void;
}

function TagCategoryList({
  tags,
  tagRatings,
  onToggle,
  onUpdateRating,
  onUpdateNote,
  badgeVariant,
  selectedBorderColor,
  selectedBgColor,
}: {
  tags: TagItem[];
  tagRatings: Record<string, TagRating>;
  onToggle: (tagId: string) => void;
  onUpdateRating: (tagId: string, rating: number) => void;
  onUpdateNote: (tagId: string, note: string) => void;
  badgeVariant: "default" | "outline" | "destructive";
  selectedBorderColor: string;
  selectedBgColor: string;
}) {
  return (
    <div className="space-y-3">
      {tags.map((tag) => (
        <TagRatingItem
          key={tag.id}
          tag={tag}
          isSelected={!!tagRatings[tag.id]}
          rating={tagRatings[tag.id]?.rating || 0}
          tagRating={tagRatings[tag.id]}
          onToggle={onToggle}
          onUpdateRating={onUpdateRating}
          onUpdateNote={onUpdateNote}
          badgeVariant={badgeVariant}
          selectedBorderColor={selectedBorderColor}
          selectedBgColor={selectedBgColor}
        />
      ))}
    </div>
  );
}

export function TagRatingPanel({
  categorizedTags,
  tagRatings,
  selectedTagsCount,
  customTagName,
  customTagNote,
  customTagRating,
  customTagCategory,
  addingCustomTag,
  onToggleTag,
  onUpdateTagRating,
  onUpdateTagNote,
  onSetCustomTagName,
  onSetCustomTagNote,
  onSetCustomTagRating,
  onSetCustomTagCategory,
  onAddCustomTag,
}: TagRatingPanelProps) {
  return (
    <div className="space-y-6">
      {/* 自定义添加标签 */}
      <Card className="border-dashed border-2 border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            自定义添加标签
          </CardTitle>
          <CardDescription>添加自定义评价维度，选择分类后保存到系统中</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label className="text-xs">标签名称</Label>
              <Input
                placeholder="例如：创新能力"
                value={customTagName}
                onChange={(e) => onSetCustomTagName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">分类</Label>
              <Select
                value={customTagCategory}
                onValueChange={onSetCustomTagCategory}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strength">优点</SelectItem>
                  <SelectItem value="improvement">提升</SelectItem>
                  <SelectItem value="weakness">待提升</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">星级评分</Label>
              <Select
                value={customTagRating.toString()}
                onValueChange={(v) => onSetCustomTagRating(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <SelectItem key={star} value={star.toString()}>
                      {star}星
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs">备注说明（可选）</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="标签描述或表现说明"
                  value={customTagNote}
                  onChange={(e) => onSetCustomTagNote(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={onAddCustomTag} disabled={!customTagName.trim() || addingCustomTag}>
                  {addingCustomTag ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            能力评价
          </CardTitle>
          <CardDescription>
            选择评价维度并进行星级评分（1-5星），系统将根据评分自动生成描述
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50 rounded-lg flex items-center justify-between">
            <span className="text-sm text-blue-700">
              已选择 <strong>{selectedTagsCount}</strong> 个评价维度
            </span>
            <Badge variant={selectedTagsCount > 0 ? "default" : "secondary"}>至少选择1个</Badge>
          </div>

          {/* 手机端：标签页切换 */}
          <div className="md:hidden">
            <Tabs defaultValue="strength" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-auto">
                <TabsTrigger
                  value="strength"
                  className="text-xs py-2 data-[state=active]:bg-green-100 data-[state=active]:text-green-700"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  优点
                </TabsTrigger>
                <TabsTrigger
                  value="improvement"
                  className="text-xs py-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  提升
                </TabsTrigger>
                <TabsTrigger
                  value="weakness"
                  className="text-xs py-2 data-[state=active]:bg-red-100 data-[state=active]:text-red-700"
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  待提升
                </TabsTrigger>
              </TabsList>

              <TabsContent value="strength" className="mt-3">
                <div className="border rounded-lg bg-green-50/30 overflow-hidden">
                  <h4 className="font-medium p-3 flex items-center gap-2 text-green-700 bg-green-50/95 border-b text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    学员优点
                  </h4>
                  <div className="max-h-[400px] overflow-y-auto p-3">
                    <TagCategoryList
                      tags={categorizedTags.strength}
                      tagRatings={tagRatings}
                      onToggle={onToggleTag}
                      onUpdateRating={onUpdateTagRating}
                      onUpdateNote={onUpdateTagNote}
                      badgeVariant="default"
                      selectedBorderColor="border-green-400"
                      selectedBgColor="bg-green-50"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="improvement" className="mt-3">
                <div className="border rounded-lg bg-blue-50/30 overflow-hidden">
                  <h4 className="font-medium p-3 flex items-center gap-2 text-blue-700 bg-blue-50/95 border-b text-sm">
                    <ArrowRight className="h-4 w-4" />
                    能力提升
                  </h4>
                  <div className="max-h-[400px] overflow-y-auto p-3">
                    <TagCategoryList
                      tags={categorizedTags.improvement}
                      tagRatings={tagRatings}
                      onToggle={onToggleTag}
                      onUpdateRating={onUpdateTagRating}
                      onUpdateNote={onUpdateTagNote}
                      badgeVariant="default"
                      selectedBorderColor="border-blue-400"
                      selectedBgColor="bg-blue-50"
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="weakness" className="mt-3">
                <div className="border rounded-lg bg-red-50/30 overflow-hidden">
                  <h4 className="font-medium p-3 flex items-center gap-2 text-red-700 bg-red-50/95 border-b text-sm">
                    <AlertCircle className="h-4 w-4" />
                    需要提升
                  </h4>
                  <div className="max-h-[400px] overflow-y-auto p-3">
                    <TagCategoryList
                      tags={categorizedTags.weakness}
                      tagRatings={tagRatings}
                      onToggle={onToggleTag}
                      onUpdateRating={onUpdateTagRating}
                      onUpdateNote={onUpdateTagNote}
                      badgeVariant="destructive"
                      selectedBorderColor="border-red-400"
                      selectedBgColor="bg-red-50"
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* 电脑端：三栏布局 */}
          <div className="hidden md:grid grid-cols-3 gap-4" style={{ height: "500px" }}>
            {/* 学员优点 */}
            <div className="border rounded-lg bg-green-50/30 flex flex-col overflow-hidden h-full">
              <h4 className="font-medium p-4 pb-3 flex items-center gap-2 text-green-700 bg-green-50/95 border-b shrink-0">
                <CheckCircle2 className="h-4 w-4" />
                学员优点
              </h4>
              <div className="flex-1 overflow-y-auto p-4 pt-3">
                <TagCategoryList
                  tags={categorizedTags.strength}
                  tagRatings={tagRatings}
                  onToggle={onToggleTag}
                  onUpdateRating={onUpdateTagRating}
                  onUpdateNote={onUpdateTagNote}
                  badgeVariant="default"
                  selectedBorderColor="border-green-400"
                  selectedBgColor="bg-green-50"
                />
              </div>
            </div>

            {/* 能力提升 */}
            <div className="border rounded-lg bg-blue-50/30 flex flex-col overflow-hidden h-full">
              <h4 className="font-medium p-4 pb-3 flex items-center gap-2 text-blue-700 bg-blue-50/95 border-b shrink-0">
                <ArrowRight className="h-4 w-4" />
                能力提升
              </h4>
              <div className="flex-1 overflow-y-auto p-4 pt-3">
                <TagCategoryList
                  tags={categorizedTags.improvement}
                  tagRatings={tagRatings}
                  onToggle={onToggleTag}
                  onUpdateRating={onUpdateTagRating}
                  onUpdateNote={onUpdateTagNote}
                  badgeVariant="default"
                  selectedBorderColor="border-blue-400"
                  selectedBgColor="bg-blue-50"
                />
              </div>
            </div>

            {/* 需要提升 */}
            <div className="border rounded-lg bg-red-50/30 flex flex-col overflow-hidden h-full">
              <h4 className="font-medium p-4 pb-3 flex items-center gap-2 text-red-700 bg-red-50/95 border-b shrink-0">
                <AlertCircle className="h-4 w-4" />
                需要提升
              </h4>
              <div className="flex-1 overflow-y-auto p-4 pt-3">
                <TagCategoryList
                  tags={categorizedTags.weakness}
                  tagRatings={tagRatings}
                  onToggle={onToggleTag}
                  onUpdateRating={onUpdateTagRating}
                  onUpdateNote={onUpdateTagNote}
                  badgeVariant="destructive"
                  selectedBorderColor="border-red-400"
                  selectedBgColor="bg-red-50"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
