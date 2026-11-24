CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"level" text NOT NULL,
	"unit" text NOT NULL,
	"seuil_min" double precision,
	"seuil_max" double precision,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "articles_code_unique" UNIQUE("code"),
	CONSTRAINT "articles_level_check" CHECK ("articles"."level" in ('matiere_premiere','semi_fini','produit_fini')),
	CONSTRAINT "articles_unit_check" CHECK ("articles"."unit" in ('kg','m','rouleau','piece','panier','carton'))
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"reason" text,
	"before_data" jsonb NOT NULL,
	"after_data" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalogue_produits" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"label" text NOT NULL,
	"finish" text,
	"supplier_ref" text,
	"typical_net_weight_kg" double precision,
	"typical_length_m" double precision,
	"usual_price" double precision,
	"usual_currency" text,
	"created_at" text NOT NULL,
	CONSTRAINT "catalogue_produits_article_id_unique" UNIQUE("article_id")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"segment" text,
	"zone" text,
	"delai_paiement_jours" integer,
	"plafond_encours" bigint,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "clients_code_unique" UNIQUE("code"),
	CONSTRAINT "clients_plafond_check" CHECK ("clients"."plafond_encours" is null or "clients"."plafond_encours" >= 0)
);
--> statement-breakpoint
CREATE TABLE "commande_lignes" (
	"id" serial PRIMARY KEY NOT NULL,
	"commande_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"catalogue_produit_id" integer,
	"nom_affiche" text NOT NULL,
	"description" text,
	"quantite" double precision NOT NULL,
	"prix_unitaire" double precision,
	"finish" text,
	"created_at" text NOT NULL,
	CONSTRAINT "commande_lignes_quantite_check" CHECK ("commande_lignes"."quantite" > 0),
	CONSTRAINT "commande_lignes_prix_check" CHECK ("commande_lignes"."prix_unitaire" is null or "commande_lignes"."prix_unitaire" >= 0)
);
--> statement-breakpoint
CREATE TABLE "commandes" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"fournisseur_id" integer NOT NULL,
	"devise" text NOT NULL,
	"taux_change" double precision,
	"date_arrivee_prevue" text,
	"reference" text,
	"commentaire" text,
	"etat" text DEFAULT 'brouillon' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "commandes_numero_unique" UNIQUE("numero"),
	CONSTRAINT "commandes_etat_check" CHECK ("commandes"."etat" in ('brouillon','commandee','partiellement_recue','recue','soldee','annulee'))
);
--> statement-breakpoint
CREATE TABLE "commandes_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"client_id" integer NOT NULL,
	"commercial" text,
	"date_commande" text NOT NULL,
	"reference" text,
	"commentaire" text,
	"etat" text DEFAULT 'brouillon' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "commandes_clients_numero_unique" UNIQUE("numero"),
	CONSTRAINT "commandes_clients_etat_check" CHECK ("commandes_clients"."etat" in ('brouillon','confirmee','partiellement_livree','livree','annulee'))
);
--> statement-breakpoint
CREATE TABLE "commandes_clients_lignes" (
	"id" serial PRIMARY KEY NOT NULL,
	"commande_client_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"nom_affiche" text NOT NULL,
	"quantite" double precision NOT NULL,
	"prix_unitaire" bigint NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "commandes_clients_lignes_quantite_check" CHECK ("commandes_clients_lignes"."quantite" > 0),
	CONSTRAINT "commandes_clients_lignes_prix_check" CHECK ("commandes_clients_lignes"."prix_unitaire" >= 0)
);
--> statement-breakpoint
CREATE TABLE "devis" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"client_id" integer NOT NULL,
	"commercial" text,
	"date_devis" text NOT NULL,
	"validite_jours" integer,
	"reference" text,
	"commentaire" text,
	"etat" text DEFAULT 'brouillon' NOT NULL,
	"commande_client_id" integer,
	"created_at" text NOT NULL,
	CONSTRAINT "devis_numero_unique" UNIQUE("numero"),
	CONSTRAINT "devis_etat_check" CHECK ("devis"."etat" in ('brouillon','accepte','refuse')),
	CONSTRAINT "devis_validite_check" CHECK ("devis"."validite_jours" is null or "devis"."validite_jours" > 0)
);
--> statement-breakpoint
CREATE TABLE "devis_lignes" (
	"id" serial PRIMARY KEY NOT NULL,
	"devis_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"nom_affiche" text NOT NULL,
	"quantite" double precision NOT NULL,
	"prix_unitaire" bigint NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "devis_lignes_quantite_check" CHECK ("devis_lignes"."quantite" > 0),
	CONSTRAINT "devis_lignes_prix_check" CHECK ("devis_lignes"."prix_unitaire" >= 0)
);
--> statement-breakpoint
CREATE TABLE "doctor_rewinder_dossiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"fabrication_id" integer NOT NULL,
	"quantite_envoyee" integer NOT NULL,
	"quantite_recuperee" integer,
	"quantite_perdue" integer,
	"date_envoi" text NOT NULL,
	"date_retour" text,
	"statut" text DEFAULT 'en_cours' NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "doctor_rewinder_dossiers_statut_check" CHECK ("doctor_rewinder_dossiers"."statut" in ('en_cours','cloture'))
);
--> statement-breakpoint
CREATE TABLE "fabrications" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"modele_ruban_id" integer NOT NULL,
	"metrage_engage" double precision NOT NULL,
	"date_debut" text NOT NULL,
	"etat" text DEFAULT 'ouverte' NOT NULL,
	"tours_total" integer,
	"tours_defectueux" integer,
	"pieces_defectueuses_supp" integer,
	"pieces_doctor_rewinder" integer,
	"pieces_perdues" integer,
	"date_resultat" text,
	"created_at" text NOT NULL,
	CONSTRAINT "fabrications_numero_unique" UNIQUE("numero"),
	CONSTRAINT "fabrications_etat_check" CHECK ("fabrications"."etat" in ('ouverte','terminee','annulee')),
	CONSTRAINT "fabrications_metrage_check" CHECK ("fabrications"."metrage_engage" > 0)
);
--> statement-breakpoint
CREATE TABLE "fournisseurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"phone" text,
	"email" text,
	"address" text,
	"payment_terms" text,
	"lead_time_days" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "fournisseurs_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "livraisons_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"commande_client_id" integer NOT NULL,
	"numero" text NOT NULL,
	"date" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "livraisons_clients_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "livraisons_clients_lignes" (
	"id" serial PRIMARY KEY NOT NULL,
	"livraison_id" integer NOT NULL,
	"commande_client_ligne_id" integer NOT NULL,
	"quantite_livree" double precision NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "livraisons_clients_lignes_quantite_check" CHECK ("livraisons_clients_lignes"."quantite_livree" > 0)
);
--> statement-breakpoint
CREATE TABLE "modeles_ruban" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"famille" text NOT NULL,
	"largeur_mm" double precision NOT NULL,
	"longueur_rouleau_m" double precision NOT NULL,
	"pieces_par_tour" integer NOT NULL,
	"pieces_par_carton" integer NOT NULL,
	"pieces_par_paquet" integer,
	"plastique_kg_par_paquet" double precision,
	"finish" text,
	"moule" text,
	"bobine_article_id" integer NOT NULL,
	"tube_article_id" integer NOT NULL,
	"carton_article_id" integer NOT NULL,
	"plastique_article_id" integer,
	"produit_fini_article_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "modeles_ruban_famille_check" CHECK ("modeles_ruban"."famille" in ('bopp','pvc_electrique','masquage')),
	CONSTRAINT "modeles_ruban_largeur_check" CHECK ("modeles_ruban"."largeur_mm" > 0),
	CONSTRAINT "modeles_ruban_longueur_check" CHECK ("modeles_ruban"."longueur_rouleau_m" > 0),
	CONSTRAINT "modeles_ruban_pieces_par_tour_check" CHECK ("modeles_ruban"."pieces_par_tour" > 0),
	CONSTRAINT "modeles_ruban_pieces_par_carton_check" CHECK ("modeles_ruban"."pieces_par_carton" > 0),
	CONSTRAINT "modeles_ruban_pieces_par_paquet_check" CHECK ("modeles_ruban"."pieces_par_paquet" is null or "modeles_ruban"."pieces_par_paquet" > 0),
	CONSTRAINT "modeles_ruban_plastique_kg_check" CHECK ("modeles_ruban"."plastique_kg_par_paquet" is null or "modeles_ruban"."plastique_kg_par_paquet" > 0)
);
--> statement-breakpoint
CREATE TABLE "paiements_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"commande_client_id" integer NOT NULL,
	"montant" bigint NOT NULL,
	"methode" text NOT NULL,
	"date" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "paiements_clients_montant_check" CHECK ("paiements_clients"."montant" > 0)
);
--> statement-breakpoint
CREATE TABLE "reception_lignes" (
	"id" serial PRIMARY KEY NOT NULL,
	"reception_id" integer NOT NULL,
	"commande_ligne_id" integer NOT NULL,
	"quantite_recue" double precision NOT NULL,
	"quantite_acceptee" double precision NOT NULL,
	"motif_ecart" text,
	"created_at" text NOT NULL,
	CONSTRAINT "reception_lignes_quantite_recue_check" CHECK ("reception_lignes"."quantite_recue" >= 0),
	CONSTRAINT "reception_lignes_quantite_acceptee_check" CHECK ("reception_lignes"."quantite_acceptee" >= 0)
);
--> statement-breakpoint
CREATE TABLE "receptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"commande_id" integer NOT NULL,
	"numero" text NOT NULL,
	"date" text NOT NULL,
	"reference_document" text,
	"documents_conformes" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "receptions_numero_unique" UNIQUE("numero")
);
--> statement-breakpoint
CREATE TABLE "relances_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"commande_client_id" integer NOT NULL,
	"niveau" integer NOT NULL,
	"canal" text NOT NULL,
	"commentaire" text,
	"date" text NOT NULL,
	"auteur_id" text NOT NULL,
	"auteur_name" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "relances_clients_niveau_check" CHECK ("relances_clients"."niveau" in (1,2,3))
);
--> statement-breakpoint
CREATE TABLE "stock_mouvements" (
	"id" serial PRIMARY KEY NOT NULL,
	"article_id" integer NOT NULL,
	"type" text NOT NULL,
	"quantite" double precision NOT NULL,
	"motif" text,
	"auteur_id" text NOT NULL,
	"auteur_name" text NOT NULL,
	"reception_ligne_id" integer,
	"date" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "stock_mouvements_type_check" CHECK ("stock_mouvements"."type" in ('reception','entree_manuelle','entree_directe','sortie_manuelle','sortie_exceptionnelle','ajustement','inventaire','consommation','transformation','rebut','vente')),
	CONSTRAINT "stock_mouvements_quantite_check" CHECK ("stock_mouvements"."quantite" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_niveaux" (
	"article_id" integer PRIMARY KEY NOT NULL,
	"quantite" double precision DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "stock_niveaux_quantite_check" CHECK ("stock_niveaux"."quantite" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tarifs_clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"prix_unitaire" bigint NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "tarifs_clients_prix_check" CHECK ("tarifs_clients"."prix_unitaire" >= 0)
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"issuer" text DEFAULT 'local:credential' NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"impersonated_by" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"image" text,
	"role" text DEFAULT 'resp_stock' NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "catalogue_produits" ADD CONSTRAINT "catalogue_produits_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commande_lignes" ADD CONSTRAINT "commande_lignes_commande_id_commandes_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commande_lignes" ADD CONSTRAINT "commande_lignes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commande_lignes" ADD CONSTRAINT "commande_lignes_catalogue_produit_id_catalogue_produits_id_fk" FOREIGN KEY ("catalogue_produit_id") REFERENCES "public"."catalogue_produits"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commandes" ADD CONSTRAINT "commandes_fournisseur_id_fournisseurs_id_fk" FOREIGN KEY ("fournisseur_id") REFERENCES "public"."fournisseurs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commandes_clients" ADD CONSTRAINT "commandes_clients_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commandes_clients_lignes" ADD CONSTRAINT "commandes_clients_lignes_commande_client_id_commandes_clients_id_fk" FOREIGN KEY ("commande_client_id") REFERENCES "public"."commandes_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commandes_clients_lignes" ADD CONSTRAINT "commandes_clients_lignes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis" ADD CONSTRAINT "devis_commande_client_id_commandes_clients_id_fk" FOREIGN KEY ("commande_client_id") REFERENCES "public"."commandes_clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis_lignes" ADD CONSTRAINT "devis_lignes_devis_id_devis_id_fk" FOREIGN KEY ("devis_id") REFERENCES "public"."devis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devis_lignes" ADD CONSTRAINT "devis_lignes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "doctor_rewinder_dossiers" ADD CONSTRAINT "doctor_rewinder_dossiers_fabrication_id_fabrications_id_fk" FOREIGN KEY ("fabrication_id") REFERENCES "public"."fabrications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fabrications" ADD CONSTRAINT "fabrications_modele_ruban_id_modeles_ruban_id_fk" FOREIGN KEY ("modele_ruban_id") REFERENCES "public"."modeles_ruban"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livraisons_clients" ADD CONSTRAINT "livraisons_clients_commande_client_id_commandes_clients_id_fk" FOREIGN KEY ("commande_client_id") REFERENCES "public"."commandes_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livraisons_clients_lignes" ADD CONSTRAINT "livraisons_clients_lignes_livraison_id_livraisons_clients_id_fk" FOREIGN KEY ("livraison_id") REFERENCES "public"."livraisons_clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "livraisons_clients_lignes" ADD CONSTRAINT "livraisons_clients_lignes_commande_client_ligne_id_commandes_clients_lignes_id_fk" FOREIGN KEY ("commande_client_ligne_id") REFERENCES "public"."commandes_clients_lignes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeles_ruban" ADD CONSTRAINT "modeles_ruban_bobine_article_id_articles_id_fk" FOREIGN KEY ("bobine_article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeles_ruban" ADD CONSTRAINT "modeles_ruban_tube_article_id_articles_id_fk" FOREIGN KEY ("tube_article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeles_ruban" ADD CONSTRAINT "modeles_ruban_carton_article_id_articles_id_fk" FOREIGN KEY ("carton_article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeles_ruban" ADD CONSTRAINT "modeles_ruban_plastique_article_id_articles_id_fk" FOREIGN KEY ("plastique_article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modeles_ruban" ADD CONSTRAINT "modeles_ruban_produit_fini_article_id_articles_id_fk" FOREIGN KEY ("produit_fini_article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paiements_clients" ADD CONSTRAINT "paiements_clients_commande_client_id_commandes_clients_id_fk" FOREIGN KEY ("commande_client_id") REFERENCES "public"."commandes_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reception_lignes" ADD CONSTRAINT "reception_lignes_reception_id_receptions_id_fk" FOREIGN KEY ("reception_id") REFERENCES "public"."receptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reception_lignes" ADD CONSTRAINT "reception_lignes_commande_ligne_id_commande_lignes_id_fk" FOREIGN KEY ("commande_ligne_id") REFERENCES "public"."commande_lignes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receptions" ADD CONSTRAINT "receptions_commande_id_commandes_id_fk" FOREIGN KEY ("commande_id") REFERENCES "public"."commandes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relances_clients" ADD CONSTRAINT "relances_clients_commande_client_id_commandes_clients_id_fk" FOREIGN KEY ("commande_client_id") REFERENCES "public"."commandes_clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_mouvements" ADD CONSTRAINT "stock_mouvements_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_mouvements" ADD CONSTRAINT "stock_mouvements_reception_ligne_id_reception_lignes_id_fk" FOREIGN KEY ("reception_ligne_id") REFERENCES "public"."reception_lignes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_niveaux" ADD CONSTRAINT "stock_niveaux_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifs_clients" ADD CONSTRAINT "tarifs_clients_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tarifs_clients" ADD CONSTRAINT "tarifs_clients_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commande_lignes_unique_idx" ON "commande_lignes" USING btree ("commande_id","article_id","finish");--> statement-breakpoint
CREATE INDEX "commande_lignes_commande_idx" ON "commande_lignes" USING btree ("commande_id");--> statement-breakpoint
CREATE INDEX "commandes_clients_lignes_commande_idx" ON "commandes_clients_lignes" USING btree ("commande_client_id");--> statement-breakpoint
CREATE INDEX "devis_lignes_devis_idx" ON "devis_lignes" USING btree ("devis_id");--> statement-breakpoint
CREATE INDEX "livraisons_clients_lignes_livraison_idx" ON "livraisons_clients_lignes" USING btree ("livraison_id");--> statement-breakpoint
CREATE INDEX "paiements_clients_commande_idx" ON "paiements_clients" USING btree ("commande_client_id");--> statement-breakpoint
CREATE INDEX "reception_lignes_reception_idx" ON "reception_lignes" USING btree ("reception_id");--> statement-breakpoint
CREATE INDEX "relances_clients_commande_idx" ON "relances_clients" USING btree ("commande_client_id");--> statement-breakpoint
CREATE INDEX "stock_mouvements_article_idx" ON "stock_mouvements" USING btree ("article_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tarifs_clients_unique_idx" ON "tarifs_clients" USING btree ("client_id","article_id");--> statement-breakpoint
CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log est en append-only : % interdit', tg_op;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");