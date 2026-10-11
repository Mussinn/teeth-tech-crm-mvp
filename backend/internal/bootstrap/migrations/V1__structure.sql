--
-- PostgreSQL database dump
--


-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


SET default_tablespace = '';

--
-- Name: attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    task_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    storage_path character varying(512) NOT NULL,
    content_type character varying(100) NOT NULL,
    file_size bigint,
    attachment_type character varying(20) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_attachment_type CHECK (((attachment_type)::text = ANY ((ARRAY['SCREEN'::character varying, 'FILE'::character varying])::text[])))
);


--
-- Name: t_business_audit_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_business_audit_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    actor_user_id uuid,
    actor_email character varying(255),
    action character varying(120) NOT NULL,
    resource_type character varying(120) NOT NULL,
    resource_id character varying(255),
    http_method character varying(10),
    request_path character varying(1000),
    request_id character varying(100),
    ip_address character varying(64),
    success boolean NOT NULL,
    error_code character varying(120),
    metadata text
);


--
-- Name: t_chat_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_chat_attachments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    message_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    storage_path character varying(700) NOT NULL,
    content_type character varying(120) NOT NULL,
    file_size bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT t_chat_attachments_file_size_check CHECK ((file_size >= 0))
);


--
-- Name: t_chat_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_chat_conversations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(16) NOT NULL,
    title character varying(150),
    direct_key character varying(80),
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_chat_title CHECK ((((type)::text = 'DIRECT'::text) OR (NULLIF(btrim((title)::text), ''::text) IS NOT NULL))),
    CONSTRAINT t_chat_conversations_type_check CHECK (((type)::text = ANY ((ARRAY['DIRECT'::character varying, 'GROUP'::character varying])::text[])))
);


