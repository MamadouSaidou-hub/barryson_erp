CREATE TABLE "paiements_salaires" (
	"id" serial PRIMARY KEY NOT NULL,
	"employe_id" integer NOT NULL,
	"montant" bigint NOT NULL,
	"periode" text NOT NULL,
	"methode" text NOT NULL,
	"date" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "paiements_salaires_montant_check" CHECK ("paiements_salaires"."montant" > 0)
);
--> statement-breakpoint
CREATE TABLE "salaires_employes" (
	"id" serial PRIMARY KEY NOT NULL,
	"employe_id" integer NOT NULL,
	"salaire_base" bigint NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "salaires_employes_employe_id_unique" UNIQUE("employe_id"),
	CONSTRAINT "salaires_employes_montant_check" CHECK ("salaires_employes"."salaire_base" > 0)
);
--> statement-breakpoint
ALTER TABLE "paiements_salaires" ADD CONSTRAINT "paiements_salaires_employe_id_employes_id_fk" FOREIGN KEY ("employe_id") REFERENCES "public"."employes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salaires_employes" ADD CONSTRAINT "salaires_employes_employe_id_employes_id_fk" FOREIGN KEY ("employe_id") REFERENCES "public"."employes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paiements_salaires_employe_idx" ON "paiements_salaires" USING btree ("employe_id");