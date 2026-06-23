-- ============================================================
-- Roster — Row-Level Security (RLS) Policies
-- ============================================================
--
-- This file defines RLS policies for every table in the Roster schema.
-- Once applied, the database enforces access control at the row level —
-- even if the application code has a bug (e.g., a missing WHERE clause),
-- users can never read or modify data they don't have access to.
--
-- IMPORTANT: These policies assume the application connects with the
-- user's Supabase auth JWT (anon key + user session). Prisma connections
-- using the service_role key bypass RLS entirely.
--
-- Access model:
--   - SUPER_ADMIN / SCHOOL_ADMIN: full access to all clubs (global)
--   - Club members: read access to their clubs' data
--   - Club officers (PRESIDENT, VP, etc.): write access per their role
--   - Anonymous users: read access to public clubs only
--
-- The policies use a helper function `user_club_role()` that returns the
-- user's MembershipRole in a given club (or NULL if not a member).
-- ============================================================

-- Enable RLS on all tables (RLS is disabled by default)
-- We'll enable it table-by-table after creating the policies.

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get the current user's ID from the Supabase auth JWT.
-- Returns NULL if not authenticated.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claim.sub', true)::uuid,
    NULL
  );
$$;

-- Get the current user's global role (SUPER_ADMIN, SCHOOL_ADMIN, etc.)
-- Looks up the User table by supabaseAuthId.
CREATE OR REPLACE FUNCTION roster.user_global_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::TEXT FROM "User"
  WHERE "supabaseAuthId" = auth.uid()::text
  LIMIT 1;
$$;

-- Check if the current user is a super admin or school admin (global bypass).
CREATE OR REPLACE FUNCTION roster.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "User"
    WHERE "supabaseAuthId" = auth.uid()::text
      AND role IN ('SUPER_ADMIN', 'SCHOOL_ADMIN')
  );
$$;

