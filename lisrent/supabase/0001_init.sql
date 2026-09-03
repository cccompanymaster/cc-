-- 리스렌트 내부 프로그램 초기 스키마
-- 프로젝트: lisrent-erp (Supabase)

-- ============ 사용자 프로필 ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  phone text,
  role text not null default 'sales' check (role in ('admin','sales')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- 첫 가입자는 자동으로 admin + 승인, 이후 가입자는 승인 대기
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  cnt int;
begin
  select count(*) into cnt from public.profiles;
  insert into public.profiles (id, email, name, role, approved)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''), '@', 1)),
    case when cnt = 0 then 'admin' else 'sales' end,
    cnt = 0
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 승인/역할 확인 헬퍼 (RLS 재귀 방지용 security definer)
create or replace function public.is_approved()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select approved from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select role = 'admin' and approved from public.profiles where id = auth.uid()), false);
$$;

-- ============ 고객 ============
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'individual' check (type in ('individual','corporate')),
  name text not null,
  phone text,
  email text,
  address text,
  company_name text,        -- 법인일 때 상호
  biz_no text,              -- 사업자등록번호
  birth date,               -- 개인일 때 생년월일
  status text not null default 'lead'
    check (status in ('lead','consulting','quoted','contracted','active','expired','lost')),
  owner_id uuid references public.profiles(id),  -- 담당 영업사원
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_customers_owner on public.customers(owner_id);
create index idx_customers_status on public.customers(status);

-- ============ 상담 이력 ============
create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  user_id uuid references public.profiles(id),
  content text not null,
  consulted_at timestamptz not null default now()
);
create index idx_consultations_customer on public.consultations(customer_id);

-- ============ 차종 마스터 ============
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  model text not null,
  trim text,
  fuel text,                -- 가솔린/디젤/하이브리드/전기/LPG
  price numeric not null default 0,   -- 차량가(원)
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ 제휴 금융사 ============
create table public.financiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'capital' check (type in ('capital','bank','rentcar','etc')),
  contact_name text,
  contact_phone text,
  default_rate numeric,          -- 기본 이율(%)
  commission_rate numeric,       -- 기본 수수료율(%)
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ 견적 ============
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_no serial,
  customer_id uuid not null references public.customers(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id),
  vehicle_text text not null,          -- 차량 표시명 (마스터 없어도 입력 가능)
  price numeric not null default 0,    -- 차량가
  financier_id uuid references public.financiers(id),
  product_type text not null default 'rent' check (product_type in ('rent','lease')),
  months int not null default 48,
  deposit_pct numeric not null default 0,   -- 보증금 %
  prepay_pct numeric not null default 0,    -- 선납금 %
  residual_pct numeric not null default 40, -- 잔가율 %
  rate numeric not null default 7,          -- 이율 %
  monthly_payment numeric not null default 0,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected')),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_quotes_customer on public.quotes(customer_id);

-- ============ 계약 ============
create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  contract_no serial,
  quote_id uuid references public.quotes(id),
  customer_id uuid not null references public.customers(id),
  financier_id uuid references public.financiers(id),
  sales_id uuid references public.profiles(id),
  product_type text not null default 'rent' check (product_type in ('rent','lease')),
  vehicle_text text not null,
  plate_no text,                         -- 차량번호
  price numeric not null default 0,
  months int not null default 48,
  monthly_payment numeric not null default 0,
  deposit numeric not null default 0,    -- 보증금(원)
  prepay numeric not null default 0,     -- 선납금(원)
  residual numeric not null default 0,   -- 잔존가치(원)
  contract_date date,
  delivery_date date,                    -- 출고일
  end_date date,                         -- 만기일
  status text not null default 'pending'
    check (status in ('pending','review','approved','delivered','active','ended','canceled')),
  end_result text check (end_result in ('renewal','return','purchase')),
  insurance_expiry date,
  commission_amount numeric not null default 0,  -- 금융사 수수료(매출)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_contracts_customer on public.contracts(customer_id);
create index idx_contracts_end_date on public.contracts(end_date);
create index idx_contracts_status on public.contracts(status);

