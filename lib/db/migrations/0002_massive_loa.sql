CREATE TABLE "paiements_fournisseurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"commande_id" integer NOT NULL,
	"montant" double precision NOT NULL,
	"methode" text NOT NULL,
	"date" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "paiements_fournisseurs_montant_check" CHECK ("paiements_fournisseurs"."montant" > 0)
);
--> statement-breakpoint
ALTER TABLE "paiements_fournisseurs" ADD CONSTRAINT "paiements_fournisseurs_commande_id_commandes_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paiements_fournisseurs_commande_idx" ON "paiements_fournisseurs" USING btree ("commande_id");