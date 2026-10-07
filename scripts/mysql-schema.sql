-- Julie Sufi — MySQL schema for database `juliesufi`
-- Import in phpMyAdmin or run: mysql -u root juliesufi < scripts/mysql-schema.sql

CREATE TABLE IF NOT EXISTS `collections` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `slug` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `image_url` TEXT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `published` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  UNIQUE KEY `collections_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `pages` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `slug` VARCHAR(255) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `intro` TEXT NOT NULL,
  `body` TEXT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `published` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  UNIQUE KEY `pages_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `products` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `collection_id` VARCHAR(64) NULL,
  `name` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `price` INT NULL,
  `price_label` VARCHAR(255) NOT NULL DEFAULT 'Private consultation',
  `image_url` TEXT NOT NULL,
  `secondary_image_url` TEXT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `featured` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(64) NOT NULL DEFAULT 'available',
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  UNIQUE KEY `products_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sections` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `page_id` VARCHAR(64) NOT NULL,
  `type` VARCHAR(64) NOT NULL DEFAULT 'editorial',
  `eyebrow` VARCHAR(255) NOT NULL DEFAULT '',
  `heading` VARCHAR(255) NOT NULL DEFAULT '',
  `copy` TEXT NOT NULL,
  `media_url` TEXT NOT NULL,
  `media_type` VARCHAR(32) NOT NULL DEFAULT 'image',
  `sort_order` INT NOT NULL DEFAULT 0,
  `published` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` VARCHAR(64) NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `site_settings` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(255) NOT NULL,
  `value_json` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(64) NOT NULL,
  UNIQUE KEY `site_settings_key_unique` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
