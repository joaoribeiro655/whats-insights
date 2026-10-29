CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"phone_jid" text,
	"lid_jid" text,
	"phone" text,
	"name" text,
	"push_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"model" text NOT NULL,
	"analyzed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"message_count" integer NOT NULL,
	"lead_score" integer NOT NULL,
	"stage" text NOT NULL,
	"intent" text,
	"interest" text,
	"urgency" text,
	"budget_mentioned" text,
	"objections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lost_reason" text,
	"sentiment" text,
	"summary" text NOT NULL,
	"next_step" text,
	"followup_needed" boolean DEFAULT false NOT NULL,
	"followup_suggestion" text,
	"seller_score" integer NOT NULL,
	"seller_strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seller_improvements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"asked_qualifying_questions" boolean DEFAULT false NOT NULL,
	"attempted_close" boolean DEFAULT false NOT NULL,
	"raw" jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	CONSTRAINT "conversation_insights_conversation_id_unique" UNIQUE("conversation_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"last_inbound_at" timestamp with time zone,
	"last_outbound_at" timestamp with time zone,
	"last_direction" text,
	"first_inbound_at" timestamp with time zone,
	"first_response_at" timestamp with time zone,
	"first_response_seconds" integer,
	"inbound_count" integer DEFAULT 0 NOT NULL,
	"outbound_count" integer DEFAULT 0 NOT NULL,
	"ad_context" jsonb,
	"needs_analysis" boolean DEFAULT false NOT NULL,
	"analyzed_at" timestamp with time zone,
	"analyzed_message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"wa_message_id" text NOT NULL,
	"direction" text NOT NULL,
	"type" text NOT NULL,
	"text" text,
	"media_mimetype" text,
	"media_duration_seconds" integer,
	"quoted_wa_message_id" text,
	"ad_context" jsonb,
	"sent_at" timestamp with time zone NOT NULL,
	"source" text DEFAULT 'live' NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"sales_context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"instance_id" text NOT NULL,
	"status" text DEFAULT 'starting' NOT NULL,
	"phone" text,
	"wa_name" text,
	"last_status_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sellers_instance_id_unique" UNIQUE("instance_id")
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_insights" ADD CONSTRAINT "conversation_insights_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_seller_id_sellers_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."sellers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_seller_phone_jid" ON "contacts" USING btree ("seller_id","phone_jid");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_seller_lid_jid" ON "contacts" USING btree ("seller_id","lid_jid");--> statement-breakpoint
CREATE INDEX "insights_org_stage" ON "conversation_insights" USING btree ("org_id","stage");--> statement-breakpoint
CREATE INDEX "insights_seller" ON "conversation_insights" USING btree ("seller_id","analyzed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_seller_contact" ON "conversations" USING btree ("seller_id","contact_id");--> statement-breakpoint
CREATE INDEX "conversations_last_message" ON "conversations" USING btree ("org_id","last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_needs_analysis" ON "conversations" USING btree ("needs_analysis","last_message_at");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_seller_wa_id" ON "messages" USING btree ("seller_id","wa_message_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_sent" ON "messages" USING btree ("conversation_id","sent_at");--> statement-breakpoint
CREATE INDEX "messages_org_sent" ON "messages" USING btree ("org_id","sent_at");