-- ============ 계약 서류 ============
create table public.contract_files (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  name text not null,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ============ 수수료 정산 ============
create table public.commissions (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  sales_id uuid references public.profiles(id),
  base_amount numeric not null default 0,   -- 금융사 수수료(매출)
  sales_rate numeric not null default 50,   -- 영업사원 지급률 %
  sales_amount numeric not null default 0,  -- 영업사원 지급액
  settle_month text,                        -- 정산 귀속월 YYYY-MM
  settled boolean not null default false,
  memo text,
  created_at timestamptz not null default now()
);
create index idx_commissions_month on public.commissions(settle_month);

-- ============ 변경 이력 (감사 로그) ============
create table public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,          -- create/update/delete
  entity text not null,          -- customers/contracts/...
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger trg_customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();
create trigger trg_contracts_touch before update on public.contracts
  for each row execute function public.touch_updated_at();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.consultations enable row level security;
alter table public.vehicles enable row level security;
alter table public.financiers enable row level security;
alter table public.quotes enable row level security;
alter table public.contracts enable row level security;
alter table public.contract_files enable row level security;
alter table public.commissions enable row level security;
alter table public.activity_logs enable row level security;

-- profiles: 본인 조회 + 승인 사용자 전체 조회, admin만 수정
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_approved());
create policy profiles_admin_update on public.profiles for update
  using (public.is_admin());

-- 업무 테이블 공통: 승인 사용자 읽기/쓰기, 삭제는 admin
create policy customers_rw on public.customers for select using (public.is_approved());
create policy customers_ins on public.customers for insert with check (public.is_approved());
create policy customers_upd on public.customers for update using (public.is_approved());
create policy customers_del on public.customers for delete using (public.is_admin());

create policy consultations_sel on public.consultations for select using (public.is_approved());
create policy consultations_ins on public.consultations for insert with check (public.is_approved());
create policy consultations_upd on public.consultations for update using (public.is_approved());
create policy consultations_del on public.consultations for delete using (public.is_admin());

create policy vehicles_sel on public.vehicles for select using (public.is_approved());
create policy vehicles_ins on public.vehicles for insert with check (public.is_approved());
create policy vehicles_upd on public.vehicles for update using (public.is_approved());
create policy vehicles_del on public.vehicles for delete using (public.is_admin());

create policy financiers_sel on public.financiers for select using (public.is_approved());
create policy financiers_ins on public.financiers for insert with check (public.is_approved());
create policy financiers_upd on public.financiers for update using (public.is_approved());
create policy financiers_del on public.financiers for delete using (public.is_admin());

create policy quotes_sel on public.quotes for select using (public.is_approved());
create policy quotes_ins on public.quotes for insert with check (public.is_approved());
create policy quotes_upd on public.quotes for update using (public.is_approved());
create policy quotes_del on public.quotes for delete using (public.is_admin());

create policy contracts_sel on public.contracts for select using (public.is_approved());
create policy contracts_ins on public.contracts for insert with check (public.is_approved());
create policy contracts_upd on public.contracts for update using (public.is_approved());
create policy contracts_del on public.contracts for delete using (public.is_admin());

create policy contract_files_sel on public.contract_files for select using (public.is_approved());
create policy contract_files_ins on public.contract_files for insert with check (public.is_approved());
create policy contract_files_del on public.contract_files for delete using (public.is_approved());

create policy commissions_sel on public.commissions for select using (public.is_approved());
create policy commissions_ins on public.commissions for insert with check (public.is_approved());
create policy commissions_upd on public.commissions for update using (public.is_approved());
create policy commissions_del on public.commissions for delete using (public.is_admin());

create policy logs_sel on public.activity_logs for select using (public.is_admin());
create policy logs_ins on public.activity_logs for insert with check (public.is_approved());

-- ============ 파일 스토리지 ============
insert into storage.buckets (id, name, public) values ('contract-files','contract-files', false)
on conflict (id) do nothing;

create policy storage_files_sel on storage.objects for select
  using (bucket_id = 'contract-files' and public.is_approved());
create policy storage_files_ins on storage.objects for insert
  with check (bucket_id = 'contract-files' and public.is_approved());
create policy storage_files_del on storage.objects for delete
  using (bucket_id = 'contract-files' and public.is_approved());
