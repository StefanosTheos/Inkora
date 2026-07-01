-- =====================================================================
-- 0002  ENUMS
-- =====================================================================
create type user_role          as enum ('seeker','artist','studio_admin','moderator');
create type membership_role    as enum ('owner','manager','artist');
create type membership_status  as enum ('invited','active','suspended','removed');

create type conversation_type  as enum ('direct','support');
create type message_type       as enum ('text','image','system','booking_card');

create type request_status     as enum ('pending','reviewing','offered','accepted','declined','expired','cancelled','converted');
create type offer_status       as enum ('pending','accepted','declined','withdrawn','expired');
create type appointment_status as enum ('scheduled','rescheduled','completed','cancelled','no_show');
create type estimation_status  as enum ('draft','sent','accepted','expired');

create type favorite_target    as enum ('idea','artist','studio','portfolio_image');
create type ai_preview_status  as enum ('draft','queued','processing','completed','failed');
create type journey_entry_type as enum ('idea','consultation','appointment','healing','milestone','completed');

create type notification_type  as enum ('message','booking_request','booking_update','offer','review','reward','follow','system');
create type reward_txn_type    as enum ('earn','redeem','adjust','expire','refund');
create type reward_reason      as enum ('signup','daily_active','save','message_sent','booking_completed','review_left','referral','redemption','manual_adjust');
create type reward_tier        as enum ('bronze','silver','gold','platinum');
create type moderation_status  as enum ('pending','approved','rejected');
