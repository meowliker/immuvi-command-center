CREATE TYPE "public"."strategist_verdict_kind" AS ENUM('match', 'mismatch', 'missing', 'differs', 'unverifiable', 'no_claim_no_obs');--> statement-breakpoint
CREATE TYPE "public"."strategist_verifiability" AS ENUM('objective', 'semi', 'interpretive');--> statement-breakpoint
CREATE TYPE "public"."strategist_win_category" AS ENUM('winner', 'mild_winner', 'scale', 'loser', 'untested');--> statement-breakpoint
CREATE TABLE "strategist_creatives" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"source" text NOT NULL,
	"source_file_id" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"variant_index" integer,
	"is_video" boolean NOT NULL,
	"duration_sec" real,
	"width" integer,
	"height" integer,
	"aspect_ratio" text,
	"cut_count" integer,
	"cuts_per_minute" real,
	"has_voiceover" boolean,
	"has_music" boolean,
	"thumbnail_path" text,
	"analysed_at" timestamp with time zone,
	"analysis_error" text
);
--> statement-breakpoint
CREATE TABLE "strategist_frame_texts" (
	"id" text PRIMARY KEY NOT NULL,
	"creative_id" text NOT NULL,
	"t_sec" real NOT NULL,
	"text" text NOT NULL,
	"is_hook_frame" boolean DEFAULT false NOT NULL,
	"frame_path" text
);
--> statement-breakpoint
CREATE TABLE "strategist_keywords" (
	"id" text PRIMARY KEY NOT NULL,
	"creative_id" text,
	"term" text NOT NULL,
	"kind" text NOT NULL,
	"searchable" boolean DEFAULT true NOT NULL,
	"weight" real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategist_observations" (
	"creative_id" text PRIMARY KEY NOT NULL,
	"observed_ad_type" text,
	"observed_creative_structure" text,
	"observed_production_style" text,
	"observed_hook_type" text,
	"observed_funnel" text,
	"observed_angle_signal" text,
	"observed_persona_signal" text,
	"hook_text" text,
	"cta_text" text,
	"pain_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"model" text NOT NULL,
	"prompt_version" integer DEFAULT 1 NOT NULL,
	"analysed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategist_research" (
	"creative_id" text PRIMARY KEY NOT NULL,
	"format_description" text NOT NULL,
	"hook_mechanism" text NOT NULL,
	"core_concept" text NOT NULL,
	"creative_hypothesis" text NOT NULL,
	"offer" text,
	"offer_mechanism" text,
	"script_arc" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scenes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tactile_elements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"repurposed_signals" text,
	"source_handle" text,
	"model" text NOT NULL,
	"prompt_version" integer DEFAULT 1 NOT NULL,
	"analysed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategist_sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"trigger" text NOT NULL,
	"tasks_seen" integer DEFAULT 0 NOT NULL,
	"tasks_upserted" integer DEFAULT 0 NOT NULL,
	"creatives_queued" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "strategist_synthesis" (
	"product_key" text PRIMARY KEY NOT NULL,
	"product_name" text NOT NULL,
	"hook_formulas" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"winner_vs_mild" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hunt_for" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avoid" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_pattern" text,
	"winners_analysed" integer DEFAULT 0 NOT NULL,
	"losers_analysed" integer DEFAULT 0 NOT NULL,
	"model" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategist_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"list_id" text NOT NULL,
	"product_name" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"status" text NOT NULL,
	"category" "strategist_win_category" NOT NULL,
	"was_tested" boolean DEFAULT false NOT NULL,
	"date_created" timestamp with time zone,
	"date_updated" timestamp with time zone,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assignees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"editor" text,
	"product_code" text,
	"serial" integer,
	"inspiration_id" text,
	"legacy_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"variation_chain" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"changed_lever" text,
	"igb_angle" text,
	"parent_task_id" text,
	"claimed_angle" text,
	"claimed_persona" text,
	"claimed_funnel" text,
	"claimed_ad_type" text,
	"claimed_hook_type" text,
	"claimed_creative_structure" text,
	"claimed_production_style" text,
	"claimed_usp" text,
	"hypothesis" text,
	"notes" text,
	"drive_link" text,
	"inspiration_link" text,
	"inspiration_brief_url" text,
	"raw_description" text,
	"dedupe_key" text NOT NULL,
	"duplicate_of_task_id" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategist_transcripts" (
	"creative_id" text PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"language" text,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hook_spoken" text
);
--> statement-breakpoint
CREATE TABLE "strategist_verdicts" (
	"id" text PRIMARY KEY NOT NULL,
	"creative_id" text NOT NULL,
	"field" text NOT NULL,
	"verifiability" "strategist_verifiability" NOT NULL,
	"claimed_value" text,
	"observed_value" text,
	"verdict" "strategist_verdict_kind" NOT NULL,
	"confidence" real,
	"evidence" text,
	"resolved_value" text,
	"human_override" text,
	"overridden_by" text,
	"overridden_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "strategist_creatives" ADD CONSTRAINT "strategist_creatives_task_id_strategist_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."strategist_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategist_frame_texts" ADD CONSTRAINT "strategist_frame_texts_creative_id_strategist_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."strategist_creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategist_keywords" ADD CONSTRAINT "strategist_keywords_creative_id_strategist_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."strategist_creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategist_observations" ADD CONSTRAINT "strategist_observations_creative_id_strategist_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."strategist_creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategist_research" ADD CONSTRAINT "strategist_research_creative_id_strategist_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."strategist_creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategist_transcripts" ADD CONSTRAINT "strategist_transcripts_creative_id_strategist_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."strategist_creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategist_verdicts" ADD CONSTRAINT "strategist_verdicts_creative_id_strategist_creatives_id_fk" FOREIGN KEY ("creative_id") REFERENCES "public"."strategist_creatives"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "strategist_creatives_task_idx" ON "strategist_creatives" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strategist_creatives_source_idx" ON "strategist_creatives" USING btree ("source","source_file_id");--> statement-breakpoint
CREATE INDEX "strategist_frame_texts_creative_idx" ON "strategist_frame_texts" USING btree ("creative_id");--> statement-breakpoint
CREATE INDEX "strategist_keywords_term_idx" ON "strategist_keywords" USING btree ("term");--> statement-breakpoint
CREATE INDEX "strategist_keywords_creative_idx" ON "strategist_keywords" USING btree ("creative_id");--> statement-breakpoint
CREATE INDEX "strategist_tasks_list_idx" ON "strategist_tasks" USING btree ("list_id");--> statement-breakpoint
CREATE INDEX "strategist_tasks_category_idx" ON "strategist_tasks" USING btree ("category");--> statement-breakpoint
CREATE INDEX "strategist_tasks_dedupe_idx" ON "strategist_tasks" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "strategist_verdicts_creative_field_idx" ON "strategist_verdicts" USING btree ("creative_id","field");--> statement-breakpoint
CREATE INDEX "strategist_verdicts_verdict_idx" ON "strategist_verdicts" USING btree ("verdict");