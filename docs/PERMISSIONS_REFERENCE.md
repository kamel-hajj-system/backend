# Permissions Reference

Internal reference for developers. Permission names must match between backend and frontend.

| Permission Name       | Module / Page  | What the user can see / do                         | Default (Company) | Default (ServiceCenter) |
|-----------------------|----------------|----------------------------------------------------|--------------------|-------------------------|
| dashboard.view        | Portal         | Portal dashboard page                              | Yes                | Yes                     |
| users.view            | Super Admin    | Users list and user details                        | No                 | No                      |
| users.create          | Super Admin    | Create new users                                   | No                 | No                      |
| users.update          | Super Admin    | Update users                                       | No                 | No                      |
| users.delete          | Super Admin    | Soft delete users                                  | No                 | No                      |
| users.assign_role     | Super Admin    | Assign role to user                                | No                 | No                      |
| users.assign_permissions | Super Admin | Assign permissions to user                         | No                 | No                      |
| locations.view        | Super Admin    | View locations list                               | Yes                | Yes                     |
| locations.manage      | Super Admin    | Create, edit, activate/deactivate locations        | No                 | No                      |
| shifts.view           | Super Admin    | View shifts list                                   | Yes                | Yes                     |
| shifts.manage         | Super Admin    | Create and edit shifts                             | No                 | No                      |
| permissions.view      | Super Admin    | View permissions and default permissions           | No                 | No                      |
| permissions.manage    | Super Admin    | Create, edit, delete permissions; set defaults      | No                 | No                      |

- **Default**: Assigned automatically when a user is created (by userType). **Custom**: Assigned manually by Super Admin.
- Super Admin bypasses all permission checks and has full access.
