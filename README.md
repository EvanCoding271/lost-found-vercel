


## Enable ownership claims on verified lost reports

Before deploying this version, open **Supabase → SQL Editor**, paste the contents of `schema_claim_lost_reports.sql`, and run it once. This migration keeps existing found-item claims and adds a nullable `lost_item_id` link so a claim can refer to either a found item or a lost report. Do not skip this migration: the updated API queries use that new column.

Then deploy the updated project to Vercel. The workflow is:

1. Staff verifies a lost report; it is stored as `under_review` (the app displays **Pending**).
2. Students can open that verified report under **Reported Lost** and submit a claim with a description, when and where they lost it, and a photo proving ownership.
3. The claim appears for staff review. Staff approves or rejects it with a rationale.
4. After approval, staff uses **Release to owner**. The lost report is stored as `returned` and appears under **Claimed**.

The database's existing lost-item status constraint is unchanged. The migration only adjusts the claims relationship.


## Automatic student profile creation

Student registration now writes the Supabase Auth account metadata and then performs an idempotent `INSERT ... ON CONFLICT (auth_user_id) DO UPDATE` into `public.students`. The existing `on_auth_user_created` trigger can still create the profile first; the API upsert safely handles that case and also creates the profile if the trigger did not. This requires `public.students.auth_user_id` to have a UNIQUE constraint/index (the existing registration setup adds one). New student profiles start with `student_id_verified = false`; registration alone does not verify the student's identity. No per-user SQL is needed.


## One-time setup for automatic student registration

Run `schema_registration_auto_profile.sql` once in **Supabase → SQL Editor** and deploy this project. This updates the existing `handle_new_auth_user()` trigger function so it links a matching student row by school student ID/email, or creates a new student row if no match exists. The API also ensures the profile is linked after Auth signup. New records start with `student_id_verified = false`; staff verification remains a separate step. After this one-time setup, do not manually insert a database row for each new student.
