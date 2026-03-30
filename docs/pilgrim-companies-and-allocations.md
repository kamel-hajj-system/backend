# Pilgrim Companies And Service Center Allocations

## Purpose

This model separates two different concepts that were previously mixed:

1. **Operating company (system tenant)**: has real system users and signs in to Kamel.
2. **Pilgrim company**: a business/reference entity for pilgrimage operations only, with no login users.

## Data Model

- `PilgrimCompany`
  - `externalCode` (manual ministry/sheet code, unique)
  - `name`, `nameAr`
  - `expectedPilgrimsCount` (official expected total at company level)
  - `mergedActualPilgrimsCount` (optional integration result)
  - `notes`
- `PilgrimCompanyNationality`
  - many-to-many link between pilgrim companies and nationalities
- `ServiceCenterPilgrimCompany`
  - allocation row per (`serviceCenterId`, `pilgrimCompanyId`)
  - `allocatedPilgrims`
- `PilgrimNationality`
  - reference-only data for labels/flags (`code`, `flagCode`, names, notes)

Removed old per-center nationality allocation table:

- `ServiceCenterNationality` (deleted)

## API Changes

### Service centers

- `POST /service-centers` and `PATCH /service-centers/:id` now accept:

```json
{
  "code": "110",
  "maxCapacity": 500,
  "companies": [
    { "pilgrimCompanyId": "uuid-1", "allocatedPilgrims": 120 },
    { "pilgrimCompanyId": "uuid-2", "allocatedPilgrims": 200 }
  ]
}
```

Validation rules:

- each pilgrim company appears once per center
- sum of `allocatedPilgrims` must be less than or equal to `maxCapacity` (when capacity exists)

### Pilgrim companies

New Super Admin endpoints:

- `GET /pilgrim-companies`
- `GET /pilgrim-companies/:id`
- `POST /pilgrim-companies`
- `PATCH /pilgrim-companies/:id`
- `DELETE /pilgrim-companies/:id`

Create/update supports `nationalityIds` array for many-to-many linkage.

### Reception

- `GET /reception/service-centers-overview` now returns service-center totals by pilgrim-company allocations and includes each center's company list.
- old nationality-overview endpoint is removed.

## Frontend Guidance

- Use clear labels:
  - **Operating company** for user/account contexts
  - **Pilgrim company** for operations/quota contexts
- Remove old “nationality totals per center” forms and replace with service-center company allocations.
