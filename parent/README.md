# Parent dashboard

Implemented in `frontend/src/Dashboards.jsx`, with Home, Progress, Schoolwork and Messages.
Select a fictional parent profile on the entry screen. Only that child's group,
progress, planner and conversation are shown. Group membership is read-only.
Teacher messages and parent replies share browser-local storage with the teacher
workspace; switch profiles to verify the conversation.

This is a device-local demonstration, not authenticated parent access. There is
no cross-device sync, external message delivery or automatic translation.
