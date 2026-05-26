-- Auto-create a profile row whenever a new auth user is created.
-- Bypasses RLS via security definer so it works pre-email-confirmation.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
  attempt int := 0;
begin
  -- Prefer the username supplied at signUp (passed via options.data.username),
  -- fall back to a generated handle. Ensure uniqueness with a small retry loop.
  uname := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'username'), ''),
    'player_' || substr(new.id::text, 1, 8)
  );

  loop
    begin
      insert into public.profiles (id, username)
      values (new.id, uname);
      return new;
    exception when unique_violation then
      attempt := attempt + 1;
      if attempt > 5 then
        raise;
      end if;
      uname := uname || '_' || floor(random() * 1000)::text;
    end;
  end loop;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Also relax the profile insert policy (the trigger handles it now, but if a
-- client ever inserts manually we still want auth.uid() = id to be enforced).
-- No change needed; existing policy already covers that case.
