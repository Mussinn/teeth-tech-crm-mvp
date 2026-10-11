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
-- Data for Name: t_clinics; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_clinics (id, name, address, phone, email, contact_person, bin, discount_percent, created_at, updated_at, deleted_at) VALUES ('30a6e3f5-7cc7-59e1-af0d-c815e6f58793', 'Стоматология «Улыбка»', 'Актобе, пр. Абилкайыр хана, 45', '+77132000101', 'info@smile-test.kz', 'Медведева Ольга', '120740001001', 5, '2026-07-28 20:38:15.625348+00', '2026-07-28 20:38:15.625348+00', NULL);
INSERT INTO public.t_clinics (id, name, address, phone, email, contact_person, bin, discount_percent, created_at, updated_at, deleted_at) VALUES ('735887da-e5d9-5e07-afeb-00395147dc7a', 'Dental City', 'Актобе, ул. Маресьева, 88', '+77132000102', 'info@dentalcity-test.kz', 'Нурланов Ержан', '130840002002', 10, '2026-07-28 20:38:15.625348+00', '2026-07-28 20:38:15.625348+00', NULL);
INSERT INTO public.t_clinics (id, name, address, phone, email, contact_person, bin, discount_percent, created_at, updated_at, deleted_at) VALUES ('1e385e30-30c8-54d8-9fad-f62a98260a4e', 'Family Dent', 'Актобе, ул. Жанкожа батыра, 12', '+77132000103', 'info@familydent-test.kz', 'Ким Елена', '150940003003', 0, '2026-07-28 20:38:15.625348+00', '2026-07-28 20:38:15.625348+00', NULL);


--
-- Data for Name: t_clinic_user_cards; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_clinic_user_cards (id, clinic_id, full_name, role, created_at, updated_at, deleted_at) VALUES ('c985d4b4-ea10-509e-865f-fa664d2071f6', '30a6e3f5-7cc7-59e1-af0d-c815e6f58793', 'Медведева Ольга Сергеевна', 'doctor', '2026-07-28 20:38:15.625805+00', '2026-07-28 20:38:15.625805+00', NULL);
INSERT INTO public.t_clinic_user_cards (id, clinic_id, full_name, role, created_at, updated_at, deleted_at) VALUES ('163a24c5-8098-5a6c-b295-c5ee3d04179d', '30a6e3f5-7cc7-59e1-af0d-c815e6f58793', 'Ахметов Данияр Русланович', 'patient', '2026-07-28 20:38:15.625805+00', '2026-07-28 20:38:15.625805+00', NULL);
INSERT INTO public.t_clinic_user_cards (id, clinic_id, full_name, role, created_at, updated_at, deleted_at) VALUES ('86b00b26-0728-5e09-b57a-a824edaba05a', '30a6e3f5-7cc7-59e1-af0d-c815e6f58793', 'Смагулова Айша Ермековна', 'patient', '2026-07-28 20:38:15.625805+00', '2026-07-28 20:38:15.625805+00', NULL);
INSERT INTO public.t_clinic_user_cards (id, clinic_id, full_name, role, created_at, updated_at, deleted_at) VALUES ('84a4ed36-ee29-579a-ada9-62be00ebbf56', '735887da-e5d9-5e07-afeb-00395147dc7a', 'Нурланов Ержан Алиевич', 'doctor', '2026-07-28 20:38:15.625805+00', '2026-07-28 20:38:15.625805+00', NULL);
INSERT INTO public.t_clinic_user_cards (id, clinic_id, full_name, role, created_at, updated_at, deleted_at) VALUES ('a2dc1888-c8bc-5540-ba0f-ec50a520c024', '735887da-e5d9-5e07-afeb-00395147dc7a', 'Иванов Максим Олегович', 'patient', '2026-07-28 20:38:15.625805+00', '2026-07-28 20:38:15.625805+00', NULL);
INSERT INTO public.t_clinic_user_cards (id, clinic_id, full_name, role, created_at, updated_at, deleted_at) VALUES ('00269cbb-67b1-5338-8d40-755c6cd57135', '735887da-e5d9-5e07-afeb-00395147dc7a', 'Омарова Амина Сериковна', 'patient', '2026-07-28 20:38:15.625805+00', '2026-07-28 20:38:15.625805+00', NULL);
INSERT INTO public.t_clinic_user_cards (id, clinic_id, full_name, role, created_at, updated_at, deleted_at) VALUES ('c55c3cba-e02b-52da-94ef-19db13b5bd6c', '1e385e30-30c8-54d8-9fad-f62a98260a4e', 'Ким Елена Викторовна', 'doctor', '2026-07-28 20:38:15.625805+00', '2026-07-28 20:38:15.625805+00', NULL);
INSERT INTO public.t_clinic_user_cards (id, clinic_id, full_name, role, created_at, updated_at, deleted_at) VALUES ('60194cf2-4cc2-58d6-b643-0717e2f0aeb4', '1e385e30-30c8-54d8-9fad-f62a98260a4e', 'Петров Артем Ильич', 'patient', '2026-07-28 20:38:15.625805+00', '2026-07-28 20:38:15.625805+00', NULL);


