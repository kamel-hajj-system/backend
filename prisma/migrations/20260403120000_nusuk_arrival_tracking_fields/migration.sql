-- Portal-tracked arrival fields (not from Google Sheet import)
ALTER TABLE "nusuk_sheet_rows" ADD COLUMN     "arrival_flight_confirmed" BOOLEAN,
ADD COLUMN     "actual_arrival_status" VARCHAR(16),
ADD COLUMN     "actual_arrival_count" INTEGER;
