


## Enable ownership claims on verified lost reports

Before deploying this version, open **Supabase → SQL Editor**, paste the contents of `schema_claim_lost_reports.sql`, and run it once. This migration keeps existing found-item claims and adds a nullable `lost_item_id` link so a claim can refer to either a found item or a lost report. Do not skip this migration: the updated API queries use that new column.

Then deploy the updated project to Vercel. The workflow is:

1. Staff verifies a lost report; it is stored as `under_review` (the app displays **Pending**).
2. Students can open that verified report under **Reported Lost** and submit a claim with a description, when and where they lost it, and a photo proving ownership.
3. The claim appears for staff review. Staff approves or rejects it with a rationale.
4. After approval, staff uses **Release to owner**. The lost report is stored as `returned` and appears under **Claimed**.

The database's existing lost-item status constraint is unchanged. The migration only adjusts the claims relationship.