-- Get the current user's membership role in a specific club.
-- Returns NULL if not a member or membership is not ACTIVE.
CREATE OR REPLACE FUNCTION roster.user_club_role(club_id TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT m.role::TEXT
  FROM "Membership" m
  JOIN "User" u ON u.id = m."userId"
  WHERE u."supabaseAuthId" = auth.uid()::text
    AND m."clubId" = club_id
    AND m.status = 'ACTIVE'
  LIMIT 1;
$$;

-- Check if the current user can read a club's data.
-- True if: admin, OR active member, OR club is public.
CREATE OR REPLACE FUNCTION roster.can_read_club(club_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    roster.is_admin()
    OR roster.user_club_role(club_id) IS NOT NULL
    OR EXISTS (SELECT 1 FROM "Club" WHERE id = club_id AND "isPublic" = true);
$$;

-- Check if the current user can write to a club (officer-level).
-- True if: admin, OR has a role with club:write permission.
CREATE OR REPLACE FUNCTION roster.can_write_club(club_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    roster.is_admin()
    OR roster.user_club_role(club_id) IN (
      'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'COMMITTEE_HEAD'
    );
$$;

-- Check if the current user can manage members in a club.
CREATE OR REPLACE FUNCTION roster.can_manage_members(club_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    roster.is_admin()
    OR roster.user_club_role(club_id) IN (
      'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'COMMITTEE_HEAD'
    );
$$;

-- Check if the current user can manage events in a club.
CREATE OR REPLACE FUNCTION roster.can_manage_events(club_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    roster.is_admin()
    OR roster.user_club_role(club_id) IN (
      'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'COMMITTEE_HEAD'
    );
$$;

-- Check if the current user can manage finance in a club.
CREATE OR REPLACE FUNCTION roster.can_manage_finance(club_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    roster.is_admin()
    OR roster.user_club_role(club_id) IN (
      'PRESIDENT', 'VICE_PRESIDENT', 'TREASURER'
    );
$$;

-- ============================================================
-- USER TABLE
-- ============================================================
-- Users can read their own profile.
-- Admins can read all profiles.
-- Users can update their own profile (limited fields).

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_read_self ON "User"
  FOR SELECT USING (
    "supabaseAuthId" = auth.uid()::text
    OR roster.is_admin()
    -- Allow reading basic info of users in shared clubs (for member lists)
    OR EXISTS (
      SELECT 1 FROM "Membership" m1
      JOIN "Membership" m2 ON m1."clubId" = m2."clubId"
      JOIN "User" u1 ON u1.id = m1."userId"
      JOIN "User" u2 ON u2.id = m2."userId"
      WHERE u1."supabaseAuthId" = auth.uid()::text
        AND u2.id = "User".id
        AND m1.status = 'ACTIVE'
        AND m2.status = 'ACTIVE'
    )
  );

CREATE POLICY user_update_self ON "User"
  FOR UPDATE USING ("supabaseAuthId" = auth.uid()::text OR roster.is_admin());

-- ============================================================
-- CLUB TABLE
-- ============================================================
-- Anyone can read public clubs. Members can read their clubs. Officers can write.

ALTER TABLE "Club" ENABLE ROW LEVEL SECURITY;

CREATE POLICY club_read ON "Club"
  FOR SELECT USING (
    "isPublic" = true
    OR roster.can_read_club(id)
  );

CREATE POLICY club_write ON "Club"
  FOR ALL USING (roster.can_write_club(id))
  WITH CHECK (roster.can_write_club(id));

-- ============================================================
-- MEMBERSHIP TABLE
-- ============================================================
-- Members can read memberships in their clubs. Officers can manage.

ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;

CREATE POLICY membership_read ON "Membership"
  FOR SELECT USING (
    roster.can_read_club("clubId")
    OR "userId" IN (
      SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text
    )
  );

CREATE POLICY membership_write ON "Membership"
  FOR ALL USING (roster.can_manage_members("clubId"))
  WITH CHECK (roster.can_manage_members("clubId"));

-- ============================================================
-- EVENT TABLE
-- ============================================================

ALTER TABLE "Event" ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_read ON "Event"
  FOR SELECT USING (
    roster.can_read_club("clubId")
  );

CREATE POLICY event_write ON "Event"
  FOR ALL USING (roster.can_manage_events("clubId"))
  WITH CHECK (roster.can_manage_events("clubId"));

-- ============================================================
-- ATTENDANCE TABLE
-- ============================================================
-- Members can read their own attendance. Officers can read/write all.

ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;

CREATE POLICY attendance_read ON "Attendance"
  FOR SELECT USING (
    "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
    OR roster.can_read_club(
      (SELECT "clubId" FROM "Event" WHERE id = "Attendance"."eventId")
    )
  );

CREATE POLICY attendance_write ON "Attendance"
  FOR ALL USING (roster.can_manage_events(
    (SELECT "clubId" FROM "Event" WHERE id = "Attendance"."eventId")
  ))
  WITH CHECK (roster.can_manage_events(
    (SELECT "clubId" FROM "Event" WHERE id = "Attendance"."eventId")
  ));

-- ============================================================
-- CHECK-IN TABLE
-- ============================================================

ALTER TABLE "CheckIn" ENABLE ROW LEVEL SECURITY;

CREATE POLICY checkin_read ON "CheckIn"
  FOR SELECT USING (
    "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
    OR roster.can_read_club(
      (SELECT "clubId" FROM "Event" WHERE id = "CheckIn"."eventId")
    )
  );

CREATE POLICY checkin_write ON "CheckIn"
  FOR ALL USING (roster.can_manage_events(
    (SELECT "clubId" FROM "Event" WHERE id = "CheckIn"."eventId")
  ))
  WITH CHECK (roster.can_manage_events(
    (SELECT "clubId" FROM "Event" WHERE id = "CheckIn"."eventId")
  ));

-- ============================================================
-- EVENT RSVP TABLE
-- ============================================================

ALTER TABLE "EventRSVP" ENABLE ROW LEVEL SECURITY;

CREATE POLICY rsvp_read ON "EventRSVP"
  FOR SELECT USING (
    "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
    OR roster.can_read_club(
      (SELECT "clubId" FROM "Event" WHERE id = "EventRSVP"."eventId")
    )
  );

CREATE POLICY rsvp_write ON "EventRSVP"
  FOR ALL USING (
    "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
    OR roster.can_manage_events(
      (SELECT "clubId" FROM "Event" WHERE id = "EventRSVP"."eventId")
    )
  )
  WITH CHECK (
    "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
    OR roster.can_manage_events(
      (SELECT "clubId" FROM "Event" WHERE id = "EventRSVP"."eventId")
    )
  );

-- ============================================================
-- ANNOUNCEMENT TABLE
-- ============================================================

ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;

CREATE POLICY announcement_read ON "Announcement"
  FOR SELECT USING (roster.can_read_club("clubId"));

CREATE POLICY announcement_write ON "Announcement"
  FOR ALL USING (roster.can_write_club("clubId"))
  WITH CHECK (roster.can_write_club("clubId"));

-- ============================================================
-- CLUB SETTING TABLE
-- ============================================================

ALTER TABLE "ClubSetting" ENABLE ROW LEVEL SECURITY;

CREATE POLICY settings_read ON "ClubSetting"
  FOR SELECT USING (roster.can_read_club("clubId"));

CREATE POLICY settings_write ON "ClubSetting"
  FOR ALL USING (roster.can_write_club("clubId"))
  WITH CHECK (roster.can_write_club("clubId"));

-- ============================================================
-- TRANSACTION TABLE
-- ============================================================

ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY transaction_read ON "Transaction"
  FOR SELECT USING (roster.can_read_club("clubId"));

CREATE POLICY transaction_write ON "Transaction"
  FOR ALL USING (roster.can_manage_finance("clubId"))
  WITH CHECK (roster.can_manage_finance("clubId"));

-- ============================================================
-- BUDGET TABLE
-- ============================================================

ALTER TABLE "Budget" ENABLE ROW LEVEL SECURITY;

CREATE POLICY budget_read ON "Budget"
  FOR SELECT USING (roster.can_read_club("clubId"));

CREATE POLICY budget_write ON "Budget"
  FOR ALL USING (roster.can_manage_finance("clubId"))
  WITH CHECK (roster.can_manage_finance("clubId"));

-- ============================================================
-- VOLUNTEER HOURS TABLE
-- ============================================================

ALTER TABLE "VolunteerHours" ENABLE ROW LEVEL SECURITY;

CREATE POLICY volunteer_read ON "VolunteerHours"
  FOR SELECT USING (
    "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
    OR roster.can_read_club("clubId")
  );

CREATE POLICY volunteer_write ON "VolunteerHours"
  FOR ALL USING (
    "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
    OR roster.can_manage_members("clubId")
  )
  WITH CHECK (
    "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
    OR roster.can_manage_members("clubId")
  );

-- ============================================================
-- POLL TABLE + OPTIONS + VOTES
-- ============================================================

ALTER TABLE "Poll" ENABLE ROW LEVEL SECURITY;
CREATE POLICY poll_read ON "Poll" FOR SELECT USING (roster.can_read_club("clubId"));
CREATE POLICY poll_write ON "Poll" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

ALTER TABLE "PollOption" ENABLE ROW LEVEL SECURITY;
CREATE POLICY poll_option_read ON "PollOption" FOR SELECT USING (
  roster.can_read_club((SELECT "clubId" FROM "Poll" WHERE id = "PollOption"."pollId"))
);
CREATE POLICY poll_option_write ON "PollOption" FOR ALL USING (
  roster.can_write_club((SELECT "clubId" FROM "Poll" WHERE id = "PollOption"."pollId"))
) WITH CHECK (
  roster.can_write_club((SELECT "clubId" FROM "Poll" WHERE id = "PollOption"."pollId"))
);

ALTER TABLE "PollVote" ENABLE ROW LEVEL SECURITY;
CREATE POLICY poll_vote_read ON "PollVote" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_read_club((SELECT "clubId" FROM "Poll" WHERE id = "PollVote"."pollId"))
);
CREATE POLICY poll_vote_write ON "PollVote" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  AND roster.can_read_club((SELECT "clubId" FROM "Poll" WHERE id = "PollVote"."pollId"))
);

-- ============================================================
-- FORM + RESPONSES
-- ============================================================

ALTER TABLE "Form" ENABLE ROW LEVEL SECURITY;
CREATE POLICY form_read ON "Form" FOR SELECT USING (roster.can_read_club("clubId"));
CREATE POLICY form_write ON "Form" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

ALTER TABLE "FormResponse" ENABLE ROW LEVEL SECURITY;
CREATE POLICY form_response_read ON "FormResponse" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_read_club((SELECT "clubId" FROM "Form" WHERE id = "FormResponse"."formId"))
);
CREATE POLICY form_response_write ON "FormResponse" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_write_club((SELECT "clubId" FROM "Form" WHERE id = "FormResponse"."formId"))
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_write_club((SELECT "clubId" FROM "Form" WHERE id = "FormResponse"."formId"))
);

-- ============================================================
-- TASK + TASK LIST
-- ============================================================

ALTER TABLE "TaskList" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasklist_read ON "TaskList" FOR SELECT USING (roster.can_read_club("clubId"));
CREATE POLICY tasklist_write ON "TaskList" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
CREATE POLICY task_read ON "Task" FOR SELECT USING (
  roster.can_read_club("clubId")
  OR "assigneeId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);
CREATE POLICY task_write ON "Task" FOR ALL USING (
  roster.can_write_club("clubId")
  OR "assigneeId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
) WITH CHECK (roster.can_write_club("clubId"));

-- ============================================================
-- COMMITTEE + MEMBERS
-- ============================================================

ALTER TABLE "Committee" ENABLE ROW LEVEL SECURITY;
CREATE POLICY committee_read ON "Committee" FOR SELECT USING (roster.can_read_club("clubId"));
CREATE POLICY committee_write ON "Committee" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

ALTER TABLE "CommitteeMember" ENABLE ROW LEVEL SECURITY;
CREATE POLICY committee_member_read ON "CommitteeMember" FOR SELECT USING (
  roster.can_read_club((SELECT "clubId" FROM "Committee" WHERE id = "CommitteeMember"."committeeId"))
  OR "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);
CREATE POLICY committee_member_write ON "CommitteeMember" FOR ALL USING (
  roster.can_write_club((SELECT "clubId" FROM "Committee" WHERE id = "CommitteeMember"."committeeId"))
) WITH CHECK (
  roster.can_write_club((SELECT "clubId" FROM "Committee" WHERE id = "CommitteeMember"."committeeId"))
);

-- ============================================================
-- RESOURCE + BOOKINGS
-- ============================================================

ALTER TABLE "Resource" ENABLE ROW LEVEL SECURITY;
CREATE POLICY resource_read ON "Resource" FOR SELECT USING (roster.can_read_club("clubId"));
CREATE POLICY resource_write ON "Resource" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

ALTER TABLE "ResourceBooking" ENABLE ROW LEVEL SECURITY;
CREATE POLICY booking_read ON "ResourceBooking" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_read_club((SELECT "clubId" FROM "Resource" WHERE id = "ResourceBooking"."resourceId"))
);
CREATE POLICY booking_write ON "ResourceBooking" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_write_club((SELECT "clubId" FROM "Resource" WHERE id = "ResourceBooking"."resourceId"))
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_write_club((SELECT "clubId" FROM "Resource" WHERE id = "ResourceBooking"."resourceId"))
);

-- ============================================================
-- INVENTORY + LOANS + MAINTENANCE
-- ============================================================

ALTER TABLE "InventoryItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_read ON "InventoryItem" FOR SELECT USING (roster.can_read_club("clubId"));
CREATE POLICY inventory_write ON "InventoryItem" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

ALTER TABLE "InventoryLoan" ENABLE ROW LEVEL SECURITY;
CREATE POLICY loan_read ON "InventoryLoan" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_read_club((SELECT "clubId" FROM "InventoryItem" WHERE id = "InventoryLoan"."itemId"))
);
CREATE POLICY loan_write ON "InventoryLoan" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_write_club((SELECT "clubId" FROM "InventoryItem" WHERE id = "InventoryLoan"."itemId"))
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_write_club((SELECT "clubId" FROM "InventoryItem" WHERE id = "InventoryLoan"."itemId"))
);

