DROP INDEX "evidence_contribution";--> statement-breakpoint
ALTER TABLE "evidence" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "evidence_contribution" ON "evidence" USING btree ("contribution_id","position");