-- CreateEnum
CREATE TYPE "TipoConta" AS ENUM ('CORRENTE', 'CONJUNTA', 'POUPANCA');

-- CreateEnum
CREATE TYPE "Bandeira" AS ENUM ('VISA', 'MASTERCARD', 'ELO', 'AMEX');

-- CreateEnum
CREATE TYPE "TipoCategoria" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "TipoTransacao" AS ENUM ('ENTRADA', 'SAIDA');

-- CreateEnum
CREATE TYPE "Responsavel" AS ENUM ('ANA', 'BRUNO', 'CONJUNTA');

-- CreateEnum
CREATE TYPE "PeriodoRecorrencia" AS ENUM ('SEMANAL', 'MENSAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "PeriodoAssinatura" AS ENUM ('MENSAL', 'TRIMESTRAL', 'SEMESTRAL', 'ANUAL');

-- CreateEnum
CREATE TYPE "StatusAssinatura" AS ENUM ('ATIVA', 'PAUSADA', 'TESTE');

-- CreateEnum
CREATE TYPE "ClasseAtivo" AS ENUM ('RENDA_FIXA', 'FUNDOS_IMOBILIARIOS', 'ACOES_EXTERIOR', 'ACOES_BRASIL', 'CRIPTO');

-- CreateTable
CREATE TABLE "households" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "preferencias" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoConta" NOT NULL,
    "dono" TEXT NOT NULL,
    "saldo" DECIMAL(12,2) NOT NULL,
    "ultimaSync" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "bandeira" "Bandeira" NOT NULL,
    "final" TEXT NOT NULL,
    "limite" DECIMAL(12,2) NOT NULL,
    "diaFechamento" INTEGER NOT NULL,
    "diaVencimento" INTEGER NOT NULL,
    "temaEscuro" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoCategoria" NOT NULL,
    "cor" TEXT NOT NULL,
    "orcamentoMensal" DECIMAL(12,2),
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "tipo" "TipoTransacao" NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "accountId" TEXT,
    "cardId" TEXT,
    "responsavel" "Responsavel" NOT NULL,
    "parcelaAtual" INTEGER,
    "parcelaTotal" INTEGER,
    "recurrenceId" TEXT,
    "importId" TEXT,
    "fingerprint" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurrences" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "periodo" "PeriodoRecorrencia" NOT NULL,
    "proximaData" DATE NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "valor" DECIMAL(12,2) NOT NULL,
    "periodo" "PeriodoAssinatura" NOT NULL,
    "proximoDebito" DATE NOT NULL,
    "cardId" TEXT,
    "categoriaId" TEXT NOT NULL,
    "status" "StatusAssinatura" NOT NULL DEFAULT 'ATIVA',
    "observacao" TEXT,
    "precoAnterior" DECIMAL(12,2),

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "fechamento" DATE NOT NULL,
    "vencimento" DATE NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "paga" BOOLEAN NOT NULL DEFAULT false,
    "pagaEm" TIMESTAMP(3),

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "classe" "ClasseAtivo" NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "taxaAnual" DECIMAL(6,2) NOT NULL,
    "aporteMensal" DECIMAL(12,2) NOT NULL,
    "metaTaxa" DECIMAL(6,2) NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "alvo" DECIMAL(14,2) NOT NULL,
    "atual" DECIMAL(14,2) NOT NULL,
    "prazoMeses" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "termo" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "acertos" INTEGER NOT NULL DEFAULT 0,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imports" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "arquivo" TEXT NOT NULL,
    "periodoInicio" DATE NOT NULL,
    "periodoFim" DATE NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "classificados" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_householdId_idx" ON "users"("householdId");

-- CreateIndex
CREATE INDEX "accounts_householdId_idx" ON "accounts"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_householdId_nome_key" ON "accounts"("householdId", "nome");

-- CreateIndex
CREATE INDEX "cards_householdId_idx" ON "cards"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "cards_householdId_nome_key" ON "cards"("householdId", "nome");

-- CreateIndex
CREATE INDEX "categories_householdId_idx" ON "categories"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_householdId_nome_key" ON "categories"("householdId", "nome");

-- CreateIndex
CREATE INDEX "transactions_householdId_data_idx" ON "transactions"("householdId", "data");

-- CreateIndex
CREATE INDEX "transactions_householdId_categoriaId_idx" ON "transactions"("householdId", "categoriaId");

-- CreateIndex
CREATE INDEX "transactions_cardId_data_idx" ON "transactions"("cardId", "data");

-- CreateIndex
CREATE INDEX "transactions_accountId_data_idx" ON "transactions"("accountId", "data");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_householdId_fingerprint_key" ON "transactions"("householdId", "fingerprint");

-- CreateIndex
CREATE INDEX "recurrences_householdId_idx" ON "recurrences"("householdId");

-- CreateIndex
CREATE INDEX "recurrences_ativa_proximaData_idx" ON "recurrences"("ativa", "proximaData");

-- CreateIndex
CREATE INDEX "subscriptions_householdId_idx" ON "subscriptions"("householdId");

-- CreateIndex
CREATE INDEX "subscriptions_cardId_idx" ON "subscriptions"("cardId");

-- CreateIndex
CREATE INDEX "subscriptions_status_proximoDebito_idx" ON "subscriptions"("status", "proximoDebito");

-- CreateIndex
CREATE INDEX "invoices_cardId_idx" ON "invoices"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_cardId_competencia_key" ON "invoices"("cardId", "competencia");

-- CreateIndex
CREATE INDEX "assets_householdId_idx" ON "assets"("householdId");

-- CreateIndex
CREATE INDEX "goals_householdId_idx" ON "goals"("householdId");

-- CreateIndex
CREATE INDEX "rules_householdId_idx" ON "rules"("householdId");

-- CreateIndex
CREATE INDEX "imports_householdId_idx" ON "imports"("householdId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_importId_fkey" FOREIGN KEY ("importId") REFERENCES "imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurrences" ADD CONSTRAINT "recurrences_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imports" ADD CONSTRAINT "imports_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
