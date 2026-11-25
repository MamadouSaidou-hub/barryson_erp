CREATE TABLE "employes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"poste" text NOT NULL,
	"phone" text,
	"email" text,
	"date_embauche" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "employes_code_unique" UNIQUE("code")
);