ALTER TABLE "MaintenanceLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY maintenance_read ON "MaintenanceLog" FOR SELECT USING (
  roster.can_read_club((SELECT "clubId" FROM "InventoryItem" WHERE id = "MaintenanceLog"."itemId"))
);
CREATE POLICY maintenance_write ON "MaintenanceLog" FOR ALL USING (
  roster.can_write_club((SELECT "clubId" FROM "InventoryItem" WHERE id = "MaintenanceLog"."itemId"))
) WITH CHECK (
  roster.can_write_club((SELECT "clubId" FROM "InventoryItem" WHERE id = "MaintenanceLog"."itemId"))
);

-- ============================================================
-- DOCUMENT + COMMENTS + MEETING MINUTES
-- ============================================================

ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_read ON "Document" FOR SELECT USING (
  roster.can_read_club("clubId")
  OR ("isPublic" = true)
);
CREATE POLICY document_write ON "Document" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

ALTER TABLE "DocumentComment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY doc_comment_read ON "DocumentComment" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_read_club((SELECT "clubId" FROM "Document" WHERE id = "DocumentComment"."documentId"))
);
CREATE POLICY doc_comment_write ON "DocumentComment" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);

ALTER TABLE "MeetingMinutes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY minutes_read ON "MeetingMinutes" FOR SELECT USING (roster.can_read_club("clubId"));
CREATE POLICY minutes_write ON "MeetingMinutes" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

