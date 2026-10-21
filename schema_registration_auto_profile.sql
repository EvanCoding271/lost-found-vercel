-- Run once in Supabase SQL Editor when deploying the automatic-registration fix.
-- Existing student rows are linked by school student ID or school email rather
-- than creating a duplicate row. Newly registered students are not considered
-- identity-verified merely because they created an account.

CREATE UNIQUE INDEX IF NOT EXISTS students_auth_user_id_uidx
    ON public.students (auth_user_id);

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_full_name text;
    v_parts text[];
    v_count integer;
    v_school_student_id text;
    v_student_id bigint;
    v_existing_auth_user_id uuid;
BEGIN
    v_school_student_id := nullif(
        btrim(NEW.raw_user_meta_data ->> 'school_student_id'), ''
    );

    -- Accounts without a school student ID (for example, staff) are not
    -- automatically inserted into the students table.
    IF v_school_student_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_full_name := btrim(coalesce(NEW.raw_user_meta_data ->> 'full_name', ''));
    v_parts := regexp_split_to_array(v_full_name, '\s+');
    v_count := array_length(v_parts, 1);
    IF v_count IS NULL OR v_count < 2 OR v_full_name = '' THEN
        RAISE EXCEPTION 'A first name and last name are required';
    END IF;

    -- Link a pre-existing roster row when one matches; prefer the student ID.
    SELECT s.student_id, s.auth_user_id
      INTO v_student_id, v_existing_auth_user_id
      FROM public.students AS s
     WHERE s.school_student_id = v_school_student_id
        OR lower(s.student_email) = lower(NEW.email)
     ORDER BY (s.school_student_id = v_school_student_id) IS TRUE DESC
     LIMIT 1
     FOR UPDATE;

    IF v_student_id IS NOT NULL THEN
        IF v_existing_auth_user_id IS NOT NULL AND v_existing_auth_user_id <> NEW.id THEN
            RAISE EXCEPTION 'This student ID or school email is already linked to another account';
        END IF;

        UPDATE public.students
           SET first_name = v_parts[1],
               last_name = v_parts[v_count],
               middle_name = CASE WHEN v_count > 2
                   THEN array_to_string(v_parts[2:v_count - 1], ' ')
                   ELSE NULL END,
               student_email = lower(NEW.email),
               auth_user_id = NEW.id,
               school_student_id = v_school_student_id
         WHERE student_id = v_student_id;
    ELSE
        INSERT INTO public.students (
            first_name, last_name, middle_name, student_email,
            auth_user_id, school_student_id, student_id_verified
        ) VALUES (
            v_parts[1],
            v_parts[v_count],
            CASE WHEN v_count > 2
                THEN array_to_string(v_parts[2:v_count - 1], ' ')
                ELSE NULL END,
            lower(NEW.email),
            NEW.id,
            v_school_student_id,
            false
        );
    END IF;

    RETURN NEW;
END;
$function$;