--
-- Name: t_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_chat_messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    reply_to_id uuid,
    text character varying(4000),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: t_chat_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_chat_participants (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role character varying(16) NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    last_read_at timestamp with time zone,
    CONSTRAINT t_chat_participants_role_check CHECK (((role)::text = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MEMBER'::character varying])::text[])))
);


--
-- Name: t_clinic_user_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_clinic_user_cards (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    clinic_id uuid NOT NULL,
    full_name character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT chk_clinic_card_role CHECK (((role)::text = ANY ((ARRAY['doctor'::character varying, 'patient'::character varying])::text[])))
);


--
-- Name: t_clinics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_clinics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    address text,
    phone character varying(50),
    email character varying(255),
    contact_person character varying(255),
    bin character varying(50),
    discount_percent integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: t_colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_colors (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(100),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: t_finance_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_finance_periods (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    date_from date NOT NULL,
    date_to date NOT NULL,
    status character varying(32) DEFAULT 'OPEN'::character varying NOT NULL,
    closed_by uuid,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT t_finance_periods_check CHECK ((date_to >= date_from))
);


--
-- Name: t_incoming_request_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_incoming_request_statuses (
    code character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    is_initial boolean DEFAULT false NOT NULL,
    is_in_review boolean DEFAULT false NOT NULL,
    is_accepted boolean DEFAULT false NOT NULL,
    is_rejected boolean DEFAULT false NOT NULL,
    is_terminal boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: t_incoming_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_incoming_requests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    source_code character varying(32) NOT NULL,
    external_id character varying(255) NOT NULL,
    status_code character varying(32) NOT NULL,
    customer_name character varying(255),
    phone character varying(50),
    username character varying(255),
    message text NOT NULL,
    clinic_name character varying(255),
    doctor_name character varying(255),
    patient_name character varying(255),
    work_type_text character varying(500),
    desired_deadline timestamp with time zone,
    external_created_at timestamp with time zone,
    raw_payload text,
    dispatcher_comment text,
    rejection_reason text,
    processed_by uuid,
    processed_at timestamp with time zone,
    created_order_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_integration_api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_integration_api_keys (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    source_code character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    key_prefix character varying(16) NOT NULL,
    key_hash character varying(64) NOT NULL,
    active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    last_used_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);


--
-- Name: t_integration_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_integration_sources (
    code character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: t_inventory_check; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_inventory_check (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    status character varying(32) NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_by_user_id uuid NOT NULL,
    comment character varying(500),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_inventory_check_item; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_inventory_check_item (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    inventory_check_id uuid NOT NULL,
    nomenclature_id uuid NOT NULL,
    expected_quantity numeric(19,4) NOT NULL,
    actual_quantity numeric(19,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_inventory_status_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_inventory_status_rules (
    code character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    is_initial boolean DEFAULT false NOT NULL,
    locks_warehouse boolean DEFAULT false NOT NULL,
    allows_counting boolean DEFAULT false NOT NULL,
    marks_completed boolean DEFAULT false NOT NULL,
    marks_cancelled boolean DEFAULT false NOT NULL,
    is_terminal boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: t_invoice_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_invoice_payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(14,2) NOT NULL,
    payment_method character varying(64) NOT NULL,
    external_reference character varying(255),
    paid_at timestamp with time zone NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reversed_at timestamp with time zone,
    reversal_reason text,
    CONSTRAINT t_invoice_payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: t_invoice_status_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_invoice_status_rules (
    code character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    is_initial boolean DEFAULT false NOT NULL,
    is_issued boolean DEFAULT false NOT NULL,
    is_partial boolean DEFAULT false NOT NULL,
    is_paid boolean DEFAULT false NOT NULL,
    is_cancelled boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: t_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_number character varying(64) NOT NULL,
    clinic_id uuid NOT NULL,
    order_id uuid,
    status character varying(32) DEFAULT 'DRAFT'::character varying NOT NULL,
    amount numeric(14,2) NOT NULL,
    paid_amount numeric(14,2) DEFAULT 0 NOT NULL,
    issued_at timestamp with time zone,
    due_at timestamp with time zone,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT t_invoices_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT t_invoices_paid_amount_check CHECK ((paid_amount >= (0)::numeric))
);


--
-- Name: t_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_materials (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    nomenclature_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: t_nomenclature; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_nomenclature (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(100) NOT NULL,
    name character varying(255) NOT NULL,
    unit character varying(50) NOT NULL,
    min_stock_level numeric(19,4) DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_nomenclature_consumption_norms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_nomenclature_consumption_norms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    work_type_id uuid NOT NULL,
    material_id uuid NOT NULL,
    nomenclature_id uuid NOT NULL,
    norm_quantity numeric(19,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    waste_percent numeric(5,2) DEFAULT 0 NOT NULL,
    CONSTRAINT t_nomenclature_consumption_norms_norm_quantity_check CHECK ((norm_quantity > (0)::numeric)),
    CONSTRAINT t_nomenclature_consumption_norms_waste_percent_check CHECK (((waste_percent >= (0)::numeric) AND (waste_percent <= (100)::numeric)))
);


--
-- Name: t_notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_notification_preferences (
    user_id uuid NOT NULL,
    in_app_enabled boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT false NOT NULL,
    telegram_enabled boolean DEFAULT false NOT NULL,
    telegram_chat_id character varying(100),
    task_assigned boolean DEFAULT true NOT NULL,
    deadline_warning boolean DEFAULT true NOT NULL,
    task_overdue boolean DEFAULT true NOT NULL,
    quality_incident boolean DEFAULT true NOT NULL,
    stock_warning boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    type character varying(64) NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    resource_type character varying(64),
    resource_id uuid,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_order_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_order_statuses (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(50) NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    color_hex character varying(7),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_initial boolean DEFAULT false NOT NULL,
    is_terminal boolean DEFAULT false NOT NULL,
    is_review boolean DEFAULT false NOT NULL
);


--
-- Name: t_order_task_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_order_task_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    changed_by uuid,
    field_name character varying(255),
    old_value text,
    new_value text,
    comment text,
    changed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_order_task_materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_order_task_materials (
    order_task_id uuid NOT NULL,
    material_id uuid NOT NULL
);


--
-- Name: t_order_task_status_assignees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_order_task_status_assignees (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_task_id uuid NOT NULL,
    status_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_order_task_teeth; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_order_task_teeth (
    order_task_id uuid NOT NULL,
    tooth_number integer NOT NULL,
    CONSTRAINT t_order_task_teeth_tooth_number_check CHECK (((tooth_number >= 11) AND (tooth_number <= 48)))
);


--
-- Name: t_order_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_order_tasks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    status_id uuid NOT NULL,
    order_id uuid NOT NULL,
    work_type_id uuid,
    quantity integer DEFAULT 1 NOT NULL,
    color_id uuid,
    price_per_unit numeric(10,2) DEFAULT 0 NOT NULL,
    dental_technician_id uuid,
    assignment_mode character varying(20) DEFAULT 'AUTO'::character varying NOT NULL,
    salary_statement_id uuid,
    discount_percent numeric(5,2) DEFAULT 0 NOT NULL,
    total_task numeric(10,2) GENERATED ALWAYS AS ((((price_per_unit * (quantity)::numeric) * ((100)::numeric - discount_percent)) / (100)::numeric)) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    salary_earned_amount numeric(12,2),
    materials_finalized_at timestamp with time zone,
    CONSTRAINT chk_order_tasks_assignment_mode CHECK (((assignment_mode)::text = ANY ((ARRAY['AUTO'::character varying, 'PREASSIGNED'::character varying])::text[]))),
    CONSTRAINT chk_order_tasks_discount CHECK (((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric))),
    CONSTRAINT t_order_tasks_quantity_check CHECK ((quantity > 0))
);


--
-- Name: t_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    order_number character varying(50),
    patient_card_id uuid NOT NULL,
    doctor_card_id uuid NOT NULL,
    deadline date,
    completed_at timestamp with time zone,
    cad_cam_operator_id uuid,
    comment text,
    is_active boolean DEFAULT true NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: t_outbox_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_outbox_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    event_type character varying(120) NOT NULL,
    aggregate_type character varying(120) NOT NULL,
    aggregate_id uuid,
    payload text NOT NULL,
    status character varying(32) DEFAULT 'PENDING'::character varying NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone
);


--
-- Name: t_payment_method_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_payment_method_rules (
    code character varying(64) NOT NULL,
    name character varying(100) NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: t_personal_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_personal_notes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    owner_id uuid NOT NULL,
    title character varying(120),
    content character varying(5000),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_personal_note_not_empty CHECK (((NULLIF(btrim((COALESCE(title, ''::character varying))::text), ''::text) IS NOT NULL) OR (NULLIF(btrim((COALESCE(content, ''::character varying))::text), ''::text) IS NOT NULL)))
);


--
-- Name: t_purchase_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_purchase_order_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    purchase_order_id uuid NOT NULL,
    nomenclature_id uuid NOT NULL,
    ordered_quantity numeric(19,4) NOT NULL,
    received_quantity numeric(19,4) DEFAULT 0 NOT NULL,
    unit_price numeric(14,4) NOT NULL,
    CONSTRAINT t_purchase_order_items_ordered_quantity_check CHECK ((ordered_quantity > (0)::numeric)),
    CONSTRAINT t_purchase_order_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: t_purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_purchase_orders (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    number character varying(64) NOT NULL,
    supplier_id uuid NOT NULL,
    status character varying(32) DEFAULT 'DRAFT'::character varying NOT NULL,
    expected_at timestamp with time zone,
    received_at timestamp with time zone,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_purchase_status_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_purchase_status_rules (
    code character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    is_initial boolean DEFAULT false NOT NULL,
    is_ordered boolean DEFAULT false NOT NULL,
    is_partial boolean DEFAULT false NOT NULL,
    allows_receipt boolean DEFAULT false NOT NULL,
    is_complete boolean DEFAULT false NOT NULL,
    is_cancelled boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL
);


--
-- Name: t_quality_incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_quality_incidents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    task_id uuid NOT NULL,
    incident_type character varying(32) NOT NULL,
    status character varying(32) DEFAULT 'OPEN'::character varying NOT NULL,
    reason_code character varying(64) NOT NULL,
    description text NOT NULL,
    reported_by uuid NOT NULL,
    assigned_to uuid,
    material_loss_amount numeric(14,2),
    salary_deduction_amount numeric(14,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolution_comment text
);


--
-- Name: t_refresh_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_refresh_sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    replaced_by_id uuid,
    user_agent character varying(500),
    ip_address character varying(64),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone
);


--
-- Name: t_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code character varying(50) NOT NULL,
    description text,
    system_managed boolean DEFAULT false NOT NULL
);


--
-- Name: t_salary_accruals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_salary_accruals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    order_task_id uuid NOT NULL,
    status_id uuid NOT NULL,
    rule_id uuid,
    salary_statement_id uuid,
    treatment character varying(30) NOT NULL,
    calculation_type character varying(30) NOT NULL,
    quantity numeric(14,4) DEFAULT 0 NOT NULL,
    rate numeric(14,4) DEFAULT 0 NOT NULL,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    earned_at timestamp with time zone NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_salary_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_salary_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    payment_type character varying(32) NOT NULL,
    base_salary numeric(12,2) DEFAULT 0 NOT NULL,
    commission_percent numeric(5,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: t_salary_payment_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_salary_payment_types (
    code character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    includes_base_salary boolean DEFAULT false NOT NULL,
    includes_piecework boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: t_salary_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_salary_plans (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(200) NOT NULL,
    base_salary numeric(14,2) DEFAULT 0 NOT NULL,
    monthly_cap numeric(14,2),
    cap_mode character varying(30) DEFAULT 'TOTAL'::character varying NOT NULL,
    carry_forward boolean DEFAULT true NOT NULL,
    active boolean DEFAULT true NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT t_salary_plans_base_salary_check CHECK ((base_salary >= (0)::numeric)),
    CONSTRAINT t_salary_plans_cap_mode_check CHECK (((cap_mode)::text = ANY ((ARRAY['TOTAL'::character varying, 'VARIABLE_ONLY'::character varying])::text[]))),
    CONSTRAINT t_salary_plans_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT t_salary_plans_monthly_cap_check CHECK (((monthly_cap IS NULL) OR (monthly_cap > (0)::numeric)))
);


--
-- Name: t_salary_stage_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_salary_stage_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    plan_id uuid NOT NULL,
    work_type_id uuid,
    status_id uuid,
    name character varying(200) NOT NULL,
    treatment character varying(30) NOT NULL,
    calculation_type character varying(30) DEFAULT 'ONCE_PER_STAGE'::character varying NOT NULL,
    rate numeric(14,4) DEFAULT 0 NOT NULL,
    priority integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT t_salary_stage_rules_calculation_type_check CHECK (((calculation_type)::text = ANY ((ARRAY['ONCE_PER_STAGE'::character varying, 'TASK_QUANTITY'::character varying, 'TEETH_COUNT'::character varying, 'PERCENT_OF_TASK'::character varying])::text[]))),
    CONSTRAINT t_salary_stage_rules_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT t_salary_stage_rules_rate_check CHECK ((rate >= (0)::numeric)),
    CONSTRAINT t_salary_stage_rules_treatment_check CHECK (((treatment)::text = ANY ((ARRAY['INCLUDED_IN_BASE'::character varying, 'PAID_EXTRA'::character varying, 'NOT_PAYABLE'::character varying, 'REQUIRES_REVIEW'::character varying])::text[])))
);


--
-- Name: t_salary_statement_statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_salary_statement_statuses (
    code character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    description character varying(500),
    is_initial boolean DEFAULT false NOT NULL,
    marks_paid boolean DEFAULT false NOT NULL,
    is_terminal boolean DEFAULT false NOT NULL,
    is_deletable boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: t_salary_statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_salary_statements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    employee_id uuid NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    payment_type character varying(32) NOT NULL,
    base_salary_amount numeric(12,2) DEFAULT 0 NOT NULL,
    piecework_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_tasks_count integer DEFAULT 0 NOT NULL,
    status character varying(32) DEFAULT 'DRAFT'::character varying NOT NULL,
    paid_at timestamp with time zone,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    gross_accrued_amount numeric(14,2) DEFAULT 0 NOT NULL,
    carry_in_amount numeric(14,2) DEFAULT 0 NOT NULL,
    carry_out_amount numeric(14,2) DEFAULT 0 NOT NULL,
    monthly_cap_snapshot numeric(14,2),
    plan_id uuid
);


--
-- Name: t_sla_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_sla_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    work_type_id uuid,
    status_id uuid,
    warning_minutes integer NOT NULL,
    breach_minutes integer NOT NULL,
    escalation_role character varying(100),
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT t_sla_rules_check CHECK ((breach_minutes > warning_minutes)),
    CONSTRAINT t_sla_rules_warning_minutes_check CHECK ((warning_minutes > 0))
);


--
-- Name: t_stock_balance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_stock_balance (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    nomenclature_id uuid NOT NULL,
    quantity numeric(19,4) DEFAULT 0 NOT NULL,
    version bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_stock_level_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_stock_level_rules (
    code character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    min_ratio numeric(8,4) NOT NULL,
    max_ratio numeric(8,4),
    counts_as_low boolean DEFAULT false NOT NULL,
    color_hex character varying(7),
    sort_order integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT t_stock_level_rules_check CHECK (((max_ratio IS NULL) OR (max_ratio > min_ratio))),
    CONSTRAINT t_stock_level_rules_min_ratio_check CHECK ((min_ratio >= (0)::numeric))
);


--
-- Name: t_stock_lots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_stock_lots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    nomenclature_id uuid NOT NULL,
    purchase_item_id uuid,
    lot_number character varying(100) NOT NULL,
    expires_at date,
    initial_quantity numeric(19,4) NOT NULL,
    remaining_quantity numeric(19,4) NOT NULL,
    unit_cost numeric(14,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    receipt_id uuid
);


--
-- Name: t_stock_movement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_stock_movement (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    nomenclature_id uuid NOT NULL,
    movement_type character varying(32) NOT NULL,
    quantity numeric(19,4) NOT NULL,
    reason character varying(500),
    reference_type character varying(100) NOT NULL,
    reference_id uuid NOT NULL,
    balance_after numeric(19,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    total_cost numeric(19,4) DEFAULT 0 NOT NULL,
    standard_quantity numeric(19,4) DEFAULT 0 NOT NULL,
    waste_quantity numeric(19,4) DEFAULT 0 NOT NULL,
    standard_cost numeric(19,4) DEFAULT 0 NOT NULL,
    waste_cost numeric(19,4) DEFAULT 0 NOT NULL,
    CONSTRAINT chk_stock_movement_breakdown CHECK (((standard_quantity >= (0)::numeric) AND (waste_quantity >= (0)::numeric) AND (quantity = (standard_quantity + waste_quantity)))),
    CONSTRAINT chk_stock_movement_cost_breakdown CHECK (((standard_cost >= (0)::numeric) AND (waste_cost >= (0)::numeric) AND (total_cost = (standard_cost + waste_cost)))),
    CONSTRAINT t_stock_movement_total_cost_check CHECK ((total_cost >= (0)::numeric))
);


--
-- Name: t_stock_movement_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_stock_movement_types (
    code character varying(32) NOT NULL,
    name character varying(100) NOT NULL,
    increases_stock boolean DEFAULT false NOT NULL,
    decreases_stock boolean DEFAULT false NOT NULL,
    is_inventory_adjustment boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: t_stock_reserves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_stock_reserves (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    order_task_id uuid NOT NULL,
    nomenclature_id uuid NOT NULL,
    reserved_quantity numeric(19,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    standard_quantity numeric(19,4) DEFAULT 0 NOT NULL,
    waste_quantity numeric(19,4) DEFAULT 0 NOT NULL,
    CONSTRAINT chk_stock_reserve_breakdown CHECK (((standard_quantity >= (0)::numeric) AND (waste_quantity >= (0)::numeric) AND (reserved_quantity = (standard_quantity + waste_quantity)))),
    CONSTRAINT t_stock_reserves_reserved_quantity_check CHECK ((reserved_quantity > (0)::numeric))
);


--
-- Name: t_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_suppliers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    bin character varying(32),
    phone character varying(64),
    email character varying(255),
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_task_material_plan; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_task_material_plan (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_task_id uuid NOT NULL,
    nomenclature_id uuid NOT NULL,
    standard_quantity numeric(19,4) NOT NULL,
    waste_quantity numeric(19,4) NOT NULL,
    planned_quantity numeric(19,4) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_task_material_plan_breakdown CHECK ((planned_quantity = (standard_quantity + waste_quantity))),
    CONSTRAINT t_task_material_plan_planned_quantity_check CHECK ((planned_quantity >= (0)::numeric)),
    CONSTRAINT t_task_material_plan_standard_quantity_check CHECK ((standard_quantity >= (0)::numeric)),
    CONSTRAINT t_task_material_plan_waste_quantity_check CHECK ((waste_quantity >= (0)::numeric))
);


--
-- Name: t_task_sla_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_task_sla_states (
    task_id uuid NOT NULL,
    status_id uuid NOT NULL,
    entered_at timestamp with time zone NOT NULL,
    warning_at timestamp with time zone,
    breach_at timestamp with time zone,
    warned_at timestamp with time zone,
    breached_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: t_task_stage_material_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_task_stage_material_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    order_task_id uuid NOT NULL,
    workflow_step_id uuid NOT NULL,
    from_status_id uuid NOT NULL,
    to_status_id uuid NOT NULL,
    nomenclature_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    issued_quantity numeric(19,4) NOT NULL,
    consumed_quantity numeric(19,4) NOT NULL,
    waste_quantity numeric(19,4) NOT NULL,
    returned_quantity numeric(19,4) NOT NULL,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_stage_material_conservation CHECK ((issued_quantity = ((consumed_quantity + waste_quantity) + returned_quantity))),
    CONSTRAINT t_task_stage_material_usage_consumed_quantity_check CHECK ((consumed_quantity >= (0)::numeric)),
    CONSTRAINT t_task_stage_material_usage_issued_quantity_check CHECK ((issued_quantity > (0)::numeric)),
    CONSTRAINT t_task_stage_material_usage_returned_quantity_check CHECK ((returned_quantity >= (0)::numeric)),
    CONSTRAINT t_task_stage_material_usage_waste_quantity_check CHECK ((waste_quantity >= (0)::numeric))
);


--
-- Name: t_telegram_bot_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_telegram_bot_settings (
    id smallint NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    bot_token_encrypted text,
    webhook_secret_encrypted text,
    webhook_url character varying(500),
    bot_username character varying(100),
    commands_json text DEFAULT '[{"command":"start","description":"Создать заявку"},{"command":"cancel","description":"Отменить заполнение"}]'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by uuid,
    CONSTRAINT t_telegram_bot_settings_id_check CHECK ((id = 1))
);


--
-- Name: t_user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);


--
-- Name: t_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(50),
    password_hash text NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    failed_login_attempts integer DEFAULT 0 NOT NULL,
    locked_until timestamp with time zone,
    credentials_changed_at timestamp with time zone,
    CONSTRAINT chk_users_status CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'BUSY'::character varying])::text[])))
);


--
-- Name: t_work_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_work_types (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(255) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: t_workflow_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.t_workflow_steps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    work_type_id uuid NOT NULL,
    from_status_id uuid NOT NULL,
    to_status_id uuid NOT NULL,
    required_role character varying(50) NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    material_report_required boolean DEFAULT false NOT NULL,
    allow_unplanned_materials boolean DEFAULT false NOT NULL
);


--
-- Name: attachments attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_pkey PRIMARY KEY (id);


--
-- Name: attachments attachments_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_storage_path_key UNIQUE (storage_path);


--
-- Name: t_finance_periods ex_finance_periods_no_overlap; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_finance_periods
    ADD CONSTRAINT ex_finance_periods_no_overlap EXCLUDE USING gist (daterange(date_from, date_to, '[]'::text) WITH &&);


--
-- Name: t_business_audit_events t_business_audit_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_business_audit_events
    ADD CONSTRAINT t_business_audit_events_pkey PRIMARY KEY (id);


--
-- Name: t_chat_attachments t_chat_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_attachments
    ADD CONSTRAINT t_chat_attachments_pkey PRIMARY KEY (id);


--
-- Name: t_chat_attachments t_chat_attachments_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_attachments
    ADD CONSTRAINT t_chat_attachments_storage_path_key UNIQUE (storage_path);


--
-- Name: t_chat_conversations t_chat_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_conversations
    ADD CONSTRAINT t_chat_conversations_pkey PRIMARY KEY (id);


--
-- Name: t_chat_messages t_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_messages
    ADD CONSTRAINT t_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: t_chat_participants t_chat_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_participants
    ADD CONSTRAINT t_chat_participants_pkey PRIMARY KEY (conversation_id, user_id);


--
-- Name: t_clinic_user_cards t_clinic_user_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_clinic_user_cards
    ADD CONSTRAINT t_clinic_user_cards_pkey PRIMARY KEY (id);


--
-- Name: t_clinics t_clinics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_clinics
    ADD CONSTRAINT t_clinics_pkey PRIMARY KEY (id);


--
-- Name: t_colors t_colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_colors
    ADD CONSTRAINT t_colors_pkey PRIMARY KEY (id);


--
-- Name: t_finance_periods t_finance_periods_date_from_date_to_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_finance_periods
    ADD CONSTRAINT t_finance_periods_date_from_date_to_key UNIQUE (date_from, date_to);


--
-- Name: t_finance_periods t_finance_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_finance_periods
    ADD CONSTRAINT t_finance_periods_pkey PRIMARY KEY (id);


--
-- Name: t_incoming_request_statuses t_incoming_request_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_incoming_request_statuses
    ADD CONSTRAINT t_incoming_request_statuses_pkey PRIMARY KEY (code);


--
-- Name: t_incoming_requests t_incoming_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_incoming_requests
    ADD CONSTRAINT t_incoming_requests_pkey PRIMARY KEY (id);


--
-- Name: t_integration_api_keys t_integration_api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_integration_api_keys
    ADD CONSTRAINT t_integration_api_keys_key_hash_key UNIQUE (key_hash);


--
-- Name: t_integration_api_keys t_integration_api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_integration_api_keys
    ADD CONSTRAINT t_integration_api_keys_pkey PRIMARY KEY (id);


--
-- Name: t_integration_sources t_integration_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_integration_sources
    ADD CONSTRAINT t_integration_sources_pkey PRIMARY KEY (code);


--
-- Name: t_inventory_check_item t_inventory_check_item_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_inventory_check_item
    ADD CONSTRAINT t_inventory_check_item_pkey PRIMARY KEY (id);


--
-- Name: t_inventory_check t_inventory_check_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_inventory_check
    ADD CONSTRAINT t_inventory_check_pkey PRIMARY KEY (id);


--
-- Name: t_inventory_status_rules t_inventory_status_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_inventory_status_rules
    ADD CONSTRAINT t_inventory_status_rules_pkey PRIMARY KEY (code);


--
-- Name: t_invoice_payments t_invoice_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_invoice_payments
    ADD CONSTRAINT t_invoice_payments_pkey PRIMARY KEY (id);


--
-- Name: t_invoice_status_rules t_invoice_status_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_invoice_status_rules
    ADD CONSTRAINT t_invoice_status_rules_pkey PRIMARY KEY (code);


--
-- Name: t_invoices t_invoices_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_invoices
    ADD CONSTRAINT t_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: t_invoices t_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_invoices
    ADD CONSTRAINT t_invoices_pkey PRIMARY KEY (id);


--
-- Name: t_materials t_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_materials
    ADD CONSTRAINT t_materials_pkey PRIMARY KEY (id);


--
-- Name: t_nomenclature t_nomenclature_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_nomenclature
    ADD CONSTRAINT t_nomenclature_code_key UNIQUE (code);


--
-- Name: t_nomenclature_consumption_norms t_nomenclature_consumption_norms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_nomenclature_consumption_norms
    ADD CONSTRAINT t_nomenclature_consumption_norms_pkey PRIMARY KEY (id);


--
-- Name: t_nomenclature t_nomenclature_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_nomenclature
    ADD CONSTRAINT t_nomenclature_pkey PRIMARY KEY (id);


--
-- Name: t_notification_preferences t_notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_notification_preferences
    ADD CONSTRAINT t_notification_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: t_notifications t_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_notifications
    ADD CONSTRAINT t_notifications_pkey PRIMARY KEY (id);


--
-- Name: t_order_statuses t_order_statuses_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_statuses
    ADD CONSTRAINT t_order_statuses_code_key UNIQUE (code);


--
-- Name: t_order_statuses t_order_statuses_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_statuses
    ADD CONSTRAINT t_order_statuses_name_key UNIQUE (name);


--
-- Name: t_order_statuses t_order_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_statuses
    ADD CONSTRAINT t_order_statuses_pkey PRIMARY KEY (id);


--
-- Name: t_order_task_history t_order_task_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_history
    ADD CONSTRAINT t_order_task_history_pkey PRIMARY KEY (id);


--
-- Name: t_order_task_materials t_order_task_materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_materials
    ADD CONSTRAINT t_order_task_materials_pkey PRIMARY KEY (order_task_id, material_id);


--
-- Name: t_order_task_status_assignees t_order_task_status_assignees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_status_assignees
    ADD CONSTRAINT t_order_task_status_assignees_pkey PRIMARY KEY (id);


--
-- Name: t_order_task_teeth t_order_task_teeth_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_teeth
    ADD CONSTRAINT t_order_task_teeth_pkey PRIMARY KEY (order_task_id, tooth_number);


--
-- Name: t_order_tasks t_order_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_tasks
    ADD CONSTRAINT t_order_tasks_pkey PRIMARY KEY (id);


--
-- Name: t_orders t_orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_orders
    ADD CONSTRAINT t_orders_order_number_key UNIQUE (order_number);


--
-- Name: t_orders t_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_orders
    ADD CONSTRAINT t_orders_pkey PRIMARY KEY (id);


--
-- Name: t_outbox_events t_outbox_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_outbox_events
    ADD CONSTRAINT t_outbox_events_pkey PRIMARY KEY (id);


--
-- Name: t_payment_method_rules t_payment_method_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_payment_method_rules
    ADD CONSTRAINT t_payment_method_rules_pkey PRIMARY KEY (code);


--
-- Name: t_personal_notes t_personal_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_personal_notes
    ADD CONSTRAINT t_personal_notes_pkey PRIMARY KEY (id);


--
-- Name: t_purchase_order_items t_purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_purchase_order_items
    ADD CONSTRAINT t_purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: t_purchase_order_items t_purchase_order_items_purchase_order_id_nomenclature_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_purchase_order_items
    ADD CONSTRAINT t_purchase_order_items_purchase_order_id_nomenclature_id_key UNIQUE (purchase_order_id, nomenclature_id);


--
-- Name: t_purchase_orders t_purchase_orders_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_purchase_orders
    ADD CONSTRAINT t_purchase_orders_number_key UNIQUE (number);


--
-- Name: t_purchase_orders t_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_purchase_orders
    ADD CONSTRAINT t_purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: t_purchase_status_rules t_purchase_status_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_purchase_status_rules
    ADD CONSTRAINT t_purchase_status_rules_pkey PRIMARY KEY (code);


--
-- Name: t_quality_incidents t_quality_incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_quality_incidents
    ADD CONSTRAINT t_quality_incidents_pkey PRIMARY KEY (id);


--
-- Name: t_refresh_sessions t_refresh_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_refresh_sessions
    ADD CONSTRAINT t_refresh_sessions_pkey PRIMARY KEY (id);


--
-- Name: t_refresh_sessions t_refresh_sessions_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_refresh_sessions
    ADD CONSTRAINT t_refresh_sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: t_roles t_roles_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_roles
    ADD CONSTRAINT t_roles_code_key UNIQUE (code);


--
-- Name: t_roles t_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_roles
    ADD CONSTRAINT t_roles_pkey PRIMARY KEY (id);


--
-- Name: t_salary_accruals t_salary_accruals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_accruals
    ADD CONSTRAINT t_salary_accruals_pkey PRIMARY KEY (id);


--
-- Name: t_salary_configs t_salary_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_configs
    ADD CONSTRAINT t_salary_configs_pkey PRIMARY KEY (id);


--
-- Name: t_salary_configs t_salary_configs_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_configs
    ADD CONSTRAINT t_salary_configs_user_id_key UNIQUE (user_id);


--
-- Name: t_salary_payment_types t_salary_payment_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_payment_types
    ADD CONSTRAINT t_salary_payment_types_pkey PRIMARY KEY (code);


--
-- Name: t_salary_plans t_salary_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_plans
    ADD CONSTRAINT t_salary_plans_pkey PRIMARY KEY (id);


--
-- Name: t_salary_plans t_salary_plans_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_plans
    ADD CONSTRAINT t_salary_plans_user_id_key UNIQUE (user_id);


--
-- Name: t_salary_stage_rules t_salary_stage_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_stage_rules
    ADD CONSTRAINT t_salary_stage_rules_pkey PRIMARY KEY (id);


--
-- Name: t_salary_statement_statuses t_salary_statement_statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_statement_statuses
    ADD CONSTRAINT t_salary_statement_statuses_pkey PRIMARY KEY (code);


--
-- Name: t_salary_statements t_salary_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_statements
    ADD CONSTRAINT t_salary_statements_pkey PRIMARY KEY (id);


--
-- Name: t_sla_rules t_sla_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_sla_rules
    ADD CONSTRAINT t_sla_rules_pkey PRIMARY KEY (id);


--
-- Name: t_stock_balance t_stock_balance_nomenclature_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_balance
    ADD CONSTRAINT t_stock_balance_nomenclature_id_key UNIQUE (nomenclature_id);


--
-- Name: t_stock_balance t_stock_balance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_balance
    ADD CONSTRAINT t_stock_balance_pkey PRIMARY KEY (id);


--
-- Name: t_stock_level_rules t_stock_level_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_level_rules
    ADD CONSTRAINT t_stock_level_rules_pkey PRIMARY KEY (code);


--
-- Name: t_stock_lots t_stock_lots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_lots
    ADD CONSTRAINT t_stock_lots_pkey PRIMARY KEY (id);


--
-- Name: t_stock_movement t_stock_movement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_movement
    ADD CONSTRAINT t_stock_movement_pkey PRIMARY KEY (id);


--
-- Name: t_stock_movement_types t_stock_movement_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_movement_types
    ADD CONSTRAINT t_stock_movement_types_pkey PRIMARY KEY (code);


--
-- Name: t_stock_reserves t_stock_reserves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_reserves
    ADD CONSTRAINT t_stock_reserves_pkey PRIMARY KEY (id);


--
-- Name: t_suppliers t_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_suppliers
    ADD CONSTRAINT t_suppliers_pkey PRIMARY KEY (id);


--
-- Name: t_task_material_plan t_task_material_plan_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_material_plan
    ADD CONSTRAINT t_task_material_plan_pkey PRIMARY KEY (id);


--
-- Name: t_task_sla_states t_task_sla_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_sla_states
    ADD CONSTRAINT t_task_sla_states_pkey PRIMARY KEY (task_id);


--
-- Name: t_task_stage_material_usage t_task_stage_material_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_stage_material_usage
    ADD CONSTRAINT t_task_stage_material_usage_pkey PRIMARY KEY (id);


--
-- Name: t_telegram_bot_settings t_telegram_bot_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_telegram_bot_settings
    ADD CONSTRAINT t_telegram_bot_settings_pkey PRIMARY KEY (id);


--
-- Name: t_user_roles t_user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_user_roles
    ADD CONSTRAINT t_user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: t_users t_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_users
    ADD CONSTRAINT t_users_email_key UNIQUE (email);


--
-- Name: t_users t_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_users
    ADD CONSTRAINT t_users_pkey PRIMARY KEY (id);


--
-- Name: t_work_types t_work_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_work_types
    ADD CONSTRAINT t_work_types_pkey PRIMARY KEY (id);


--
-- Name: t_workflow_steps t_workflow_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_workflow_steps
    ADD CONSTRAINT t_workflow_steps_pkey PRIMARY KEY (id);


--
-- Name: t_chat_conversations uq_chat_direct_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_conversations
    ADD CONSTRAINT uq_chat_direct_key UNIQUE (direct_key);


--
-- Name: t_incoming_requests uq_incoming_request_external; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_incoming_requests
    ADD CONSTRAINT uq_incoming_request_external UNIQUE (source_code, external_id);


--
-- Name: t_integration_api_keys uq_integration_key_name; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_integration_api_keys
    ADD CONSTRAINT uq_integration_key_name UNIQUE (source_code, name);


--
-- Name: t_inventory_check_item uq_inventory_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_inventory_check_item
    ADD CONSTRAINT uq_inventory_item UNIQUE (inventory_check_id, nomenclature_id);


--
-- Name: t_sla_rules uq_sla_rule_scope; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_sla_rules
    ADD CONSTRAINT uq_sla_rule_scope UNIQUE NULLS NOT DISTINCT (work_type_id, status_id);


--
-- Name: t_task_stage_material_usage uq_stage_material_report_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_stage_material_usage
    ADD CONSTRAINT uq_stage_material_report_item UNIQUE (report_id, nomenclature_id);


--
-- Name: t_stock_reserves uq_stock_reserve_task_nomenclature; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_reserves
    ADD CONSTRAINT uq_stock_reserve_task_nomenclature UNIQUE (order_task_id, nomenclature_id);


--
-- Name: t_task_material_plan uq_task_material_plan_item; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_material_plan
    ADD CONSTRAINT uq_task_material_plan_item UNIQUE (order_task_id, nomenclature_id);


--
-- Name: t_order_task_status_assignees uq_task_status_assignee; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_status_assignees
    ADD CONSTRAINT uq_task_status_assignee UNIQUE (order_task_id, status_id);


--
-- Name: t_nomenclature_consumption_norms uq_work_material_nomenclature_norm; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_nomenclature_consumption_norms
    ADD CONSTRAINT uq_work_material_nomenclature_norm UNIQUE (work_type_id, material_id, nomenclature_id);


--
-- Name: idx_attachment_task_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachment_task_id ON public.attachments USING btree (task_id);


--
-- Name: idx_attachment_task_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attachment_task_type ON public.attachments USING btree (task_id, attachment_type);


--
-- Name: idx_business_audit_actor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_audit_actor ON public.t_business_audit_events USING btree (actor_user_id, occurred_at DESC);


--
-- Name: idx_business_audit_occurred; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_audit_occurred ON public.t_business_audit_events USING btree (occurred_at DESC);


--
-- Name: idx_business_audit_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_business_audit_resource ON public.t_business_audit_events USING btree (resource_type, resource_id, occurred_at DESC);


--
-- Name: idx_chat_attachment_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_attachment_message ON public.t_chat_attachments USING btree (message_id);


--
-- Name: idx_chat_message_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_message_page ON public.t_chat_messages USING btree (conversation_id, created_at DESC, id DESC);


--
-- Name: idx_chat_participant_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_participant_user ON public.t_chat_participants USING btree (user_id, conversation_id);


--
-- Name: idx_incoming_requests_queue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_incoming_requests_queue ON public.t_incoming_requests USING btree (status_code, created_at DESC);


--
-- Name: idx_integration_keys_source_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_integration_keys_source_active ON public.t_integration_api_keys USING btree (source_code, active) WHERE (revoked_at IS NULL);


--
-- Name: idx_invoices_clinic_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_clinic_created ON public.t_invoices USING btree (clinic_id, created_at DESC);


--
-- Name: idx_invoices_order_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_order_status ON public.t_invoices USING btree (order_id, status) WHERE (order_id IS NOT NULL);


--
-- Name: idx_norms_work_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_norms_work_material ON public.t_nomenclature_consumption_norms USING btree (work_type_id, material_id);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.t_notifications USING btree (user_id, created_at DESC) WHERE (read_at IS NULL);


--
-- Name: idx_order_statuses_flags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_statuses_flags ON public.t_order_statuses USING btree (is_initial, is_terminal, is_review);


--
-- Name: idx_order_task_materials_material; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_task_materials_material ON public.t_order_task_materials USING btree (material_id, order_task_id);


--
-- Name: idx_order_tasks_salary_calc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_tasks_salary_calc ON public.t_order_tasks USING btree (dental_technician_id, updated_at) WHERE ((salary_statement_id IS NULL) AND (deleted_at IS NULL));


--
-- Name: idx_order_tasks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_tasks_status ON public.t_order_tasks USING btree (status_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_order_tasks_technician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_tasks_technician ON public.t_order_tasks USING btree (dental_technician_id);


--
-- Name: idx_order_tasks_work_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_tasks_work_type ON public.t_order_tasks USING btree (work_type_id);


--
-- Name: idx_orders_analytics_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_orders_analytics_dates ON public.t_orders USING btree (is_active, deadline, created_at) WHERE (deleted_at IS NULL);


--
-- Name: idx_outbox_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_outbox_pending ON public.t_outbox_events USING btree (next_attempt_at, created_at) WHERE ((status)::text = ANY ((ARRAY['PENDING'::character varying, 'RETRY'::character varying])::text[]));


--
-- Name: idx_personal_notes_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personal_notes_expires ON public.t_personal_notes USING btree (expires_at);


--
-- Name: idx_personal_notes_owner_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_personal_notes_owner_updated ON public.t_personal_notes USING btree (owner_id, updated_at DESC);


--
-- Name: idx_quality_incidents_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_incidents_open ON public.t_quality_incidents USING btree (status, created_at DESC) WHERE ((status)::text <> 'RESOLVED'::text);


--
-- Name: idx_quality_incidents_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_quality_incidents_task ON public.t_quality_incidents USING btree (task_id, created_at DESC);


--
-- Name: idx_refresh_sessions_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_refresh_sessions_user_active ON public.t_refresh_sessions USING btree (user_id, expires_at) WHERE (revoked_at IS NULL);


--
-- Name: idx_roles_system_managed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_roles_system_managed ON public.t_roles USING btree (system_managed, code);


--
-- Name: idx_salary_accruals_employee_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salary_accruals_employee_period ON public.t_salary_accruals USING btree (employee_id, earned_at);


--
-- Name: idx_salary_accruals_unpaid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salary_accruals_unpaid ON public.t_salary_accruals USING btree (employee_id, salary_statement_id) WHERE (salary_statement_id IS NULL);


--
-- Name: idx_salary_configs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salary_configs_user_id ON public.t_salary_configs USING btree (user_id) WHERE (deleted_at IS NULL);


--
-- Name: idx_salary_stage_rules_resolution; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salary_stage_rules_resolution ON public.t_salary_stage_rules USING btree (plan_id, status_id, work_type_id, active);


--
-- Name: idx_salary_statements_employee_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_salary_statements_employee_status ON public.t_salary_statements USING btree (employee_id, status) WHERE (deleted_at IS NULL);


--
-- Name: idx_stage_material_usage_report; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stage_material_usage_report ON public.t_task_stage_material_usage USING btree (report_id);


--
-- Name: idx_stage_material_usage_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stage_material_usage_task ON public.t_task_stage_material_usage USING btree (order_task_id, created_at);


--
-- Name: idx_stock_lots_fefo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_lots_fefo ON public.t_stock_lots USING btree (nomenclature_id, expires_at) WHERE (remaining_quantity > (0)::numeric);


--
-- Name: idx_stock_movement_nomenclature; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movement_nomenclature ON public.t_stock_movement USING btree (nomenclature_id, created_at DESC);


--
-- Name: idx_stock_movement_order_cost_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movement_order_cost_period ON public.t_stock_movement USING btree (created_at) WHERE ((reference_type)::text = 'ORDER_COMPLETED'::text);


--
-- Name: idx_stock_reserves_nomenclature_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reserves_nomenclature_id ON public.t_stock_reserves USING btree (nomenclature_id);


--
-- Name: idx_stock_reserves_order_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_reserves_order_id ON public.t_stock_reserves USING btree (order_id);


--
-- Name: idx_task_material_plan_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_material_plan_task ON public.t_task_material_plan USING btree (order_task_id);


--
-- Name: idx_task_status_assignees_task; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_status_assignees_task ON public.t_order_task_status_assignees USING btree (order_task_id);


--
-- Name: idx_task_status_assignees_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_task_status_assignees_user ON public.t_order_task_status_assignees USING btree (user_id);


--
-- Name: uq_clinic_card_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_clinic_card_active ON public.t_clinic_user_cards USING btree (clinic_id, full_name, role) WHERE (deleted_at IS NULL);


--
-- Name: uq_clinics_bin_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_clinics_bin_active ON public.t_clinics USING btree (bin) WHERE ((deleted_at IS NULL) AND (bin IS NOT NULL));


--
-- Name: uq_color_code_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_color_code_active ON public.t_colors USING btree (code) WHERE (deleted_at IS NULL);


--
-- Name: uq_incoming_status_accepted; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_incoming_status_accepted ON public.t_incoming_request_statuses USING btree (is_accepted) WHERE (is_accepted = true);


--
-- Name: uq_incoming_status_initial; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_incoming_status_initial ON public.t_incoming_request_statuses USING btree (is_initial) WHERE (is_initial = true);


--
-- Name: uq_incoming_status_rejected; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_incoming_status_rejected ON public.t_incoming_request_statuses USING btree (is_rejected) WHERE (is_rejected = true);


--
-- Name: uq_incoming_status_review; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_incoming_status_review ON public.t_incoming_request_statuses USING btree (is_in_review) WHERE (is_in_review = true);


--
-- Name: uq_inventory_cancelled_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_cancelled_rule ON public.t_inventory_status_rules USING btree (marks_cancelled) WHERE (marks_cancelled = true);


--
-- Name: uq_inventory_completed_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_completed_rule ON public.t_inventory_status_rules USING btree (marks_completed) WHERE (marks_completed = true);


--
-- Name: uq_inventory_initial_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_initial_rule ON public.t_inventory_status_rules USING btree (is_initial) WHERE (is_initial = true);


--
-- Name: uq_inventory_lock_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_inventory_lock_rule ON public.t_inventory_status_rules USING btree (locks_warehouse) WHERE (locks_warehouse = true);


--
-- Name: uq_invoice_payment_external; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_invoice_payment_external ON public.t_invoice_payments USING btree (external_reference) WHERE ((external_reference IS NOT NULL) AND (reversed_at IS NULL));


--
-- Name: uq_material_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_material_name_active ON public.t_materials USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: uq_salary_statement_initial_status; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_salary_statement_initial_status ON public.t_salary_statement_statuses USING btree (is_initial) WHERE (is_initial = true);


--
-- Name: uq_salary_statement_paid_status; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_salary_statement_paid_status ON public.t_salary_statement_statuses USING btree (marks_paid) WHERE (marks_paid = true);


--
-- Name: uq_stock_lot_receipt_item; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_stock_lot_receipt_item ON public.t_stock_lots USING btree (receipt_id, purchase_item_id) WHERE (receipt_id IS NOT NULL);


--
-- Name: uq_stock_movement_adjustment_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_stock_movement_adjustment_rule ON public.t_stock_movement_types USING btree (is_inventory_adjustment) WHERE (is_inventory_adjustment = true);


--
-- Name: uq_stock_movement_decrease_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_stock_movement_decrease_rule ON public.t_stock_movement_types USING btree (decreases_stock) WHERE (decreases_stock = true);


--
-- Name: uq_stock_movement_increase_rule; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_stock_movement_increase_rule ON public.t_stock_movement_types USING btree (increases_stock) WHERE (increases_stock = true);


--
-- Name: uq_stock_movement_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_stock_movement_reference ON public.t_stock_movement USING btree (nomenclature_id, reference_type, reference_id, movement_type);


--
-- Name: uq_work_type_code_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_work_type_code_active ON public.t_work_types USING btree (code) WHERE (deleted_at IS NULL);


--
-- Name: uq_work_type_name_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_work_type_name_active ON public.t_work_types USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: uq_workflow_step_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_workflow_step_active ON public.t_workflow_steps USING btree (work_type_id, from_status_id, to_status_id) WHERE (deleted_at IS NULL);


--
-- Name: attachments attachments_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attachments
    ADD CONSTRAINT attachments_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.t_order_tasks(id) ON DELETE CASCADE;


--
-- Name: t_inventory_check fk_inventory_status_rule; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_inventory_check
    ADD CONSTRAINT fk_inventory_status_rule FOREIGN KEY (status) REFERENCES public.t_inventory_status_rules(code);


--
-- Name: t_invoices fk_invoice_status_rule; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_invoices
    ADD CONSTRAINT fk_invoice_status_rule FOREIGN KEY (status) REFERENCES public.t_invoice_status_rules(code);


--
-- Name: t_invoice_payments fk_payment_method_rule; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_invoice_payments
    ADD CONSTRAINT fk_payment_method_rule FOREIGN KEY (payment_method) REFERENCES public.t_payment_method_rules(code);


--
-- Name: t_purchase_orders fk_purchase_status_rule; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_purchase_orders
    ADD CONSTRAINT fk_purchase_status_rule FOREIGN KEY (status) REFERENCES public.t_purchase_status_rules(code);


--
-- Name: t_salary_configs fk_salary_config_payment_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_configs
    ADD CONSTRAINT fk_salary_config_payment_type FOREIGN KEY (payment_type) REFERENCES public.t_salary_payment_types(code);


--
-- Name: t_salary_statements fk_salary_statement_payment_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_statements
    ADD CONSTRAINT fk_salary_statement_payment_type FOREIGN KEY (payment_type) REFERENCES public.t_salary_payment_types(code);


--
-- Name: t_salary_statements fk_salary_statement_status; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_statements
    ADD CONSTRAINT fk_salary_statement_status FOREIGN KEY (status) REFERENCES public.t_salary_statement_statuses(code);


--
-- Name: t_stock_movement fk_stock_movement_type_rule; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_movement
    ADD CONSTRAINT fk_stock_movement_type_rule FOREIGN KEY (movement_type) REFERENCES public.t_stock_movement_types(code);


--
-- Name: t_business_audit_events t_business_audit_events_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_business_audit_events
    ADD CONSTRAINT t_business_audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.t_users(id);


--
-- Name: t_chat_attachments t_chat_attachments_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_attachments
    ADD CONSTRAINT t_chat_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.t_chat_messages(id) ON DELETE CASCADE;


--
-- Name: t_chat_conversations t_chat_conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_conversations
    ADD CONSTRAINT t_chat_conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.t_users(id);


--
-- Name: t_chat_messages t_chat_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_messages
    ADD CONSTRAINT t_chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.t_chat_conversations(id) ON DELETE CASCADE;


--
-- Name: t_chat_messages t_chat_messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_messages
    ADD CONSTRAINT t_chat_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.t_chat_messages(id);


--
-- Name: t_chat_messages t_chat_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_messages
    ADD CONSTRAINT t_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.t_users(id);


--
-- Name: t_chat_participants t_chat_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_participants
    ADD CONSTRAINT t_chat_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.t_chat_conversations(id) ON DELETE CASCADE;


--
-- Name: t_chat_participants t_chat_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_chat_participants
    ADD CONSTRAINT t_chat_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.t_users(id);


--
-- Name: t_clinic_user_cards t_clinic_user_cards_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_clinic_user_cards
    ADD CONSTRAINT t_clinic_user_cards_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.t_clinics(id) ON DELETE RESTRICT;


--
-- Name: t_finance_periods t_finance_periods_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_finance_periods
    ADD CONSTRAINT t_finance_periods_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES public.t_users(id);


--
-- Name: t_incoming_requests t_incoming_requests_created_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_incoming_requests
    ADD CONSTRAINT t_incoming_requests_created_order_id_fkey FOREIGN KEY (created_order_id) REFERENCES public.t_orders(id);


--
-- Name: t_incoming_requests t_incoming_requests_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_incoming_requests
    ADD CONSTRAINT t_incoming_requests_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.t_users(id);


--
-- Name: t_incoming_requests t_incoming_requests_source_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_incoming_requests
    ADD CONSTRAINT t_incoming_requests_source_code_fkey FOREIGN KEY (source_code) REFERENCES public.t_integration_sources(code);


--
-- Name: t_incoming_requests t_incoming_requests_status_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_incoming_requests
    ADD CONSTRAINT t_incoming_requests_status_code_fkey FOREIGN KEY (status_code) REFERENCES public.t_incoming_request_statuses(code);


--
-- Name: t_integration_api_keys t_integration_api_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_integration_api_keys
    ADD CONSTRAINT t_integration_api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.t_users(id);


--
-- Name: t_integration_api_keys t_integration_api_keys_source_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_integration_api_keys
    ADD CONSTRAINT t_integration_api_keys_source_code_fkey FOREIGN KEY (source_code) REFERENCES public.t_integration_sources(code);


--
-- Name: t_inventory_check t_inventory_check_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_inventory_check
    ADD CONSTRAINT t_inventory_check_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.t_users(id);


--
-- Name: t_inventory_check_item t_inventory_check_item_inventory_check_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_inventory_check_item
    ADD CONSTRAINT t_inventory_check_item_inventory_check_id_fkey FOREIGN KEY (inventory_check_id) REFERENCES public.t_inventory_check(id) ON DELETE CASCADE;


--
-- Name: t_inventory_check_item t_inventory_check_item_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_inventory_check_item
    ADD CONSTRAINT t_inventory_check_item_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.t_nomenclature(id);


--
-- Name: t_invoice_payments t_invoice_payments_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_invoice_payments
    ADD CONSTRAINT t_invoice_payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.t_users(id);


--
-- Name: t_invoice_payments t_invoice_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_invoice_payments
    ADD CONSTRAINT t_invoice_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.t_invoices(id);


--
-- Name: t_invoices t_invoices_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_invoices
    ADD CONSTRAINT t_invoices_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.t_clinics(id);


--
-- Name: t_invoices t_invoices_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_invoices
    ADD CONSTRAINT t_invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.t_orders(id);


--
-- Name: t_materials t_materials_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_materials
    ADD CONSTRAINT t_materials_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.t_nomenclature(id);


--
-- Name: t_nomenclature_consumption_norms t_nomenclature_consumption_norms_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_nomenclature_consumption_norms
    ADD CONSTRAINT t_nomenclature_consumption_norms_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.t_materials(id) ON DELETE CASCADE;


--
-- Name: t_nomenclature_consumption_norms t_nomenclature_consumption_norms_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_nomenclature_consumption_norms
    ADD CONSTRAINT t_nomenclature_consumption_norms_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.t_nomenclature(id) ON DELETE RESTRICT;


--
-- Name: t_nomenclature_consumption_norms t_nomenclature_consumption_norms_work_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_nomenclature_consumption_norms
    ADD CONSTRAINT t_nomenclature_consumption_norms_work_type_id_fkey FOREIGN KEY (work_type_id) REFERENCES public.t_work_types(id) ON DELETE CASCADE;


--
-- Name: t_notification_preferences t_notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_notification_preferences
    ADD CONSTRAINT t_notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.t_users(id);


--
-- Name: t_notifications t_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_notifications
    ADD CONSTRAINT t_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.t_users(id);


--
-- Name: t_order_task_history t_order_task_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_history
    ADD CONSTRAINT t_order_task_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.t_users(id);


--
-- Name: t_order_task_history t_order_task_history_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_history
    ADD CONSTRAINT t_order_task_history_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.t_order_tasks(id) ON DELETE CASCADE;


--
-- Name: t_order_task_materials t_order_task_materials_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_materials
    ADD CONSTRAINT t_order_task_materials_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.t_materials(id) ON DELETE RESTRICT;


--
-- Name: t_order_task_materials t_order_task_materials_order_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_materials
    ADD CONSTRAINT t_order_task_materials_order_task_id_fkey FOREIGN KEY (order_task_id) REFERENCES public.t_order_tasks(id) ON DELETE CASCADE;


--
-- Name: t_order_task_status_assignees t_order_task_status_assignees_order_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_status_assignees
    ADD CONSTRAINT t_order_task_status_assignees_order_task_id_fkey FOREIGN KEY (order_task_id) REFERENCES public.t_order_tasks(id) ON DELETE CASCADE;


--
-- Name: t_order_task_status_assignees t_order_task_status_assignees_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_status_assignees
    ADD CONSTRAINT t_order_task_status_assignees_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.t_order_statuses(id) ON DELETE RESTRICT;


--
-- Name: t_order_task_status_assignees t_order_task_status_assignees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_status_assignees
    ADD CONSTRAINT t_order_task_status_assignees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.t_users(id) ON DELETE RESTRICT;


--
-- Name: t_order_task_teeth t_order_task_teeth_order_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_task_teeth
    ADD CONSTRAINT t_order_task_teeth_order_task_id_fkey FOREIGN KEY (order_task_id) REFERENCES public.t_order_tasks(id) ON DELETE CASCADE;


--
-- Name: t_order_tasks t_order_tasks_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_tasks
    ADD CONSTRAINT t_order_tasks_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.t_colors(id);


--
-- Name: t_order_tasks t_order_tasks_dental_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_tasks
    ADD CONSTRAINT t_order_tasks_dental_technician_id_fkey FOREIGN KEY (dental_technician_id) REFERENCES public.t_users(id);


--
-- Name: t_order_tasks t_order_tasks_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_tasks
    ADD CONSTRAINT t_order_tasks_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.t_orders(id) ON DELETE CASCADE;


--
-- Name: t_order_tasks t_order_tasks_salary_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_tasks
    ADD CONSTRAINT t_order_tasks_salary_statement_id_fkey FOREIGN KEY (salary_statement_id) REFERENCES public.t_salary_statements(id) ON DELETE SET NULL;


--
-- Name: t_order_tasks t_order_tasks_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_tasks
    ADD CONSTRAINT t_order_tasks_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.t_order_statuses(id);


--
-- Name: t_order_tasks t_order_tasks_work_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_order_tasks
    ADD CONSTRAINT t_order_tasks_work_type_id_fkey FOREIGN KEY (work_type_id) REFERENCES public.t_work_types(id);


--
-- Name: t_orders t_orders_cad_cam_operator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_orders
    ADD CONSTRAINT t_orders_cad_cam_operator_id_fkey FOREIGN KEY (cad_cam_operator_id) REFERENCES public.t_users(id);


--
-- Name: t_orders t_orders_doctor_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_orders
    ADD CONSTRAINT t_orders_doctor_card_id_fkey FOREIGN KEY (doctor_card_id) REFERENCES public.t_clinic_user_cards(id);


--
-- Name: t_orders t_orders_patient_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_orders
    ADD CONSTRAINT t_orders_patient_card_id_fkey FOREIGN KEY (patient_card_id) REFERENCES public.t_clinic_user_cards(id);


--
-- Name: t_personal_notes t_personal_notes_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_personal_notes
    ADD CONSTRAINT t_personal_notes_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.t_users(id) ON DELETE CASCADE;


--
-- Name: t_purchase_order_items t_purchase_order_items_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_purchase_order_items
    ADD CONSTRAINT t_purchase_order_items_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.t_nomenclature(id);


--
-- Name: t_purchase_order_items t_purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_purchase_order_items
    ADD CONSTRAINT t_purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.t_purchase_orders(id) ON DELETE CASCADE;


--
-- Name: t_purchase_orders t_purchase_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_purchase_orders
    ADD CONSTRAINT t_purchase_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.t_users(id);


--
-- Name: t_purchase_orders t_purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_purchase_orders
    ADD CONSTRAINT t_purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.t_suppliers(id);


--
-- Name: t_quality_incidents t_quality_incidents_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_quality_incidents
    ADD CONSTRAINT t_quality_incidents_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.t_users(id);


--
-- Name: t_quality_incidents t_quality_incidents_reported_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_quality_incidents
    ADD CONSTRAINT t_quality_incidents_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES public.t_users(id);


--
-- Name: t_quality_incidents t_quality_incidents_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_quality_incidents
    ADD CONSTRAINT t_quality_incidents_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.t_order_tasks(id);


--
-- Name: t_refresh_sessions t_refresh_sessions_replaced_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_refresh_sessions
    ADD CONSTRAINT t_refresh_sessions_replaced_by_id_fkey FOREIGN KEY (replaced_by_id) REFERENCES public.t_refresh_sessions(id);


--
-- Name: t_refresh_sessions t_refresh_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_refresh_sessions
    ADD CONSTRAINT t_refresh_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.t_users(id);


--
-- Name: t_salary_accruals t_salary_accruals_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_accruals
    ADD CONSTRAINT t_salary_accruals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.t_users(id);


--
-- Name: t_salary_accruals t_salary_accruals_order_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_accruals
    ADD CONSTRAINT t_salary_accruals_order_task_id_fkey FOREIGN KEY (order_task_id) REFERENCES public.t_order_tasks(id);


--
-- Name: t_salary_accruals t_salary_accruals_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_accruals
    ADD CONSTRAINT t_salary_accruals_rule_id_fkey FOREIGN KEY (rule_id) REFERENCES public.t_salary_stage_rules(id);


--
-- Name: t_salary_accruals t_salary_accruals_salary_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_accruals
    ADD CONSTRAINT t_salary_accruals_salary_statement_id_fkey FOREIGN KEY (salary_statement_id) REFERENCES public.t_salary_statements(id);


--
-- Name: t_salary_accruals t_salary_accruals_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_accruals
    ADD CONSTRAINT t_salary_accruals_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.t_order_statuses(id);


--
-- Name: t_salary_configs t_salary_configs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_configs
    ADD CONSTRAINT t_salary_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.t_users(id) ON DELETE CASCADE;


--
-- Name: t_salary_plans t_salary_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_plans
    ADD CONSTRAINT t_salary_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.t_users(id);


--
-- Name: t_salary_stage_rules t_salary_stage_rules_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_stage_rules
    ADD CONSTRAINT t_salary_stage_rules_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.t_salary_plans(id);


--
-- Name: t_salary_stage_rules t_salary_stage_rules_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_stage_rules
    ADD CONSTRAINT t_salary_stage_rules_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.t_order_statuses(id);


--
-- Name: t_salary_stage_rules t_salary_stage_rules_work_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_stage_rules
    ADD CONSTRAINT t_salary_stage_rules_work_type_id_fkey FOREIGN KEY (work_type_id) REFERENCES public.t_work_types(id);


--
-- Name: t_salary_statements t_salary_statements_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_statements
    ADD CONSTRAINT t_salary_statements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.t_users(id);


--
-- Name: t_salary_statements t_salary_statements_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_salary_statements
    ADD CONSTRAINT t_salary_statements_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.t_salary_plans(id);


--
-- Name: t_sla_rules t_sla_rules_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_sla_rules
    ADD CONSTRAINT t_sla_rules_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.t_order_statuses(id);


--
-- Name: t_sla_rules t_sla_rules_work_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_sla_rules
    ADD CONSTRAINT t_sla_rules_work_type_id_fkey FOREIGN KEY (work_type_id) REFERENCES public.t_work_types(id);


--
-- Name: t_stock_balance t_stock_balance_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_balance
    ADD CONSTRAINT t_stock_balance_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.t_nomenclature(id);


--
-- Name: t_stock_lots t_stock_lots_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_lots
    ADD CONSTRAINT t_stock_lots_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.t_nomenclature(id);


--
-- Name: t_stock_lots t_stock_lots_purchase_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_lots
    ADD CONSTRAINT t_stock_lots_purchase_item_id_fkey FOREIGN KEY (purchase_item_id) REFERENCES public.t_purchase_order_items(id);


--
-- Name: t_stock_movement t_stock_movement_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_movement
    ADD CONSTRAINT t_stock_movement_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.t_nomenclature(id);


--
-- Name: t_stock_reserves t_stock_reserves_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_reserves
    ADD CONSTRAINT t_stock_reserves_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.t_nomenclature(id) ON DELETE RESTRICT;


--
-- Name: t_stock_reserves t_stock_reserves_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_reserves
    ADD CONSTRAINT t_stock_reserves_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.t_orders(id) ON DELETE CASCADE;


--
-- Name: t_stock_reserves t_stock_reserves_order_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_stock_reserves
    ADD CONSTRAINT t_stock_reserves_order_task_id_fkey FOREIGN KEY (order_task_id) REFERENCES public.t_order_tasks(id) ON DELETE CASCADE;


--
-- Name: t_task_material_plan t_task_material_plan_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_material_plan
    ADD CONSTRAINT t_task_material_plan_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.t_nomenclature(id) ON DELETE RESTRICT;


--
-- Name: t_task_material_plan t_task_material_plan_order_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_material_plan
    ADD CONSTRAINT t_task_material_plan_order_task_id_fkey FOREIGN KEY (order_task_id) REFERENCES public.t_order_tasks(id) ON DELETE RESTRICT;


--
-- Name: t_task_sla_states t_task_sla_states_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_sla_states
    ADD CONSTRAINT t_task_sla_states_status_id_fkey FOREIGN KEY (status_id) REFERENCES public.t_order_statuses(id);


--
-- Name: t_task_sla_states t_task_sla_states_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_sla_states
    ADD CONSTRAINT t_task_sla_states_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.t_order_tasks(id);


--
-- Name: t_task_stage_material_usage t_task_stage_material_usage_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_stage_material_usage
    ADD CONSTRAINT t_task_stage_material_usage_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.t_users(id) ON DELETE RESTRICT;


--
-- Name: t_task_stage_material_usage t_task_stage_material_usage_from_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_stage_material_usage
    ADD CONSTRAINT t_task_stage_material_usage_from_status_id_fkey FOREIGN KEY (from_status_id) REFERENCES public.t_order_statuses(id);


--
-- Name: t_task_stage_material_usage t_task_stage_material_usage_nomenclature_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_stage_material_usage
    ADD CONSTRAINT t_task_stage_material_usage_nomenclature_id_fkey FOREIGN KEY (nomenclature_id) REFERENCES public.t_nomenclature(id) ON DELETE RESTRICT;


--
-- Name: t_task_stage_material_usage t_task_stage_material_usage_order_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_stage_material_usage
    ADD CONSTRAINT t_task_stage_material_usage_order_task_id_fkey FOREIGN KEY (order_task_id) REFERENCES public.t_order_tasks(id) ON DELETE RESTRICT;


--
-- Name: t_task_stage_material_usage t_task_stage_material_usage_to_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_stage_material_usage
    ADD CONSTRAINT t_task_stage_material_usage_to_status_id_fkey FOREIGN KEY (to_status_id) REFERENCES public.t_order_statuses(id);


--
-- Name: t_task_stage_material_usage t_task_stage_material_usage_workflow_step_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_task_stage_material_usage
    ADD CONSTRAINT t_task_stage_material_usage_workflow_step_id_fkey FOREIGN KEY (workflow_step_id) REFERENCES public.t_workflow_steps(id) ON DELETE RESTRICT;


--
-- Name: t_telegram_bot_settings t_telegram_bot_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_telegram_bot_settings
    ADD CONSTRAINT t_telegram_bot_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.t_users(id);


--
-- Name: t_user_roles t_user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_user_roles
    ADD CONSTRAINT t_user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.t_roles(id) ON DELETE CASCADE;


--
-- Name: t_user_roles t_user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_user_roles
    ADD CONSTRAINT t_user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.t_users(id) ON DELETE CASCADE;


--
-- Name: t_workflow_steps t_workflow_steps_from_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_workflow_steps
    ADD CONSTRAINT t_workflow_steps_from_status_id_fkey FOREIGN KEY (from_status_id) REFERENCES public.t_order_statuses(id);


--
-- Name: t_workflow_steps t_workflow_steps_to_status_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_workflow_steps
    ADD CONSTRAINT t_workflow_steps_to_status_id_fkey FOREIGN KEY (to_status_id) REFERENCES public.t_order_statuses(id);


--
-- Name: t_workflow_steps t_workflow_steps_work_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.t_workflow_steps
    ADD CONSTRAINT t_workflow_steps_work_type_id_fkey FOREIGN KEY (work_type_id) REFERENCES public.t_work_types(id);


--
-- PostgreSQL database dump complete
--