-- ============================================================
-- NOTIFICATION TABLE
-- ============================================================
-- Users can only see their own notifications.

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_read ON "Notification" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);
CREATE POLICY notification_write ON "Notification" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.is_admin()
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.is_admin()
);

-- ============================================================
-- BADGE + USER BADGE
-- ============================================================

ALTER TABLE "Badge" ENABLE ROW LEVEL SECURITY;
CREATE POLICY badge_read ON "Badge" FOR SELECT USING (roster.can_read_club("clubId"));
CREATE POLICY badge_write ON "Badge" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

ALTER TABLE "UserBadge" ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_badge_read ON "UserBadge" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_read_club((SELECT "clubId" FROM "Badge" WHERE id = "UserBadge"."badgeId"))
);
CREATE POLICY user_badge_write ON "UserBadge" FOR ALL USING (
  roster.can_write_club((SELECT "clubId" FROM "Badge" WHERE id = "UserBadge"."badgeId"))
) WITH CHECK (
  roster.can_write_club((SELECT "clubId" FROM "Badge" WHERE id = "UserBadge"."badgeId"))
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
-- Only officers+ can read audit logs. Anyone can create (the app logs actions).

ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_read ON "AuditLog" FOR SELECT USING (
  roster.is_admin()
  OR EXISTS (
    SELECT 1 FROM "Membership" m
    JOIN "User" u ON u.id = m."userId"
    WHERE u."supabaseAuthId" = auth.uid()::text
      AND m."clubId" = "AuditLog"."clubId"
      AND m.role IN ('PRESIDENT', 'VICE_PRESIDENT', 'COMMITTEE_HEAD')
      AND m.status = 'ACTIVE'
  )
);
CREATE POLICY audit_write ON "AuditLog" FOR INSERT WITH CHECK (true);
-- Note: audit logs are append-only — no UPDATE or DELETE policies (denied by default).

-- ============================================================
-- CLUB APPLICATION
-- ============================================================

ALTER TABLE "ClubApplication" ENABLE ROW LEVEL SECURITY;
CREATE POLICY application_read ON "ClubApplication" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_manage_members("clubId")
);
CREATE POLICY application_write ON "ClubApplication" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_manage_members("clubId")
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_manage_members("clubId")
);

