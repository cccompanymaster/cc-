-- 본인 프로필(이름/연락처) 수정 허용 + 일반 사용자의 role/approved 변경 차단
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.approved := old.approved;
  end if;
  return new;
end;
$$;

create trigger trg_protect_profile_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();
