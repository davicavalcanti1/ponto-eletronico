CREATE DATABASE IF NOT EXISTS ponto CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ponto;

CREATE TABLE IF NOT EXISTS employees (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  cpf           VARCHAR(14),
  role          VARCHAR(100),
  fingerprint_id INT UNIQUE COMMENT 'ID interno do leitor TechMag',
  active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS time_records (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  type        ENUM('entry','exit') NOT NULL,
  source      VARCHAR(50) NOT NULL DEFAULT 'biometric',
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE INDEX idx_time_records_employee ON time_records(employee_id);
CREATE INDEX idx_time_records_date ON time_records(recorded_at);
