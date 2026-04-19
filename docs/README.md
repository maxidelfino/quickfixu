# QuickFixU Docs Index

Este directorio está dividido para que no mezclemos **verdad actual**, **historia** y **referencia técnica**.

## 1. Living docs (fuente de verdad actual)

Estos documentos definen el producto V1 vigente y deben usarse para decisiones actuales.

- `PRD.md` — alcance funcional actual de QuickFixU V1.
- `BusinessCase.md` — posicionamiento, problema y dirección de negocio.
- `FunctionalFlow.md` — flujo funcional vigente cliente ↔ profesional.
- `tickets/` — decisiones y cambios de producto registrados como tickets internos.

## 2. Technical reference docs

Estos documentos describen estructura técnica o de datos. Deben leerse alineados con el PRD vigente.

- `backend/V1BackendContracts.md` — vocabulario y guardrails de contratos backend para el V1 marketplace.
- `backend/V1SubscriptionBoundary.md` — boundary liviano para monetización futura por suscripción sin contaminar el V1.
- `database/DataModel.md` — modelo de datos V1 marketplace.
- `database/QuickFixU-DBML.txt` — referencia DBML.
- `database/PostgreSQL-Indexes.sql` — índices y soporte de consultas.
- `database/*.png|*.svg` — diagramas exportados.

## 3. Historical docs

Estos documentos preservan exploración, decisiones previas y fases históricas. **No son la fuente de verdad actual** si contradicen los living docs.

- `Narrative.md` — discovery notes tempranos.
- `phases/` — artifacts históricos por fase.

Si un documento histórico menciona pagos in-app, escrow, commissions, card capture, payouts o refunds como parte de V1, tomalo como **superseded** por la documentación viva actual.

## 4. Orden recomendado de lectura

Si alguien necesita entender QuickFixU hoy, este es el orden correcto:

1. `PRD.md`
2. `FunctionalFlow.md`
3. `BusinessCase.md`
4. `V1PlanningReconciliation.md` — contrasta estado actual vs fases históricas y define qué queda por hacer
5. `tickets/2026-04-v1-marketplace-pivot.md`
6. `backend/V1BackendContracts.md`
7. `backend/V1SubscriptionBoundary.md`
8. `database/DataModel.md`

Para planificación de la siguiente tanda de trabajo, comenzar por `V1PlanningReconciliation.md` y los tickets tech-06, tech-07, tech-08 y tech-10.

## 5. Regla de mantenimiento

- Cambios de negocio o alcance V1 → actualizar **living docs** y registrar ticket.
- Cambios técnicos estructurales → actualizar **technical reference docs**.
- Si un cambio menciona monetización futura por suscripción, verificar además `backend/V1SubscriptionBoundary.md` antes de tocar scope V1.
- Documentos históricos → no reescribir historia; agregar nota de superseded si hace falta.
