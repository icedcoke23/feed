CREATE TABLE "ai_settings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key" text,
	"base_url" text,
	"model_id" varchar(100) DEFAULT 'gpt-3.5-turbo' NOT NULL,
	"max_concurrent" integer DEFAULT 5 NOT NULL,
	"system_prompt" text,
	"use_custom_ai" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "class_transfers" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"from_teacher_id" varchar(36),
	"to_teacher_id" varchar(36) NOT NULL,
	"from_class" varchar(100),
	"to_class" varchar(100),
	"reason" text,
	"transferred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"grade" varchar(50),
	"teacher_id" varchar(36),
	"schedule" varchar(255),
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "course_prompts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_code" varchar(50) NOT NULL,
	"system_prompt" text,
	"report_structure" text,
	"word_limit" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "course_prompts_stage_code_unique" UNIQUE("stage_code")
);
--> statement-breakpoint
CREATE TABLE "course_stages" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage_code" varchar(50) NOT NULL,
	"stage_name" varchar(100) NOT NULL,
	"theme" varchar(50) NOT NULL,
	"level" varchar(20) NOT NULL,
	"description" text,
	"content" text,
	"goal" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "course_stages_stage_code_unique" UNIQUE("stage_code")
);
--> statement-breakpoint
CREATE TABLE "feedback_ability_scores" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" varchar(36) NOT NULL,
	"ability_name" varchar(100) NOT NULL,
	"score" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feedback_id" varchar(36) NOT NULL,
	"tag_id" varchar(36),
	"category" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"rating" smallint,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedbacks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"teacher_id" varchar(36) NOT NULL,
	"strengths" jsonb DEFAULT '[]'::jsonb,
	"improvements" jsonb DEFAULT '[]'::jsonb,
	"weaknesses" jsonb DEFAULT '[]'::jsonb,
	"teaching_plan" jsonb DEFAULT '[]'::jsonb,
	"suggestions" text,
	"ai_report" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"work_info" jsonb DEFAULT '{}'::jsonb,
	"ability_scores" jsonb DEFAULT '[]'::jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"parent_feedback_id" varchar(36),
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"period_start" timestamp with time zone,
	"period_end" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "health_check" (
	"id" serial NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "student_classes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar(36) NOT NULL,
	"class_id" varchar(36) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"grade" varchar(50),
	"school" varchar(255),
	"phone" varchar(20),
	"current_teacher_id" varchar(36),
	"current_class" varchar(100),
	"class_id" varchar(36),
	"admin_teacher_id" varchar(36),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" varchar(255),
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(128) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"role" varchar(20) DEFAULT 'teacher' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "teachers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "teaching_themes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"category" varchar(100),
	"description" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(100) NOT NULL,
	"password" varchar(255) NOT NULL,
	"name" varchar(128) NOT NULL,
	"role" varchar(20) DEFAULT 'teacher' NOT NULL,
	"phone" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "class_transfers" ADD CONSTRAINT "class_transfers_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_transfers" ADD CONSTRAINT "class_transfers_from_teacher_id_teachers_id_fk" FOREIGN KEY ("from_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_transfers" ADD CONSTRAINT "class_transfers_to_teacher_id_teachers_id_fk" FOREIGN KEY ("to_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_prompts" ADD CONSTRAINT "course_prompts_stage_code_course_stages_stage_code_fk" FOREIGN KEY ("stage_code") REFERENCES "public"."course_stages"("stage_code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_ability_scores" ADD CONSTRAINT "feedback_ability_scores_feedback_id_feedbacks_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedbacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_feedback_id_feedbacks_id_fk" FOREIGN KEY ("feedback_id") REFERENCES "public"."feedbacks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_items" ADD CONSTRAINT "feedback_items_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_parent_feedback_id_feedbacks_id_fk" FOREIGN KEY ("parent_feedback_id") REFERENCES "public"."feedbacks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_classes" ADD CONSTRAINT "student_classes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_classes" ADD CONSTRAINT "student_classes_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_current_teacher_id_teachers_id_fk" FOREIGN KEY ("current_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_admin_teacher_id_teachers_id_fk" FOREIGN KEY ("admin_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_settings_updated_idx" ON "ai_settings" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "transfers_student_idx" ON "class_transfers" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "transfers_date_idx" ON "class_transfers" USING btree ("transferred_at");--> statement-breakpoint
CREATE INDEX "classes_teacher_idx" ON "classes" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "course_prompts_stage_code_idx" ON "course_prompts" USING btree ("stage_code");--> statement-breakpoint
CREATE INDEX "course_prompts_active_idx" ON "course_prompts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "course_stages_theme_idx" ON "course_stages" USING btree ("theme");--> statement-breakpoint
CREATE INDEX "course_stages_level_idx" ON "course_stages" USING btree ("level");--> statement-breakpoint
CREATE INDEX "feedback_ability_scores_feedback_id_idx" ON "feedback_ability_scores" USING btree ("feedback_id");--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_ability_scores_unique_idx" ON "feedback_ability_scores" USING btree ("feedback_id","ability_name");--> statement-breakpoint
CREATE INDEX "feedback_items_feedback_id_idx" ON "feedback_items" USING btree ("feedback_id");--> statement-breakpoint
CREATE INDEX "feedback_items_tag_id_idx" ON "feedback_items" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "feedback_items_category_idx" ON "feedback_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "feedbacks_student_idx" ON "feedbacks" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "feedbacks_teacher_idx" ON "feedbacks" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "feedbacks_created_idx" ON "feedbacks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "student_classes_student_idx" ON "student_classes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_classes_class_idx" ON "student_classes" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_classes_primary_idx" ON "student_classes" USING btree ("student_id") WHERE "student_classes"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "students_teacher_idx" ON "students" USING btree ("current_teacher_id");--> statement-breakpoint
CREATE INDEX "students_name_idx" ON "students" USING btree ("name");--> statement-breakpoint
CREATE INDEX "students_class_idx" ON "students" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "students_admin_teacher_idx" ON "students" USING btree ("admin_teacher_id");--> statement-breakpoint
CREATE INDEX "tags_category_idx" ON "tags" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_category_name_idx" ON "tags" USING btree ("category","name");--> statement-breakpoint
CREATE INDEX "teachers_email_idx" ON "teachers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "themes_category_idx" ON "teaching_themes" USING btree ("category");--> statement-breakpoint
CREATE INDEX "users_username_idx" ON "users" USING btree ("username");