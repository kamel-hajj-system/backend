-- Perf: date-range scans on attendance lists; batch request lookups by requester/kind/status.
CREATE INDEX IF NOT EXISTS "attendance_records_shift_start_at_idx" ON "attendance_records" ("shift_start_at");

CREATE INDEX IF NOT EXISTS "attendance_requests_requester_id_kind_status_idx" ON "attendance_requests" ("requester_id", "kind", "status");
