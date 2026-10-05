-- database_setup.sql

CREATE DATABASE IF NOT EXISTS task_manager CHARACTER SET utf8mb4;
USE task_manager;

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(255) NOT NULL,
    description TEXT NULL,
    status      ENUM('todo', 'in_progress', 'done') NOT NULL DEFAULT 'todo',
    priority    ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'medium',
    due_date    DATE NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Documents: metadata stays in RDS; file bytes are stored privately in S3.
-- `content` remains nullable for backward compatibility with older DB-stored files.
CREATE TABLE IF NOT EXISTS documents (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    task_id       INT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type     VARCHAR(150) NOT NULL,
    size          INT NOT NULL,
    content       MEDIUMBLOB NULL,
    s3_key        VARCHAR(1024) NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_documents_task FOREIGN KEY (task_id)
        REFERENCES tasks(id) ON DELETE SET NULL
);

-- Sample data
INSERT INTO tasks (title, description, status, priority, due_date) VALUES
('Design the VPC', 'Public, private web, app and db subnets across 3 AZs', 'done', 'high', NULL),
('Deploy backend servers', 'Node.js API on EC2 behind the app ALB', 'in_progress', 'high', NULL),
('Write project documentation', 'Upload the architecture diagram and runbook', 'todo', 'medium', NULL);
