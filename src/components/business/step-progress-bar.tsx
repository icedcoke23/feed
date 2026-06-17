"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { STEPS } from "@/lib/feedback-utils";

interface StepProgressBarProps {
  currentStep: number;
}

export function StepProgressBar({ currentStep }: StepProgressBarProps) {
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="bg-white border-b sticky top-0 z-40">
      <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-4">
        <div className="flex items-center justify-between mb-2 sm:mb-4">
          <Link
            href="/"
            className="flex items-center gap-1 sm:gap-2 text-gray-600 hover:text-gray-900 text-sm sm:text-base"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">返回首页</span>
            <span className="sm:hidden">返回</span>
          </Link>
          <div className="text-xs sm:text-sm text-gray-500">
            步骤 {currentStep + 1} / {STEPS.length}
          </div>
        </div>

        <div className="flex items-center justify-between overflow-x-auto">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;

            return (
              <div key={step.id} className="flex items-center flex-1 min-w-0">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-colors flex-shrink-0",
                    isActive && "bg-blue-500 text-white",
                    isCompleted && "bg-green-500 text-white",
                    !isActive && !isCompleted && "bg-gray-200 text-gray-500"
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </div>
                <div className="ml-1 sm:ml-2 hidden sm:block min-w-0">
                  <p
                    className={cn(
                      "text-xs sm:text-sm font-medium truncate",
                      isActive && "text-blue-600",
                      isCompleted && "text-green-600",
                      !isActive && !isCompleted && "text-gray-500"
                    )}
                  >
                    {step.title}
                  </p>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1 sm:mx-2 bg-gray-200 min-w-[10px]">
                    <div
                      className={cn(
                        "h-full transition-all",
                        isCompleted ? "bg-green-500" : "bg-transparent"
                      )}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Progress value={progress} className="mt-2 sm:mt-4 h-1" />
      </div>
    </div>
  );
}