--
-- Data for Name: t_colors; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('8c1eef9f-92f8-4fb5-a058-b92b3beab4c2', 'A1', 'Светлый красно-коричневый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('3dcb04b6-4090-4100-a9cd-589c155f07c2', 'A2', 'Красно-коричневый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('7dc98be8-acb6-42f7-b24d-44e65327522a', 'A3', 'Насыщенный красно-коричневый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('8fae98c5-01f8-4cc9-ba59-1dd4aa7fa4aa', 'A3.5', 'Темный красно-коричневый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('96ef799d-ef01-47c1-a0d8-cca044cdd9ac', 'A4', 'Очень темный красно-коричневый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('7d71820b-3e60-423d-b24a-373327107be8', 'B1', 'Светлый красно-желтый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('ef3b00f9-2cc8-4270-be87-28504ef73aea', 'B2', 'Красно-желтый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('4a0fbc8c-1c48-4c27-8e1d-30e5d1ab9755', 'B3', 'Насыщенный красно-желтый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('81e4ff36-e0ec-43e2-b34c-9ec3f853a072', 'B4', 'Темный красно-желтый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('16a858db-3027-47db-b9f7-d80fe7088b89', 'C1', 'Светлый серый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('19834e9e-90db-478e-ba8d-b4d4f2d2bba9', 'C2', 'Серый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('677e031d-cc88-4801-964e-f00008972f71', 'C3', 'Насыщенный серый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('7cbf2f76-ac1c-416e-a36e-278f04e30135', 'C4', 'Темный серый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('f259fb18-7f67-40b3-b7bf-c0205b8331c1', 'D2', 'Светлый красно-серый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('d69fe8b9-f09a-4dfd-bae2-6b9be5550b09', 'D3', 'Красно-серый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('d35397da-0d62-4526-ba0b-33736359f537', 'D4', 'Темный красно-серый', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('59002431-4d48-4840-b48f-02b9a6312719', 'BL1', 'Bleach 1', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('2916f443-2b00-413f-b9fe-af25a364f718', 'BL2', 'Bleach 2', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('15c24557-3e54-4409-9be6-8c1379c23979', 'BL3', 'Bleach 3', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);
INSERT INTO public.t_colors (id, code, name, is_active, created_at, updated_at, deleted_at) VALUES ('45f67ef1-26e0-48db-9f50-886066e54abe', 'BL4', 'Bleach 4', true, '2026-07-28 20:38:15.61969+00', '2026-07-28 20:38:15.61969+00', NULL);


--
-- Data for Name: t_order_statuses; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'PLASTERING', 'Гипсовка', 'Изготовление гипсовой модели', 2, '#EAB308', '2026-07-28 20:38:15.617047+00', '2026-07-28 20:38:15.617047+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('c5fd12c6-c17f-562e-a3ae-14c2bf8cc0c2', 'SCANNING', 'Сканирование', 'Сканирование модели', 3, '#0EA5E9', '2026-07-28 20:38:15.617047+00', '2026-07-28 20:38:15.617047+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('e08ce645-23d7-59b5-830c-8a5946b8a4e8', 'MODELING', 'Моделирование', 'CAD/CAM моделирование', 4, '#22C55E', '2026-07-28 20:38:15.617047+00', '2026-07-28 20:38:15.617047+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('0b8741cd-cd21-5d1d-8b71-4bece984e0cf', 'CERAMICS', 'Керамика', 'Нанесение и обжиг керамики', 5, '#F97316', '2026-07-28 20:38:15.617047+00', '2026-07-28 20:38:15.617047+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('ae37c459-16cd-58a8-af63-a962d631d508', 'PROSTHETIST_WORK', 'Работа протезиста', 'Изготовление съемной конструкции', 6, '#8B5CF6', '2026-07-28 20:38:15.617047+00', '2026-07-28 20:38:15.617047+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('ca61343e-44a7-514b-9eba-beb0ac245308', 'TODO', 'Новая задача', 'Задача зарегистрирована', 1, '#64748B', '2026-07-28 20:38:15.617047+00', '2026-07-28 20:38:15.617047+00', true, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('699331e5-8a22-593d-b6c5-6244abb077d2', 'ORDER_CLOSED', 'Завершено', 'Работа завершена', 8, '#111827', '2026-07-28 20:38:15.617047+00', '2026-07-28 20:38:15.617047+00', false, true, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('49afbf34-3d65-5a70-ad9a-20ff2cdb7302', 'WAITING_FOR_APPROVAL', 'Ожидание проверки', 'Финальная проверка качества', 7, '#EC4899', '2026-07-28 20:38:15.617047+00', '2026-07-28 20:38:15.617047+00', false, false, true);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('c9768a8b-5b2d-5b0e-9a88-f9e70dd0e375', 'CAD_CAM', 'CAD/CAM', 'CAD/CAM-проектирование', 20, '#2563EB', '2026-07-28 20:38:16.468295+00', '2026-07-28 20:38:16.468295+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('93d147c7-3487-5a76-bead-c6880caba0fb', 'MILLING', 'Фрезеровка', 'Фрезеровка конструкции', 21, '#0891B2', '2026-07-28 20:38:16.468295+00', '2026-07-28 20:38:16.468295+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('b41495b3-20ee-5941-aa6d-3c7137c55085', 'BAR_MODELING', 'Моделировка балки', 'Моделировка балки', 22, '#4F46E5', '2026-07-28 20:38:16.468295+00', '2026-07-28 20:38:16.468295+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('7c724c43-0bf5-57e5-950c-f44a06270012', 'METAL_FRAME_MODELING', 'Моделировка металлического каркаса', 'Моделировка металлического каркаса', 23, '#7C3AED', '2026-07-28 20:38:16.468295+00', '2026-07-28 20:38:16.468295+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('ad11998e-a2c8-5301-919c-132e52043db3', 'INDIVIDUAL_TRAY', 'Индивидуальная ложка', 'Изготовление индивидуальной ложки', 24, '#DB2777', '2026-07-28 20:38:16.468295+00', '2026-07-28 20:38:16.468295+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'BITE_RIMS', 'Валики', 'Изготовление прикусных валиков', 25, '#EA580C', '2026-07-28 20:38:16.468295+00', '2026-07-28 20:38:16.468295+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('0cbfd68a-119e-51a7-8de7-cf771932c973', 'TEETH_SETUP', 'Постановка', 'Постановка зубов', 26, '#D97706', '2026-07-28 20:38:16.468295+00', '2026-07-28 20:38:16.468295+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', 'PRESSING', 'Опрессовка', 'Опрессовка протеза', 27, '#65A30D', '2026-07-28 20:38:16.468295+00', '2026-07-28 20:38:16.468295+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('83978d62-7e41-5890-b6ea-472ce94d19f4', 'FINISHING_POLISHING', 'Обработка-полировка', 'Финишная обработка и полировка', 28, '#16A34A', '2026-07-28 20:38:16.468295+00', '2026-07-28 20:38:16.468295+00', false, false, false);
INSERT INTO public.t_order_statuses (id, code, name, description, sort_order, color_hex, created_at, updated_at, is_initial, is_terminal, is_review) VALUES ('93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'DENTURE_REPAIR_CORRECTION', 'Починка протеза / коррекция', 'Починка протеза и коррекция', 29, '#DC2626', '2026-07-28 20:38:16.468295+00', '2026-07-28 20:38:16.468295+00', false, false, false);


--
-- Data for Name: t_users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_users (id, email, name, phone, password_hash, status, created_at, updated_at, deleted_at, failed_login_attempts, locked_until, credentials_changed_at) VALUES ('40ff19dc-2944-5e7a-9d28-85942725f26d', 'admin@teethtech.kz', 'Алия Администратор', '+77010000001', '$2a$12$XW8peNso0SPa6XIufH.2AedB2Ln5bGioMcIU3M0AR3nQzkqxxBNgW', 'ACTIVE', '2026-07-28 20:38:15.614056+00', '2026-07-28 20:38:15.614056+00', NULL, 0, NULL, NULL);
INSERT INTO public.t_users (id, email, name, phone, password_hash, status, created_at, updated_at, deleted_at, failed_login_attempts, locked_until, credentials_changed_at) VALUES ('b4eb3dcd-35d8-51bb-b723-6507fe49272d', 'dispatcher@teethtech.kz', 'Диана Диспетчер', '+77010000002', '$2a$12$7Qd4RRsCRjzvb0FH4MjC4eRcuM9gbC/VZxbOO1QbG.Wlld/lkC58q', 'ACTIVE', '2026-07-28 20:38:15.614056+00', '2026-07-28 20:38:15.614056+00', NULL, 0, NULL, NULL);
INSERT INTO public.t_users (id, email, name, phone, password_hash, status, created_at, updated_at, deleted_at, failed_login_attempts, locked_until, credentials_changed_at) VALUES ('46443a23-7f84-5549-800a-f8bdb36759d0', 'plasterer@teethtech.kz', 'Галым Гипсовщик', '+77010000003', '$2a$12$gBjxvDValQLsXL7elccICOs1yDPdB6jEt31q.ResV6UTzt5/RLNae', 'ACTIVE', '2026-07-28 20:38:15.614056+00', '2026-07-28 20:38:15.614056+00', NULL, 0, NULL, NULL);
INSERT INTO public.t_users (id, email, name, phone, password_hash, status, created_at, updated_at, deleted_at, failed_login_attempts, locked_until, credentials_changed_at) VALUES ('795930cb-ee12-5c44-90ce-1c18fad09f99', 'scanner@teethtech.kz', 'Сауле Сканировщик', '+77010000004', '$2a$12$g7e5nQouoqtXPtDjugM3OummMgMghcngRh.sGdxlcDfZmTc85Yc3q', 'ACTIVE', '2026-07-28 20:38:15.614056+00', '2026-07-28 20:38:15.614056+00', NULL, 0, NULL, NULL);
INSERT INTO public.t_users (id, email, name, phone, password_hash, status, created_at, updated_at, deleted_at, failed_login_attempts, locked_until, credentials_changed_at) VALUES ('cfdf9c24-05b7-5030-874f-4a2684ceec35', 'operator@teethtech.kz', 'Олег CAD/CAM оператор', '+77010000005', '$2a$12$vfTpG91weOs7r1nhKBajHuc6rcAH9wMkE6dKlS54XKTirW1bBLXpC', 'ACTIVE', '2026-07-28 20:38:15.614056+00', '2026-07-28 20:38:15.614056+00', NULL, 0, NULL, NULL);
INSERT INTO public.t_users (id, email, name, phone, password_hash, status, created_at, updated_at, deleted_at, failed_login_attempts, locked_until, credentials_changed_at) VALUES ('e8e208d1-c8c7-5386-98d7-f072578247d4', 'ceramist@teethtech.kz', 'Камила Керамист', '+77010000006', '$2a$12$nJc16FXmaVCyDh94f6vbZOYyyFhi/aY9lwBcaRHmw00fZTbyIJQba', 'ACTIVE', '2026-07-28 20:38:15.614056+00', '2026-07-28 20:38:15.614056+00', NULL, 0, NULL, NULL);
INSERT INTO public.t_users (id, email, name, phone, password_hash, status, created_at, updated_at, deleted_at, failed_login_attempts, locked_until, credentials_changed_at) VALUES ('eae4e028-8fd7-50b2-b932-75c4e6362378', 'prosthetist@teethtech.kz', 'Павел Протезист', '+77010000007', '$2a$12$pI9eUi2V22kYqXzxPqbtX.ndysnf9xRzpODF0DSR9hnl7gcnPK2lO', 'ACTIVE', '2026-07-28 20:38:15.614056+00', '2026-07-28 20:38:15.614056+00', NULL, 0, NULL, NULL);
INSERT INTO public.t_users (id, email, name, phone, password_hash, status, created_at, updated_at, deleted_at, failed_login_attempts, locked_until, credentials_changed_at) VALUES ('9363f90f-9f8d-5a9c-be60-769a9220df31', 'financier@teethtech.kz', 'Фарида Финансист', '+77010000008', '$2a$12$u2r1D7BKoSFz4KrBhYTqqemqbcfTqVDof2dK37s.a5GRRjPeHj4mq', 'ACTIVE', '2026-07-28 20:38:15.614056+00', '2026-07-28 20:38:15.614056+00', NULL, 0, NULL, NULL);
INSERT INTO public.t_users (id, email, name, phone, password_hash, status, created_at, updated_at, deleted_at, failed_login_attempts, locked_until, credentials_changed_at) VALUES ('080bce6a-9b69-5c88-a992-d8c6370ea1b2', 'ceramist2@teethtech.kz', 'Мария Керамист', '+77010000009', '$2a$12$6Qy27W1.oo4HtaarIIVGceV4HVVBbyoJTfuOGlC6GwrKUuSteZZSS', 'BUSY', '2026-07-28 20:38:15.614056+00', '2026-07-28 20:38:15.614056+00', NULL, 0, NULL, NULL);


--
-- Data for Name: t_orders; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_orders (id, order_number, patient_card_id, doctor_card_id, deadline, completed_at, cad_cam_operator_id, comment, is_active, total_amount, paid_amount, created_at, updated_at, deleted_at) VALUES ('826e9a85-d55e-56d7-979e-c4e980e24aff', 'TT-UI-001', '163a24c5-8098-5a6c-b295-c5ee3d04179d', 'c985d4b4-ea10-509e-865f-fa664d2071f6', '2026-07-30', NULL, 'cfdf9c24-05b7-5030-874f-4a2684ceec35', 'Срочно. Циркониевая коронка, оттенок A2', true, 45000.00, 20000.00, '2026-07-26 20:38:15.627036+00', '2026-07-28 20:38:15.627036+00', NULL);
INSERT INTO public.t_orders (id, order_number, patient_card_id, doctor_card_id, deadline, completed_at, cad_cam_operator_id, comment, is_active, total_amount, paid_amount, created_at, updated_at, deleted_at) VALUES ('2b39c49c-517e-5c47-822d-8e97623ac746', 'TT-UI-002', '86b00b26-0728-5e09-b57a-a824edaba05a', 'c985d4b4-ea10-509e-865f-fa664d2071f6', '2026-08-04', NULL, 'cfdf9c24-05b7-5030-874f-4a2684ceec35', 'Металлокерамический мост, примерка каркаса', true, 120000.00, 60000.00, '2026-07-23 20:38:15.627036+00', '2026-07-28 20:38:15.627036+00', NULL);
INSERT INTO public.t_orders (id, order_number, patient_card_id, doctor_card_id, deadline, completed_at, cad_cam_operator_id, comment, is_active, total_amount, paid_amount, created_at, updated_at, deleted_at) VALUES ('43ae1bc0-4b32-5a1b-86bd-a6303ebdae2a', 'TT-UI-003', 'a2dc1888-c8bc-5540-ba0f-ec50a520c024', '84a4ed36-ee29-579a-ada9-62be00ebbf56', '2026-08-07', NULL, NULL, 'Полный съемный протез верхней челюсти', true, 95000.00, 0.00, '2026-07-27 20:38:15.627036+00', '2026-07-28 20:38:15.627036+00', NULL);
INSERT INTO public.t_orders (id, order_number, patient_card_id, doctor_card_id, deadline, completed_at, cad_cam_operator_id, comment, is_active, total_amount, paid_amount, created_at, updated_at, deleted_at) VALUES ('cb533aa4-9912-5989-950f-8a9f2c952e36', 'TT-UI-004', '00269cbb-67b1-5338-8d40-755c6cd57135', '84a4ed36-ee29-579a-ada9-62be00ebbf56', '2026-07-27', NULL, 'cfdf9c24-05b7-5030-874f-4a2684ceec35', 'Просроченная задача для проверки индикаторов', true, 70000.00, 35000.00, '2026-07-19 20:38:15.627036+00', '2026-07-28 20:38:15.627036+00', NULL);
INSERT INTO public.t_orders (id, order_number, patient_card_id, doctor_card_id, deadline, completed_at, cad_cam_operator_id, comment, is_active, total_amount, paid_amount, created_at, updated_at, deleted_at) VALUES ('46f6624e-5afd-564f-bc66-ed24aa7f60cb', 'TT-UI-005', '60194cf2-4cc2-58d6-b643-0717e2f0aeb4', 'c55c3cba-e02b-52da-94ef-19db13b5bd6c', '2026-07-23', '2026-07-25 20:38:15.627036+00', 'cfdf9c24-05b7-5030-874f-4a2684ceec35', 'Завершенный заказ для аналитики', false, 55000.00, 55000.00, '2026-07-13 20:38:15.627036+00', '2026-07-28 20:38:15.627036+00', NULL);
INSERT INTO public.t_orders (id, order_number, patient_card_id, doctor_card_id, deadline, completed_at, cad_cam_operator_id, comment, is_active, total_amount, paid_amount, created_at, updated_at, deleted_at) VALUES ('7b4c1f89-8e1e-5de9-a244-d8532afdd2f3', 'TT-UI-006', '163a24c5-8098-5a6c-b295-c5ee3d04179d', 'c985d4b4-ea10-509e-865f-fa664d2071f6', '2026-08-11', NULL, 'cfdf9c24-05b7-5030-874f-4a2684ceec35', 'Временные PMMA коронки', true, 30000.00, 0.00, '2026-07-28 20:38:15.627036+00', '2026-07-28 20:38:15.627036+00', NULL);


--
-- Data for Name: t_salary_payment_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_salary_payment_types (code, name, description, includes_base_salary, includes_piecework, is_active) VALUES ('FIXED', 'Оклад', NULL, true, false, true);
INSERT INTO public.t_salary_payment_types (code, name, description, includes_base_salary, includes_piecework, is_active) VALUES ('PIECEWORK', 'Сдельная оплата', NULL, false, true, true);
INSERT INTO public.t_salary_payment_types (code, name, description, includes_base_salary, includes_piecework, is_active) VALUES ('HYBRID', 'Оклад и сдельная оплата', NULL, true, true, true);


--
-- Data for Name: t_salary_plans; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_salary_plans (id, user_id, name, base_salary, monthly_cap, cap_mode, carry_forward, active, effective_from, effective_to, created_at, updated_at, deleted_at) VALUES ('22267914-627b-4239-8fa8-635a1af967e3', '46443a23-7f84-5549-800a-f8bdb36759d0', 'Основной план', 280000.00, NULL, 'TOTAL', true, true, '2026-07-28', NULL, '2026-07-28 20:38:16.580523+00', '2026-07-28 20:38:16.580523+00', NULL);
INSERT INTO public.t_salary_plans (id, user_id, name, base_salary, monthly_cap, cap_mode, carry_forward, active, effective_from, effective_to, created_at, updated_at, deleted_at) VALUES ('95f3aa53-23ba-48c8-af0f-e3ec6756b1d4', '795930cb-ee12-5c44-90ce-1c18fad09f99', 'Основной план', 300000.00, NULL, 'TOTAL', true, true, '2026-07-28', NULL, '2026-07-28 20:38:16.580523+00', '2026-07-28 20:38:16.580523+00', NULL);
INSERT INTO public.t_salary_plans (id, user_id, name, base_salary, monthly_cap, cap_mode, carry_forward, active, effective_from, effective_to, created_at, updated_at, deleted_at) VALUES ('213e4b9a-0105-42f8-9a0f-1be23461eee7', 'cfdf9c24-05b7-5030-874f-4a2684ceec35', 'Основной план', 220000.00, NULL, 'TOTAL', true, true, '2026-07-28', NULL, '2026-07-28 20:38:16.580523+00', '2026-07-28 20:38:16.580523+00', NULL);
INSERT INTO public.t_salary_plans (id, user_id, name, base_salary, monthly_cap, cap_mode, carry_forward, active, effective_from, effective_to, created_at, updated_at, deleted_at) VALUES ('0de87a64-055f-488e-a802-05c1d0a65976', 'e8e208d1-c8c7-5386-98d7-f072578247d4', 'Основной план', 0.00, NULL, 'TOTAL', true, true, '2026-07-28', NULL, '2026-07-28 20:38:16.580523+00', '2026-07-28 20:38:16.580523+00', NULL);
INSERT INTO public.t_salary_plans (id, user_id, name, base_salary, monthly_cap, cap_mode, carry_forward, active, effective_from, effective_to, created_at, updated_at, deleted_at) VALUES ('a25fba8e-6491-4943-94c6-c6a3da10089a', '080bce6a-9b69-5c88-a992-d8c6370ea1b2', 'Основной план', 0.00, NULL, 'TOTAL', true, true, '2026-07-28', NULL, '2026-07-28 20:38:16.580523+00', '2026-07-28 20:38:16.580523+00', NULL);
INSERT INTO public.t_salary_plans (id, user_id, name, base_salary, monthly_cap, cap_mode, carry_forward, active, effective_from, effective_to, created_at, updated_at, deleted_at) VALUES ('23497ad2-d923-444f-999f-1df46839951b', 'eae4e028-8fd7-50b2-b932-75c4e6362378', 'Основной план', 200000.00, NULL, 'TOTAL', true, true, '2026-07-28', NULL, '2026-07-28 20:38:16.580523+00', '2026-07-28 20:38:16.580523+00', NULL);


--
-- Data for Name: t_salary_statement_statuses; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_salary_statement_statuses (code, name, description, is_initial, marks_paid, is_terminal, is_deletable, is_active) VALUES ('DRAFT', 'Черновик', NULL, true, false, false, true, true);
INSERT INTO public.t_salary_statement_statuses (code, name, description, is_initial, marks_paid, is_terminal, is_deletable, is_active) VALUES ('PAID', 'Оплачено', NULL, false, true, true, false, true);
INSERT INTO public.t_salary_statement_statuses (code, name, description, is_initial, marks_paid, is_terminal, is_deletable, is_active) VALUES ('CANCELLED', 'Отменено', NULL, false, false, true, true, true);


--
-- Data for Name: t_salary_statements; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_salary_statements (id, employee_id, start_date, end_date, payment_type, base_salary_amount, piecework_amount, total_amount, total_tasks_count, status, paid_at, comment, created_at, updated_at, deleted_at, gross_accrued_amount, carry_in_amount, carry_out_amount, monthly_cap_snapshot, plan_id) VALUES ('866b4a11-7c95-5513-8577-4bc7449544a5', '080bce6a-9b69-5c88-a992-d8c6370ea1b2', '2026-06-01 00:00:00+00', '2026-06-30 23:59:59+00', 'PIECEWORK', 0.00, 9900.00, 9900.00, 1, 'PAID', '2026-07-26 20:38:15.633479+00', 'Демо-выплата за завершенную работу', '2026-07-28 20:38:15.633479+00', NULL, NULL, 0.00, 0.00, 0.00, NULL, NULL);
INSERT INTO public.t_salary_statements (id, employee_id, start_date, end_date, payment_type, base_salary_amount, piecework_amount, total_amount, total_tasks_count, status, paid_at, comment, created_at, updated_at, deleted_at, gross_accrued_amount, carry_in_amount, carry_out_amount, monthly_cap_snapshot, plan_id) VALUES ('425bc7cf-9cb4-5f9c-ba75-ac2622ccea07', 'cfdf9c24-05b7-5030-874f-4a2684ceec35', '2026-07-01 00:00:00+00', '2026-07-28 20:38:15.633479+00', 'HYBRID', 220000.00, 3600.00, 223600.00, 1, 'DRAFT', NULL, 'Черновик текущего месяца', '2026-07-28 20:38:15.633479+00', NULL, NULL, 0.00, 0.00, 0.00, NULL, NULL);


--
-- Data for Name: t_work_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('5f45d16e-94b7-5b15-92f5-c6f8b57c9abf', 'Физический слепок', 'PHYSICAL', 'Полный цикл: гипсовка, сканирование, CAD/CAM и керамика', true, '2026-07-28 20:38:15.617597+00', '2026-07-28 20:38:15.617597+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('67a05ce9-b4ad-5a9c-8768-c0087da0eb38', 'Цифровой слепок', 'ELECTRONIC', 'Цифровой цикл без гипсовки и сканирования модели', true, '2026-07-28 20:38:15.617597+00', '2026-07-28 20:38:15.617597+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('c79a95c1-190d-5f5e-af49-4cf791885069', 'Съемный протез', 'PROSTHETIC', 'Цикл изготовления съемных и бюгельных протезов', true, '2026-07-28 20:38:15.617597+00', '2026-07-28 20:38:15.617597+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('5a305223-10e3-5fc5-b068-43b4fd713e67', 'Съемный протез акриловый', 'REMOVABLE_ACRYLIC_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('301c5f4b-af09-55fc-9c63-cf11b4fbb20d', 'Съемный протез Титан акрил', 'REMOVABLE_TITANIUM_ACRYLIC_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('285b765e-70fc-59fc-abf7-3bf195c47408', 'Съемный протез Нейлон', 'REMOVABLE_NYLON_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('e4db8784-1b8e-5095-ad84-837357235df5', 'Съемный протез Валпласт', 'REMOVABLE_VALPLAST_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('3b738b35-9ae6-5e87-b7c3-9c4f16a78c1c', 'Съемный протез Термобель', 'REMOVABLE_THERMOBEL_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('56f63db9-1776-57b9-990f-b39689b47446', 'Съемный протез Кондор', 'REMOVABLE_CONDOR_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('6e2a63e9-0243-57ce-bc59-e01db07909f1', 'Условносъемный протез на импланте', 'IMPLANT_SUPPORTED_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('c60ee0ed-71b5-5109-9e41-5a589e648363', 'Условносъемный протез на балке', 'BAR_SUPPORTED_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('832a253a-6f1b-5080-a27b-23c0adb0a438', 'Временный протез на балке', 'TEMPORARY_BAR_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('0cc05984-ddd3-5bdb-a91d-6f645b535d27', 'Временный протез на ребрах', 'TEMPORARY_RIB_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('c65cb61f-80bc-5248-8e3d-9b5a25158936', 'Временный протез на импланте', 'TEMPORARY_IMPLANT_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('417e9551-c86b-5b4a-b15d-eed6357f6a49', 'Микропротез Акриловый', 'ACRYLIC_MICRO_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('557259f6-4b21-5836-9809-f34d7356f34e', 'Микропротез Валпласт', 'VALPLAST_MICRO_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('72efb4dc-bba1-5cf1-b1a3-ea8c034462ae', 'Микропротез Термобель', 'THERMOBEL_MICRO_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);
INSERT INTO public.t_work_types (id, name, code, description, is_active, created_at, updated_at, deleted_at) VALUES ('ab6ea790-326c-55b0-a56f-5b1eda349bd3', 'Микропротез Нейлоновый', 'NYLON_MICRO_DENTURE', 'Стандартный производственный маршрут съемного протезирования', true, '2026-07-28 20:38:16.470591+00', '2026-07-28 20:38:16.470591+00', NULL);


--
-- Data for Name: t_order_tasks; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_order_tasks (id, status_id, order_id, work_type_id, quantity, color_id, price_per_unit, dental_technician_id, assignment_mode, salary_statement_id, discount_percent, created_at, updated_at, deleted_at, salary_earned_amount, materials_finalized_at) VALUES ('8aa0238b-f2f8-53c5-a227-165ae5cb65c5', 'e08ce645-23d7-59b5-830c-8a5946b8a4e8', '826e9a85-d55e-56d7-979e-c4e980e24aff', '67a05ce9-b4ad-5a9c-8768-c0087da0eb38', 1, '3dcb04b6-4090-4100-a9cd-589c155f07c2', 45000.00, 'cfdf9c24-05b7-5030-874f-4a2684ceec35', 'PREASSIGNED', NULL, 0.00, '2026-07-28 20:38:15.628197+00', '2026-07-28 20:38:15.628197+00', NULL, NULL, NULL);
INSERT INTO public.t_order_tasks (id, status_id, order_id, work_type_id, quantity, color_id, price_per_unit, dental_technician_id, assignment_mode, salary_statement_id, discount_percent, created_at, updated_at, deleted_at, salary_earned_amount, materials_finalized_at) VALUES ('83d11f6d-9f7d-53ef-9d0e-28f78ac51cd8', '0b8741cd-cd21-5d1d-8b71-4bece984e0cf', '2b39c49c-517e-5c47-822d-8e97623ac746', '5f45d16e-94b7-5b15-92f5-c6f8b57c9abf', 3, '7dc98be8-acb6-42f7-b24d-44e65327522a', 40000.00, 'e8e208d1-c8c7-5386-98d7-f072578247d4', 'AUTO', NULL, 0.00, '2026-07-28 20:38:15.628197+00', '2026-07-28 20:38:15.628197+00', NULL, NULL, NULL);
INSERT INTO public.t_order_tasks (id, status_id, order_id, work_type_id, quantity, color_id, price_per_unit, dental_technician_id, assignment_mode, salary_statement_id, discount_percent, created_at, updated_at, deleted_at, salary_earned_amount, materials_finalized_at) VALUES ('8af1ccea-5c10-5697-854e-a29b5159b2c2', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', '43ae1bc0-4b32-5a1b-86bd-a6303ebdae2a', 'c79a95c1-190d-5f5e-af49-4cf791885069', 1, '3dcb04b6-4090-4100-a9cd-589c155f07c2', 95000.00, '46443a23-7f84-5549-800a-f8bdb36759d0', 'AUTO', NULL, 0.00, '2026-07-28 20:38:15.628197+00', '2026-07-28 20:38:15.628197+00', NULL, NULL, NULL);
INSERT INTO public.t_order_tasks (id, status_id, order_id, work_type_id, quantity, color_id, price_per_unit, dental_technician_id, assignment_mode, salary_statement_id, discount_percent, created_at, updated_at, deleted_at, salary_earned_amount, materials_finalized_at) VALUES ('5611b7c0-89b3-5603-b848-5a73d5d88d9e', '49afbf34-3d65-5a70-ad9a-20ff2cdb7302', 'cb533aa4-9912-5989-950f-8a9f2c952e36', '67a05ce9-b4ad-5a9c-8768-c0087da0eb38', 2, '7d71820b-3e60-423d-b24a-373327107be8', 35000.00, 'b4eb3dcd-35d8-51bb-b723-6507fe49272d', 'AUTO', NULL, 0.00, '2026-07-28 20:38:15.628197+00', '2026-07-28 20:38:15.83502+00', NULL, NULL, NULL);
INSERT INTO public.t_order_tasks (id, status_id, order_id, work_type_id, quantity, color_id, price_per_unit, dental_technician_id, assignment_mode, salary_statement_id, discount_percent, created_at, updated_at, deleted_at, salary_earned_amount, materials_finalized_at) VALUES ('2a92dc17-e869-5990-858c-8a13f0400f63', 'ca61343e-44a7-514b-9eba-beb0ac245308', '7b4c1f89-8e1e-5de9-a244-d8532afdd2f3', '67a05ce9-b4ad-5a9c-8768-c0087da0eb38', 3, '2916f443-2b00-413f-b9fe-af25a364f718', 10000.00, 'b4eb3dcd-35d8-51bb-b723-6507fe49272d', 'PREASSIGNED', NULL, 0.00, '2026-07-28 20:38:15.628197+00', '2026-07-28 20:38:15.83502+00', NULL, NULL, NULL);
INSERT INTO public.t_order_tasks (id, status_id, order_id, work_type_id, quantity, color_id, price_per_unit, dental_technician_id, assignment_mode, salary_statement_id, discount_percent, created_at, updated_at, deleted_at, salary_earned_amount, materials_finalized_at) VALUES ('56961ac7-5aaf-5907-b15f-0bce41716396', '699331e5-8a22-593d-b6c5-6244abb077d2', '46f6624e-5afd-564f-bc66-ed24aa7f60cb', '5f45d16e-94b7-5b15-92f5-c6f8b57c9abf', 1, '8c1eef9f-92f8-4fb5-a058-b92b3beab4c2', 55000.00, '080bce6a-9b69-5c88-a992-d8c6370ea1b2', 'AUTO', '866b4a11-7c95-5513-8577-4bc7449544a5', 0.00, '2026-07-28 20:38:15.628197+00', '2026-07-28 20:38:15.628197+00', NULL, NULL, '2026-07-28 20:38:15.628197+00');


--
-- Data for Name: attachments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_business_audit_events; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_chat_conversations; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_chat_attachments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_chat_participants; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_finance_periods; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_incoming_request_statuses; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_incoming_request_statuses (code, name, is_initial, is_in_review, is_accepted, is_rejected, is_terminal, is_active) VALUES ('NEW', 'Новая', true, false, false, false, false, true);
INSERT INTO public.t_incoming_request_statuses (code, name, is_initial, is_in_review, is_accepted, is_rejected, is_terminal, is_active) VALUES ('IN_REVIEW', 'На рассмотрении', false, true, false, false, false, true);
INSERT INTO public.t_incoming_request_statuses (code, name, is_initial, is_in_review, is_accepted, is_rejected, is_terminal, is_active) VALUES ('ACCEPTED', 'Принята', false, false, true, false, true, true);
INSERT INTO public.t_incoming_request_statuses (code, name, is_initial, is_in_review, is_accepted, is_rejected, is_terminal, is_active) VALUES ('REJECTED', 'Отклонена', false, false, false, true, true, true);


--
-- Data for Name: t_integration_sources; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_integration_sources (code, name, is_active) VALUES ('TELEGRAM', 'Telegram', true);
INSERT INTO public.t_integration_sources (code, name, is_active) VALUES ('INSTAGRAM', 'Instagram', true);
INSERT INTO public.t_integration_sources (code, name, is_active) VALUES ('WHATSAPP', 'WhatsApp', true);
INSERT INTO public.t_integration_sources (code, name, is_active) VALUES ('WEBSITE', 'Сайт', true);
INSERT INTO public.t_integration_sources (code, name, is_active) VALUES ('MANUAL', 'Ручной ввод', true);


--
-- Data for Name: t_incoming_requests; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_integration_api_keys; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_inventory_status_rules; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_inventory_status_rules (code, name, is_initial, locks_warehouse, allows_counting, marks_completed, marks_cancelled, is_terminal, is_active) VALUES ('DRAFT', 'Черновик', true, false, false, false, false, false, true);
INSERT INTO public.t_inventory_status_rules (code, name, is_initial, locks_warehouse, allows_counting, marks_completed, marks_cancelled, is_terminal, is_active) VALUES ('IN_PROGRESS', 'В процессе', false, true, true, false, false, false, true);
INSERT INTO public.t_inventory_status_rules (code, name, is_initial, locks_warehouse, allows_counting, marks_completed, marks_cancelled, is_terminal, is_active) VALUES ('COMPLETED', 'Завершено', false, false, false, true, false, true, true);
INSERT INTO public.t_inventory_status_rules (code, name, is_initial, locks_warehouse, allows_counting, marks_completed, marks_cancelled, is_terminal, is_active) VALUES ('CANCELLED', 'Отменено', false, false, false, false, true, true, true);


--
-- Data for Name: t_inventory_check; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_inventory_check (id, status, started_at, completed_at, created_by_user_id, comment, created_at, updated_at) VALUES ('6214c8ec-bc37-5f01-b428-1dc7879801d5', 'COMPLETED', '2026-07-20 20:38:15.634555+00', '2026-07-20 22:38:15.634555+00', '40ff19dc-2944-5e7a-9d28-85942725f26d', 'Плановая демонстрационная инвентаризация', '2026-07-20 20:38:15.634555+00', '2026-07-28 20:38:15.634555+00');


--
-- Data for Name: t_nomenclature; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('338dd44c-12f1-57d9-8a49-c0c3426a437a', 'MAT-ZR-DISC', 'Диск диоксида циркония 98 мм', 'шт', 5.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('d7b58fb2-50f9-5dce-bc21-b087a14980ea', 'MAT-COCR', 'Сплав кобальт-хромовый', 'г', 500.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('70a09d0f-62ab-5abd-abdd-7d533b9652c8', 'MAT-CER-POW', 'Керамическая масса', 'г', 200.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('03809ab4-37cf-5ec3-953a-1913c88ef7d2', 'MAT-PMMA', 'PMMA диск 98 мм', 'шт', 5.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('e6762e04-e4fc-5fa6-a035-d297bc7e235d', 'MAT-ACRYLIC', 'Акрил базисный', 'г', 500.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('1e8ba5c2-27e2-5d6f-ae44-9b7113b1e032', 'MAT-NYLON', 'Нейлон термопластичный', 'г', 300.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('566d7f4c-7291-5dbb-b08e-e73393f6b4c4', 'MAT-WAX', 'Воск моделировочный', 'г', 200.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('4a9a06e7-6194-522c-9419-b696a037a6bb', 'MAT-TI-BASE', 'Титановое основание', 'шт', 10.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('91c2652f-e513-526c-aa6f-421dd87bf397', 'CON-GLOVES-M', 'Перчатки нитриловые M', 'пар', 50.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('e35573e9-5458-54b0-8127-0d925f668622', 'CON-MASK', 'Маска медицинская', 'шт', 50.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('e6a1869c-7e8d-5d60-aacc-0e8045a9d219', 'CON-GYPSUM-4', 'Гипс стоматологический IV класса', 'кг', 10.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('107d8712-2c09-56dc-9759-a19e72a032d3', 'CON-SILICONE', 'Силикон дублировочный', 'мл', 500.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('897b8ea8-c66d-558f-894d-764a1b05e8fb', 'CON-SEPARATOR', 'Изолирующая жидкость', 'мл', 250.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('782a4a22-51e9-555a-ab9f-5ca36fec16e4', 'CON-BUR-SET', 'Фрезы CAD/CAM комплект', 'компл', 2.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('d06d3bed-6ea8-5c0c-a9b5-dbc4f5f9a83f', 'CON-CUT-DISC', 'Диск отрезной', 'шт', 20.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('4fb491e0-ca25-5aea-bfb1-68556990356d', 'CON-BRUSH', 'Кисть керамиста', 'шт', 5.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('b278c2a5-2755-5c9b-bbc7-0b678fd0d29f', 'CON-POLISH', 'Паста полировочная', 'мл', 100.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('d1535830-afab-5ff3-a992-8417c24f5549', 'CON-STAINS', 'Красители и глазурь, набор', 'компл', 2.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('d31f6f33-c2aa-53c2-b70c-990a26080ea4', 'CON-ARTIC', 'Артикуляционная бумага', 'уп', 5.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');
INSERT INTO public.t_nomenclature (id, code, name, unit, min_stock_level, active, deleted_at, created_at, updated_at) VALUES ('7373770f-9eb6-5f5e-a0e9-cf7f0eaa483e', 'CON-PACK', 'Пакет для готовой работы', 'шт', 50.0000, true, NULL, '2026-07-28 20:38:15.620296+00', '2026-07-28 20:38:15.620296+00');


--
-- Data for Name: t_inventory_check_item; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_inventory_check_item (id, inventory_check_id, nomenclature_id, expected_quantity, actual_quantity, created_at, updated_at) VALUES ('e8f171af-c852-4fcd-9be8-e49f57b29445', '6214c8ec-bc37-5f01-b428-1dc7879801d5', '338dd44c-12f1-57d9-8a49-c0c3426a437a', 18.0000, 18.0000, '2026-07-28 20:38:15.635156+00', '2026-07-28 20:38:15.635156+00');
INSERT INTO public.t_inventory_check_item (id, inventory_check_id, nomenclature_id, expected_quantity, actual_quantity, created_at, updated_at) VALUES ('8491a7df-128a-4147-870a-e75c1e45de6e', '6214c8ec-bc37-5f01-b428-1dc7879801d5', 'e6a1869c-7e8d-5d60-aacc-0e8045a9d219', 45.0000, 44.5000, '2026-07-28 20:38:15.635156+00', '2026-07-28 20:38:15.635156+00');
INSERT INTO public.t_inventory_check_item (id, inventory_check_id, nomenclature_id, expected_quantity, actual_quantity, created_at, updated_at) VALUES ('1b793d85-2473-40b6-ab0f-aaf95ad7c4af', '6214c8ec-bc37-5f01-b428-1dc7879801d5', '782a4a22-51e9-555a-ab9f-5ca36fec16e4', 6.0000, 6.0000, '2026-07-28 20:38:15.635156+00', '2026-07-28 20:38:15.635156+00');


--
-- Data for Name: t_invoice_status_rules; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_invoice_status_rules (code, name, is_initial, is_issued, is_partial, is_paid, is_cancelled, active) VALUES ('DRAFT', 'Черновик', true, false, false, false, false, true);
INSERT INTO public.t_invoice_status_rules (code, name, is_initial, is_issued, is_partial, is_paid, is_cancelled, active) VALUES ('ISSUED', 'Выставлен', false, true, false, false, false, true);
INSERT INTO public.t_invoice_status_rules (code, name, is_initial, is_issued, is_partial, is_paid, is_cancelled, active) VALUES ('PARTIALLY_PAID', 'Частично оплачен', false, false, true, false, false, true);
INSERT INTO public.t_invoice_status_rules (code, name, is_initial, is_issued, is_partial, is_paid, is_cancelled, active) VALUES ('PAID', 'Оплачен', false, false, false, true, false, true);
INSERT INTO public.t_invoice_status_rules (code, name, is_initial, is_issued, is_partial, is_paid, is_cancelled, active) VALUES ('CANCELLED', 'Отменён', false, false, false, false, true, true);


--
-- Data for Name: t_invoices; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_payment_method_rules; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_payment_method_rules (code, name, active) VALUES ('CASH', 'Наличные', true);
INSERT INTO public.t_payment_method_rules (code, name, active) VALUES ('BANK_TRANSFER', 'Банковский перевод', true);
INSERT INTO public.t_payment_method_rules (code, name, active) VALUES ('CARD', 'Карта', true);


--
-- Data for Name: t_invoice_payments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_materials; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_materials (id, name, description, is_active, nomenclature_id, created_at, updated_at, deleted_at) VALUES ('2eeaf3fe-185e-5bff-b589-ade094ffa1e0', 'Диоксид циркония', 'Для циркониевых коронок, мостов и абатментов', true, '338dd44c-12f1-57d9-8a49-c0c3426a437a', '2026-07-28 20:38:15.620932+00', '2026-07-28 20:38:15.620932+00', NULL);
INSERT INTO public.t_materials (id, name, description, is_active, nomenclature_id, created_at, updated_at, deleted_at) VALUES ('69b53e62-95d9-54d0-8f97-648074031a83', 'Кобальт-хром', 'Сплав для металлокерамических конструкций', true, 'd7b58fb2-50f9-5dce-bc21-b087a14980ea', '2026-07-28 20:38:15.620932+00', '2026-07-28 20:38:15.620932+00', NULL);
INSERT INTO public.t_materials (id, name, description, is_active, nomenclature_id, created_at, updated_at, deleted_at) VALUES ('f0c13e87-d8c0-51eb-9c57-56d48d3c2e29', 'Керамика', 'Облицовочная керамическая масса', true, '70a09d0f-62ab-5abd-abdd-7d533b9652c8', '2026-07-28 20:38:15.620932+00', '2026-07-28 20:38:15.620932+00', NULL);
INSERT INTO public.t_materials (id, name, description, is_active, nomenclature_id, created_at, updated_at, deleted_at) VALUES ('36a7f3f9-e7c5-53e4-9c9e-fc107887d67a', 'PMMA', 'Временные коронки и мосты', true, '03809ab4-37cf-5ec3-953a-1913c88ef7d2', '2026-07-28 20:38:15.620932+00', '2026-07-28 20:38:15.620932+00', NULL);
INSERT INTO public.t_materials (id, name, description, is_active, nomenclature_id, created_at, updated_at, deleted_at) VALUES ('dad3b5ee-6dfc-5421-b712-f9ba64f7487a', 'Акрил', 'Базисы съемных протезов', true, 'e6762e04-e4fc-5fa6-a035-d297bc7e235d', '2026-07-28 20:38:15.620932+00', '2026-07-28 20:38:15.620932+00', NULL);
INSERT INTO public.t_materials (id, name, description, is_active, nomenclature_id, created_at, updated_at, deleted_at) VALUES ('21f4adbb-672d-502b-ad95-46b841e51356', 'Нейлон', 'Гибкие съемные протезы', true, '1e8ba5c2-27e2-5d6f-ae44-9b7113b1e032', '2026-07-28 20:38:15.620932+00', '2026-07-28 20:38:15.620932+00', NULL);
INSERT INTO public.t_materials (id, name, description, is_active, nomenclature_id, created_at, updated_at, deleted_at) VALUES ('a7c5df50-3ae6-5a4d-899a-3c1e2ed00ab4', 'Воск', 'Диагностическое и рабочее моделирование', true, '566d7f4c-7291-5dbb-b08e-e73393f6b4c4', '2026-07-28 20:38:15.620932+00', '2026-07-28 20:38:15.620932+00', NULL);
INSERT INTO public.t_materials (id, name, description, is_active, nomenclature_id, created_at, updated_at, deleted_at) VALUES ('ae44593b-a474-5667-9e00-d522668b6b50', 'Титановое основание', 'Работы на имплантах', true, '4a9a06e7-6194-522c-9419-b696a037a6bb', '2026-07-28 20:38:15.620932+00', '2026-07-28 20:38:15.620932+00', NULL);


--
-- Data for Name: t_nomenclature_consumption_norms; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_nomenclature_consumption_norms (id, work_type_id, material_id, nomenclature_id, norm_quantity, created_at, updated_at, deleted_at, waste_percent) VALUES ('e09c57df-dc54-438b-9a34-c56b19fed50a', '67a05ce9-b4ad-5a9c-8768-c0087da0eb38', '2eeaf3fe-185e-5bff-b589-ade094ffa1e0', '338dd44c-12f1-57d9-8a49-c0c3426a437a', 0.1500, '2026-07-28 20:38:15.624269+00', '2026-07-28 20:38:15.624269+00', NULL, 0.00);
INSERT INTO public.t_nomenclature_consumption_norms (id, work_type_id, material_id, nomenclature_id, norm_quantity, created_at, updated_at, deleted_at, waste_percent) VALUES ('fc4fbf70-1bc0-4d2f-800b-2ead72ccf7fd', '5f45d16e-94b7-5b15-92f5-c6f8b57c9abf', '69b53e62-95d9-54d0-8f97-648074031a83', 'd7b58fb2-50f9-5dce-bc21-b087a14980ea', 12.0000, '2026-07-28 20:38:15.624269+00', '2026-07-28 20:38:15.624269+00', NULL, 0.00);
INSERT INTO public.t_nomenclature_consumption_norms (id, work_type_id, material_id, nomenclature_id, norm_quantity, created_at, updated_at, deleted_at, waste_percent) VALUES ('4b108ddd-20ff-4553-b3e3-cd68aad5afb2', '5f45d16e-94b7-5b15-92f5-c6f8b57c9abf', 'f0c13e87-d8c0-51eb-9c57-56d48d3c2e29', '70a09d0f-62ab-5abd-abdd-7d533b9652c8', 8.0000, '2026-07-28 20:38:15.624269+00', '2026-07-28 20:38:15.624269+00', NULL, 0.00);
INSERT INTO public.t_nomenclature_consumption_norms (id, work_type_id, material_id, nomenclature_id, norm_quantity, created_at, updated_at, deleted_at, waste_percent) VALUES ('aa31855c-8123-4004-9928-8d37d6cb2ffd', '67a05ce9-b4ad-5a9c-8768-c0087da0eb38', '36a7f3f9-e7c5-53e4-9c9e-fc107887d67a', '03809ab4-37cf-5ec3-953a-1913c88ef7d2', 0.1200, '2026-07-28 20:38:15.624269+00', '2026-07-28 20:38:15.624269+00', NULL, 0.00);
INSERT INTO public.t_nomenclature_consumption_norms (id, work_type_id, material_id, nomenclature_id, norm_quantity, created_at, updated_at, deleted_at, waste_percent) VALUES ('15f93d41-e5af-471f-a383-d1aa92fdef59', 'c79a95c1-190d-5f5e-af49-4cf791885069', 'dad3b5ee-6dfc-5421-b712-f9ba64f7487a', 'e6762e04-e4fc-5fa6-a035-d297bc7e235d', 80.0000, '2026-07-28 20:38:15.624269+00', '2026-07-28 20:38:15.624269+00', NULL, 0.00);
INSERT INTO public.t_nomenclature_consumption_norms (id, work_type_id, material_id, nomenclature_id, norm_quantity, created_at, updated_at, deleted_at, waste_percent) VALUES ('cea84466-a8e5-4173-9945-c59b99cc731f', 'c79a95c1-190d-5f5e-af49-4cf791885069', '21f4adbb-672d-502b-ad95-46b841e51356', '1e8ba5c2-27e2-5d6f-ae44-9b7113b1e032', 75.0000, '2026-07-28 20:38:15.624269+00', '2026-07-28 20:38:15.624269+00', NULL, 0.00);
INSERT INTO public.t_nomenclature_consumption_norms (id, work_type_id, material_id, nomenclature_id, norm_quantity, created_at, updated_at, deleted_at, waste_percent) VALUES ('69098dd0-cd9d-4c68-bcdd-5e36d43e1940', 'c79a95c1-190d-5f5e-af49-4cf791885069', 'a7c5df50-3ae6-5a4d-899a-3c1e2ed00ab4', '566d7f4c-7291-5dbb-b08e-e73393f6b4c4', 25.0000, '2026-07-28 20:38:15.624269+00', '2026-07-28 20:38:15.624269+00', NULL, 0.00);
INSERT INTO public.t_nomenclature_consumption_norms (id, work_type_id, material_id, nomenclature_id, norm_quantity, created_at, updated_at, deleted_at, waste_percent) VALUES ('7fa21afc-c879-4ab2-b0de-b44c8bf66339', '67a05ce9-b4ad-5a9c-8768-c0087da0eb38', 'ae44593b-a474-5667-9e00-d522668b6b50', '4a9a06e7-6194-522c-9419-b696a037a6bb', 1.0000, '2026-07-28 20:38:15.624269+00', '2026-07-28 20:38:15.624269+00', NULL, 0.00);


--
-- Data for Name: t_notification_preferences; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_notifications; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_order_task_history; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_order_task_history (id, task_id, changed_by, field_name, old_value, new_value, comment, changed_at, created_at, updated_at) VALUES ('96292819-eef5-45c4-b4a1-aab472cec9b2', '8aa0238b-f2f8-53c5-a227-165ae5cb65c5', 'b4eb3dcd-35d8-51bb-b723-6507fe49272d', 'STATUS', 'TODO', 'MODELING', 'Цифровой слепок принят', '2026-07-27 20:38:15.631432+00', '2026-07-28 20:38:15.631432+00', '2026-07-28 20:38:15.631432+00');
INSERT INTO public.t_order_task_history (id, task_id, changed_by, field_name, old_value, new_value, comment, changed_at, created_at, updated_at) VALUES ('8b58774f-b900-4083-a456-168957f320ca', '83d11f6d-9f7d-53ef-9d0e-28f78ac51cd8', 'cfdf9c24-05b7-5030-874f-4a2684ceec35', 'STATUS', 'MODELING', 'CERAMICS', 'Каркас готов', '2026-07-26 20:38:15.631432+00', '2026-07-28 20:38:15.631432+00', '2026-07-28 20:38:15.631432+00');
INSERT INTO public.t_order_task_history (id, task_id, changed_by, field_name, old_value, new_value, comment, changed_at, created_at, updated_at) VALUES ('922fa06f-ee07-40e5-9c11-9a03f46d6a56', '56961ac7-5aaf-5907-b15f-0bce41716396', 'b4eb3dcd-35d8-51bb-b723-6507fe49272d', 'STATUS', 'WAITING_FOR_APPROVAL', 'ORDER_CLOSED', 'Контроль качества пройден', '2026-07-25 20:38:15.631432+00', '2026-07-28 20:38:15.631432+00', '2026-07-28 20:38:15.631432+00');


--
-- Data for Name: t_order_task_materials; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_order_task_materials (order_task_id, material_id) VALUES ('8aa0238b-f2f8-53c5-a227-165ae5cb65c5', '2eeaf3fe-185e-5bff-b589-ade094ffa1e0');
INSERT INTO public.t_order_task_materials (order_task_id, material_id) VALUES ('83d11f6d-9f7d-53ef-9d0e-28f78ac51cd8', 'f0c13e87-d8c0-51eb-9c57-56d48d3c2e29');
INSERT INTO public.t_order_task_materials (order_task_id, material_id) VALUES ('8af1ccea-5c10-5697-854e-a29b5159b2c2', 'dad3b5ee-6dfc-5421-b712-f9ba64f7487a');
INSERT INTO public.t_order_task_materials (order_task_id, material_id) VALUES ('5611b7c0-89b3-5603-b848-5a73d5d88d9e', '2eeaf3fe-185e-5bff-b589-ade094ffa1e0');
INSERT INTO public.t_order_task_materials (order_task_id, material_id) VALUES ('2a92dc17-e869-5990-858c-8a13f0400f63', '36a7f3f9-e7c5-53e4-9c9e-fc107887d67a');
INSERT INTO public.t_order_task_materials (order_task_id, material_id) VALUES ('56961ac7-5aaf-5907-b15f-0bce41716396', '69b53e62-95d9-54d0-8f97-648074031a83');


--
-- Data for Name: t_order_task_status_assignees; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_order_task_status_assignees (id, order_task_id, status_id, user_id, created_at, updated_at) VALUES ('48ad69fe-4084-4491-b381-134aac2f3412', '8aa0238b-f2f8-53c5-a227-165ae5cb65c5', 'e08ce645-23d7-59b5-830c-8a5946b8a4e8', 'cfdf9c24-05b7-5030-874f-4a2684ceec35', '2026-07-28 20:38:15.630479+00', '2026-07-28 20:38:15.837132+00');
INSERT INTO public.t_order_task_status_assignees (id, order_task_id, status_id, user_id, created_at, updated_at) VALUES ('41821cd0-bb2b-49ce-ac11-236b41521a89', '8aa0238b-f2f8-53c5-a227-165ae5cb65c5', '0b8741cd-cd21-5d1d-8b71-4bece984e0cf', 'e8e208d1-c8c7-5386-98d7-f072578247d4', '2026-07-28 20:38:15.630479+00', '2026-07-28 20:38:15.837132+00');
INSERT INTO public.t_order_task_status_assignees (id, order_task_id, status_id, user_id, created_at, updated_at) VALUES ('152bd890-9ac7-44ac-b2be-e0a236e3376a', '8aa0238b-f2f8-53c5-a227-165ae5cb65c5', '49afbf34-3d65-5a70-ad9a-20ff2cdb7302', 'b4eb3dcd-35d8-51bb-b723-6507fe49272d', '2026-07-28 20:38:15.630479+00', '2026-07-28 20:38:15.837132+00');
INSERT INTO public.t_order_task_status_assignees (id, order_task_id, status_id, user_id, created_at, updated_at) VALUES ('75c591f7-4d3d-461f-a8d7-05758d660a6e', '2a92dc17-e869-5990-858c-8a13f0400f63', 'e08ce645-23d7-59b5-830c-8a5946b8a4e8', 'cfdf9c24-05b7-5030-874f-4a2684ceec35', '2026-07-28 20:38:15.630479+00', '2026-07-28 20:38:15.837132+00');
INSERT INTO public.t_order_task_status_assignees (id, order_task_id, status_id, user_id, created_at, updated_at) VALUES ('c1d13c12-4a26-4d31-8be3-87c7e5703dc0', '2a92dc17-e869-5990-858c-8a13f0400f63', '0b8741cd-cd21-5d1d-8b71-4bece984e0cf', '080bce6a-9b69-5c88-a992-d8c6370ea1b2', '2026-07-28 20:38:15.630479+00', '2026-07-28 20:38:15.837132+00');
INSERT INTO public.t_order_task_status_assignees (id, order_task_id, status_id, user_id, created_at, updated_at) VALUES ('d00c464b-942f-4937-b57e-e6c7a40c9174', '2a92dc17-e869-5990-858c-8a13f0400f63', '49afbf34-3d65-5a70-ad9a-20ff2cdb7302', 'b4eb3dcd-35d8-51bb-b723-6507fe49272d', '2026-07-28 20:38:15.630479+00', '2026-07-28 20:38:15.837132+00');


--
-- Data for Name: t_order_task_teeth; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_order_task_teeth (order_task_id, tooth_number) VALUES ('8aa0238b-f2f8-53c5-a227-165ae5cb65c5', 16);
INSERT INTO public.t_order_task_teeth (order_task_id, tooth_number) VALUES ('83d11f6d-9f7d-53ef-9d0e-28f78ac51cd8', 11);
INSERT INTO public.t_order_task_teeth (order_task_id, tooth_number) VALUES ('83d11f6d-9f7d-53ef-9d0e-28f78ac51cd8', 12);
INSERT INTO public.t_order_task_teeth (order_task_id, tooth_number) VALUES ('83d11f6d-9f7d-53ef-9d0e-28f78ac51cd8', 13);
INSERT INTO public.t_order_task_teeth (order_task_id, tooth_number) VALUES ('5611b7c0-89b3-5603-b848-5a73d5d88d9e', 21);
INSERT INTO public.t_order_task_teeth (order_task_id, tooth_number) VALUES ('5611b7c0-89b3-5603-b848-5a73d5d88d9e', 22);
INSERT INTO public.t_order_task_teeth (order_task_id, tooth_number) VALUES ('2a92dc17-e869-5990-858c-8a13f0400f63', 14);
INSERT INTO public.t_order_task_teeth (order_task_id, tooth_number) VALUES ('2a92dc17-e869-5990-858c-8a13f0400f63', 15);
INSERT INTO public.t_order_task_teeth (order_task_id, tooth_number) VALUES ('2a92dc17-e869-5990-858c-8a13f0400f63', 16);


--
-- Data for Name: t_outbox_events; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_personal_notes; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_purchase_status_rules; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_purchase_status_rules (code, name, is_initial, is_ordered, is_partial, allows_receipt, is_complete, is_cancelled, active) VALUES ('DRAFT', 'Черновик', true, false, false, false, false, false, true);
INSERT INTO public.t_purchase_status_rules (code, name, is_initial, is_ordered, is_partial, allows_receipt, is_complete, is_cancelled, active) VALUES ('ORDERED', 'Заказан', false, true, false, true, false, false, true);
INSERT INTO public.t_purchase_status_rules (code, name, is_initial, is_ordered, is_partial, allows_receipt, is_complete, is_cancelled, active) VALUES ('PARTIALLY_RECEIVED', 'Частично принят', false, false, true, true, false, false, true);
INSERT INTO public.t_purchase_status_rules (code, name, is_initial, is_ordered, is_partial, allows_receipt, is_complete, is_cancelled, active) VALUES ('RECEIVED', 'Принят', false, false, false, false, true, false, true);
INSERT INTO public.t_purchase_status_rules (code, name, is_initial, is_ordered, is_partial, allows_receipt, is_complete, is_cancelled, active) VALUES ('CANCELLED', 'Отменён', false, false, false, false, false, true, true);


--
-- Data for Name: t_suppliers; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_purchase_orders; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_purchase_order_items; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_quality_incidents; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_refresh_sessions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('7453c55a-49dd-5e51-96e5-cbb644295c9d', 'ROLE_DISPATCHER', 'Диспетчер / регистратор заказов', true);
INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('bf0c84b7-3e49-5f2e-8871-427778df617e', 'ROLE_PLASTERER', 'Гипсовщик', true);
INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('ad20a1d9-64f1-55db-9590-a4e2eb30e2a9', 'ROLE_SCANNER', 'Сканировщик', true);
INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('388eae53-6b0c-5731-a356-93f476604f15', 'ROLE_OPERATOR', 'Оператор CAD/CAM', true);
INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('b87c987d-d4a4-56a9-8603-971f0ac0606c', 'ROLE_CERAMIST', 'Керамист', true);
INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('c40699f3-c755-5771-a165-03ae6ce87390', 'ROLE_PROSTHETIST', 'Протезист', true);
INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('d77db510-9e49-510c-bbf5-5af61bbdf619', 'ROLE_FINANCIER', 'Финансист / бухгалтер', true);
INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('c040dd67-bc47-5ce6-91bb-598d0c4e2ade', 'ROLE_ADMIN', 'Администратор лаборатории', true);
INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('d0b6960c-8061-5c94-b4da-5e0d45165f42', 'ROLE_STOREKEEPER', 'Кладовщик', true);
INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('0784a2bb-7362-5cb8-8d5e-e116f6534534', 'ROLE_WAREHOUSE_MANAGER', 'Руководитель склада', true);
INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('6cd78ff4-e09d-5fc0-a133-540ea04bae79', 'ROLE_CHIEF_TECHNICIAN', 'Главный техник', true);
INSERT INTO public.t_roles (id, code, description, system_managed) VALUES ('6e897f9a-2b59-515d-ae6d-9e36bd288da0', 'ROLE_HEAD_TECHNICIAN', 'Руководитель техников', true);


--
-- Data for Name: t_salary_stage_rules; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_salary_accruals; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_salary_configs; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_salary_configs (id, user_id, payment_type, base_salary, commission_percent, created_at, updated_at, deleted_at) VALUES ('dd128c37-9c54-49df-a802-db217ebd4690', '46443a23-7f84-5549-800a-f8bdb36759d0', 'FIXED', 280000.00, 0.00, '2026-07-28 20:38:15.632869+00', NULL, NULL);
INSERT INTO public.t_salary_configs (id, user_id, payment_type, base_salary, commission_percent, created_at, updated_at, deleted_at) VALUES ('7ab4388f-def4-498d-81f8-cae61a6dc570', '795930cb-ee12-5c44-90ce-1c18fad09f99', 'FIXED', 300000.00, 0.00, '2026-07-28 20:38:15.632869+00', NULL, NULL);
INSERT INTO public.t_salary_configs (id, user_id, payment_type, base_salary, commission_percent, created_at, updated_at, deleted_at) VALUES ('798f6393-fd27-4899-a1e8-ac08a777dcf0', 'cfdf9c24-05b7-5030-874f-4a2684ceec35', 'HYBRID', 220000.00, 8.00, '2026-07-28 20:38:15.632869+00', NULL, NULL);
INSERT INTO public.t_salary_configs (id, user_id, payment_type, base_salary, commission_percent, created_at, updated_at, deleted_at) VALUES ('d2de3fa8-800b-4b1b-ab4a-18cc12609a8c', 'e8e208d1-c8c7-5386-98d7-f072578247d4', 'PIECEWORK', 0.00, 18.00, '2026-07-28 20:38:15.632869+00', NULL, NULL);
INSERT INTO public.t_salary_configs (id, user_id, payment_type, base_salary, commission_percent, created_at, updated_at, deleted_at) VALUES ('000d2f10-5bb5-49c4-813e-50217e8dfc6b', '080bce6a-9b69-5c88-a992-d8c6370ea1b2', 'PIECEWORK', 0.00, 18.00, '2026-07-28 20:38:15.632869+00', NULL, NULL);
INSERT INTO public.t_salary_configs (id, user_id, payment_type, base_salary, commission_percent, created_at, updated_at, deleted_at) VALUES ('e3e6c587-2847-40df-8003-9a77e3c552d6', 'eae4e028-8fd7-50b2-b932-75c4e6362378', 'HYBRID', 200000.00, 12.00, '2026-07-28 20:38:15.632869+00', NULL, NULL);


--
-- Data for Name: t_sla_rules; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_stock_balance; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('d9d66e46-d783-49ef-926a-9aadc8d77b52', '338dd44c-12f1-57d9-8a49-c0c3426a437a', 18.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('d0247199-df53-4523-bc96-dbc33be0d368', 'd7b58fb2-50f9-5dce-bc21-b087a14980ea', 2400.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('3365c8df-06b7-4f1c-8f66-0889760e606b', '70a09d0f-62ab-5abd-abdd-7d533b9652c8', 850.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('a05785c5-3a2d-4528-8c53-c73b2c248a52', '03809ab4-37cf-5ec3-953a-1913c88ef7d2', 12.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('ee54f8a5-8d8b-4c0c-8d49-f08d75079b23', 'e6762e04-e4fc-5fa6-a035-d297bc7e235d', 1800.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('d7e8b02d-bf45-416a-94dc-112996837537', '1e8ba5c2-27e2-5d6f-ae44-9b7113b1e032', 950.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('3e8fc9dc-fe8a-4478-81f4-fe0b85bdbfd7', '566d7f4c-7291-5dbb-b08e-e73393f6b4c4', 700.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('cee0058d-f05e-4009-9d11-15d4b88ad162', '4a9a06e7-6194-522c-9419-b696a037a6bb', 35.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('cfa83650-7318-4eba-ad64-0f2a9682d402', '91c2652f-e513-526c-aa6f-421dd87bf397', 180.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('d0584052-12c5-4b14-ad33-6583c1718045', 'e35573e9-5458-54b0-8127-0d925f668622', 240.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('c83b3cb6-60e4-4ed2-b730-dd26f1f26acc', 'e6a1869c-7e8d-5d60-aacc-0e8045a9d219', 45.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('bc8ffaea-242b-4584-9f82-c2316380210f', '107d8712-2c09-56dc-9759-a19e72a032d3', 1800.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('07d6c01d-2ed5-458b-b222-a67971a89cfb', '897b8ea8-c66d-558f-894d-764a1b05e8fb', 900.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('c6dd85f1-52f9-4e9c-b14e-76474f35344b', '782a4a22-51e9-555a-ab9f-5ca36fec16e4', 6.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('a2fed1a5-eebd-4cf4-8b20-bacceb067861', 'd06d3bed-6ea8-5c0c-a9b5-dbc4f5f9a83f', 85.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('0edb5910-18f2-4049-85da-53e50d850c9a', '4fb491e0-ca25-5aea-bfb1-68556990356d', 14.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('05022f88-d86e-41a4-8855-399599dbd0e9', 'b278c2a5-2755-5c9b-bbc7-0b678fd0d29f', 350.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('076ef8f6-3338-47b4-92c4-f78b86f78048', 'd1535830-afab-5ff3-a992-8417c24f5549', 4.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('9a5686a7-c5b6-476d-a65c-3661209178e4', 'd31f6f33-c2aa-53c2-b70c-990a26080ea4', 12.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');
INSERT INTO public.t_stock_balance (id, nomenclature_id, quantity, version, created_at, updated_at) VALUES ('98ff43f0-60ca-4dde-a50c-d76720da116f', '7373770f-9eb6-5f5e-a0e9-cf7f0eaa483e', 200.0000, 0, '2026-07-28 20:38:15.621967+00', '2026-07-28 20:38:15.621967+00');


--
-- Data for Name: t_stock_level_rules; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_stock_level_rules (code, name, min_ratio, max_ratio, counts_as_low, color_hex, sort_order, is_active) VALUES ('CRITICAL', 'Критично', 0.0000, 0.7500, true, '#EF4444', 1, true);
INSERT INTO public.t_stock_level_rules (code, name, min_ratio, max_ratio, counts_as_low, color_hex, sort_order, is_active) VALUES ('LOW', 'На грани', 0.7500, 1.0000, true, '#F59E0B', 2, true);
INSERT INTO public.t_stock_level_rules (code, name, min_ratio, max_ratio, counts_as_low, color_hex, sort_order, is_active) VALUES ('SUFFICIENT', 'Достаточно', 1.0000, NULL, false, '#22C55E', 3, true);


--
-- Data for Name: t_stock_lots; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_stock_movement_types; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_stock_movement_types (code, name, increases_stock, decreases_stock, is_inventory_adjustment, is_active) VALUES ('IN', 'Приход', true, false, false, true);
INSERT INTO public.t_stock_movement_types (code, name, increases_stock, decreases_stock, is_inventory_adjustment, is_active) VALUES ('OUT', 'Расход', false, true, false, true);
INSERT INTO public.t_stock_movement_types (code, name, increases_stock, decreases_stock, is_inventory_adjustment, is_active) VALUES ('INVENTORY_ADJUSTMENT', 'Корректировка инвентаризации', false, false, true, true);


--
-- Data for Name: t_stock_movement; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('92fee7db-4953-5e33-b4fe-473a8bc4b337', '338dd44c-12f1-57d9-8a49-c0c3426a437a', 'IN', 18.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', 'bd7f5aee-4da2-5d4a-83eb-2cc79702cbe6', 18.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 18.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('c501017b-2bab-5f12-bb95-0597dff028d3', 'd7b58fb2-50f9-5dce-bc21-b087a14980ea', 'IN', 2400.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '94a1a545-79d4-5c85-90fb-d58b85980c1c', 2400.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 2400.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('ff9e4412-7d82-565c-a0ab-806181e94c44', '70a09d0f-62ab-5abd-abdd-7d533b9652c8', 'IN', 850.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '4b30bfec-06d3-5374-9847-3a1e85a9a50e', 850.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 850.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('fc48e043-d221-5ff9-9e6e-ca4d39778ae3', '03809ab4-37cf-5ec3-953a-1913c88ef7d2', 'IN', 12.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '77448805-9551-5d43-90bd-25e964a7d494', 12.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 12.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('b7331911-c116-5467-8b0f-21d17adcbceb', 'e6762e04-e4fc-5fa6-a035-d297bc7e235d', 'IN', 1800.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '2776b7da-8c2d-57c5-881e-84e189c266ef', 1800.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 1800.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('6ccb8562-f0c3-595f-bea5-58f903fb1242', '1e8ba5c2-27e2-5d6f-ae44-9b7113b1e032', 'IN', 950.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '178a81db-9fac-502f-b9be-f30230b30b24', 950.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 950.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('f24f067a-d366-5d69-88f1-b92ab76fa0ee', '566d7f4c-7291-5dbb-b08e-e73393f6b4c4', 'IN', 700.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '8fead685-0152-5e57-858c-b3e67980b36c', 700.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 700.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('3755b49c-9afb-585e-b172-3ce7183f60f1', '4a9a06e7-6194-522c-9419-b696a037a6bb', 'IN', 35.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', 'f856a20c-c811-5d28-86a8-d845df750fff', 35.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 35.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('0a6d8904-37a1-5228-b8bc-00518aa2d429', '91c2652f-e513-526c-aa6f-421dd87bf397', 'IN', 180.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', 'b4d59af1-4d4e-5036-907c-1781ab0fea18', 180.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 180.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('5c118bfe-48cd-5612-8c7c-2d781df843f3', 'e35573e9-5458-54b0-8127-0d925f668622', 'IN', 240.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', 'ad153e42-8db8-5b18-a233-5b829b9b887d', 240.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 240.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('192c56b2-aa39-5034-93ce-8e06bc957a41', 'e6a1869c-7e8d-5d60-aacc-0e8045a9d219', 'IN', 45.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', 'a36ec68f-39c6-559b-b64f-9fbdf229d080', 45.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 45.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('175db32f-9256-5ecc-bcc2-3d177783f74a', '107d8712-2c09-56dc-9759-a19e72a032d3', 'IN', 1800.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '0875db41-3e80-5646-ae9f-50b4a33600f9', 1800.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 1800.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('81e80372-f4a9-5dfd-953d-87575e7f8cf5', '897b8ea8-c66d-558f-894d-764a1b05e8fb', 'IN', 900.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '8b694836-867c-58d4-a923-5a42dbf32b48', 900.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 900.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('15e12eb4-451e-58cd-b778-546b0fc4952e', '782a4a22-51e9-555a-ab9f-5ca36fec16e4', 'IN', 6.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', 'a0718f03-0ee6-5902-ab4e-b6689f3045ef', 6.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 6.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('e3bc20ea-d80a-500a-8b2d-37425bfc55e5', 'd06d3bed-6ea8-5c0c-a9b5-dbc4f5f9a83f', 'IN', 85.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '8e8d6519-04ad-5a12-b8c7-8ecc4b479cf5', 85.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 85.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('da910a55-dd0c-5abc-a7b4-57afd2b49cd4', '4fb491e0-ca25-5aea-bfb1-68556990356d', 'IN', 14.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '702c35b8-ba7b-559b-b674-cfe3191941ab', 14.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 14.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('05352bc0-6b3b-5189-8fbc-6d91402a0867', 'b278c2a5-2755-5c9b-bbc7-0b678fd0d29f', 'IN', 350.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '03e23833-a3e6-50dd-8840-61b56b389064', 350.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 350.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('f5100777-0b2d-50e6-9091-91407bf2b32f', 'd1535830-afab-5ff3-a992-8417c24f5549', 'IN', 4.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '4b0740b6-588a-5ee8-9ae6-e989a728aef2', 4.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 4.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('d5f7795a-e1cd-5639-828f-3a0bc69c8138', 'd31f6f33-c2aa-53c2-b70c-990a26080ea4', 'IN', 12.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '9ac41015-a3ed-5acc-9f0f-a801f0756838', 12.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 12.0000, 0.0000, 0.0000, 0.0000);
INSERT INTO public.t_stock_movement (id, nomenclature_id, movement_type, quantity, reason, reference_type, reference_id, balance_after, created_at, updated_at, total_cost, standard_quantity, waste_quantity, standard_cost, waste_cost) VALUES ('9ed0e17d-7ce0-517b-8670-50e57bdf6eef', '7373770f-9eb6-5f5e-a0e9-cf7f0eaa483e', 'IN', 200.0000, 'Начальное наполнение склада для UI', 'INITIAL_SEED', '29af6a6d-4f11-5629-b879-7bbc548657bd', 200.0000, '2026-07-28 20:38:15.622774+00', '2026-07-28 20:38:15.622774+00', 0.0000, 200.0000, 0.0000, 0.0000, 0.0000);


--
-- Data for Name: t_stock_reserves; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_task_material_plan; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_task_sla_states; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_workflow_steps; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('208c7a8a-d589-40aa-83d6-a45dcdcd5094', '5f45d16e-94b7-5b15-92f5-c6f8b57c9abf', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('e99e4816-5c89-4dfc-b5ce-0294093b45d5', 'c79a95c1-190d-5f5e-af49-4cf791885069', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('1decb321-b548-45db-b9f1-a721375a6efe', '5f45d16e-94b7-5b15-92f5-c6f8b57c9abf', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'c5fd12c6-c17f-562e-a3ae-14c2bf8cc0c2', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('a527baaf-ce3e-4f3e-967c-caddfcb12201', '5f45d16e-94b7-5b15-92f5-c6f8b57c9abf', 'c5fd12c6-c17f-562e-a3ae-14c2bf8cc0c2', 'e08ce645-23d7-59b5-830c-8a5946b8a4e8', 'ROLE_SCANNER', 3, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('6a8ff115-ac81-44c5-b7b8-22d81f6a726a', '67a05ce9-b4ad-5a9c-8768-c0087da0eb38', 'ca61343e-44a7-514b-9eba-beb0ac245308', 'e08ce645-23d7-59b5-830c-8a5946b8a4e8', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('950435bb-5279-4da2-a014-b218d02b72f0', '5f45d16e-94b7-5b15-92f5-c6f8b57c9abf', 'e08ce645-23d7-59b5-830c-8a5946b8a4e8', '0b8741cd-cd21-5d1d-8b71-4bece984e0cf', 'ROLE_OPERATOR', 4, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('12edc08c-f5bf-47e5-9786-91da61a62dcd', '67a05ce9-b4ad-5a9c-8768-c0087da0eb38', 'e08ce645-23d7-59b5-830c-8a5946b8a4e8', '0b8741cd-cd21-5d1d-8b71-4bece984e0cf', 'ROLE_OPERATOR', 2, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('d35c461c-8304-46b5-9869-47a7f65ff9d4', 'c79a95c1-190d-5f5e-af49-4cf791885069', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ae37c459-16cd-58a8-af63-a962d631d508', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('48e948ed-3403-4bbe-815c-77ace10bcbf5', 'c79a95c1-190d-5f5e-af49-4cf791885069', 'ae37c459-16cd-58a8-af63-a962d631d508', '49afbf34-3d65-5a70-ad9a-20ff2cdb7302', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('e90fd0b5-7021-44a1-b1b6-71b99de10e76', '5f45d16e-94b7-5b15-92f5-c6f8b57c9abf', '0b8741cd-cd21-5d1d-8b71-4bece984e0cf', '49afbf34-3d65-5a70-ad9a-20ff2cdb7302', 'ROLE_CERAMIST', 5, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('4b2d8fb2-8836-4291-91ac-1f1b0689f98f', '67a05ce9-b4ad-5a9c-8768-c0087da0eb38', '0b8741cd-cd21-5d1d-8b71-4bece984e0cf', '49afbf34-3d65-5a70-ad9a-20ff2cdb7302', 'ROLE_CERAMIST', 3, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('ba5ee31e-ca8c-4d82-bf78-9142f2acd12a', '5f45d16e-94b7-5b15-92f5-c6f8b57c9abf', '49afbf34-3d65-5a70-ad9a-20ff2cdb7302', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_DISPATCHER', 6, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('2feadb42-8cdb-4204-9d74-6cfe4f48b863', '67a05ce9-b4ad-5a9c-8768-c0087da0eb38', '49afbf34-3d65-5a70-ad9a-20ff2cdb7302', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_DISPATCHER', 4, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('31c41111-c35c-465e-bdfd-d09f6aa393b6', 'c79a95c1-190d-5f5e-af49-4cf791885069', '49afbf34-3d65-5a70-ad9a-20ff2cdb7302', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_DISPATCHER', 4, '2026-07-28 20:38:15.618204+00', '2026-07-28 20:38:15.618204+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('c1542295-c679-51fe-bad7-4a1914f121e2', '5a305223-10e3-5fc5-b068-43b4fd713e67', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('09e5baeb-7324-53bb-bf81-0d2d4bc950f2', '301c5f4b-af09-55fc-9c63-cf11b4fbb20d', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ROLE_PLASTERER', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('d4fea563-9735-5efb-85db-a33eaeca39a7', '285b765e-70fc-59fc-abf7-3bf195c47408', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('11ca197f-0acf-51bf-9e2c-da7afa811951', 'e4db8784-1b8e-5095-ad84-837357235df5', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('70b2e842-3856-5a61-b8a2-182b8c91bfe9', '3b738b35-9ae6-5e87-b7c3-9c4f16a78c1c', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('922ed255-0701-5b36-b0b5-29ae7e4691f9', '56f63db9-1776-57b9-990f-b39689b47446', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('6b85407c-2980-5123-8369-8fb1736d1891', '6e2a63e9-0243-57ce-bc59-e01db07909f1', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('23433014-fed0-559b-903b-9b3c36b95d86', 'c60ee0ed-71b5-5109-9e41-5a589e648363', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ROLE_PLASTERER', 7, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('32659f40-4171-52f3-8558-e3a5e682ad17', '832a253a-6f1b-5080-a27b-23c0adb0a438', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ROLE_PLASTERER', 7, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('a886be1f-84bc-5796-a12c-2fab904ece50', '0cc05984-ddd3-5bdb-a91d-6f645b535d27', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('5dccb617-9dc5-5eac-9cf9-00fa6f30f29f', 'c65cb61f-80bc-5248-8e3d-9b5a25158936', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('19c237c7-c5bb-5585-9dd9-09ddab2a682f', '417e9551-c86b-5b4a-b15d-eed6357f6a49', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('6cbf9f23-6492-59b3-ae15-6f0d5d7675bb', '557259f6-4b21-5836-9809-f34d7356f34e', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('60069bbc-8d99-5308-9bf2-b84b8455a822', '72efb4dc-bba1-5cf1-b1a3-ea8c034462ae', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('f91c2412-d2aa-5faa-ab47-c95ea4cd9327', 'ab6ea790-326c-55b0-a56f-5b1eda349bd3', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PLASTERER', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('c09d8aa8-225a-5b9d-966b-190df148a358', '301c5f4b-af09-55fc-9c63-cf11b4fbb20d', 'c5fd12c6-c17f-562e-a3ae-14c2bf8cc0c2', '93d147c7-3487-5a76-bead-c6880caba0fb', 'ROLE_SCANNER', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('60a6ac3f-d12f-54c0-95d0-eb6c33d2d882', 'c60ee0ed-71b5-5109-9e41-5a589e648363', 'c5fd12c6-c17f-562e-a3ae-14c2bf8cc0c2', '93d147c7-3487-5a76-bead-c6880caba0fb', 'ROLE_SCANNER', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('dc6b0b9f-da0b-52bf-ad1c-0d46e6e5a4f7', '832a253a-6f1b-5080-a27b-23c0adb0a438', 'c5fd12c6-c17f-562e-a3ae-14c2bf8cc0c2', '93d147c7-3487-5a76-bead-c6880caba0fb', 'ROLE_SCANNER', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('fe106a60-12a3-524d-b59e-7d0d38a10ad9', '5a305223-10e3-5fc5-b068-43b4fd713e67', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('915d1618-31e6-5511-9ebf-d3c827f67255', '301c5f4b-af09-55fc-9c63-cf11b4fbb20d', 'ca61343e-44a7-514b-9eba-beb0ac245308', 'c9768a8b-5b2d-5b0e-9a88-f9e70dd0e375', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('6b8d1f9f-9c1b-5d27-be94-33124b253c69', '285b765e-70fc-59fc-abf7-3bf195c47408', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('0be2b7c4-c6e2-52cb-8cd0-847bc6fb86eb', 'e4db8784-1b8e-5095-ad84-837357235df5', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('eec88065-1f4e-5cb4-b917-435bb8d4ac91', '3b738b35-9ae6-5e87-b7c3-9c4f16a78c1c', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('80ba01f8-ad71-5bc1-ad68-0ac110897b0f', '56f63db9-1776-57b9-990f-b39689b47446', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('fd9fa58f-ca57-50f2-98ea-4527e11771fd', '6e2a63e9-0243-57ce-bc59-e01db07909f1', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('2bde796a-83a9-5c41-b165-5f69cba9b770', 'c60ee0ed-71b5-5109-9e41-5a589e648363', 'ca61343e-44a7-514b-9eba-beb0ac245308', 'c9768a8b-5b2d-5b0e-9a88-f9e70dd0e375', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('6e7bb23d-c6ce-508e-aeae-ee90dfff78bb', '832a253a-6f1b-5080-a27b-23c0adb0a438', 'ca61343e-44a7-514b-9eba-beb0ac245308', 'c9768a8b-5b2d-5b0e-9a88-f9e70dd0e375', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('da2cfb86-da48-5a2c-ad07-07159bbf4593', '0cc05984-ddd3-5bdb-a91d-6f645b535d27', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('bf6c884a-a609-52ed-84da-4cfbe576a84d', 'c65cb61f-80bc-5248-8e3d-9b5a25158936', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('8fe56537-d5f2-5acd-b04c-3058a539cbf9', '417e9551-c86b-5b4a-b15d-eed6357f6a49', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('c6eecf1d-b596-5fd2-b5dc-30c32158f02b', '557259f6-4b21-5836-9809-f34d7356f34e', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('ea8cc5f2-90fa-51e5-85b1-f87e5d944142', '72efb4dc-bba1-5cf1-b1a3-ea8c034462ae', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('eedade37-c932-5091-9e88-ee4856dc8020', 'ab6ea790-326c-55b0-a56f-5b1eda349bd3', 'ca61343e-44a7-514b-9eba-beb0ac245308', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_DISPATCHER', 1, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('0c974cb3-6175-575c-8c97-b1c590df7313', '301c5f4b-af09-55fc-9c63-cf11b4fbb20d', 'c9768a8b-5b2d-5b0e-9a88-f9e70dd0e375', 'c5fd12c6-c17f-562e-a3ae-14c2bf8cc0c2', 'ROLE_OPERATOR', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('d2f36a5d-9a4a-5416-be04-b92289a4cd49', 'c60ee0ed-71b5-5109-9e41-5a589e648363', 'c9768a8b-5b2d-5b0e-9a88-f9e70dd0e375', 'c5fd12c6-c17f-562e-a3ae-14c2bf8cc0c2', 'ROLE_OPERATOR', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('70f8daed-13ec-5ab2-b28d-1f0b7a9cff93', '832a253a-6f1b-5080-a27b-23c0adb0a438', 'c9768a8b-5b2d-5b0e-9a88-f9e70dd0e375', 'c5fd12c6-c17f-562e-a3ae-14c2bf8cc0c2', 'ROLE_OPERATOR', 2, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('3f7afc10-c5df-55a0-add4-d04b61dce09b', '301c5f4b-af09-55fc-9c63-cf11b4fbb20d', '93d147c7-3487-5a76-bead-c6880caba0fb', 'b41495b3-20ee-5941-aa6d-3c7137c55085', 'ROLE_OPERATOR', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('4430e884-970a-5628-9d72-f3cf124463dc', 'c60ee0ed-71b5-5109-9e41-5a589e648363', '93d147c7-3487-5a76-bead-c6880caba0fb', 'b41495b3-20ee-5941-aa6d-3c7137c55085', 'ROLE_OPERATOR', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('4bd893f1-06e0-5af4-82a2-f75821a3de25', '832a253a-6f1b-5080-a27b-23c0adb0a438', '93d147c7-3487-5a76-bead-c6880caba0fb', 'b41495b3-20ee-5941-aa6d-3c7137c55085', 'ROLE_OPERATOR', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('6ed0b3af-e81c-51d6-be4a-2ab002c67eee', '301c5f4b-af09-55fc-9c63-cf11b4fbb20d', 'b41495b3-20ee-5941-aa6d-3c7137c55085', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_OPERATOR', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('21d2c348-d437-5414-b7c4-f47604c76b9e', 'c60ee0ed-71b5-5109-9e41-5a589e648363', 'b41495b3-20ee-5941-aa6d-3c7137c55085', '7c724c43-0bf5-57e5-950c-f44a06270012', 'ROLE_OPERATOR', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('060aa608-eb9a-5e09-a396-b53e03ee64f2', '832a253a-6f1b-5080-a27b-23c0adb0a438', 'b41495b3-20ee-5941-aa6d-3c7137c55085', '7c724c43-0bf5-57e5-950c-f44a06270012', 'ROLE_OPERATOR', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('09e85447-0ab3-5c15-b9b8-86cbdd3c34fc', 'c60ee0ed-71b5-5109-9e41-5a589e648363', '7c724c43-0bf5-57e5-950c-f44a06270012', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_OPERATOR', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('d7ebb5c4-c2d0-53f4-a07b-958237eebc8c', '832a253a-6f1b-5080-a27b-23c0adb0a438', '7c724c43-0bf5-57e5-950c-f44a06270012', '47844887-a3dc-5ff8-bd12-1e0ce1a49b41', 'ROLE_OPERATOR', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('a64daa04-10d6-5eb6-b1ac-ec95b7f4175e', '5a305223-10e3-5fc5-b068-43b4fd713e67', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('e9775979-5912-55dd-bd8e-cc7ce95b9d3c', '301c5f4b-af09-55fc-9c63-cf11b4fbb20d', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'ROLE_PROSTHETIST', 7, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('077e8bb5-e030-5567-9f9e-4cb95667a5f8', '285b765e-70fc-59fc-abf7-3bf195c47408', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('629e0474-1497-5d0b-8ffd-1680dbb07304', 'e4db8784-1b8e-5095-ad84-837357235df5', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('a6ef5921-40bb-5346-858f-dd3709fe0abf', '3b738b35-9ae6-5e87-b7c3-9c4f16a78c1c', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('1db04688-dbb1-50c5-88fb-7a1301331907', '56f63db9-1776-57b9-990f-b39689b47446', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('277d8775-d106-5ec8-beae-0b3f32173601', '6e2a63e9-0243-57ce-bc59-e01db07909f1', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('fe27baac-50d8-50aa-9e76-25f8c3743b8d', 'c60ee0ed-71b5-5109-9e41-5a589e648363', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'ROLE_PROSTHETIST', 8, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('43d88ed5-70c1-5779-b8b3-247d02e7e2dd', '832a253a-6f1b-5080-a27b-23c0adb0a438', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'ROLE_PROSTHETIST', 8, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('3429b075-89a8-5522-9713-8f6c0f19bda3', '0cc05984-ddd3-5bdb-a91d-6f645b535d27', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('15f232e4-5ccf-56d2-9c96-2086db98eded', 'c65cb61f-80bc-5248-8e3d-9b5a25158936', 'ad11998e-a2c8-5301-919c-132e52043db3', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('f35aec1f-707e-5d2a-ad85-2e9ffd854d38', '5a305223-10e3-5fc5-b068-43b4fd713e67', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('ac6462b9-acd6-5fa8-b0af-96dfc172125f', '301c5f4b-af09-55fc-9c63-cf11b4fbb20d', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PROSTHETIST', 8, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('c87d345b-dcc9-57db-9a95-baa07305cd50', '285b765e-70fc-59fc-abf7-3bf195c47408', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('c97875ea-642e-54ff-b9a5-37dddeca5da3', 'e4db8784-1b8e-5095-ad84-837357235df5', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('cde75f46-1c3f-5209-8e78-30dbc452ca4a', '3b738b35-9ae6-5e87-b7c3-9c4f16a78c1c', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('5d395da5-15f3-5b8f-9b4e-51b1b4c95e1e', '56f63db9-1776-57b9-990f-b39689b47446', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('a8236040-a38f-5ad0-825e-6915fc288db4', '6e2a63e9-0243-57ce-bc59-e01db07909f1', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('74bf66df-3c10-5b43-8883-f603b174984a', 'c60ee0ed-71b5-5109-9e41-5a589e648363', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PROSTHETIST', 9, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('a191cfdf-5d19-522a-a238-a5c822daecdd', '832a253a-6f1b-5080-a27b-23c0adb0a438', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PROSTHETIST', 9, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('ef9bde8d-5fc7-543d-84a4-0a2160b7c04a', '0cc05984-ddd3-5bdb-a91d-6f645b535d27', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('2ce25ebd-2ae8-57c0-897c-21ae140db42c', 'c65cb61f-80bc-5248-8e3d-9b5a25158936', 'ec8c66db-fce4-5d18-a81e-c5e05d695eea', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('65ca29b3-ad12-5054-b108-b921602c0a5c', '5a305223-10e3-5fc5-b068-43b4fd713e67', '0cbfd68a-119e-51a7-8de7-cf771932c973', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('e7f0f357-7f3a-5c22-8d29-06726b26858d', '301c5f4b-af09-55fc-9c63-cf11b4fbb20d', '0cbfd68a-119e-51a7-8de7-cf771932c973', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 9, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('77c40f7f-acdb-56ce-a2c8-800d3955d67b', '285b765e-70fc-59fc-abf7-3bf195c47408', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('2a7d0867-1e3d-5e92-9b7b-17554b7eb2fb', 'e4db8784-1b8e-5095-ad84-837357235df5', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('b7073e3a-d2b6-5dc9-ae1a-ae311daef90a', '3b738b35-9ae6-5e87-b7c3-9c4f16a78c1c', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('563fd5bc-c7de-54cf-96a0-f610d693df4d', '56f63db9-1776-57b9-990f-b39689b47446', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('e46337bc-3edb-5c9b-aed4-0c932ded79c6', '6e2a63e9-0243-57ce-bc59-e01db07909f1', '0cbfd68a-119e-51a7-8de7-cf771932c973', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('1e711c39-9a96-564a-9660-0089a1be42f6', 'c60ee0ed-71b5-5109-9e41-5a589e648363', '0cbfd68a-119e-51a7-8de7-cf771932c973', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 10, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('512a0730-1170-57e5-acf5-ad0c94852f61', '832a253a-6f1b-5080-a27b-23c0adb0a438', '0cbfd68a-119e-51a7-8de7-cf771932c973', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 10, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('41542b65-961c-53f5-9ebe-07389075261a', '0cc05984-ddd3-5bdb-a91d-6f645b535d27', '0cbfd68a-119e-51a7-8de7-cf771932c973', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('4ae657a3-c4fe-5d7b-86f6-1d67769ca0ed', 'c65cb61f-80bc-5248-8e3d-9b5a25158936', '0cbfd68a-119e-51a7-8de7-cf771932c973', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('f1e6d5b1-0d1f-58d3-b4d4-e6c9b25ace52', '417e9551-c86b-5b4a-b15d-eed6357f6a49', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('018ad2fe-e9e0-5f2e-b9a8-55a783440bb9', '557259f6-4b21-5836-9809-f34d7356f34e', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('21b46f4e-df15-5553-b604-d4626b9aca13', '72efb4dc-bba1-5cf1-b1a3-ea8c034462ae', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('82c8fdca-6916-53a1-8630-f4e552a86fc3', 'ab6ea790-326c-55b0-a56f-5b1eda349bd3', '0cbfd68a-119e-51a7-8de7-cf771932c973', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', 'ROLE_PROSTHETIST', 3, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('1337aabb-2df7-52cd-b49e-66c400e63926', '285b765e-70fc-59fc-abf7-3bf195c47408', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('9e47db29-106a-5372-a7c6-247390ef5cff', 'e4db8784-1b8e-5095-ad84-837357235df5', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('648a36ce-2b9c-5a13-8c7f-510404880ee4', '3b738b35-9ae6-5e87-b7c3-9c4f16a78c1c', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('feff1aa4-e284-5324-84d1-2aaab3d0114e', '56f63db9-1776-57b9-990f-b39689b47446', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('d36ee58f-29a1-5a91-934e-ea9ca6a69130', '417e9551-c86b-5b4a-b15d-eed6357f6a49', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('a958fbcb-1211-5eef-aa5a-1937263281d1', '557259f6-4b21-5836-9809-f34d7356f34e', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('424cbf12-52f3-51f6-95ab-fc2a299efff9', '72efb4dc-bba1-5cf1-b1a3-ea8c034462ae', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('2733f7be-6b1d-5221-92dc-416fd537723c', 'ab6ea790-326c-55b0-a56f-5b1eda349bd3', 'f7031ebc-2e8d-595f-8aa8-ea9a75adaae5', '83978d62-7e41-5890-b6ea-472ce94d19f4', 'ROLE_PROSTHETIST', 4, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('22ced4b3-4850-5ecd-959a-498c8308be34', '5a305223-10e3-5fc5-b068-43b4fd713e67', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('02e87b5b-70a8-57ac-a3ad-c12806c1f90c', '301c5f4b-af09-55fc-9c63-cf11b4fbb20d', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 10, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('fc8aae01-aded-5682-8b22-805d332e58c9', '285b765e-70fc-59fc-abf7-3bf195c47408', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 7, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('b0c35393-3e7a-5545-b7ea-2e2c15cf97cc', 'e4db8784-1b8e-5095-ad84-837357235df5', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 7, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('e8f67e40-bcb1-5759-953c-71874f0c8c65', '3b738b35-9ae6-5e87-b7c3-9c4f16a78c1c', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 7, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('37974296-aa83-54c5-94b2-33909b9805b6', '56f63db9-1776-57b9-990f-b39689b47446', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 7, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('508a8baf-e75f-593e-a8a8-e1b9f99071eb', '6e2a63e9-0243-57ce-bc59-e01db07909f1', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('11f6d0bf-ebcc-5582-b0c5-9f87e420ac42', 'c60ee0ed-71b5-5109-9e41-5a589e648363', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 11, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('6cb2fcf1-0c79-5650-b4d7-1b8ddb8d5b32', '832a253a-6f1b-5080-a27b-23c0adb0a438', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 11, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('482d3cb6-ecf3-5f29-b87b-d62d49983755', '0cc05984-ddd3-5bdb-a91d-6f645b535d27', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('6eca80f8-2550-5caf-aa63-37d8a1b7581b', 'c65cb61f-80bc-5248-8e3d-9b5a25158936', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('91160e9f-df1d-52f9-8579-a5cc83d4e890', '417e9551-c86b-5b4a-b15d-eed6357f6a49', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('6fea90af-f1d2-5c50-95b7-9dd9511f5955', '557259f6-4b21-5836-9809-f34d7356f34e', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('c3ec789a-905c-5d8a-bea5-43eb9c2f57d7', '72efb4dc-bba1-5cf1-b1a3-ea8c034462ae', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('95fb82ed-f65f-538c-9260-e2cee556bf2a', 'ab6ea790-326c-55b0-a56f-5b1eda349bd3', '83978d62-7e41-5890-b6ea-472ce94d19f4', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', 'ROLE_PROSTHETIST', 5, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('272790ef-bedf-519b-9cb8-ebfe00a51262', '5a305223-10e3-5fc5-b068-43b4fd713e67', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 7, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('93339a42-5222-531c-a39e-1ba1c54a362c', '301c5f4b-af09-55fc-9c63-cf11b4fbb20d', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 11, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('b7a37272-08c8-581a-8457-2dc5712678da', '285b765e-70fc-59fc-abf7-3bf195c47408', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 8, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('dc22bc5a-dcf5-503d-8ed6-1ba83f3aec9b', 'e4db8784-1b8e-5095-ad84-837357235df5', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 8, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('02f46219-e142-5ba6-95ad-a03f33fb323e', '3b738b35-9ae6-5e87-b7c3-9c4f16a78c1c', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 8, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('16e94e50-13a5-5422-b3f7-6dd9d76b5760', '56f63db9-1776-57b9-990f-b39689b47446', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 8, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('20f0eeda-6632-5ca5-80bf-88e1f1e839b5', '6e2a63e9-0243-57ce-bc59-e01db07909f1', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 7, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('d5d1b4f4-92a4-56fc-932d-5c5073cd1bd5', 'c60ee0ed-71b5-5109-9e41-5a589e648363', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 12, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('41840d19-a0a8-5463-9dc0-22704af21975', '832a253a-6f1b-5080-a27b-23c0adb0a438', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 12, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('e5387f35-012b-596e-bc92-baa15d987dd4', '0cc05984-ddd3-5bdb-a91d-6f645b535d27', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 7, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('2229c98b-21a8-5700-8e04-1e33264e366b', 'c65cb61f-80bc-5248-8e3d-9b5a25158936', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 7, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('5d93d33c-c314-5375-a436-4c5c06fd1df1', '417e9551-c86b-5b4a-b15d-eed6357f6a49', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('b75596f0-44f0-54cf-a38d-6437a8d1d795', '557259f6-4b21-5836-9809-f34d7356f34e', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('c2303448-7c11-5dd2-8e07-3214d5012de5', '72efb4dc-bba1-5cf1-b1a3-ea8c034462ae', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);
INSERT INTO public.t_workflow_steps (id, work_type_id, from_status_id, to_status_id, required_role, sort_order, created_at, updated_at, deleted_at, material_report_required, allow_unplanned_materials) VALUES ('3a83321c-259a-5893-a437-dc6f5d359d9a', 'ab6ea790-326c-55b0-a56f-5b1eda349bd3', '93f88033-0d45-58b0-bb2c-9f60e9eba2e9', '699331e5-8a22-593d-b6c5-6244abb077d2', 'ROLE_PROSTHETIST', 6, '2026-07-28 20:38:16.47144+00', '2026-07-28 20:38:16.47144+00', NULL, false, false);


--
-- Data for Name: t_task_stage_material_usage; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_telegram_bot_settings; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: t_user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('b4eb3dcd-35d8-51bb-b723-6507fe49272d', '7453c55a-49dd-5e51-96e5-cbb644295c9d');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('46443a23-7f84-5549-800a-f8bdb36759d0', 'bf0c84b7-3e49-5f2e-8871-427778df617e');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('795930cb-ee12-5c44-90ce-1c18fad09f99', 'ad20a1d9-64f1-55db-9590-a4e2eb30e2a9');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('cfdf9c24-05b7-5030-874f-4a2684ceec35', '388eae53-6b0c-5731-a356-93f476604f15');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('080bce6a-9b69-5c88-a992-d8c6370ea1b2', 'b87c987d-d4a4-56a9-8603-971f0ac0606c');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('e8e208d1-c8c7-5386-98d7-f072578247d4', 'b87c987d-d4a4-56a9-8603-971f0ac0606c');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('eae4e028-8fd7-50b2-b932-75c4e6362378', 'c40699f3-c755-5771-a165-03ae6ce87390');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('9363f90f-9f8d-5a9c-be60-769a9220df31', 'd77db510-9e49-510c-bbf5-5af61bbdf619');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('40ff19dc-2944-5e7a-9d28-85942725f26d', '7453c55a-49dd-5e51-96e5-cbb644295c9d');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('40ff19dc-2944-5e7a-9d28-85942725f26d', 'bf0c84b7-3e49-5f2e-8871-427778df617e');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('40ff19dc-2944-5e7a-9d28-85942725f26d', 'ad20a1d9-64f1-55db-9590-a4e2eb30e2a9');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('40ff19dc-2944-5e7a-9d28-85942725f26d', '388eae53-6b0c-5731-a356-93f476604f15');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('40ff19dc-2944-5e7a-9d28-85942725f26d', 'b87c987d-d4a4-56a9-8603-971f0ac0606c');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('40ff19dc-2944-5e7a-9d28-85942725f26d', 'c40699f3-c755-5771-a165-03ae6ce87390');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('40ff19dc-2944-5e7a-9d28-85942725f26d', 'd77db510-9e49-510c-bbf5-5af61bbdf619');
INSERT INTO public.t_user_roles (user_id, role_id) VALUES ('40ff19dc-2944-5e7a-9d28-85942725f26d', 'c040dd67-bc47-5ce6-91bb-598d0c4e2ade');


--
-- PostgreSQL database dump complete
--