-- ============================================================
-- AI INSIGHT
-- ============================================================

ALTER TABLE "AiInsight" ENABLE ROW LEVEL SECURITY;
CREATE POLICY insight_read ON "AiInsight" FOR SELECT USING (
  roster.can_read_club("clubId")
  OR "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);
CREATE POLICY insight_write ON "AiInsight" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

-- ============================================================
-- WEBHOOK
-- ============================================================

ALTER TABLE "Webhook" ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhook_read ON "Webhook" FOR SELECT USING (roster.can_write_club("clubId"));
CREATE POLICY webhook_write ON "Webhook" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

-- ============================================================
-- EMAIL TEMPLATE + QUEUE + LOG
-- ============================================================

ALTER TABLE "EmailTemplate" ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_template_read ON "EmailTemplate" FOR SELECT USING (roster.can_write_club("clubId"));
CREATE POLICY email_template_write ON "EmailTemplate" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

ALTER TABLE "EmailQueue" ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_queue_read ON "EmailQueue" FOR SELECT USING (roster.can_write_club("clubId") OR "clubId" IS NULL);
CREATE POLICY email_queue_write ON "EmailQueue" FOR ALL USING (true) WITH CHECK (true);
-- Email queue is written by the application (service role) — broad policy.

ALTER TABLE "EmailLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_log_read ON "EmailLog" FOR SELECT USING (roster.can_write_club("clubId"));
-- Email logs are insert-only (no UPDATE/DELETE).

ALTER TABLE "SmsLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY sms_log_read ON "SmsLog" FOR SELECT USING (roster.can_write_club("clubId"));

-- ============================================================
-- CONVERSATION + PARTICIPANTS + MESSAGES
-- ============================================================

ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY conversation_read ON "Conversation" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "ConversationParticipant" cp
    JOIN "User" u ON u.id = cp."userId"
    WHERE cp."conversationId" = "Conversation".id
      AND u."supabaseAuthId" = auth.uid()::text
  )
  OR (roster.can_read_club("clubId") AND "clubId" IS NOT NULL)
);
CREATE POLICY conversation_write ON "Conversation" FOR ALL USING (
  roster.can_read_club("clubId")
) WITH CHECK (roster.can_read_club("clubId"));

