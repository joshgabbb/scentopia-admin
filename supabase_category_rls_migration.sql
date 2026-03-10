-- Fix: Add write RLS policies for the `category` table
-- Run this once in Supabase Dashboard → SQL Editor

-- Allow admins to INSERT categories
DROP POLICY IF EXISTS "Admins can insert categories" ON "public"."category";
CREATE POLICY "Admins can insert categories" ON "public"."category"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.account_role::text = 'admin'
    )
  );

-- Allow admins to UPDATE categories
DROP POLICY IF EXISTS "Admins can update categories" ON "public"."category";
CREATE POLICY "Admins can update categories" ON "public"."category"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.account_role::text = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.account_role::text = 'admin'
    )
  );

-- Allow admins to DELETE categories
DROP POLICY IF EXISTS "Admins can delete categories" ON "public"."category";
CREATE POLICY "Admins can delete categories" ON "public"."category"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.account_role::text = 'admin'
    )
  );
