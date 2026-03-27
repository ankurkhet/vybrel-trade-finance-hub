-- Allow borrowers to update their own record
CREATE POLICY "Borrowers can update own record"
ON public.borrowers FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow borrowers to manage their own directors
CREATE POLICY "Borrowers can manage own directors"
ON public.borrower_directors FOR ALL
TO authenticated
USING (borrower_id IN (SELECT id FROM borrowers WHERE user_id = auth.uid()))
WITH CHECK (borrower_id IN (SELECT id FROM borrowers WHERE user_id = auth.uid()));

-- Allow borrowers to view their own documents
CREATE POLICY "Borrowers can view own documents"
ON public.documents FOR SELECT
TO authenticated
USING (borrower_id IN (SELECT id FROM borrowers WHERE user_id = auth.uid()));

-- Allow borrowers to delete their own uploaded documents
CREATE POLICY "Borrowers can delete own uploaded documents"
ON public.documents FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());