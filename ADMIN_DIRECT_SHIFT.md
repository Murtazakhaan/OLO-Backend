# Admin-Direct Shift Creation (Backend)

This backend change lets an **ADMIN** create and assign a shift without the participant submitting a request first. The participant flow remains unchanged; this is an additive path for admins.

## New Endpoint

- **POST `/api/shifts/admin/create`**
- **Auth:** Admin only (uses existing `authenticate` middleware + role check)
- **Body:**
  ```json
  {
    "participantId": "<User._id of participant>",
    "trainerId": "<Trainer._id>",
    "service": "service-code",
    "start": "2024-12-01T09:00:00Z",
    "end": "2024-12-01T11:00:00Z",
    "notes": "Optional notes"
  }
  ```
- **Behavior:**
  - Validates time window (end after start, not in the past, minimum 30 minutes).
  - Creates a **ShiftRequest** with status `APPROVED`, links `assignedTrainerId`, and sets `requestedBy` to the admin user.
  - No Shift is created until the trainer clocks in (existing `trainer/clock-in` flow).

## Notifications

On successful creation, the backend emails both the trainer and participant using the existing email service:
- Trainer: "New Shift Assigned" with date/time/service details.
- Participant: "A New Shift Has Been Scheduled" with the same details and assigned trainer name.

## Listings Impact

Because a full `ShiftRequest` is created with status `APPROVED` and `assignedTrainerId` set, these admin-created shifts automatically appear in existing listings:
- Participant views: `/api/shifts/participant/mine` and `/api/shifts/mine`
- Trainer views: `/api/shifts/trainer/mine` and `/api/shifts/mine`
- Admin views: `/api/shifts/admin/list`

## Frontend Integration Notes

- The frontend can reuse the existing "create shift request" form but hide it behind admin permissions and call the new endpoint.
- Expect the response shape to match other `ShiftRequest` documents (including `assignedTrainerId`, `status: "APPROVED"`, and timestamps).
- Clock-in/clock-out and timesheet flows are unchanged; trainers still initiate the actual Shift via `POST /api/shifts/trainer/clock-in` using the returned `requestId`.
