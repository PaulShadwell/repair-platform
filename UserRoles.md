# User Roles and Access

This document describes the current role-based access control (RBAC) rules enforced by the API.

## Roles at a glance

| Role | View Repairs | Create Repair | Assign Repair | Print Label | Edit POS Fields | Edit Repair Fields | Manage Users | Delete Repair | Archived View |
|---|---|---|---|---|---|---|---|---|---|
| ADMIN | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| SUPERVISOR | Yes | Yes | Yes | Yes | Yes | Yes | Yes | No | No |
| POS_USER | Yes | Yes | Yes | Yes | Yes | No | No | No | No |
| REPAIRER | Yes | No | Yes | Yes | No | Yes | No | No | No |

## What each role can change

### POS/intake fields (`repairs:edit_pos_fields`)

- `productType`
- `createdDate`
- `lastName`
- `city`
- `email`
- `phone`
- `itemName`
- `problemDescription`
- `assignedToUserId`

### Repair/work fields (`repairs:edit_repair_fields`)

- `successful`
- `outcome`
- `status`
- `fixDescription`
- `material`
- `safetyTested`
- `technicianNotes`
- `assignedToUserId`

## Role details

### ADMIN

- Full repair permissions (create, assign, print, update POS and repair/work fields)
- Full user management (`users:manage`)
- Can delete repairs
- Can view archived/completed repairs
- Can manage printer profiles and pairing codes

### SUPERVISOR

- Full day-to-day repair permissions (create, assign, print, update POS and repair/work fields)
- Full user management (`users:manage`)
- Can manage printer profiles and pairing codes
- Cannot delete repairs (admin-only)
- Cannot access archived view (admin-only)

### POS_USER

- Can create repairs, assign, print, and view repairs
- Can edit POS/intake fields only
- Cannot edit repair/work-only fields
- Cannot manage users
- Cannot delete repairs

### REPAIRER

- Can view repairs, assign, print, and update repair records
- Can edit repair/work fields only
- Cannot manage users
- Cannot delete repairs
- For `/repairs/:id/work`, user must be assigned to the repair (unless ADMIN or SUPERVISOR)

## User management permissions

Users with `users:manage` (ADMIN and SUPERVISOR) can:

- Create users
- View manage-users list
- Activate/deactivate users
- Reset user passwords
- Assign role sets

Safeguards:

- You cannot deactivate your own account
- You cannot remove your own `ADMIN` role

## Notes

- A user can have multiple roles. Effective permissions are the union of all assigned roles.
- UI visibility is role-aware, but API checks are the source of truth.