ALTER TABLE "ConversationParticipant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY participant_read ON "ConversationParticipant" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR EXISTS (
    SELECT 1 FROM "ConversationParticipant" cp2
    JOIN "User" u ON u.id = cp2."userId"
    WHERE cp2."conversationId" = "ConversationParticipant"."conversationId"
      AND u."supabaseAuthId" = auth.uid()::text
  )
);
CREATE POLICY participant_write ON "ConversationParticipant" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);

ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
CREATE POLICY message_read ON "Message" FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "ConversationParticipant" cp
    JOIN "User" u ON u.id = cp."userId"
    WHERE cp."conversationId" = "Message"."conversationId"
      AND u."supabaseAuthId" = auth.uid()::text
  )
);
CREATE POLICY message_write ON "Message" FOR ALL USING (
  "senderId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
) WITH CHECK (
  "senderId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);

-- ============================================================
-- PHOTO ALBUM + PHOTO
-- ============================================================

ALTER TABLE "PhotoAlbum" ENABLE ROW LEVEL SECURITY;
CREATE POLICY album_read ON "PhotoAlbum" FOR SELECT USING (
  roster.can_read_club("clubId")
  OR "isPublic" = true
);
CREATE POLICY album_write ON "PhotoAlbum" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

ALTER TABLE "Photo" ENABLE ROW LEVEL SECURITY;
CREATE POLICY photo_read ON "Photo" FOR SELECT USING (
  roster.can_read_club((SELECT "clubId" FROM "PhotoAlbum" WHERE id = "Photo"."albumId"))
  OR (SELECT "isPublic" FROM "PhotoAlbum" WHERE id = "Photo"."albumId") = true
);
CREATE POLICY photo_write ON "Photo" FOR ALL USING (
  roster.can_write_club((SELECT "clubId" FROM "PhotoAlbum" WHERE id = "Photo"."albumId"))
) WITH CHECK (
  roster.can_write_club((SELECT "clubId" FROM "PhotoAlbum" WHERE id = "Photo"."albumId"))
);

-- ============================================================
-- ALUMNI PROFILE
-- ============================================================

ALTER TABLE "AlumniProfile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY alumni_read ON "AlumniProfile" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_read_club("clubId")
);
CREATE POLICY alumni_write ON "AlumniProfile" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_write_club("clubId")
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_write_club("clubId")
);

