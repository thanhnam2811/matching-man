-- Backfill: give every organization member an explicit ProjectMember row on
-- every project in their organization, mirroring their current org role. This
-- is a one-time catch-up for the additive access gate added in
-- ProjectAccessGuard/ProjectsService — see
-- docs/superpowers/specs/2026-07-17-project-members-access-enforcement-design.md.
-- It does not keep future org members in sync with existing projects; new
-- members must be granted project access explicitly going forward.
INSERT INTO "project_members" ("id", "project_id", "user_id", "role", "created_at")
SELECT
    substr(md5(random()::text || clock_timestamp()::text || p.id || om.user_id), 1, 24),
    p.id,
    om.user_id,
    om.role,
    CURRENT_TIMESTAMP
FROM "projects" p
JOIN "organization_members" om ON om.organization_id = p.organization_id
WHERE NOT EXISTS (
    SELECT 1
    FROM "project_members" pm
    WHERE pm.project_id = p.id
      AND pm.user_id = om.user_id
);
