-- A name is not a unique patient identity. Preserve existing UUIDs and order links.
DROP INDEX IF EXISTS public.uq_clinic_card_active;
CREATE UNIQUE INDEX uq_clinic_doctor_active ON public.t_clinic_user_cards(clinic_id,full_name,role) WHERE deleted_at IS NULL AND role <> 'patient';
CREATE INDEX ix_clinic_patient_name ON public.t_clinic_user_cards(clinic_id,lower(full_name),id) WHERE deleted_at IS NULL AND role='patient';
