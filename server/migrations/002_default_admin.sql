-- A first account to sign in with on a new site: admin / admin. Only on an
-- empty database, so an existing site is left as it is. The server warns at
-- startup while this password still works; change it under Account.
-- BOXPRESS_ADMIN_* (.env.example) replace this account with your own instead.
INSERT INTO users ( username, email, display_name, password_hash, role )
SELECT 'admin', 'admin@example.com', 'Admin', '$2a$10$ph/pzLictfIPl5cNMY5HWO/B3i0I8GROQBMZzZzvYbSmnYAmlf8/a', 'admin'
FROM DUAL
WHERE NOT EXISTS ( SELECT 1 FROM users );
