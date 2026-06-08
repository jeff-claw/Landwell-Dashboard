-- Clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  client_type TEXT DEFAULT 'end_user' CHECK (client_type IN ('reseller', 'end_user')),
  region TEXT DEFAULT 'Gauteng',
  notes TEXT DEFAULT '',
  vat_number TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Clients RLS: authenticated users can do everything
CREATE POLICY "Authenticated users can view clients" ON public.clients
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert clients" ON public.clients
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clients" ON public.clients
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete clients" ON public.clients
  FOR DELETE TO authenticated USING (true);

-- Quotes table
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT DEFAULT '',
  client_contact TEXT DEFAULT '',
  client_email TEXT DEFAULT '',
  client_vat TEXT DEFAULT '',
  client_type TEXT DEFAULT 'End User',
  project_title TEXT DEFAULT '',
  date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Declined')),
  currency TEXT DEFAULT 'ZAR',
  region TEXT DEFAULT 'Gauteng',
  include_installation BOOLEAN DEFAULT false,
  discount NUMERIC DEFAULT 0,
  discount_type TEXT DEFAULT 'percent',
  notes TEXT DEFAULT '',
  line_items JSONB DEFAULT '[]',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view quotes" ON public.quotes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert quotes" ON public.quotes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update quotes" ON public.quotes
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete quotes" ON public.quotes
  FOR DELETE TO authenticated USING (true);

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT DEFAULT '',
  status TEXT DEFAULT 'Order Created',
  total_zar NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  china_order_no TEXT DEFAULT '',
  invoice_no TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view orders" ON public.orders
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert orders" ON public.orders
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update orders" ON public.orders
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete orders" ON public.orders
  FOR DELETE TO authenticated USING (true);

-- Pipeline deals table
CREATE TABLE IF NOT EXISTS public.pipeline_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT DEFAULT '',
  title TEXT NOT NULL,
  value NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'New Lead',
  notes TEXT DEFAULT '',
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pipeline_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pipeline" ON public.pipeline_deals
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pipeline" ON public.pipeline_deals
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pipeline" ON public.pipeline_deals
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete pipeline" ON public.pipeline_deals
  FOR DELETE TO authenticated USING (true);

-- Tasks table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  due_date DATE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT DEFAULT '',
  completed BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tasks" ON public.tasks
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete tasks" ON public.tasks
  FOR DELETE TO authenticated USING (true);

-- Calendar events table
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  date DATE NOT NULL,
  start_time TEXT DEFAULT '',
  end_time TEXT DEFAULT '',
  event_type TEXT DEFAULT 'Meeting',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view events" ON public.calendar_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert events" ON public.calendar_events
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update events" ON public.calendar_events
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete events" ON public.calendar_events
  FOR DELETE TO authenticated USING (true);

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  payment_date DATE DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT '',
  reference TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view payments" ON public.payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert payments" ON public.payments
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update payments" ON public.payments
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete payments" ON public.payments
  FOR DELETE TO authenticated USING (true);

-- Pricelist table
CREATE TABLE IF NOT EXISTS public.pricelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,
  category TEXT DEFAULT '',
  usd_price NUMERIC DEFAULT 0,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.pricelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view pricelist" ON public.pricelist
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert pricelist" ON public.pricelist
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update pricelist" ON public.pricelist
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete pricelist" ON public.pricelist
  FOR DELETE TO authenticated USING (true);

-- Formula settings table
CREATE TABLE IF NOT EXISTS public.formula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exchange_rate NUMERIC DEFAULT 17.5,
  shipping NUMERIC DEFAULT 1.4,
  gp NUMERIC DEFAULT 0.7,
  delivery NUMERIC DEFAULT 10,
  end_user_divisor NUMERIC DEFAULT 0.75,
  regions JSONB DEFAULT '{"Gauteng": 0, "Rustenburg": 5, "Northern Cape": 10, "KZN": 8, "Cape Town": 12}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.formula ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view formula" ON public.formula
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update formula" ON public.formula
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert formula" ON public.formula
  FOR INSERT TO authenticated WITH CHECK (true);

-- Insert default formula if empty
INSERT INTO public.formula (exchange_rate, shipping, gp, delivery, end_user_divisor)
SELECT 17.5, 1.4, 0.7, 10, 0.75
WHERE NOT EXISTS (SELECT 1 FROM public.formula);
