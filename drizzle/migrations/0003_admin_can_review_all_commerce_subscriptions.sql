CREATE POLICY "superadmin ve comercios" ON public.comercios FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));
CREATE POLICY "superadmin ve vinculos" ON public.user_roles FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));
CREATE POLICY "superadmin ve nomes de usuarios" ON public.profiles FOR SELECT TO authenticated USING (public.is_superadmin(auth.uid()));