-- ============================================================
-- CUSTOM FIELD
-- ============================================================

ALTER TABLE "CustomField" ENABLE ROW LEVEL SECURITY;
CREATE POLICY custom_field_read ON "CustomField" FOR SELECT USING (
  roster.can_read_club("clubId")
  OR EXISTS (
    SELECT 1 FROM "Form" f WHERE f.id = "CustomField"."formId"
    AND roster.can_read_club(f."clubId")
  )
);
CREATE POLICY custom_field_write ON "CustomField" FOR ALL USING (roster.can_write_club("clubId")) WITH CHECK (roster.can_write_club("clubId"));

-- ============================================================
-- CLUB INVITE
-- ============================================================

ALTER TABLE "ClubInvite" ENABLE ROW LEVEL SECURITY;
CREATE POLICY invite_read ON "ClubInvite" FOR SELECT USING (
  roster.can_manage_members("clubId")
);
CREATE POLICY invite_write ON "ClubInvite" FOR ALL USING (roster.can_manage_members("clubId")) WITH CHECK (roster.can_manage_members("clubId"));

-- ============================================================
-- SAVED VIEW
-- ============================================================

ALTER TABLE "SavedView" ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_view_read ON "SavedView" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);
CREATE POLICY saved_view_write ON "SavedView" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);

-- ============================================================
-- API KEY
-- ============================================================

ALTER TABLE "ApiKey" ENABLE ROW LEVEL SECURITY;
CREATE POLICY api_key_read ON "ApiKey" FOR SELECT USING (
  roster.can_write_club("clubId")
  OR ("clubId" IS NULL AND roster.is_admin())
);
CREATE POLICY api_key_write ON "ApiKey" FOR ALL USING (
  roster.can_write_club("clubId")
  OR ("clubId" IS NULL AND roster.is_admin())
) WITH CHECK (
  roster.can_write_club("clubId")
  OR ("clubId" IS NULL AND roster.is_admin())
);

-- ============================================================
-- DIGEST SUBSCRIPTION
-- ============================================================

ALTER TABLE "DigestSubscription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY digest_read ON "DigestSubscription" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);
CREATE POLICY digest_write ON "DigestSubscription" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);

-- ============================================================
-- ATTENDANCE EXCUSE
-- ============================================================

ALTER TABLE "AttendanceExcuse" ENABLE ROW LEVEL SECURITY;
CREATE POLICY excuse_read ON "AttendanceExcuse" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_read_club((SELECT "clubId" FROM "Event" WHERE id = "AttendanceExcuse"."eventId"))
);
CREATE POLICY excuse_write ON "AttendanceExcuse" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_manage_events((SELECT "clubId" FROM "Event" WHERE id = "AttendanceExcuse"."eventId"))
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_manage_events((SELECT "clubId" FROM "Event" WHERE id = "AttendanceExcuse"."eventId"))
);

-- ============================================================
-- ATTENDANCE REMINDER
-- ============================================================

