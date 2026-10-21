#!/usr/bin/env python3
"""Create a new Supabase Auth user and print SQL to link them to public.admins.

Requires: pip install supabase
Keep the Supabase service-role/secret key private. This script never prints it.
"""

import getpass
import re
import sys

try:
    from supabase import create_client
except ImportError:
    print("Missing dependency. Install it with: python -m pip install supabase")
    sys.exit(1)

UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def pg_literal(value: str) -> str:
    """Quote a value as a PostgreSQL string literal."""
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    print("\n=== Lost & Found: Create Staff + Generate SQL ===\n")
    print("Find your project URL and secret/service-role key in Supabase Project Settings.")
    print("The secret key is hidden while you type and is never included in the SQL.\n")

    url = input("Supabase Project URL: ").strip()
    key = getpass.getpass("Supabase secret/service-role key (hidden): ").strip()
    name = input("Staff full name: ").strip()
    email = input("Staff email: ").strip().lower()
    password = getpass.getpass("Temporary staff password (hidden): ")
    password_confirm = getpass.getpass("Confirm password (hidden): ")

    if not url.startswith("https://") or ".supabase.co" not in url:
        print("\nError: enter your full Supabase project URL, e.g. https://xxxx.supabase.co")
        sys.exit(1)
    if not key or not name or not email:
        print("\nError: URL, key, name, and email are required.")
        sys.exit(1)
    if password != password_confirm:
        print("\nError: passwords do not match.")
        sys.exit(1)
    if len(password) < 8:
        print("\nError: use a password with at least 8 characters.")
        sys.exit(1)

    print("\nCreating the new Supabase Authentication user...")
    try:
        client = create_client(url, key)
        result = client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": name},
        })
        user = getattr(result, "user", None)
        if user is None and isinstance(result, dict):
            user = result.get("user")
        user_id = getattr(user, "id", None) if user is not None else None
        if user_id is None and isinstance(user, dict):
            user_id = user.get("id")
        if not user_id or not UUID_RE.match(str(user_id)):
            print("\nSupabase did not return a usable user UID. No SQL was generated.")
            print("Check the Supabase error above and the Authentication → Users page.")
            sys.exit(1)
    except Exception as exc:
        print("\nCould not create the Auth user.")
        print("Supabase error:", str(exc))
        print("If this email already exists, check Authentication → Users before trying again.")
        sys.exit(1)

    n = pg_literal(name)
    e = pg_literal(email)
    u = pg_literal(str(user_id))

    sql = f"""-- Generated for staff account: {email}
-- A new Supabase Auth user has already been created.
-- Run this SQL in Supabase Dashboard -> SQL Editor.
-- Do NOT add the password or service-role key to this SQL.

BEGIN;

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- password_hash is not used for Supabase Auth login. Make it optional if
-- this legacy column exists and is currently NOT NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admins'
      AND column_name = 'password_hash'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.admins
      ALTER COLUMN password_hash DROP NOT NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS admins_auth_user_id_uidx
  ON public.admins (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- Link the new Auth UID to an existing staff row with the same email,
-- or create a new staff row if one does not exist.
DO $$
BEGIN
  UPDATE public.admins
  SET full_name = {n},
      email = {e},
      auth_user_id = {u}::uuid
  WHERE lower(email) = lower({e});

  IF NOT FOUND THEN
    INSERT INTO public.admins (full_name, email, auth_user_id)
    VALUES ({n}, {e}, {u}::uuid);
  END IF;
END
$$;

COMMIT;
"""

    print("\n" + "=" * 72)
    print("SUCCESS: New Supabase Auth user created.")
    print("Auth UID:", user_id)
    print("\nNEXT: Copy all SQL below into Supabase SQL Editor and click Run.")
    print("Until that SQL succeeds, the new login may not be recognized as staff.")
    print("=" * 72 + "\n")
    print(sql)

    try:
        output_path = "add_staff.sql"
        with open(output_path, "w", encoding="utf-8", newline="\n") as file:
            file.write(sql)
        print(f"\nAlso saved the SQL to: {output_path} (in the current folder)")
    except OSError as exc:
        print(f"\nCould not save add_staff.sql automatically: {exc}")

    print("\nSecurity: keep your Supabase secret/service-role key private.")


if __name__ == "__main__":
    main()
