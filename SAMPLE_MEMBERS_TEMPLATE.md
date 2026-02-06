# Sample Authorized Members Template

## Instructions

1. Fill in the required columns: `memberId` and `phoneNumber`
2. Optional columns: `name`, `email`, `notes`
3. Save as Excel (.xlsx) or CSV (.csv) file
4. Import using: `npm run import-members path/to/your/file.xlsx`

## Column Details

- **memberId** (REQUIRED): Unique member identifier (e.g., M001, MEM123, TYS-001)
- **phoneNumber** (REQUIRED): Phone number (any format: with/without spaces, dashes, country code)
- **name** (Optional): Full name of the member
- **email** (Optional): Email address
- **notes** (Optional): Any additional information

## Sample Data

| memberId | phoneNumber   | name          | email               | notes                    |
|----------|---------------|---------------|---------------------|--------------------------|
| M001     | 9876543210    | John Doe      | john@example.com    | Active member since 2020 |
| M002     | 98765 43211   | Jane Smith    | jane@example.com    | Committee member         |
| M003     | 98765-43212   | Bob Johnson   | bob@example.com     |                          |
| M004     | (98765)43213  | Alice Brown   |                     | New member               |
| M005     | +919876543214 | Charlie Davis | charlie@example.com | Sponsor                  |
| M006     | 9876543215    | Diana Prince  |                     |                          |
| M007     | 9876543216    | Eve Wilson    | eve@example.com     |                          |
| M008     | 9876543217    | Frank Miller  | frank@example.com   | Committee head           |
| M009     | 9876543218    | Grace Lee     | grace@example.com   |                          |
| M010     | 9876543219    | Henry Taylor  |                     | Active volunteer         |

## Phone Number Formats Supported

All these formats will work correctly:
- `9876543210`
- `98765 43210`
- `98765-43210`
- `(98765) 43210`
- `+91 98765 43210`
- `+91-98765-43210`

The system automatically normalizes phone numbers by removing spaces, dashes, and parentheses.

## Important Notes

1. **Member IDs must be unique** - No duplicates allowed
2. **Phone numbers should be accurate** - Used for verification during signup
3. **Case doesn't matter** - System handles case-insensitive matching
4. **Re-importing is safe** - Existing members will be skipped
5. **Bulk import supported** - Can import thousands of members at once

## After Import

1. Check import summary for any errors
2. View imported members in admin panel: `/api/admin/authorized-members`
3. Members can now sign up with matching credentials
4. Mismatches will go to pending approval

---

**Need help?** Check `VERIFICATION_SYSTEM.md` for complete documentation.