ALTER TABLE "AttendanceReminder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY reminder_read ON "AttendanceReminder" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_read_club((SELECT "clubId" FROM "Event" WHERE id = "AttendanceReminder"."eventId"))
);
CREATE POLICY reminder_write ON "AttendanceReminder" FOR ALL USING (
  roster.can_manage_events((SELECT "clubId" FROM "Event" WHERE id = "AttendanceReminder"."eventId"))
) WITH CHECK (
  roster.can_manage_events((SELECT "clubId" FROM "Event" WHERE id = "AttendanceReminder"."eventId"))
);

-- ============================================================
-- MEMBER OFFBOARDING
-- ============================================================

ALTER TABLE "MemberOffboarding" ENABLE ROW LEVEL SECURITY;
CREATE POLICY offboarding_read ON "MemberOffboarding" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_manage_members("clubId")
);
CREATE POLICY offboarding_write ON "MemberOffboarding" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_manage_members("clubId")
) WITH CHECK (roster.can_manage_members("clubId"));

-- ============================================================
-- EVENT WAITLIST
-- ============================================================

ALTER TABLE "EventWaitlist" ENABLE ROW LEVEL SECURITY;
CREATE POLICY waitlist_read ON "EventWaitlist" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_read_club((SELECT "clubId" FROM "Event" WHERE id = "EventWaitlist"."eventId"))
);
CREATE POLICY waitlist_write ON "EventWaitlist" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_manage_events((SELECT "clubId" FROM "Event" WHERE id = "EventWaitlist"."eventId"))
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.can_manage_events((SELECT "clubId" FROM "Event" WHERE id = "EventWaitlist"."eventId"))
);

-- ============================================================
-- RECURRENCE RULE
-- ============================================================

ALTER TABLE "RecurrenceRule" ENABLE ROW LEVEL SECURITY;
CREATE POLICY recurrence_read ON "RecurrenceRule" FOR SELECT USING (roster.can_read_club("clubId"));
CREATE POLICY recurrence_write ON "RecurrenceRule" FOR ALL USING (roster.can_manage_events("clubId")) WITH CHECK (roster.can_manage_events("clubId"));

-- ============================================================
-- PARENT GUARDIAN
-- ============================================================

ALTER TABLE "ParentGuardian" ENABLE ROW LEVEL SECURITY;
CREATE POLICY parent_guardian_read ON "ParentGuardian" FOR SELECT USING (
  "parentId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR "studentId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.is_admin()
);
CREATE POLICY parent_guardian_write ON "ParentGuardian" FOR ALL USING (
  "parentId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.is_admin()
) WITH CHECK (
  "parentId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.is_admin()
);

-- ============================================================
-- PARENT PORTAL TOKEN
-- ============================================================

ALTER TABLE "ParentPortalToken" ENABLE ROW LEVEL SECURITY;
CREATE POLICY parent_token_read ON "ParentPortalToken" FOR SELECT USING (
  "parentId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
  OR roster.is_admin()
);
CREATE POLICY parent_token_write ON "ParentPortalToken" FOR ALL USING (
  roster.is_admin()
) WITH CHECK (roster.is_admin());

-- ============================================================
-- ANNOUNCEMENT READ
-- ============================================================

ALTER TABLE "AnnouncementRead" ENABLE ROW LEVEL SECURITY;
CREATE POLICY announcement_read_track ON "AnnouncementRead" FOR SELECT USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);
CREATE POLICY announcement_read_write ON "AnnouncementRead" FOR ALL USING (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
) WITH CHECK (
  "userId" IN (SELECT id FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)
);

-- ============================================================
-- DONE
-- ============================================================
-- RLS is now enabled on all application tables. The service_role key
-- bypasses RLS (used by Prisma for server-side queries). Client-side
-- queries via the Supabase JS client (with the anon key + user JWT)
-- are subject to these policies.
--
-- To verify policies are working:
--   SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
--   -- Should show rowsecurity = true for all tables listed above.
