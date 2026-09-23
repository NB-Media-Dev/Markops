-- ============================================================================
-- MARKOPS PRODUCTION SEED DATA SCRIPT
-- Target RDBMS: MySQL 8.0+ / MySQL Workbench
-- Description: Inserts system roles and 1 primary Administrator user.
-- ============================================================================

USE `markops`;

SET FOREIGN_KEY_CHECKS = 0;

-- Clear all user and operational table records
TRUNCATE TABLE `transactions`;
TRUNCATE TABLE `conversions`;
TRUNCATE TABLE `follow_ups`;
TRUNCATE TABLE `call_activities`;
TRUNCATE TABLE `lead_status_history`;
TRUNCATE TABLE `lead_assignments`;
TRUNCATE TABLE `leads`;
TRUNCATE TABLE `task_attachments`;
TRUNCATE TABLE `task_comments`;
TRUNCATE TABLE `task_versions`;
TRUNCATE TABLE `task_progress_history`;
TRUNCATE TABLE `task_status_history`;
TRUNCATE TABLE `task_assignments`;
TRUNCATE TABLE `tasks`;
TRUNCATE TABLE `ad_metrics`;
TRUNCATE TABLE `ads`;
TRUNCATE TABLE `meta_sync_logs`;
TRUNCATE TABLE `meta_connections`;
TRUNCATE TABLE `campaigns`;
TRUNCATE TABLE `users`;
TRUNCATE TABLE `teams`;
TRUNCATE TABLE `role_permissions`;
TRUNCATE TABLE `permissions`;
TRUNCATE TABLE `roles`;

-- 1. Insert System Roles
-- 2. Insert Core Team
INSERT INTO `teams` (`id`, `name`, `description`) VALUES
('team_admin', 'System Administration', 'Core administrative operations');

-- 3. Insert Primary Administrator User
-- Default Email: admin@markops.io
-- Default Password: admin123 (Bcrypt Hash: $2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3BoB6tK3y/G)
INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `role_id`, `team_id`, `department`, `is_active`) VALUES
('usr_admin_01', 'admin@markops.io', '$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3BoB6tK3y/G', 'System Administrator', 'role_admin', 'team_admin', 'Executive Operations', 1);

SET FOREIGN_KEY_CHECKS = 1;
