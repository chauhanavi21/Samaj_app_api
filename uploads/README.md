# Uploads Directory

This directory stores uploaded images and files for the application.

## Security Notes

- Files are validated for MIME type before upload
- Maximum file size is 5MB (configurable via MAX_FILE_SIZE env variable)
- Only image files are allowed (JPEG, PNG, GIF, WebP)
- Files are served statically via `/uploads/` route
- Access is controlled through admin authentication

## File Naming

Files are automatically renamed on upload to prevent conflicts:
`originalname-timestamp-randomnumber.ext`

Example: `profile-1643723456789-123456789.jpg`

## Maintenance

Periodically review and clean up unused files to save disk space.
